// ML-507: "Report this" - how a member tells the owner about something a band shares, or a public
// piece. The Online Safety Act expects a service where members share things to have "a complaints
// tool that allows users to report illegal or harmful material when they see it" and "a process to
// deal with those complaints" (docs/online-safety-assessment.md). The Children's Code asks for the
// same (standard 15, online tools).
//
// A report is about a piece: its bars, recordings, documents and links go with it. It can only be made
// about a piece the member can see. It is not behind a feature switch - every member can always report.
// The owner sees reports on Admin -> Shared music, takes the thing down there if it should go, and
// closes the report with a line saying what was done.

import pool from '../config/db.js';
import { withStatus, assertFlowReadAccess } from './flows.js';
import { limitCalls } from './passwordAuth.js';
import { sendMail } from './mail.js';

const MAX_NOTE = 1000;
const fullName = (r) => [r.first_name, r.surname].filter(Boolean).join(' ').trim() || 'A member';

export async function createReport(accountId, { kind, id, note }) {
  if (kind !== 'piece' || !/^\d+$/.test(String(id))) throw withStatus(400, 'That can\'t be reported from here.');
  const text = String(note || '').trim();
  if (text.length > MAX_NOTE) throw withStatus(400, `Keep it to ${MAX_NOTE} characters.`);
  const score = await assertFlowReadAccess(accountId, id); // only something you can see
  if (Number(score.owner_account_id) === Number(accountId) && !score.owner_band_id && !score.is_public) {
    throw withStatus(400, 'This piece is your own - nobody else can see it. You can change or delete it yourself.');
  }
  await limitCalls('report', accountId);
  let bandName = '';
  if (score.owner_band_id) {
    const { rows } = await pool.query('SELECT name FROM bands WHERE id = $1', [score.owner_band_id]);
    bandName = rows.length ? rows[0].name : '';
  }
  await pool.query(
    'INSERT INTO content_reports (reported_by_account_id, kind, target_id, title, band_name, note) VALUES ($1, $2, $3, $4, $5, $6)',
    [accountId, 'piece', id, score.title || '', score.is_public ? 'Public library' : bandName, text]
  );
  // Tell the owner straight away, if an address is set. Never fails the report.
  const to = process.env.USAGE_ALERT_EMAIL || process.env.SIGNUP_ALERT_EMAIL;
  if (to) {
    try {
      await sendMail({
        to, subject: 'The Music Ledger: something has been reported',
        text: `A member has reported the piece "${score.title || 'Untitled'}"${bandName ? ` (${bandName})` : ''}.\n\n${text ? `They wrote: ${text}\n\n` : ''}Open Admin, Shared music to look at it.`
      });
    } catch (error) { console.error('Report: the owner could not be emailed:', error.message); }
  }
  return { reported: true };
}

// For the admin page: open reports first, then the last hundred closed.
export async function listReports() {
  const { rows } = await pool.query(
    `SELECT r.*, a.first_name, a.surname, EXISTS (SELECT 1 FROM scores s WHERE s.id = r.target_id) AS still_there
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
