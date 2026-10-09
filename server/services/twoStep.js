// ML-355 batch 2: two-step sign-in - authenticator-app codes (TOTP, RFC 6238: HMAC-SHA1, 6 digits,
// 30-second steps) and one-time recovery codes. Built on Node's crypto; no package.
//
// The TOTP secret is stored encrypted (AES-256-GCM). The key is TWO_STEP_KEY if set, otherwise derived
// from SESSION_SECRET - so changing SESSION_SECRET (which also logs everyone out) means everyone with
// two-step sign-in sets it up again. See docs/password-login.md.

import crypto from 'node:crypto';
import pool from '../config/db.js';

const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;            // accept the step before and after too - phone clocks drift
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;
const RECOVERY_CODES = 10;
export const ISSUER = 'Notably Better';

const fail = (status, message) => Object.assign(new Error(message), { status });

// ---- base32 (RFC 4648), the format authenticator apps take ----
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

// ---- TOTP ----
export function hotp(secret, counter, digits = DIGITS) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = mac[mac.length - 1] & 15;
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(code).padStart(digits, '0');
}
export const stepAt = (ms = Date.now()) => Math.floor(ms / 1000 / STEP_SECONDS);

// The step a code matches (within the window), or null. Constant-time compare.
export function matchingStep(secret, code, now = Date.now()) {
  const given = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(given)) return null;
  const current = stepAt(now);
  for (let s = current - WINDOW; s <= current + WINDOW; s++) {
    if (crypto.timingSafeEqual(Buffer.from(hotp(secret, s)), Buffer.from(given))) return s;
  }
  return null;
}

