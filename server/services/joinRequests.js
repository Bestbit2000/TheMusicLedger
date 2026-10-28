// ML-580: the waiting list on the public page (docs/waiting-list.md). Someone asks to join from the front door;
// the owner lets them in, passes the request to a band's organiser, or turns it down, on Admin -> Waiting list.
//
// What the form never does, by the owner's decisions (22 Oct 2026):
//  - send an email to the person asking - so it can't be used to email a stranger's address; their first email is
//    an invitation. (The owner himself is told of a new request - tellTheOwner, 26 Oct 2026.)
//  - say whether an address is already a member, already waiting or closed - every answer is the same;
//  - load anything from outside (no CAPTCHA): a field only robots fill in, a check that the form wasn't sent a
//    moment after the page opened, and a limit per sender keep robots out. The sender is counted by a scrambled
//    copy of their address (a hash), never the address itself, and the count is gone within a day.
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import pool from '../config/db.js';
import { isFeatureLive } from './features.js';
import { createInvite, normaliseEmail, limitJoinRequests } from './passwordAuth.js';
import { signInWaysOn } from './signInWays.js';
import { emailIsShutOut } from './tokenVersions.js';
import { createTargetedNotification } from './notifications.js';
import { sendMail } from './mail.js';
import { buildEmail } from './emailBuild.js';
import { EMAILS } from './emailCatalogue.js';
import { wordingFor } from './emailWording.js';
import { inviteToBand, joinBandsAskedFor, bandInviteAllowance } from './bands.js';

// ML-625: "Did you mean...?" - the same rules the form uses (public/bandMatch.js), loaded with vm like flows.js loads
// the journey engine
const bandMatchSandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/bandMatch.js', import.meta.url), 'utf8'), bandMatchSandbox);
const BandMatch = bandMatchSandbox.self.BandMatch;

const fail = (status, message) => Object.assign(new Error(message), { status });
const looksLikeEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
export const JOIN_KEPT_DAYS = 90;
export const MIN_FILL_MS = 3000; // a person takes longer than this to fill in four boxes
export const THANKS = "Thanks - we'll email you if we can let you in.";

// A band in the directory as the form offers it - its name, and its town when it has one, so two bands of the
// same name can be told apart. The same words are matched back when the form is sent.
export const bandLabel = (b) => (b.town ? `${b.name} (${b.town})` : b.name);
const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Pure - unit tested. The form's fields -> what to keep, or { drop: true } for a robot (answered as if kept),
// or an error a person can act on.
export function readJoinForm(body = {}, now = Date.now()) {
  if (clean(body.website, 200)) return { drop: true };                         // the field only robots fill in
  const started = Number(body.started);
  if (Number.isFinite(started) && started > 0 && now - started < MIN_FILL_MS) return { drop: true };
  const firstName = clean(body.firstName, 80);
  const lastName = clean(body.lastName, 80);
  const email = normaliseEmail(body.email);
  if (!firstName || !lastName) return { error: 'Please give your first name and last name.' };
  if (!looksLikeEmail(email)) return { error: 'Please give an email address we can write to.' };
  const ageOk = body.ageConfirmed === true || body.ageConfirmed === 'on' || body.ageConfirmed === 'true';
  if (!ageOk) return { error: 'If you are under 13, please ask a parent or carer to fill this in for you.' };
  const band = clean(body.band, 120);
  const instrumentId = Number(body.instrumentId) > 0 ? Number(body.instrumentId) : null;
  return { firstName, lastName, email, band: band || null, instrumentId };
}

// The open lists the form offers: the directory's bands and the app's instruments. Nothing about any member.
export async function joinOptions() {
  if (!(await isFeatureLive('waiting_list'))) return { open: false };
  const [bands, instruments] = await Promise.all([
    pool.query(`SELECT id, name, town FROM bands WHERE kind = 'directory' AND active ORDER BY lower(name), town`),
    pool.query('SELECT id, name FROM instruments WHERE active ORDER BY lower(name)')
  ]);
  return { open: true, bands: bands.rows.map(bandLabel), instruments: instruments.rows.map((i) => ({ id: Number(i.id), name: i.name })) };
}

