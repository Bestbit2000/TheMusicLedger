// ML-470: Admin -> Security -> Reviews. One list of the reviews that come round - data protection, the
// Children's Code, the breach plan, and the two security reviews - with when each was last done, by
// whom, what was noted, and when it is due again. "Mark as reviewed" adds a line to review_log
// (migration 112) and never changes an old one: the table is the audit trail.
// Where the app can check something itself, it does (checks, below). The rules are in reviewRules.js.
import fs from 'node:fs';
import pool from '../config/db.js';
import { REVIEWS, MARKED_KEYS, reviewState, needsDoing, policyDate, policyCheck, sayDay } from './reviewRules.js';
import { getSecurityReview } from './securityReview.js';
import { getSiteSecurityReview } from './siteSecurityReview.js';
import thirdPartyRegister from '../thirdParties/register.js';
import { listRecords } from './thirdPartyRecords.js';
import { applyRecords } from '../thirdParties/records.js';

const withStatus = (status, message) => Object.assign(new Error(message), { status });
const part = async (read, fallback = null) => { try { return await read(); } catch (error) { console.error('Reviews: a part was not read:', error.message); return fallback; } };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// A moment (a Date, or text the database or a file gave) as its day, YYYY-MM-DD
const dayOf = (at) => { const d = new Date(at); return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); };

// What the daily clear-up (retention.js, clearOldRecords) should already have taken. Anything counted
// here is older than its limit and still held: the job isn't running, or it failed.
async function overdueClearUps() {
  const { rows } = await pool.query(
    `SELECT (SELECT count(*) FROM auth_email_links WHERE purpose = 'invite' AND COALESCE(used_at, expires_at) < now() - interval '32 days')::int AS invites,
            (SELECT count(*) FROM band_invites WHERE created_at < now() - interval '32 days')::int AS band_invites,
            (SELECT count(*) FROM feedback WHERE status = 'resolved' AND updated_at < now() - interval '12 months' - interval '2 days')::int AS feedback`);
  return rows[0];
}

async function dataProtectionChecks(lastOn) {
  const checks = [];
  const html = await part(() => fs.readFileSync(new URL('../../public/privacy.html', import.meta.url), 'utf8'), '');
  checks.push(policyCheck(policyDate(html), lastOn));
  const records = await part(listRecords, undefined);
  if (records !== undefined) {
    const missing = applyRecords(thirdPartyRegister.entries, records).filter((e) => e.status !== 'not_in_use').reduce((n, e) => n + (e.agreementAttention || []).length, 0);
    checks.push(missing
      ? { ok: false, text: `${plural(missing, 'thing is', 'things are')} missing on Third parties: a data processing agreement or a transfer safeguard not recorded, or not in place.` }
      : { ok: true, text: 'Every provider that handles members\' information has an agreement and a transfer safeguard recorded.' });
  }
  const old = await part(overdueClearUps);
  if (old) {
    const left = old.invites + old.band_invites + old.feedback;
    checks.push(left
      ? { ok: false, text: `The daily clear-up has left ${plural(old.invites + old.band_invites, 'old invite', 'old invites')} and ${plural(old.feedback, 'piece', 'pieces')} of old feedback that should have gone. Check the daily job is running (Retention).` }
      : { ok: true, text: 'Nothing is being kept past its time: no invite older than 30 days, no dealt-with feedback older than 12 months.' });
  }
  return checks;
}

// A security review's own state: its last automated run, whether that is due, and what it found
function securityState(review, data) {
  const auto = data && data.lastAutomatedRun;
  const deep = data && data.lastDeepReview;
  const failing = data ? Object.values(data.latest || {}).filter((x) => x.runId && String(x.runId).startsWith('auto-') && x.status === 'fail').length : 0;
  const checks = [];
  if (data) {
    checks.push(failing ? { ok: false, text: `${plural(failing, 'automated check is', 'automated checks are')} failing.` } : { ok: true, text: 'No automated check is failing.' });
    if (review.key === 'site-security') {
      const headers = (data.latest || {})['security-headers'];
      if (headers) checks.push({ ok: headers.status === 'pass', text: `Security headers on the live site: ${headers.summary || headers.status}` });
    }
    if (data.upstreamChangedSinceDeepReview) checks.push({ ok: false, text: review.key === 'site-security' ? 'A release has gone out since the last full review.' : 'The service has changed since its last full review.' });
  }
  return {
    last: auto && dayOf(auto.at) ? { on: dayOf(auto.at), by: 'the automated checks', note: deep && dayOf(deep.at) ? `Last full review: ${sayDay(dayOf(deep.at))}` : 'No full review recorded' } : null,
    checks
  };
}

export async function getReviews(today = new Date()) {
  const { rows } = await pool.query(
    `SELECT review_key, to_char(reviewed_on, 'YYYY-MM-DD') AS on, reviewed_by AS by, note FROM review_log ORDER BY reviewed_on DESC, id DESC`);
  const [site, omr] = await Promise.all([part(getSiteSecurityReview), part(getSecurityReview)]);
  const reviews = [];
  for (const r of REVIEWS) {
    const history = rows.filter((x) => x.review_key === r.key).map(({ on, by, note }) => ({ on, by, note }));
    let last = history[0] || null;
    let checks = [];
    if (r.kind === 'checks') ({ last, checks } = securityState(r, r.key === 'site-security' ? site : omr));
    else if (r.key === 'data-protection') checks = await dataProtectionChecks(last && last.on);
    reviews.push({ key: r.key, kind: r.kind, name: r.name, about: r.about, where: r.where, months: r.months, tab: r.tab || null,
      last, history: r.kind === 'marked' ? history : [], checks, ...reviewState(r, last && last.on, today) });
  }
  return { reviews, due: reviews.filter((r) => r.kind === 'marked' && needsDoing(r)).length };
}

// How many marked reviews are due or never done - for the Dashboard and the menu. (The security
// reviews have their own lines there already.)
export async function reviewsDue(today = new Date()) {
  const { rows } = await pool.query(
    `SELECT review_key, to_char(max(reviewed_on), 'YYYY-MM-DD') AS on FROM review_log WHERE review_key = ANY($1) GROUP BY review_key`, [MARKED_KEYS]);
  const lastOn = new Map(rows.map((x) => [x.review_key, x.on]));
  return REVIEWS.filter((r) => r.kind === 'marked' && needsDoing(reviewState(r, lastOn.get(r.key), today))).length;
}

// "Mark as reviewed": today, by whoever is signed in, with a note of what was checked or changed.
export async function markReviewed(key, note, by) {
  if (!MARKED_KEYS.includes(key)) throw withStatus(404, 'That review isn\'t marked here - it is run from its own tab.');
  const text = String(note || '').trim().slice(0, 1000);
  if (!text) throw withStatus(400, 'Say what you checked, or what changed - a line is enough.');
  await pool.query('INSERT INTO review_log (review_key, reviewed_by, note) VALUES ($1, $2, $3)', [key, String(by || '').trim().slice(0, 120), text]);
}
