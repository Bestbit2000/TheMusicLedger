// ML-497 / ML-501: notices the app sends itself when something happens to a member's things, and which ones a
// member gets. See db/migrations/142_automatic_notices.sql and docs/notifications.md ("Automatic notices").
//
// The owner's rules (21 Oct 2026): they name the band, never the person who did it; they sit in the list with
// the red dot, never pop up; new pieces and practice lists are one notice a day per band, added to while it is
// unread; every kind is on until the member switches it off. Behind the auto_notices feature (and the
// notification centre), checked for the member it is for.
//
// Sending never stops what caused it: every send is wrapped, and a failure is only logged.
import pool from '../config/db.js';
import { isFeatureEnabled } from './features.js';

// The kinds a member chooses between, in Settings -> Notifications (ML-501), with their words. Each is shown only
// while its feature is on for the member's account type: the automatic notices (auto_notices), a band's notices
// (band_notices, ML-498) and email copies of urgent notices (notice_emails, ML-499).
export const NOTICE_KINDS = [
  { key: 'band_invite', title: 'Invitations to a band', sub: 'When an organiser invites you to join a band.', feature: 'auto_notices' },
  { key: 'band_change', title: 'Changes in a band', sub: 'When what you can do in a band changes, you are made its band leader, or you are taken out of it.', feature: 'auto_notices' },
  { key: 'band_news', title: 'New music in your bands', sub: 'New pieces and practice lists - one notice a day for each band.', feature: 'auto_notices' },
  { key: 'piece_deleted', title: 'A piece you added is deleted', sub: 'When someone else deletes a piece you added to a band.', feature: 'auto_notices' },
  { key: 'band_notice', title: 'Notices from my bands', sub: 'When someone who runs one of your bands sends the band a notice.', feature: 'band_notices' },
  { key: 'email_urgent', title: 'Email me a copy of urgent notices', sub: 'Notices about how your information is used are always emailed.', feature: 'notice_emails' },
];
async function kindsOnHere() {
  const out = [];
  for (const k of NOTICE_KINDS) if (await isFeatureEnabled(k.feature)) out.push(k);
  return out;
}
const CHOICE_OF = { band_invite: 'band_invite', band_level: 'band_change', band_removed: 'band_change', band_leader: 'band_change', band_news: 'band_news', piece_deleted: 'piece_deleted' };
// How long each stays: an invitation as long as one waits (30 days, ML-473), the rest 90 days; then the 12-month
// clear-up (ML-494) takes them.
const KEEP_DAYS = { band_invite: 30 };
const MAX_TITLE = 120;
const clip = (s) => (s.length > MAX_TITLE ? `${s.slice(0, MAX_TITLE - 3).trimEnd()}...` : s);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const log = (what) => (error) => console.error(`Automatic notice (${what}) not sent:`, error.message);

// ---------- ML-501: the member's choices ----------
export async function getNoticePreferences(accountId) {
  const { rows } = await pool.query('SELECT kind, enabled FROM notice_preferences WHERE account_id = $1', [accountId]);
  const off = new Set(rows.filter(r => !r.enabled).map(r => r.kind));
  return { kinds: (await kindsOnHere()).map(({ feature, ...k }) => ({ ...k, enabled: !off.has(k.key) })) };
}
export async function setNoticePreference(accountId, kind, enabled) {
  if (!(await kindsOnHere()).some(k => k.key === kind)) throw Object.assign(new Error('Unknown kind of notice.'), { status: 400 });
  await pool.query(
    `INSERT INTO notice_preferences (account_id, kind, enabled) VALUES ($1, $2, $3)
     ON CONFLICT (account_id, kind) DO UPDATE SET enabled = $3, updated_at = now()`,
    [accountId, kind, enabled === true]);
  return getNoticePreferences(accountId);
}

// The accounts out of these that get a notice of this kind: still here, with the notification centre and
// automatic notices switched on for their account type, and the kind not switched off.
async function whoGets(accountIds, kind) {
  const ids = [...new Set((accountIds || []).filter(Boolean).map(String))];
  if (!ids.length) return [];
  const { rows } = await pool.query(
    `SELECT a.id, a.account_level FROM accounts a
      WHERE a.id = ANY($1::bigint[]) AND a.deleted_at IS NULL AND a.closed_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM notice_preferences p WHERE p.account_id = a.id AND p.kind = $2 AND NOT p.enabled)`,
    [ids, CHOICE_OF[kind]]);
  const out = [];
  for (const r of rows) {
    if (await isFeatureEnabled('auto_notices', r.account_level) && await isFeatureEnabled('notifications', r.account_level)) out.push(String(r.id));
  }
  return out;
}

