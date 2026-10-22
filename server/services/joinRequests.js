// ML-580: the waiting list on the public page (docs/waiting-list.md). Someone asks to join from the front door;
// the owner lets them in, passes the request to a band's organiser, or turns it down, on Admin -> Waiting list.
//
// What the form never does, by the owner's decisions (22 Oct 2026):
//  - send an email - so it can't be used to email a stranger's address; the first email is an invitation;
//  - say whether an address is already a member, already waiting or closed - every answer is the same;
//  - load anything from outside (no CAPTCHA): a field only robots fill in, a check that the form wasn't sent a
//    moment after the page opened, and a limit per sender keep robots out. The sender is counted by a scrambled
//    copy of their address (a hash), never the address itself, and the count is gone within a day.
import crypto from 'node:crypto';
import pool from '../config/db.js';
import { isFeatureLive } from './features.js';
import { createInvite, normaliseEmail, limitJoinRequests, passwordLoginEnabled } from './passwordAuth.js';
import { emailIsShutOut } from './tokenVersions.js';
import { createTargetedNotification } from './notifications.js';

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
  const instrument = form.instrumentId ? (await pool.query('SELECT id FROM instruments WHERE id = $1 AND active', [form.instrumentId])).rows[0] : null;
  // Asking twice keeps one request, with the latest answers
  await pool.query(
    `INSERT INTO join_requests (first_name, last_name, email, directory_band_id, band_name, instrument_id, age_confirmed)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     ON CONFLICT ((lower(email))) DO UPDATE SET first_name = $1, last_name = $2, directory_band_id = $4, band_name = $5,
       instrument_id = $6, updated_at = now()`,
    [form.firstName, form.lastName, form.email, directoryBandId, bandName, instrument ? instrument.id : null]);
  return { ok: true, message: THANKS };
}

// ---- Admin -> Waiting list (super admins, server/routes/admin.js) ----
export async function listJoinRequests() {
  const { rows } = await pool.query(
    `SELECT r.id, r.first_name, r.last_name, r.email, r.band_name, r.created_at, r.updated_at,
            d.id AS directory_band_id, d.name AS directory_name, d.town AS directory_town, i.name AS instrument,
            EXISTS (SELECT 1 FROM accounts a WHERE lower(a.email) = lower(r.email) AND a.deleted_at IS NULL) AS is_member
       FROM join_requests r
       LEFT JOIN bands d ON d.id = r.directory_band_id
       LEFT JOIN instruments i ON i.id = r.instrument_id
      ORDER BY r.updated_at DESC`);
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
      isMember: r.is_member, closed: await emailIsShutOut(r.email),
      spaces: spaces.filter((s) => s.organisers > 0).map((s) => ({ id: Number(s.id), name: s.name, organisers: s.organisers }))
    });
  }
  // Let in is the email-and-password invitation, so it needs that sign-in switched on (password_login Live)
  return { requests: out, keptDays: JOIN_KEPT_DAYS, canLetIn: await passwordLoginEnabled() };
}
export const LET_IN_NEEDS = 'Let in sends the email-and-password invitation, and email and password sign-in is switched off on this site. Switch on "Email and password login" (Live) on Admin -> Feature access first.';

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
export async function letInJoinRequest(id, adminAccountId, origin) {
  if (!(await passwordLoginEnabled())) throw fail(409, LET_IN_NEEDS); // createInvite's own answer would be "Not found"
  const r = await oneRequest(id);
  const invite = await createInvite({ email: r.email, firstName: r.first_name, surname: r.last_name, accountLevel: 'standard_member', createdBy: adminAccountId, origin });
  await pool.query('DELETE FROM join_requests WHERE id = $1', [id]);
  return { invite, ...(await listJoinRequests()) };
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
  return listJoinRequests();
}

export async function dismissJoinRequest(id) {
  await pool.query('DELETE FROM join_requests WHERE id = $1', [id]);
  return listJoinRequests();
}
