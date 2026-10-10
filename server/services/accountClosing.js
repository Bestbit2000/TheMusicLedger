// ML-502: warning a member and closing their account (Admin -> Members -> Accounts). The terms say
// what may not be shared and that "we may close the account of someone who shares it"; this is how.
//   - Warn: the member is told in the app and by email, in the owner's words, and it is kept on
//     their record so the next time it is plain they have been warned before.
//   - Close: the account can't sign in - every token for it is refused (tokenVersions.js) and no new
//     one is given. Nothing is deleted, so it can be reopened on appeal. What they shared with a
//     band stays with the band.
//   - The block list: a closed account's email address is kept as a keyed hash (blocked_emails), so
//     the same address can't sign up or be invited again - even after the account is deleted. No IP
//     address is kept: one is shared by a household or a school and would shut out the wrong people.
// A super admin account is never warned or closed from here, and nobody acts on their own account.
// docs/account-closing.md; the privacy policy says what is kept.

import pool from '../config/db.js';
import { deletedEmailHash, forgetTokenVersion } from './tokenVersions.js';
import { createTargetedNotification } from './notifications.js';
import { sendMail, emailOutcome } from './mail.js';

const withStatus = (status, message) => Object.assign(new Error(message), { status });
export const ACTION_REASONS = {
  shared: 'Shared something that breaks the terms of use',
  conduct: 'How they have treated other members',
  repeated: 'Carried on after a warning',
  other: 'Another reason'
};
const MAX_MESSAGE = 2000;
const fullName = (r) => [r.first_name, r.surname].filter(Boolean).join(' ').trim() || 'A member';
// A local test address (dev's accounts, or one left on a live site by mistake) can't receive email.
const canBeEmailed = (email) => !/\.(local|invalid|test)$/i.test(String(email || ''));

