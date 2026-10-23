// ML-498: a band's notice to its members ("rehearsal moved to Thursday"). See db/migrations/150 and
// docs/notifications.md ("A band's notice"). The owner's answers, 23 Oct 2026:
//   * one way only: a title and a message to everyone in the band - nobody can reply, and nothing else is asked;
//   * sent by an organiser, a member who can change the band's music, or the band leader - and only to their own band;
//   * 3 a day and 10 a week per band (Admin -> Feature access, Limits), title up to 120 characters, message up to 1000;
//   * the member sees who sent it and which band; a member can switch them off (Settings -> Notifications).
// A notice reaches young players, so the sender confirms once that they are an adult (the same confirmation an
// organiser gives - docs/online-safety-assessment.md, version 4). It sits in the list with the red dot, never pops up,
// can be reported, and the owner can withdraw it on Admin -> Notifications.
import pool from '../config/db.js';
import { withStatus } from './flows.js';
import { isFeatureEnabled, getLimit } from './features.js';
import { accountDisplayName } from './accounts.js';

export const BAND_NOTICE_TITLE_MAX = 120;
export const BAND_NOTICE_BODY_MAX = 1000;
const KEEP_DAYS = 30; // shown for 30 days, then the 12-month clear-up (ML-494) takes it
const SENDER_ROLES = ['admin', 'owner', 'member']; // an organiser ('owner' is the older word) or "change music"

export const NOTICE_ADULT_FIRST = 'A notice goes to everyone in the band, and some of them may be young players. Confirm that you are 18 or over before you send one.';
export const NOTICE_NAME_FIRST = 'The notice says who it is from, so add your name before you send one. It is on My account, under My details.';

// Pure - unit tested. Who may send: an organiser, a member who can change music, or the band leader.
export function canSendBandNotice(role, isBandLeader) {
  return SENDER_ROLES.includes(role) || !!isBandLeader;
}

// Pure - unit tested. The title and message, tidied and checked.
export function checkBandNotice({ title, body } = {}) {
  const t = String(title ?? '').trim();
  const b = String(body ?? '').trim();
  if (!t) throw withStatus(400, 'Give the notice a title.');
  if (t.length > BAND_NOTICE_TITLE_MAX) throw withStatus(400, `Keep the title to ${BAND_NOTICE_TITLE_MAX} characters.`);
  if (!b) throw withStatus(400, 'Write the message.');
  if (b.length > BAND_NOTICE_BODY_MAX) throw withStatus(400, `Keep the message to ${BAND_NOTICE_BODY_MAX} characters.`);
  return { title: t, body: b };
}

// Pure - unit tested. How many the band has left, from when its recent notices went (newest or oldest first, any
// order), and when the next one can go if none are left. `now` is a Date.
export function bandNoticeAllowance(sentTimes, { perDay, perWeek }, now = new Date()) {
  const DAY = 24 * 60 * 60 * 1000;
  const times = sentTimes.map(t => new Date(t).getTime()).filter(t => now.getTime() - t < 7 * DAY).sort((a, b) => a - b);
  const inDay = times.filter(t => now.getTime() - t < DAY);
  const leftToday = Math.max(0, Math.min(perDay - inDay.length, perWeek - times.length));
  let nextAt = null;
  if (!leftToday) {
    // the day's limit frees up when the oldest of the last day's goes past 24 hours; the week's, past 7 days
    const dayFree = inDay.length >= perDay ? inDay[inDay.length - perDay] + DAY : 0;
    const weekFree = times.length >= perWeek ? times[times.length - perWeek] + 7 * DAY : 0;
    nextAt = new Date(Math.max(dayFree, weekFree));
  }
  return { perDay, perWeek, leftToday, leftThisWeek: Math.max(0, perWeek - times.length), nextAt };
}

async function membership(accountId, bandId) {
  if (!/^\d+$/.test(String(bandId))) throw withStatus(404, 'Band not found');
  const { rows } = await pool.query(
    `SELECT bm.role, bm.is_band_leader, b.name FROM band_members bm JOIN bands b ON b.id = bm.band_id AND b.kind = 'group'
      WHERE bm.band_id = $1 AND bm.account_id = $2`, [bandId, accountId]);
  if (!rows.length) throw withStatus(404, 'Band not found'); // a band you aren't in doesn't exist as far as you can tell
  return rows[0];
}

async function limits() {
  return { perDay: await getLimit('band_notices_day', 3), perWeek: await getLimit('band_notices_week', 10) };
}