export function otpauthUrl(secretBase32, email) {
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

// ---- encryption of the stored secret ----
function key() {
  const base = process.env.TWO_STEP_KEY || process.env.SESSION_SECRET;
  if (!base) throw new Error('SESSION_SECRET is not set - two-step sign-in needs it.');
  return Buffer.from(crypto.hkdfSync('sha256', base, 'tml-two-step', 'totp-secret', 32));
}
export function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(secret), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64url')).join('.');
}
export function decryptSecret(stored) {
  const [iv, tag, data] = String(stored).split('.').map(s => Buffer.from(s, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

// ---- recovery codes: "k7m2-9xqp" - no 0/o/1/l, so they read back without mistakes ----
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const hashCode = (c) => crypto.createHash('sha256').update(String(c).toLowerCase().replace(/[^a-z0-9]/g, '')).digest('hex');
function newRecoveryCode() {
  const pick = () => Array.from(crypto.randomBytes(4), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
  return `${pick()}-${pick()}`;
}
async function replaceRecoveryCodes(client, accountId) {
  const codes = Array.from({ length: RECOVERY_CODES }, newRecoveryCode);
  await client.query('DELETE FROM account_recovery_codes WHERE account_id = $1', [accountId]);
  for (const c of codes) await client.query('INSERT INTO account_recovery_codes (account_id, code_hash) VALUES ($1, $2)', [accountId, hashCode(c)]);
  return codes;
}

// ---- the account's two-step state ----
export async function twoStepStatus(accountId, client = pool) {
  const { rows } = await client.query('SELECT enabled_at FROM account_two_step WHERE account_id = $1', [accountId]);
  const enabledAt = rows[0]?.enabled_at || null;
  const left = enabledAt ? (await client.query('SELECT COUNT(*)::int AS n FROM account_recovery_codes WHERE account_id = $1 AND used_at IS NULL', [accountId])).rows[0].n : 0;
  return { enabled: !!enabledAt, enabledAt, recoveryCodesLeft: left };
}

// Starts setting up (or starts again): a new secret, not on until a code confirms it.
export async function beginSetup(accountId, email) {
  if ((await twoStepStatus(accountId)).enabled) throw fail(409, 'Two-step sign-in is already on.');
  const secret = crypto.randomBytes(20);
  await pool.query(
    `INSERT INTO account_two_step (account_id, secret_encrypted) VALUES ($1, $2)
     ON CONFLICT (account_id) DO UPDATE SET secret_encrypted = EXCLUDED.secret_encrypted, enabled_at = NULL, last_used_step = 0, failed_attempts = 0, locked_until = NULL`,
    [accountId, encryptSecret(secret)]);
  const b32 = base32Encode(secret);
  return { secret: b32.match(/.{1,4}/g).join(' '), otpauthUrl: otpauthUrl(b32, email) };
}

// Checks a code against the account's secret (authenticator codes only - not recovery codes), with
// the lock and no-replay rules. Returns true/false; throws 423 while locked.
async function checkAppCode(client, accountId, code) {
  const { rows } = await client.query('SELECT * FROM account_two_step WHERE account_id = $1 FOR UPDATE', [accountId]);
  const row = rows[0];
  if (!row) throw fail(400, 'Two-step sign-in isn\'t set up.');
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    throw fail(423, `Too many wrong codes - try again in ${LOCK_MINUTES} minutes, or use a recovery code.`);
  }
  const step = matchingStep(decryptSecret(row.secret_encrypted), code);
  if (step !== null && step > Number(row.last_used_step)) {
    await client.query('UPDATE account_two_step SET last_used_step = $2, failed_attempts = 0, locked_until = NULL WHERE account_id = $1', [accountId, step]);
    return true;
  }
  await client.query(
    `UPDATE account_two_step SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END
      WHERE account_id = $1`, [accountId, LOCK_AFTER, LOCK_MINUTES]);
  return false;
}

async function inTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
// Wrong-code counts must stick even when the request fails, so they're committed on their own.
async function withCodeCheck(accountId, code, allowRecovery, then) {
  const isAppCode = /^\d{6}$/.test(String(code || '').replace(/\s/g, ''));
  const ok = await inTransaction(async (client) => {
    // 6 digits is an app code (locks after too many wrong); anything else is tried as a recovery code,
    // which still works while app codes are locked - that's what they're for.
    if (isAppCode) return (await checkAppCode(client, accountId, code)) ? 'app' : null;
    if (!allowRecovery) return null;
    const { rows } = await client.query(
      'UPDATE account_recovery_codes SET used_at = now() WHERE account_id = $1 AND code_hash = $2 AND used_at IS NULL RETURNING id',
      [accountId, hashCode(code)]);
    if (!rows.length) return null;
    await client.query('UPDATE account_two_step SET failed_attempts = 0, locked_until = NULL WHERE account_id = $1', [accountId]);
    return 'recovery';
  });
  if (!ok) throw fail(400, allowRecovery ? 'That code isn\'t right - check it and try again, or use a recovery code.' : 'That code isn\'t right - check the app and try again.');
  return then ? inTransaction((client) => then(client, ok)) : ok;
}

// Finishes setting up: the first code from the app turns it on and gives the recovery codes (shown once).
export async function confirmSetup(accountId, code) {
  const { rows } = await pool.query('SELECT enabled_at FROM account_two_step WHERE account_id = $1', [accountId]);
  if (!rows.length) throw fail(400, 'Start setting up two-step sign-in first.');
  if (rows[0].enabled_at) throw fail(409, 'Two-step sign-in is already on.');
  return withCodeCheck(accountId, code, false, async (client) => {
    await client.query('UPDATE account_two_step SET enabled_at = now() WHERE account_id = $1', [accountId]);
    return { recoveryCodes: await replaceRecoveryCodes(client, accountId) };
  });
}

// A login's second step: an app code or a recovery code. Returns 'app' or 'recovery'.
export async function verifyLoginCode(accountId, code) {
  if (!(await twoStepStatus(accountId)).enabled) throw fail(400, 'Two-step sign-in isn\'t on.');
  return withCodeCheck(accountId, code, true);
}

export async function newRecoveryCodes(accountId, code) {
  if (!(await twoStepStatus(accountId)).enabled) throw fail(400, 'Two-step sign-in isn\'t on.');
  return withCodeCheck(accountId, code, false, async (client) => ({ recoveryCodes: await replaceRecoveryCodes(client, accountId) }));
}

export async function turnOff(accountId, code) {
  if (!(await twoStepStatus(accountId)).enabled) throw fail(400, 'Two-step sign-in isn\'t on.');
  return withCodeCheck(accountId, code, true, async (client) => {
    await client.query('DELETE FROM account_two_step WHERE account_id = $1', [accountId]);
    await client.query('DELETE FROM account_recovery_codes WHERE account_id = $1', [accountId]);
    return { ok: true };
  });
}