async function byName(adminAccountId) {
  const { rows } = await pool.query('SELECT first_name, surname FROM accounts WHERE id = $1', [adminAccountId]);
  return rows.length ? fullName(rows[0]) : '';
}
// The account an action is about - never your own, never a super admin's, never one already deleted.
async function target(db, adminAccountId, accountId, lock = false) {
  const id = Number(accountId);
  if (!Number.isInteger(id) || id <= 0) throw withStatus(404, 'No such account.');
  if (id === Number(adminAccountId)) throw withStatus(400, "You can't do this to your own account.");
  const { rows } = await db.query(
    `SELECT id, email, first_name, account_level, closed_at, deleted_at FROM accounts WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!rows.length || rows[0].deleted_at) throw withStatus(404, 'That account has been deleted.');
  if (rows[0].account_level === 'super_admin') throw withStatus(403, "A super admin account can't be warned or closed here. Change its account type first.");
  return rows[0];
}
function checked({ reason, message }) {
  if (!Object.hasOwn(ACTION_REASONS, reason)) throw withStatus(400, 'Choose the reason.');
  const text = String(message || '').trim();
  if (!text) throw withStatus(400, 'Write what they will be told.');
  if (text.length > MAX_MESSAGE) throw withStatus(400, `The message can be up to ${MAX_MESSAGE} characters.`);
  return { reason, text };
}
async function email(account, subject, text) {
  if (!canBeEmailed(account.email)) return false;
  try {
    await sendMail({ to: account.email, subject, text: `Hello${account.first_name ? ` ${account.first_name}` : ''},\n\n${text}\n\nNotably Better\n` });
    return emailOutcome().emailed;
  } catch (error) {
    console.error('Account action: the email could not be sent:', error.message);
    return false;
  }
}

// What has been done about an account so far, newest first - shown before the owner warns or closes.
export async function accountRecord(accountId) {
  if (!/^\d+$/.test(String(accountId))) throw withStatus(404, 'No such account.');
  const { rows } = await pool.query(
    'SELECT id, kind, reason, message, by_name, emailed, created_at FROM account_actions WHERE account_id = $1 ORDER BY created_at DESC, id DESC', [accountId]);
  return {
    reasons: ACTION_REASONS,
    record: rows.map((r) => ({ id: Number(r.id), kind: r.kind, reason: r.reason, message: r.message, by: r.by_name, emailed: r.emailed, at: r.created_at }))
  };
}

export async function warnAccount(adminAccountId, accountId, body = {}) {
  const { reason, text } = checked(body);
  const account = await target(pool, adminAccountId, accountId);
  if (account.closed_at) throw withStatus(400, 'This account is closed - there is nobody to warn.');
  await createTargetedNotification(adminAccountId, { title: 'A warning about your account', body: text, urgent: true }, [account.id]);
  const emailed = await email(account, 'Notably Better: a warning about your account', text);
  await pool.query(
    'INSERT INTO account_actions (account_id, kind, reason, message, by_name, emailed) VALUES ($1, $2, $3, $4, $5, $6)',
    [account.id, 'warning', reason, text, await byName(adminAccountId), emailed]);
  return { email: account.email, emailed };
}

export async function closeAccount(adminAccountId, accountId, body = {}) {
  const { reason, text } = checked(body);
  const by = await byName(adminAccountId);
  const client = await pool.connect();
  let account;
  let actionId;
  try {
    await client.query('BEGIN');
    account = await target(client, adminAccountId, accountId, true);
    if (account.closed_at) throw withStatus(400, 'This account is already closed.');
    // token_version goes up as well, so a sign-in from before stays out even if the account is reopened
    await client.query('UPDATE accounts SET closed_at = now(), token_version = token_version + 1 WHERE id = $1', [account.id]);
    await client.query('INSERT INTO blocked_emails (email_hash) VALUES ($1) ON CONFLICT (email_hash) DO NOTHING', [deletedEmailHash(account.email)]);
    actionId = (await client.query(
      'INSERT INTO account_actions (account_id, kind, reason, message, by_name) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [account.id, 'closed', reason, text, by])).rows[0].id;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  forgetTokenVersion(account.email);
  // Closed first and told after, so the email is never untrue. A failed email changes nothing.
  const emailed = await email(account, 'Your Notably Better account has been closed', text);
  if (emailed) await pool.query('UPDATE account_actions SET emailed = true WHERE id = $1', [actionId]);
  return { email: account.email, emailed };
}

export const REOPENED_TEXT = 'Your Notably Better account is open again, and you can sign in as before. Everything is as you left it.\n\nIf you have a question, email hello@notablybetter.com.';
export async function reopenAccount(adminAccountId, accountId) {
  const by = await byName(adminAccountId);
  const client = await pool.connect();
  let account;
  let actionId;
  try {
    await client.query('BEGIN');
    account = await target(client, adminAccountId, accountId, true);
    if (!account.closed_at) throw withStatus(400, 'This account is not closed.');
    await client.query('UPDATE accounts SET closed_at = NULL WHERE id = $1', [account.id]);
    await client.query('DELETE FROM blocked_emails WHERE email_hash = $1', [deletedEmailHash(account.email)]);
    actionId = (await client.query(
      'INSERT INTO account_actions (account_id, kind, message, by_name) VALUES ($1, $2, $3, $4) RETURNING id',
      [account.id, 'reopened', REOPENED_TEXT, by])).rows[0].id;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  forgetTokenVersion(account.email);
  const emailed = await email(account, 'Your Notably Better account is open again', REOPENED_TEXT);
  if (emailed) await pool.query('UPDATE account_actions SET emailed = true WHERE id = $1', [actionId]);
  return { email: account.email, emailed };
}

// The block list can't be read back - it holds hashes, not addresses. This says how many addresses
// are on it whose account has since been deleted (a closed account's own entry shows on its row).
export async function blockedWithoutAccount() {
  const { rows } = await pool.query(
    `SELECT (SELECT count(*) FROM blocked_emails)::int - (SELECT count(*) FROM accounts WHERE closed_at IS NOT NULL AND deleted_at IS NULL)::int AS n`);
  return Math.max(0, rows[0].n);
}
// Taking an address off the list after its account has gone: the owner types it (from the appeal in
// his mailbox). An address whose account is still there is reopened on its row instead.
export async function unblockEmail(emailAddress) {
  const address = String(emailAddress || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw withStatus(400, 'Type the email address to unblock.');
  const open = await pool.query('SELECT 1 FROM accounts WHERE lower(email) = $1 AND closed_at IS NOT NULL', [address]);
  if (open.rows.length) throw withStatus(400, 'That address has a closed account - use Reopen this account on its row.');
  const { rowCount } = await pool.query('DELETE FROM blocked_emails WHERE email_hash = $1', [deletedEmailHash(address)]);
  if (!rowCount) throw withStatus(404, 'That address is not on the block list.');
  forgetTokenVersion(address);
  return { email: address };
}
