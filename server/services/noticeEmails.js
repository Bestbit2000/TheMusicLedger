// ML-499: an email copy of an urgent or important notice, for the people it is for. See db/migrations/150 and
// docs/notifications.md ("Email copies"). The owner's answers, 23 Oct 2026:
//   * a switch on the Admin -> Notifications form, offered for urgent and important notices only;
//   * the form says how many emails it will send, and refuses more than the day's allowance (Brevo's free plan
//     sends 300 a day in all - the allowance, notice_emails_day on Admin -> Feature access, leaves room for the rest);
//   * a member can switch off email copies of urgent notices (Settings -> Notifications); a notice about how their
//     information is used - an important one - is always emailed.
// The email is the notice's own title and text, plain, with a line saying why they are getting it. It goes when the
// notice is published - so only for one published now - and an edit never sends it again. Only account types with
// the notice_emails feature get one (Super admin only until it is switched on).
import pool from '../config/db.js';
import { withStatus } from './flows.js';
import { isFeatureEnabled, getLimit } from './features.js';
import { emailBody, sendMailBatch } from './mail.js';
import { appLink } from '../utils/appPath.js';

const canBeEmailed = (email) => !/\.(local|invalid|test)$/i.test(String(email || ''));
const ALLOWANCE_DEFAULT = 250;

// Pure - unit tested. Whether an email copy can be asked for on this notice.
export function emailCopyAllowed({ urgent, important } = {}) {
  return urgent === true || important === true;
}

// Pure - unit tested. The email for one notice: its own words, why they are getting it, and a way into the app.
export function noticeEmailWords({ title, body, important, policyLink }, origin) {
  const paragraphs = String(body || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const home = String(origin || '').replace(/\/+$/, '');
  const why = important
    ? 'You are getting this email because the notice is about how your information is used. We email a copy of notices like this to every member, and it is in the app too.'
    : 'You are getting this email because it is an urgent notice from the Notably Better team, and it is in the app too. To stop email copies of urgent notices, open the app and go to Settings, Notifications.';
  const lines = [...paragraphs];
  if (important && policyLink) lines.push(`Read the privacy policy: ${home}/privacy.html`);
  lines.push(why);
  const { text, html } = emailBody(lines, 'Open Notably Better', appLink(home),
    'This email comes from an address that does not take replies. To write to us, email hello@notablybetter.com.');
  return { subject: String(title || '').trim(), text, html };
}

// Who gets an email copy of a notice for this audience: still here and not closed, an address that can be emailed,
// the notice_emails feature on for their account type, and - unless it is important - able to read it in the app
// (the notification centre on for their type) and not switched off. `who` is { audience, accountLevel, bandId,
// accountIds } - the same as the form sends.
async function emailCopyTargets(who, { important }) {
  const { audience = 'all', accountLevel = null, bandId = null, accountIds = [] } = who || {};
  const ids = (Array.isArray(accountIds) ? accountIds : []).map(String).filter(id => /^\d+$/.test(id));
  const { rows } = await pool.query(
    `SELECT a.id, a.email, a.account_level,
            EXISTS (SELECT 1 FROM notice_preferences p WHERE p.account_id = a.id AND p.kind = 'email_urgent' AND NOT p.enabled) AS urgent_off
       FROM accounts a
      WHERE a.deleted_at IS NULL AND a.closed_at IS NULL
        AND ($1 = 'all'
          OR ($1 = 'account_level' AND a.account_level = $2)
          OR ($1 = 'band' AND EXISTS (SELECT 1 FROM band_members bm WHERE bm.band_id = $3::bigint AND bm.account_id = a.id))
          OR ($1 = 'accounts' AND a.id = ANY($4::bigint[])))`,
    [audience, accountLevel, /^\d+$/.test(String(bandId)) ? bandId : null, ids]);
  const out = [];
  for (const r of rows) {
    if (!canBeEmailed(r.email)) continue;
    if (!(await isFeatureEnabled('notice_emails', r.account_level))) continue;
    if (!important && (r.urgent_off || !(await isFeatureEnabled('notifications', r.account_level)))) continue;
    out.push({ id: Number(r.id), email: r.email });
  }
  return out;
}

// How many can still go today: the allowance, less the email copies sent in the last 24 hours.
async function allowanceLeft() {
  const allowance = await getLimit('notice_emails_day', ALLOWANCE_DEFAULT);
  const { rows } = await pool.query(`SELECT COALESCE(SUM(emailed_count), 0)::int AS n FROM notifications WHERE emailed_at > now() - interval '24 hours'`);
  return { allowance, left: Math.max(0, allowance - rows[0].n) };
}

// For the form, before it is saved: how many it would email, and how many can go today.
export async function emailCopyPreview(data = {}) {
  const targets = await emailCopyTargets(data, { important: data.important === true });
  return { count: targets.length, ...(await allowanceLeft()) };
}

// Before a notice with an email copy is saved: refused when it can't be sent as asked.
export async function checkEmailCopy(data, publishAt) {
  if (!emailCopyAllowed(data)) throw withStatus(400, 'An email copy is only for an urgent or important notice.');
  if (publishAt && publishAt.getTime() > Date.now() + 60 * 1000) throw withStatus(400, 'The email copy goes when the notice is published, so it can only be sent with a notice published now.');
  const { count, allowance, left } = await emailCopyPreview(data);
  if (count > left) throw withStatus(400, `That would send ${count} emails, and only ${left} more can go today (the allowance is ${allowance} a day). Send it without the email copy, or tomorrow.`);
}

// Send the copies of a notice just published, and write down how many went. Never sent twice: the row is claimed
// first (emailed_at), so a second call does nothing.
export async function sendEmailCopies(notificationId, origin) {
  const { rows } = await pool.query(
    `UPDATE notifications SET emailed_at = now(), emailed_count = 0, email_failed_count = 0
      WHERE id = $1 AND email_copy AND emailed_at IS NULL
      RETURNING title, body, urgent, important, policy_link, audience, audience_account_level, audience_band_id`, [notificationId]);
  if (!rows.length) return null;
  const n = rows[0];
  const { rows: named } = await pool.query('SELECT account_id FROM notification_recipients WHERE notification_id = $1', [notificationId]);
  const targets = await emailCopyTargets({ audience: n.audience, accountLevel: n.audience_account_level, bandId: n.audience_band_id, accountIds: named.map(r => r.account_id) }, { important: n.important });
  const words = noticeEmailWords({ title: n.title, body: n.body, important: n.important, policyLink: n.policy_link }, origin);
  const { sent, failed } = await sendMailBatch(targets.map(t => ({ to: t.email, ...words })));
  await pool.query('UPDATE notifications SET emailed_count = $2, email_failed_count = $3 WHERE id = $1', [notificationId, sent, failed]);
  return { sent, failed };
}
