// ML-355: "signed out everywhere". accounts.token_version goes up when a password is reset or changed;
// every login token carries the number it was signed with (tv), and one with an older number is
// refused (server/middleware/auth.js). Tokens from before this existed have no tv, which counts as 0 -
// so they keep working until the account's first reset.
//
// Read on every authenticated request, so held for 30 seconds per email (like account types): a reset
// reaches other servers' caches within half a minute. forgetTokenVersion clears this server's at once.

import crypto from 'node:crypto';
import pool from '../config/db.js';

// ML-430: a deleted account's email, as a keyed hash - what deleted_account_markers is looked up by
// (099_account_deletion.sql). Not the address, and not reversible without SESSION_SECRET.
export function deletedEmailHash(email) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set - cannot mark a deleted account.');
  return crypto.createHmac('sha256', secret).update(String(email || '').toLowerCase()).digest('hex');
}

const TTL_MS = 30000;
const cache = new Map();

// ML-502: `shutOut` - the address may not sign in at all: its account has been closed, or (with no
// account) the address is on the block list a closed account leaves behind. Read with the version,
// so it costs nothing extra on a request and reaches every server within the same half minute.
async function lookUp(email) {
  const key = String(email || '').toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  const { rows } = await pool.query('SELECT token_version, closed_at IS NOT NULL AS closed FROM accounts WHERE lower(email) = $1', [key]);
  let version = 0; // no account yet: its first login
  let shutOut = false;
  if (rows.length) {
    version = Number(rows[0].token_version);
    shutOut = rows[0].closed;
  } else {
    // ...unless the account was deleted (ML-430): tokens from before that stay signed out
    const hash = deletedEmailHash(key);
    const marker = await pool.query('SELECT token_version FROM deleted_account_markers WHERE email_hash = $1', [hash]);
    if (marker.rows.length) version = Number(marker.rows[0].token_version);
    shutOut = (await pool.query('SELECT 1 FROM blocked_emails WHERE email_hash = $1', [hash])).rows.length > 0;
  }
  const entry = { version, shutOut, at: Date.now() };
  cache.set(key, entry);
  return entry;
}
export async function currentTokenVersion(email) {
  return (await lookUp(email)).version;
}
// Asked where a sign-in is about to be given, so the person is told why instead of being bounced.
export const SHUT_OUT_MESSAGE = 'This account has been closed, so you can\'t sign in. If you think this is a mistake, email hello@notablybetter.com.';
export async function emailIsShutOut(email) {
  forgetTokenVersion(email);
  return (await lookUp(email)).shutOut;
}

export function forgetTokenVersion(email) {
  cache.delete(String(email || '').toLowerCase());
}

export async function tokenIsCurrent(tokenData) {
  if (!tokenData.userId) return false;
  const now = await lookUp(tokenData.userId);
  return !now.shutOut && Number(tokenData.tv || 0) >= now.version; // ML-502: no token is good for a closed account
}