export async function submitJoinRequest(body, ip) {
  if (!(await isFeatureLive('waiting_list'))) throw fail(404, 'Not found');
  const form = readJoinForm(body);
  if (form.drop) return { ok: true, message: THANKS };
  if (form.error) throw fail(400, form.error);
  await limitJoinRequests(crypto.createHash('sha256').update(`join:${ip || ''}`).digest('hex'));
  let directoryBandId = null;
  let bandName = form.band;
  if (bandName) {
    const { rows } = await pool.query(
      `SELECT id FROM bands WHERE kind = 'directory' AND active
          AND (lower(name) = lower($1) OR (town IS NOT NULL AND lower(name || ' (' || town || ')') = lower($1)))`, [bandName]);
    if (rows.length === 1) { directoryBandId = Number(rows[0].id); bandName = null; }
  }
  const instrument = form.instrumentId ? (await pool.query('SELECT id, name FROM instruments WHERE id = $1 AND active', [form.instrumentId])).rows[0] : null;
  // Asking twice keeps one request, with the latest answers. xmax = 0 only on a row just made: a new request.
  const { rows: kept } = await pool.query(
    `INSERT INTO join_requests (first_name, last_name, email, directory_band_id, band_name, instrument_id, age_confirmed)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     ON CONFLICT ((lower(email))) DO UPDATE SET first_name = $1, last_name = $2, directory_band_id = $4, band_name = $5,
       instrument_id = $6, updated_at = now()
     RETURNING (xmax = 0) AS is_new`,
    [form.firstName, form.lastName, form.email, directoryBandId, bandName, instrument ? instrument.id : null]);
  if (kept[0]?.is_new) {
    await tellTheOwner({ ...form, band: directoryBandId ? form.band : bandName, instrument: instrument ? instrument.name : null });
  }
  return { ok: true, message: THANKS };
}

// The owner is emailed when someone new asks (his request, 26 Oct 2026), so he knows to look at Admin -> Waiting
// list. It goes to one address of ours, never to the one typed in the form - so the form still can't be used to
// email a stranger. It doesn't carry their email address (that stays on the page). Asking again isn't news, and
// after JOIN_ALERTS_A_DAY new requests in a day the rest wait quietly on the list, so a crowd of robots can't fill
// the inbox or use up the day's emails. A failed email changes nothing for the person asking.
export const JOIN_ALERT_TO = 'info@notablybetter.com';
export const JOIN_ALERTS_A_DAY = 30; // a whole band (25) may ask on one day (owner, 26 Oct 2026)
// ML-618: the words are on Admin -> Email wording (alert_join); wording - the built-in wording if none
export function joinAlertEmail({ firstName, lastName, band, instrument }, wording = EMAILS.alert_join.builtIn) {
  const mail = buildEmail('alert_join', wording, { name: `${firstName} ${lastName}`, band: band || 'none given', plays: instrument || 'not given' });
  return { ...mail, subject: mail.subject.slice(0, 150) };
}
async function tellTheOwner(request) {
  try {
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM join_requests WHERE created_at > now() - interval '1 day'");
    if (rows[0].n > JOIN_ALERTS_A_DAY) return false;
    await sendMail({ to: process.env.JOIN_ALERT_EMAIL || JOIN_ALERT_TO, ...joinAlertEmail(request, await wordingFor('alert_join')), toOwner: true }); // ML-617: no signature
    return true;
  } catch (error) {
    console.error('Waiting list: the owner could not be emailed:', error.message);
    return false;
  }
}