// expiresAt: when it goes, if not the kind's usual days from now (ML-649: an invitation's notice made late still
// goes when the invitation does)
async function send(accountIds, kind, { title, body, details = null, groupKey = null, expiresAt = null }) {
  const to = await whoGets(accountIds, kind);
  if (!to.length) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO notifications (title, body, audience, publish_at, expires_at, kind, details, group_key)
       VALUES ($1, $2, 'accounts', now(), COALESCE($7::timestamptz, now() + make_interval(days => $3)), $4, $5, $6) RETURNING id`,
      [clip(title), body, KEEP_DAYS[kind] || 90, kind, details, groupKey, expiresAt]);
    await client.query('INSERT INTO notification_recipients (notification_id, account_id) SELECT $1, unnest($2::bigint[])', [rows[0].id, to]);
    await client.query('COMMIT');
    return Number(rows[0].id);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
const bandName = async (bandId) => (await pool.query('SELECT name FROM bands WHERE id = $1', [bandId])).rows[0]?.name || 'your band';

// ---------- the four kinds ----------

// 1. An invitation to a band is waiting - for someone already using the app (anyone else gets only its email).
export function noticeBandInvite(bandId, email) {
  return (async () => {
    const { rows } = await pool.query(
      `SELECT i.id, a.id AS account_id FROM band_invites i JOIN accounts a ON lower(a.email) = lower(i.email) AND a.deleted_at IS NULL
        WHERE i.band_id = $1 AND i.email = $2`, [bandId, email]);
    if (!rows.length) return;
    const key = `band_invite:${rows[0].id}`;
    const live = await pool.query('SELECT 1 FROM notifications WHERE group_key = $1 AND withdrawn_at IS NULL AND (expires_at IS NULL OR expires_at > now())', [key]);
    if (live.rows.length) return; // sent again: the notice already waiting is enough
    const band = await bandName(bandId);
    await send([rows[0].account_id], 'band_invite', { title: `You're invited to join ${band}`, body: 'See My bands to say yes or no.', details: { bandId: Number(bandId) }, groupKey: key });
  })().catch(log('band invite'));
}
// ML-649: an invitation sent before the address had an account made no notice (there was nobody to give it to).
// This makes the notice for every invitation still waiting for the account's address that has no live notice -
// when an account is made, when its address changes, and for everyone in the daily job (which also catches the
// ones missed before this). Each goes when its invitation would (30 days from when it was sent).
const INVITE_DAYS = KEEP_DAYS.band_invite;
export function noticeWaitingBandInvites(accountId) {
  return (async () => {
    const { rows } = await pool.query(
      `SELECT i.id, i.band_id, i.created_at + make_interval(days => $2) AS goes FROM band_invites i
         JOIN accounts a ON lower(a.email) = lower(i.email) AND a.deleted_at IS NULL
        WHERE a.id = $1 AND i.created_at > now() - make_interval(days => $2)
          AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.group_key = 'band_invite:' || i.id AND n.withdrawn_at IS NULL
                            AND (n.expires_at IS NULL OR n.expires_at > now()))`, [accountId, INVITE_DAYS]);
    for (const r of rows) {
      const band = await bandName(r.band_id);
      await send([accountId], 'band_invite', { title: `You're invited to join ${band}`, body: 'See My bands to say yes or no.', details: { bandId: Number(r.band_id) }, groupKey: `band_invite:${r.id}`, expiresAt: r.goes });
    }
  })().catch(log('waiting band invites'));
}
// The daily job's catch-up: every account with an invitation waiting and no notice about it.
export async function noticeAllWaitingBandInvites() {
  const { rows } = await pool.query(
    `SELECT DISTINCT a.id FROM band_invites i JOIN accounts a ON lower(a.email) = lower(i.email) AND a.deleted_at IS NULL
      WHERE i.created_at > now() - make_interval(days => $1)
        AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.group_key = 'band_invite:' || i.id AND n.withdrawn_at IS NULL
                          AND (n.expires_at IS NULL OR n.expires_at > now()))`, [INVITE_DAYS]);
  for (const r of rows) await noticeWaitingBandInvites(r.id);
  return rows.length;
}
// ...and once it has been answered (or cancelled) the notice goes.
export function withdrawBandInviteNotice(inviteId) {
  return pool.query('UPDATE notifications SET withdrawn_at = now() WHERE group_key = $1 AND withdrawn_at IS NULL', [`band_invite:${inviteId}`]).catch(log('withdraw invite'));
}

// 2. What you can do in a band has changed (not when you step down yourself), or you were taken out of it.
const LEVEL_WORDS = { organiser: "you're now one of its organisers", change: 'you can now change music', play: 'you can now play its music, but not change it' };
export function noticeBandLevel(bandId, memberId, level, actorId) {
  if (Number(memberId) === Number(actorId)) return Promise.resolve();
  return (async () => {
    const band = await bandName(bandId);
    await send([memberId], 'band_level', { title: `What you can do in ${band} has changed`, body: `${LEVEL_WORDS[level] ? LEVEL_WORDS[level].charAt(0).toUpperCase() + LEVEL_WORDS[level].slice(1) : 'It has changed'}.`, details: { bandId: Number(bandId), level } });
  })().catch(log('band level'));
}
// ML-648: made a band leader, or not any more (not when an organiser changes it for themselves). Its email is
// sent by setBandLeader (bands.js); this is the notice in the app.
export function noticeBandLeader(bandId, memberId, on, actorId) {
  if (Number(memberId) === Number(actorId)) return Promise.resolve();
  return (async () => {
    const band = await bandName(bandId);
    await send([memberId], 'band_leader', on
      ? { title: `You're now a band leader of ${band}`, body: "The band's Members page says what a band leader can do.", details: { bandId: Number(bandId), on: true } }
      : { title: `You're no longer a band leader of ${band}`, body: "You're still in the band.", details: { bandId: Number(bandId), on: false } });
  })().catch(log('band leader'));
}
// ML-646: let in from the waiting list straight into the band they asked to join - one of the "Changes in a band"
// notices (kind band_level: what you can do in a band has changed - you're in it now).
export function noticeBandJoined(bandId, memberId) {
  return (async () => {
    const band = await bandName(bandId);
    await send([memberId], 'band_level', { title: `You're now in ${band}`, body: "Its music is on Rehearse, and it's on My bands.", details: { bandId: Number(bandId), joined: true } });
  })().catch(log('band joined'));
}
export function noticeBandRemoved(bandId, memberId) {
  return (async () => {
    const band = await bandName(bandId);
    await send([memberId], 'band_removed', { title: `You're no longer in ${band}'s shared space`, body: "It's still on your list of bands.", details: { bandId: Number(bandId) } });
  })().catch(log('band removed'));
}

