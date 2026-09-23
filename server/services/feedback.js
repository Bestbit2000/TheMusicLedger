// ML-170: in-app feedback. See db/migrations/045_feedback.sql for why the capture side is a bare
// text box and categorisation happens at triage.
//
// Two audiences, one table, and the split matters: submitFeedback runs as any logged-in user and
// accepts exactly one field from them (the message). Everything else on the row is either captured
// from the request or set later by an admin - so nothing a client sends can choose its own status,
// write an admin_response, or claim a different app version than the one actually running.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import { withStatus } from './flows.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const FEEDBACK_STATUSES = ['under_review', 'planned', 'in_progress', 'not_progressing', 'resolved'];
export const FEEDBACK_CATEGORIES = ['bug', 'suggestion', 'comment'];

// Long enough that nobody has to edit themselves down while reporting a problem, short enough that
// the column can't be used as free storage. Truncation would silently lose the end of a report, so
// this rejects instead - the submitter still has their text on screen to trim.
const MAX_MESSAGE_LENGTH = 5000;
const MAX_ROUTE_LENGTH = 500;
const MAX_USER_AGENT_LENGTH = 500;

// Same source and reasoning as ML-199's own version stamp (server/services/flowAuthoringStats.js):
// public/releases.json is guaranteed to be in the deployed bundle and is the version the About page
// shows, so a feedback row always names a release the user could actually point at.
let cachedAppVersion;
function currentAppVersion() {
  if (cachedAppVersion !== undefined) return cachedAppVersion;
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, '../../public/releases.json'), 'utf8');
    const releases = JSON.parse(raw);
    cachedAppVersion = Array.isArray(releases) && releases.length ? releases[0].version : null;
  } catch {
    cachedAppVersion = null;
  }
  return cachedAppVersion;
}

function clip(value, max) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  // Context fields DO truncate, unlike the message: a 4KB user-agent string is noise past its first
  // few hundred characters, and losing the tail of one is not losing anything a reader wanted.
  return s.slice(0, max);
}

function toFeedbackDto(row) {
  return {
    id: Number(row.id),
    message: row.message,
    category: row.category,
    status: row.status,
    adminResponse: row.admin_response,
    route: row.route,
    userAgent: row.user_agent,
    deviceKind: row.device_kind,
    appVersion: row.app_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.email !== undefined ? { email: row.email } : {})
  };
}

export async function submitFeedback(accountId, { message, route, userAgent, deviceKind } = {}) {
  const text = String(message ?? '').trim();
  if (!text) throw withStatus(400, 'Enter some feedback first.');
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw withStatus(400, `Feedback is limited to ${MAX_MESSAGE_LENGTH} characters - yours is ${text.length}.`);
  }
  // An unrecognised device_kind is dropped rather than rejected: the report itself is what matters,
  // and failing a submission over a context field would lose the very thing being captured.
  const device = ['mobile', 'tablet', 'desktop'].includes(deviceKind) ? deviceKind : null;

  const { rows } = await pool.query(
    `INSERT INTO feedback (account_id, message, route, user_agent, device_kind, app_version)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, message, category, status, admin_response, route, user_agent, device_kind,
               app_version, created_at, updated_at`,
    [accountId, text, clip(route, MAX_ROUTE_LENGTH), clip(userAgent, MAX_USER_AGENT_LENGTH), device, currentAppVersion()]
  );
  return toFeedbackDto(rows[0]);
}

// ---- Admin (super-admin-gated in server/routes/admin.js) ----

// Filtering is done here rather than client-side on a full dump: the list only grows, and "show me
// the untriaged bugs" is the whole workflow this tab exists for. category = 'none' is the untriaged
// filter (category IS NULL) - a real and much-used state, so it gets a filter value of its own
// rather than being reachable only by scanning the unfiltered list.
export async function listFeedbackForAdmin({ status, category } = {}) {
  const where = [];
  const params = [];

  if (status && status !== 'all') {
    if (!FEEDBACK_STATUSES.includes(status)) throw withStatus(400, 'Unknown feedback status filter.');
    params.push(status);
    where.push(`f.status = $${params.length}`);
  }
  if (category && category !== 'all') {
    if (category === 'none') {
      where.push('f.category IS NULL');
    } else {
      if (!FEEDBACK_CATEGORIES.includes(category)) throw withStatus(400, 'Unknown feedback category filter.');
      params.push(category);
      where.push(`f.category = $${params.length}`);
    }
  }

  const { rows } = await pool.query(
    `SELECT f.id, f.message, f.category, f.status, f.admin_response, f.route, f.user_agent,
            f.device_kind, f.app_version, f.created_at, f.updated_at, a.email
       FROM feedback f
       JOIN accounts a ON a.id = f.account_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY f.created_at DESC
      LIMIT 500`,
    params
  );

  // Returned alongside the rows so the filter tabs can show counts without a second request, and -
  // more to the point - so "3 untriaged" is visible even while looking at a filtered view that
  // happens to be empty. Counts are always over everything, never over the current filter.
  const { rows: counts } = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE category IS NULL)::int AS untriaged,
       COUNT(*) FILTER (WHERE status = 'under_review')::int AS under_review,
       COUNT(*) FILTER (WHERE status = 'planned')::int AS planned,
       COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
       COUNT(*) FILTER (WHERE status = 'not_progressing')::int AS not_progressing,
       COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved
     FROM feedback`
  );

  return { feedback: rows.map(toFeedbackDto), counts: counts[0] };
}

// Partial by design - the drawer saves status, category and response together, but each is
// independently optional so a later caller (a quick status-only action from the list, say) doesn't
// have to resend fields it isn't changing and risk clobbering them with stale values.
export async function updateFeedbackAdmin(feedbackId, { status, category, adminResponse } = {}) {
  const sets = [];
  const params = [feedbackId];

  if (status !== undefined) {
    if (!FEEDBACK_STATUSES.includes(status)) throw withStatus(400, 'Unknown feedback status.');
    params.push(status);
    sets.push(`status = $${params.length}`);
  }
  if (category !== undefined) {
    // null/'' clears it back to untriaged - recategorising includes being able to say "actually I
    // don't know yet", which is otherwise a one-way door.
    const value = category === null || category === '' ? null : category;
    if (value !== null && !FEEDBACK_CATEGORIES.includes(value)) throw withStatus(400, 'Unknown feedback category.');
    params.push(value);
    sets.push(`category = $${params.length}`);
  }
  if (adminResponse !== undefined) {
    const value = String(adminResponse ?? '').trim();
    params.push(value || null);
    sets.push(`admin_response = $${params.length}`);
  }

  if (!sets.length) throw withStatus(400, 'Nothing to update.');
  // ML-170 asks for updated_at to move on every admin save - "when was this last looked at",
  // distinct from created_at's "when was it written".
  sets.push('updated_at = now()');

  const { rows } = await pool.query(
    `UPDATE feedback SET ${sets.join(', ')} WHERE id = $1
     RETURNING id, message, category, status, admin_response, route, user_agent, device_kind,
               app_version, created_at, updated_at`,
    params
  );
  if (!rows.length) throw withStatus(404, 'Feedback not found');
  return toFeedbackDto(rows[0]);
}
