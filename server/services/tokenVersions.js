// ML-355: "signed out everywhere". accounts.token_version goes up when a password is reset or changed;
// every login token carries the number it was signed with (tv), and one with an older number is
// refused (server/middleware/auth.js). Tokens from before this existed have no tv, which counts as 0 -
// so they keep working until the account's first reset.
//
// Read on every authenticated request, so held for 30 seconds per email (like account types): a reset
// reaches other servers' caches within half a minute. forgetTokenVersion clears this server's at once.

import pool from '../config/db.js';

const TTL_MS = 30000;
const cache = new Map();

export async function currentTokenVersion(email) {
  const key = String(email || '').toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.version;
  const { rows } = await pool.query('SELECT token_version FROM accounts WHERE lower(email) = $1', [key]);
  const version = rows.length ? Number(rows[0].token_version) : 0; // no account yet: its first login
  cache.set(key, { version, at: Date.now() });
  return version;
}

export function forgetTokenVersion(email) {
  cache.delete(String(email || '').toLowerCase());
}

export async function tokenIsCurrent(tokenData) {
  if (!tokenData.userId) return false;
  return Number(tokenData.tv || 0) >= (await currentTokenVersion(tokenData.userId));
}