// 3. New pieces and practice lists in a band: one notice a day per band for each member (not the one who added
//    it), added to while it is unread. Its words are worked out again whenever it is read (bandNewsWords), so a
//    piece renamed after it was added shows its new name, and one deleted since drops out.
export function noticeBandNews(bandId, actorId, item) {
  return (async () => {
    const { rows: members } = await pool.query('SELECT account_id FROM band_members WHERE band_id = $1 AND account_id <> $2', [bandId, actorId]);
    const to = await whoGets(members.map(m => m.account_id), 'band_news');
    if (!to.length) return;
    const { rows: [{ day }] } = await pool.query(`SELECT to_char(now() AT TIME ZONE 'Europe/London', 'YYYY-MM-DD') AS day`);
    const band = await bandName(bandId);
    for (const accountId of to) {
      const key = `band_news:${bandId}:${accountId}:${day}`;
      const { rows } = await pool.query(
        `SELECT n.id, n.details FROM notifications n
          WHERE n.group_key = $1 AND n.withdrawn_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.account_id = $2)
          ORDER BY n.id DESC LIMIT 1`, [key, accountId]);
      const details = rows.length ? rows[0].details : { bandId: Number(bandId), pieces: [], lists: [] };
      const into = item.type === 'list' ? details.lists : details.pieces;
      if (!into.includes(Number(item.id))) into.push(Number(item.id));
      const words = await bandNewsWords(details, band);
      if (rows.length) {
        await pool.query('UPDATE notifications SET details = $2, title = $3, body = $4, publish_at = now(), updated_at = now() WHERE id = $1', [rows[0].id, details, words.title, words.body]);
      } else {
        await send([accountId], 'band_news', { ...words, details, groupKey: key });
      }
    }
  })().catch(log('band news'));
}
// "New in The Cobham Band: Abide with Me", "3 new pieces in The Cobham Band", "2 new pieces and a practice list in
// The Cobham Band" - with the names, as they are now, in the message.
export async function bandNewsWords(details, band) {
  const pieceIds = (details.pieces || []).map(Number);
  const listIds = (details.lists || []).map(Number);
  const [{ rows: pieces }, { rows: lists }] = await Promise.all([
    pieceIds.length ? pool.query('SELECT id, title FROM scores WHERE id = ANY($1::bigint[]) AND owner_band_id = $2', [pieceIds, details.bandId]) : { rows: [] },
    listIds.length ? pool.query('SELECT id, name FROM practice_lists WHERE id = ANY($1::bigint[]) AND owner_band_id = $2', [listIds, details.bandId]) : { rows: [] },
  ]);
  const names = [...pieces.map(p => p.title), ...lists.map(l => `${l.name} (practice list)`)];
  if (!names.length) return { title: `New music in ${band}`, body: 'What was added has since been taken away again.' };
  const parts = [];
  if (pieces.length) parts.push(pieces.length === 1 && !lists.length ? null : plural(pieces.length, 'new piece', 'new pieces'));
  if (lists.length) parts.push(pieces.length ? (lists.length === 1 ? 'a practice list' : `${lists.length} practice lists`) : plural(lists.length, 'new practice list', 'new practice lists'));
  const title = names.length === 1 ? `New in ${band}: ${names[0]}` : `${parts.filter(Boolean).join(' and ')} in ${band}`;
  return { title: clip(title), body: names.join('\n') };
}

// 4. A piece you added to a band was deleted by someone else.
export function noticePieceDeleted(score, deleterId) {
  if (!score || !score.owner_band_id || !score.added_by_account_id || Number(score.added_by_account_id) === Number(deleterId)) return Promise.resolve();
  return (async () => {
    const band = await bandName(score.owner_band_id);
    await send([score.added_by_account_id], 'piece_deleted', {
      title: `${score.title}, which you added to ${band}, has been deleted`,
      body: "It has gone from the band's pieces and practice lists.",
      details: { bandId: Number(score.owner_band_id), title: score.title },
    });
  })().catch(log('piece deleted'));
}
