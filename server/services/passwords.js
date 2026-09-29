// ML-355: password hashing and the password rules. scrypt is built into Node (no native package to
// build on Vercel). A stored hash is "scrypt$N$r$p$salt$hash" (base64url), so the cost can be raised
// later without breaking old hashes - verifyPassword reads the settings from the hash itself.

import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const COST = { N: 32768, r: 8, p: 1 };  // ~100 ms; needs maxmem over 32 MB
const KEY_LENGTH = 64;
const maxmem = (N, r) => 256 * N * r;     // comfortably above scrypt's 128 * N * r

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password.normalize('NFC'), salt, KEY_LENGTH, { ...COST, maxmem: maxmem(COST.N, COST.r) });
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password, stored) {
  const [kind, N, r, p, salt, hash] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(String(password).normalize('NFC'), Buffer.from(salt, 'base64url'), expected.length,
    { N: Number(N), r: Number(r), p: Number(p), maxmem: maxmem(Number(N), Number(r)) });
  return crypto.timingSafeEqual(key, expected);
}

// A made-up hash to check against when there's no account, so a wrong email takes as long as a wrong
// password (no telling which emails have accounts by timing).
let dummyHash = null;
export async function spendPasswordTime(password) {
  dummyHash ??= await hashPassword('not a real password - timing only');
  await verifyPassword(password, dummyHash);
}

// Why a new password isn't allowed, or null. Long enough, and not in a known data breach: Have I Been
// Pwned's range API is sent only the first 5 characters of the password's SHA-1 (k-anonymity), never
// the password. If that service can't be reached the check is skipped rather than blocking the reset.
export async function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use no more than ${PASSWORD_MAX} characters.`;
  if (process.env.PASSWORD_BREACH_CHECK === 'off') return null;
  try {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true' }, signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) return null;
    const suffix = sha1.slice(5);
    const found = (await res.text()).split('\n').some(line => {
      const [s, count] = line.trim().split(':');
      return s === suffix && Number(count) > 0;
    });
    return found ? 'That password has appeared in a data breach elsewhere, so it isn\'t safe - choose another.' : null;
  } catch {
    return null;
  }
}
