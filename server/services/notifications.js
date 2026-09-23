// ML-201: notification centre. See db/migrations/048_notifications.sql for the table reasoning.
//
// Two audiences: every account reads live notifications and marks them read (the only write a
// normal account makes); super admins create/edit/withdraw/delete them from the admin panel. "Live"
// is always computed from the clock at query time - there's no scheduler, so a notification
// scheduled for 09:00 simply starts appearing in every client's next poll after 09:00.

import pool from '../config/db.js';
import { withStatus } from './flows.js';

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 4000;

const LIVE_CONDITION = `n.withdrawn_at IS NULL AND n.publish_at <= now() AND (n.expires_at IS NULL OR n.expires_at > now())`;

function toUserDto(row) {
  return {
    id: Number(row.id),
    title: row.title,
    body: row.body,
    publishAt: row.publish_at,
    read: !!row.read_at,
    readAt: row.read_at || null
  };
}

// Live notifications for this account, newest first, plus the unread count the red dot needs. A
// notification published before the account existed is still shown (until it expires) - agreed
// behaviour for ML-201, so a new user still hears about e.g. a recently added feature.
export async function listNotificationsForAccount(accountId) {
  const { rows } = await pool.query(
    `SELECT n.id, n.title, n.body, n.publish_at, r.read_at
     FROM notifications n
     LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.account_id = $1
     WHERE ${LIVE_CONDITION}
     ORDER BY n.publish_at DESC, n.id DESC
     LIMIT 100`,
    [accountId]
  );
  const notifications = rows.map(toUserDto);
  return { notifications, unreadCount: notifications.filter(n => !n.read).length };
}

// Only a live notification can be marked read - a withdrawn/expired/not-yet-published id is a 404,
// same as one that never existed. Idempotent (re-reading keeps the first read_at).
export async function markNotificationRead(accountId, notificationId) {
  const { rowCount } = await pool.query(
    `INSERT INTO notification_reads (notification_id, account_id)
     SELECT n.id, $2 FROM notifications n WHERE n.id = $1 AND ${LIVE_CONDITION}
     ON CONFLICT (notification_id, account_id) DO NOTHING`,
    [notificationId, accountId]
  );
  if (!rowCount) {
    const { rows } = await pool.query(`SELECT 1 FROM notifications n WHERE n.id = $1 AND ${LIVE_CONDITION}`, [notificationId]);
    if (!rows.length) throw withStatus(404, 'Notification not found');
  }
  return listNotificationsForAccount(accountId);
}

export async function markAllNotificationsRead(accountId) {
  await pool.query(
    `INSERT INTO notification_reads (notification_id, account_id)
     SELECT n.id, $1 FROM notifications n WHERE ${LIVE_CONDITION}
     ON CONFLICT (notification_id, account_id) DO NOTHING`,
    [accountId]
  );
  return listNotificationsForAccount(accountId);
}

// ---------- admin ----------

function statusOf(row) {
  if (row.withdrawn_at) return 'withdrawn';
  const now = Date.now();
  if (new Date(row.publish_at).getTime() > now) return 'scheduled';
  if (row.expires_at && new Date(row.expires_at).getTime() <= now) return 'expired';
  return 'live';
}

function toAdminDto(row) {
  return {
    id: Number(row.id),
    title: row.title,
    body: row.body,
    audience: row.audience,
    publishAt: row.publish_at,
    expiresAt: row.expires_at,
    withdrawnAt: row.withdrawn_at,
    status: statusOf(row),
    readCount: Number(row.read_count || 0),
    createdBy: row.created_by_email || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listNotificationsForAdmin() {
  const { rows } = await pool.query(
    `SELECT n.*, a.email AS created_by_email,
            (SELECT COUNT(*) FROM notification_reads r WHERE r.notification_id = n.id) AS read_count
     FROM notifications n
     LEFT JOIN accounts a ON a.id = n.created_by_account_id
     ORDER BY n.publish_at DESC, n.id DESC`
  );
  const { rows: totals } = await pool.query('SELECT COUNT(*) AS n FROM accounts');
  return { notifications: rows.map(toAdminDto), accountCount: Number(totals[0].n) };
}

function parseTimestamp(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw withStatus(400, `${label} isn't a valid date and time.`);
  return d;
}

// Shared by create and update: validates the whole shape, so an edit can't leave e.g. an expiry
// before the (new) publish time.
function validateNotification({ title, body, publishAt, expiresAt }) {
  const t = String(title ?? '').trim();
  const b = String(body ?? '').trim();
  if (!t) throw withStatus(400, 'A title is required.');
  if (t.length > MAX_TITLE_LENGTH) throw withStatus(400, `Title is limited to ${MAX_TITLE_LENGTH} characters.`);
  if (!b) throw withStatus(400, 'A message is required.');
  if (b.length > MAX_BODY_LENGTH) throw withStatus(400, `Message is limited to ${MAX_BODY_LENGTH} characters.`);
  const publish = parseTimestamp(publishAt, 'Publish time') || new Date();
  const expires = parseTimestamp(expiresAt, 'Expiry');
  if (expires && expires <= publish) throw withStatus(400, 'Expiry must be after the publish time.');
  return { title: t, body: b, publishAt: publish, expiresAt: expires };
}

export async function createNotification(adminAccountId, data) {
  const v = validateNotification(data || {});
  const { rows } = await pool.query(
    `INSERT INTO notifications (title, body, publish_at, expires_at, created_by_account_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [v.title, v.body, v.publishAt, v.expiresAt, adminAccountId]
  );
  return getAdminNotification(rows[0].id);
}

export async function updateNotification(notificationId, data) {
  const v = validateNotification(data || {});
  const { rowCount } = await pool.query(
    `UPDATE notifications SET title = $1, body = $2, publish_at = $3, expires_at = $4, updated_at = now() WHERE id = $5`,
    [v.title, v.body, v.publishAt, v.expiresAt, notificationId]
  );
  if (!rowCount) throw withStatus(404, 'Notification not found');
  return getAdminNotification(notificationId);
}

// Withdraw hides it from everyone but keeps its read statistics; restore puts it back (as whatever
// its publish/expiry times now make it - live, scheduled or expired).
export async function setNotificationWithdrawn(notificationId, withdrawn) {
  const { rowCount } = await pool.query(
    `UPDATE notifications SET withdrawn_at = ${withdrawn ? 'now()' : 'NULL'}, updated_at = now() WHERE id = $1`,
    [notificationId]
  );
  if (!rowCount) throw withStatus(404, 'Notification not found');
  return getAdminNotification(notificationId);
}

export async function deleteNotification(notificationId) {
  const { rowCount } = await pool.query('DELETE FROM notifications WHERE id = $1', [notificationId]);
  if (!rowCount) throw withStatus(404, 'Notification not found');
}

async function getAdminNotification(id) {
  const { rows } = await pool.query(
    `SELECT n.*, a.email AS created_by_email,
            (SELECT COUNT(*) FROM notification_reads r WHERE r.notification_id = n.id) AS read_count
     FROM notifications n LEFT JOIN accounts a ON a.id = n.created_by_account_id
     WHERE n.id = $1`,
    [id]
  );
  if (!rows.length) throw withStatus(404, 'Notification not found');
  return toAdminDto(rows[0]);
}