async function recentSends(db, bandId) {
  const { rows } = await db.query(
    `SELECT created_at FROM notifications WHERE kind = 'band_notice' AND (details->>'bandId')::bigint = $1 AND created_at > now() - interval '7 days'`,
    [bandId]);
  return rows.map(r => r.created_at);
}

// The words a member sees under the title: "From Sam Smith, The Cobham Band".
export function fromWords(senderName, bandName) {
  return `From ${senderName || 'someone in the band'}, ${bandName || 'your band'}`;
}

// For the band's Members page: whether you can send, how many are left, and what the band sent lately. Only for
// those who can send - nobody else is told anything here (they get the notices themselves).
export async function bandNoticesForMember(accountId, bandId) {
  const m = await membership(accountId, bandId);
  if (!canSendBandNotice(m.role, m.is_band_leader)) return { canSend: false };
  const allowance = bandNoticeAllowance(await recentSends(pool, bandId), await limits());
  const { rows } = await pool.query(
    `SELECT n.id, n.title, n.body, n.created_at, n.withdrawn_at, a.display_name, a.first_name, a.surname
       FROM notifications n LEFT JOIN accounts a ON a.id = n.created_by_account_id
      WHERE n.kind = 'band_notice' AND (n.details->>'bandId')::bigint = $1
      ORDER BY n.created_at DESC, n.id DESC LIMIT 10`, [bandId]);
  return {
    canSend: true,
    ...allowance,
    sent: rows.map(r => ({ id: Number(r.id), title: r.title, body: r.body, sentAt: r.created_at, from: accountDisplayName({ ...r, email: null }) || 'Someone in the band', withdrawn: !!r.withdrawn_at }))
  };
}

// Send it: to everyone in the band but the sender who gets notices from the app (the notification centre and band
// notices on for their account type) and hasn't switched band notices off. A fixed list, made now.
export async function sendBandNotice(accountId, bandId, data) {
  const m = await membership(accountId, bandId);
  if (!canSendBandNotice(m.role, m.is_band_leader)) throw withStatus(403, "Only the band's organisers, the members who can change its music and its band leader can send the band a notice.");
  const words = checkBandNotice(data);
  const { rows: [me] } = await pool.query('SELECT display_name, first_name, surname, organiser_adult_confirmed_on FROM accounts WHERE id = $1', [accountId]);
  if (!accountDisplayName({ ...me, email: null })) throw Object.assign(withStatus(409, NOTICE_NAME_FIRST), { reason: 'needs-name' });
  if (!me.organiser_adult_confirmed_on) throw Object.assign(withStatus(409, NOTICE_ADULT_FIRST), { reason: 'needs-adult' });

  const { rows: members } = await pool.query(
    `SELECT a.id, a.account_level FROM band_members bm JOIN accounts a ON a.id = bm.account_id
      WHERE bm.band_id = $1 AND bm.account_id <> $2 AND a.deleted_at IS NULL AND a.closed_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM notice_preferences p WHERE p.account_id = a.id AND p.kind = 'band_notice' AND NOT p.enabled)`,
    [bandId, accountId]);
  const to = [];
  for (const r of members) {
    if (await isFeatureEnabled('band_notices', r.account_level) && await isFeatureEnabled('notifications', r.account_level)) to.push(String(r.id));
  }
  if (!to.length) throw withStatus(409, 'Nobody else in this band gets notices from the app yet, so nothing was sent.');

  const max = await limits();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // one band's sends one at a time, so two people sending at once can't both take the last one left
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`band_notice:${bandId}`]);
    const allowance = bandNoticeAllowance(await recentSends(client, bandId), max);
    if (!allowance.leftToday) {
      const when = allowance.nextAt.toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'long', hour: '2-digit', minute: '2-digit' });
      throw withStatus(429, `The band has sent ${max.perDay} notices in a day or ${max.perWeek} in a week, the most it can. The next one can go on ${when}.`);
    }
    const { rows } = await client.query(
      `INSERT INTO notifications (title, body, audience, publish_at, expires_at, kind, details, created_by_account_id)
       VALUES ($1, $2, 'accounts', now(), now() + make_interval(days => $3), 'band_notice', $4, $5) RETURNING id`,
      [words.title, words.body, KEEP_DAYS, { bandId: Number(bandId) }, accountId]);
    await client.query('INSERT INTO notification_recipients (notification_id, account_id) SELECT $1, unnest($2::bigint[])', [rows[0].id, to]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  return { ...(await bandNoticesForMember(accountId, bandId)), sentTo: to.length };
}