// ---- Admin -> Waiting list (super admins, server/routes/admin.js) ----
// ML-646: the bands the owner organises (shared spaces where he is an organiser) - the only bands Let in can put
// someone into. A super admin never puts anyone into someone else's band; for those it's Pass to the organiser.
async function bandsIOrganise(adminAccountId) {
  if (!adminAccountId) return [];
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.directory_band_id FROM band_members m JOIN bands g ON g.id = m.band_id AND g.kind = 'group'
      WHERE m.account_id = $1 AND m.role IN ('admin', 'owner') ORDER BY lower(g.name)`, [adminAccountId]);
  return rows.map((g) => ({ id: Number(g.id), name: g.name, directoryBandId: g.directory_band_id ? Number(g.directory_band_id) : null }));
}
export async function listJoinRequests(adminAccountId = null) {
  const { rows } = await pool.query(
    `SELECT r.id, r.first_name, r.last_name, r.email, r.band_name, r.created_at, r.updated_at,
            d.id AS directory_band_id, d.name AS directory_name, d.town AS directory_town, i.name AS instrument,
            EXISTS (SELECT 1 FROM accounts a WHERE lower(a.email) = lower(r.email) AND a.deleted_at IS NULL) AS is_member
       FROM join_requests r
       LEFT JOIN bands d ON d.id = r.directory_band_id
       LEFT JOIN instruments i ON i.id = r.instrument_id
      ORDER BY r.updated_at DESC`);
  // ML-625: a band typed in that isn't in the directory gets the directory bands it most likely means
  const labels = rows.some((r) => r.band_name && !r.directory_band_id)
    ? (await pool.query(`SELECT name, town FROM bands WHERE kind = 'directory' AND active ORDER BY lower(name), town`)).rows.map(bandLabel) : [];
  const mine = await bandsIOrganise(adminAccountId);
  const out = [];
  for (const r of rows) {
    // The shared spaces for the band they named, with how many organisers each has - where it can be passed on
    const spaces = r.directory_band_id ? (await pool.query(
      `SELECT g.id, g.name, (SELECT count(*)::int FROM band_members m WHERE m.band_id = g.id AND m.role = 'admin') AS organisers
         FROM bands g WHERE g.kind = 'group' AND g.directory_band_id = $1 ORDER BY g.created_at`, [r.directory_band_id])).rows : [];
    out.push({
      id: Number(r.id), firstName: r.first_name, lastName: r.last_name, email: r.email,
      band: r.directory_name ? bandLabel({ name: r.directory_name, town: r.directory_town }) : r.band_name,
      fromDirectory: !!r.directory_name, instrument: r.instrument, askedOn: r.updated_at,
      suggestions: r.band_name && !r.directory_band_id ? [...BandMatch.suggest(r.band_name, labels)] : [],
      isMember: r.is_member, closed: await emailIsShutOut(r.email),
      spaces: spaces.filter((s) => s.organisers > 0).map((s) => ({ id: Number(s.id), name: s.name, organisers: s.organisers })),
      // ML-646: the band(s) of the owner's that are the band they asked to join - Let in starts with these picked
      myBandIds: r.directory_band_id ? mine.filter((g) => g.directoryBandId === Number(r.directory_band_id)).map((g) => g.id) : []
    });
  }
  // Let in is the ordinary invitation: Google, or a password where that is switched on (SIGN_IN_WAYS) - so it needs
  // a way in, and Google always is one
  return {
    requests: out, keptDays: JOIN_KEPT_DAYS, canLetIn: (await signInWaysOn()).length > 0,
    myBands: mine.map(({ id, name }) => ({ id, name })), // ML-646
    allowance: adminAccountId ? await bandInviteAllowance(adminAccountId) : null
  };
}
// ML-625: the band they typed is one of the directory's after all ("Cobham" - Cobham Brass Band): the owner ties the
// request to it on Admin -> Waiting list, so it can be passed to that band's organiser. By the label the list shows.
export async function matchJoinRequestBand(id, label, adminAccountId = null) {
  const r = await oneRequest(id);
  const { rows } = await pool.query(
    `SELECT id FROM bands WHERE kind = 'directory' AND active AND lower(name || coalesce(' (' || town || ')', '')) = lower($1)`, [String(label || '')]);
  if (rows.length !== 1) throw fail(400, 'That band is not in the directory.');
  await pool.query('UPDATE join_requests SET directory_band_id = $1, band_name = NULL WHERE id = $2', [rows[0].id, r.id]);
  return listJoinRequests(adminAccountId);
}
export const LET_IN_NEEDS = 'Let in sends an invitation, and no way of signing in is switched on on this site.';

export async function joinRequestCount() {
  return (await pool.query('SELECT count(*)::int AS n FROM join_requests')).rows[0].n;
}

async function oneRequest(id) {
  const { rows } = await pool.query(
    `SELECT r.*, i.name AS instrument FROM join_requests r LEFT JOIN instruments i ON i.id = r.instrument_id WHERE r.id = $1`, [id]);
  if (!rows.length) throw fail(404, 'That request has already been dealt with.');
  return rows[0];
}

// Let in: the ordinary invitation email (a Standard member), then the request goes.
// ML-646 (owner, 28 Oct 2026): with `bands` - bands the owner organises - they go straight in: a band place is kept
// for each (from_request, no band email: the invitation says it) and taken up at their first sign-in, with what they
// may do (`level`: play / change / organiser). Someone who already has an account is put in at once (Add to band) and
// told in the app. Each band counts against the owner's band invitation allowance.
const named = (list) => list.length <= 1 ? (list[0] || '') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
export async function letInJoinRequest(id, adminAccountId, origin, { bands = [], level = 'play' } = {}) {
  const r = await oneRequest(id);
  const mine = await bandsIOrganise(adminAccountId);
  const chosen = [...new Set((Array.isArray(bands) ? bands : []).map(Number))].map((b) => mine.find((g) => g.id === b));
  if (chosen.some((g) => !g)) throw fail(403, "You can only let someone in to a band you organise. For another band, use Pass to the organiser.");
  if (chosen.length) {
    const a = await bandInviteAllowance(adminAccountId);
    if (a.left < chosen.length) throw fail(429, `That needs ${chosen.length} band invitation${chosen.length === 1 ? '' : 's'} and you have ${a.left} left.`);
  }
  const { rows: [member] } = await pool.query('SELECT id FROM accounts WHERE lower(email) = lower($1) AND deleted_at IS NULL', [r.email]);
  let invite = null;
  if (!member) {
    if (!(await signInWaysOn()).length) throw fail(409, LET_IN_NEEDS); // createInvite's own answer would be "Not found"
    invite = await createInvite({ email: r.email, firstName: r.first_name, surname: r.last_name, accountLevel: 'standard_member', createdBy: adminAccountId, origin, bands: named(chosen.map((g) => g.name)) });
  } else if (!chosen.length) {
    throw fail(409, 'They already have an account. Choose a band to add them to, or use Not now.');
  }
  for (const g of chosen) await inviteToBand(adminAccountId, g.id, r.email, level, origin, { email: false, fromRequest: true });
  const joined = member ? await joinBandsAskedFor(member.id) : [];
  await pool.query('DELETE FROM join_requests WHERE id = $1', [id]);
  return { invite, joined: joined.length, ...(await listJoinRequests(adminAccountId)) };
}

// ML-646: "Let in everyone asking for The Cobham Band" - every request on the list tied to the band's directory entry,
// at one level. One failing (a closed address, no allowance left) doesn't stop the rest; the answer says how many.
export async function letInAllForBand(groupId, adminAccountId, origin, level = 'play') {
  const g = (await bandsIOrganise(adminAccountId)).find((b) => b.id === Number(groupId));
  if (!g || !g.directoryBandId) throw fail(403, "You can only let people in to a band you organise.");
  const { rows } = await pool.query('SELECT id, email FROM join_requests WHERE directory_band_id = $1 ORDER BY created_at', [g.directoryBandId]);
  let letIn = 0;
  const notLetIn = [];
  for (const r of rows) {
    if (await emailIsShutOut(r.email)) { notLetIn.push(`${r.email}: a closed account`); continue; }
    try { await letInJoinRequest(r.id, adminAccountId, origin, { bands: [g.id], level }); letIn++; } catch (error) { notLetIn.push(`${r.email}: ${error.message}`); }
  }
  return { letIn, notLetIn, ...(await listJoinRequests(adminAccountId)) };
}

// Pass to the organiser: the shared space's organisers get a notice with who asked; they decide whether to invite
// (the band's own invitation, ML-473). Only that band's organisers see it. The request then goes.
export async function passJoinRequest(id, groupId, adminAccountId) {
  const r = await oneRequest(id);
  const { rows: group } = await pool.query(`SELECT id, name FROM bands WHERE id = $1 AND kind = 'group' AND directory_band_id = $2`, [groupId, r.directory_band_id]);
  if (!group.length) throw fail(400, 'That band has no shared space to pass this to.');
  const { rows: organisers } = await pool.query(`SELECT account_id FROM band_members WHERE band_id = $1 AND role = 'admin'`, [groupId]);
  if (!organisers.length) throw fail(400, 'That band has no organiser to pass this to.');
  const who = `${r.first_name} ${r.last_name}`;
  const plays = r.instrument ? ` They play the ${r.instrument}.` : '';
  // Shown for 30 days, like an invitation; the 12-month clear-up (clearOldRecords) then deletes it
  const noticeId = await createTargetedNotification(adminAccountId, {
    title: `${who} asked to join ${group[0].name}`.slice(0, 120),
    body: `${who} asked through the Notably Better website to join ${group[0].name}.${plays} To invite them, open the band on My bands, choose Members and invite ${r.email}. If you don't know them, you can leave it - nothing is sent to them unless you invite them.`
  }, organisers.map((o) => o.account_id));
  if (noticeId) await pool.query(`UPDATE notifications SET expires_at = now() + interval '30 days' WHERE id = $1`, [noticeId]);
  await pool.query('DELETE FROM join_requests WHERE id = $1', [id]);
  return listJoinRequests(adminAccountId);
}

export async function dismissJoinRequest(id, adminAccountId = null) {
  await pool.query('DELETE FROM join_requests WHERE id = $1', [id]);
  return listJoinRequests(adminAccountId);
}
