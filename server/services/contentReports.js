// ML-507: "Report this" - how a member tells the owner about something a band shares, or a public
// piece. The Online Safety Act expects a service where members share things to have "a complaints
// tool that allows users to report illegal or harmful material when they see it" and "a process to
// deal with those complaints" (docs/online-safety-assessment.md). The Children's Code asks for the
// same (standard 15, online tools).
//
// A report is about a piece (its bars, recordings, documents and links go with it), a band's name or a
// band's practice list (ML-510). It can only be made about something the member can see and somebody
// else can see too. It is not behind a feature switch - every member can always report.
// The owner sees reports on Admin -> Shared music, takes the thing down there if it should go, and
// closes the report with a line saying what was done.

import pool from '../config/db.js';
import { withStatus, assertFlowReadAccess } from './flows.js';
import { limitCalls } from './passwordAuth.js';
import { sendMail } from './mail.js';

const MAX_NOTE = 1000;
const fullName = (r) => [r.first_name, r.surname].filter(Boolean).join(' ').trim() || 'A member';

// What is being reported, as it stands today: { title, bandName, what } - or the reason it can't be.
async function reportTarget(accountId, kind, id) {
  if (kind === 'band') {
    // A band's shared space: its name is what its members see on its pieces, lists and invitations
    const { rows } = await pool.query(
      `SELECT g.name, (SELECT COUNT(*) FROM band_members m WHERE m.band_id = g.id) AS members
         FROM band_members bm JOIN bands g ON g.id = bm.band_id AND g.kind = 'group'
        WHERE g.id = $1 AND bm.account_id = $2`, [id, accountId]);
    if (!rows.length) throw withStatus(404, 'Band not found');
    if (Number(rows[0].members) === 1) throw withStatus(400, 'You are the only one in this band - nobody else can see its name.');
    return { title: rows[0].name, bandName: rows[0].name, what: `the band name "${rows[0].name}"` };
  }
  if (kind === 'list') {
    const { rows } = await pool.query(
      `SELECT pl.name, b.name AS band_name, bm.account_id AS member
         FROM practice_lists pl
         LEFT JOIN bands b ON b.id = pl.owner_band_id
         LEFT JOIN band_members bm ON bm.band_id = pl.owner_band_id AND bm.account_id = $2
        WHERE pl.id = $1 AND (pl.owner_account_id = $2 OR bm.account_id IS NOT NULL)`, [id, accountId]);
    if (!rows.length) throw withStatus(404, 'Practice list not found');
    if (!rows[0].member) throw withStatus(400, 'This list is your own - nobody else can see it. You can change or delete it yourself.');
    return { title: rows[0].name, bandName: rows[0].band_name || '', what: `the practice list "${rows[0].name}"${rows[0].band_name ? ` (${rows[0].band_name})` : ''}` };
  }
  const score = await assertFlowReadAccess(accountId, id); // only something you can see
  if (Number(score.owner_account_id) === Number(accountId) && !score.owner_band_id && !score.is_public) {
    throw withStatus(400, 'This piece is your own - nobody else can see it. You can change or delete it yourself.');
  }
  let bandName = '';
  if (score.owner_band_id) {
    const { rows } = await pool.query('SELECT name FROM bands WHERE id = $1', [score.owner_band_id]);
    bandName = rows.length ? rows[0].name : '';
  }
  return {
    title: score.title || '', bandName: score.is_public ? 'Public library' : bandName,
    what: `the piece "${score.title || 'Untitled'}"${bandName ? ` (${bandName})` : ''}`
  };
}

export async function createReport(accountId, { kind, id, note }) {
  if (!['piece', 'band', 'list'].includes(kind) || !/^\d+$/.test(String(id))) throw withStatus(400, 'That can\'t be reported from here.');
  const text = String(note || '').trim();
  if (text.length > MAX_NOTE) throw withStatus(400, `Keep it to ${MAX_NOTE} characters.`);
  const target = await reportTarget(accountId, kind, id);
  await limitCalls('report', accountId);
  await pool.query(
    'INSERT INTO content_reports (reported_by_account_id, kind, target_id, title, band_name, note) VALUES ($1, $2, $3, $4, $5, $6)',
    [accountId, kind, id, target.title, target.bandName, text]
  );
  // Tell the owner straight away, if an address is set. Never fails the report.
  const to = process.env.USAGE_ALERT_EMAIL || process.env.SIGNUP_ALERT_EMAIL;
  if (to) {
    try {
      await sendMail({
        to, subject: 'Notably Better: something has been reported',
        text: `A member has reported ${target.what}.\n\n${text ? `They wrote: ${text}\n\n` : ''}Open Admin, Shared music to look at it.`
      });
    } catch (error) { console.error('Report: the owner could not be emailed:', error.message); }
  }
  return { reported: true };
}

// For the admin page: open reports first, then the last hundred closed.
export async function listReports() {
  const { rows } = await pool.query(
    // still there: the piece or list exists; a band still has the name that was reported
    `SELECT r.*, a.first_name, a.surname,
            CASE r.kind WHEN 'list' THEN EXISTS (SELECT 1 FROM practice_lists pl WHERE pl.id = r.target_id)
                        WHEN 'band' THEN EXISTS (SELECT 1 FROM bands b WHERE b.id = r.target_id AND b.name = r.title)
                        ELSE EXISTS (SELECT 1 FROM scores s WHERE s.id = r.target_id) END AS still_there
       FROM content_reports r LEFT JOIN accounts a ON a.id = r.reported_by_account_id
      ORDER BY (r.closed_at IS NULL) DESC, r.created_at DESC LIMIT 200`);
  return rows.map((r) => ({
    id: Number(r.id), kind: r.kind, targetId: Number(r.target_id), title: r.title, band: r.band_name, note: r.note,
    reportedBy: r.reported_by_account_id ? fullName(r) : 'An account since deleted', reportedAt: r.created_at,
    open: !r.closed_at, closedAt: r.closed_at, closedBy: r.closed_by, outcome: r.outcome, stillThere: !!r.still_there
  }));
}

export async function closeReport(adminAccountId, reportId, outcome) {
  const text = String(outcome || '').trim();
  if (!text) throw withStatus(400, 'Say what was done about it.');
  if (text.length > MAX_NOTE) throw withStatus(400, `Keep it to ${MAX_NOTE} characters.`);
  const by = (await pool.query('SELECT first_name, surname FROM accounts WHERE id = $1', [adminAccountId])).rows[0];
  const { rowCount } = await pool.query(
    'UPDATE content_reports SET closed_at = now(), closed_by = $2, outcome = $3 WHERE id = $1 AND closed_at IS NULL',
    [reportId, by ? fullName(by) : '', text]);
  if (!rowCount) throw withStatus(404, 'That report has already been closed.');
}
