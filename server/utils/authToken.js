// Server-issued, HMAC-signed session tokens. Signing (not just base64) is
// what stops a client from forging an arbitrary userId - see ML-44. The
// frontend treats the result as an opaque string throughout (localStorage,
// Bearer header), so the format here is free to change without touching it.

import crypto from 'crypto';

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hmac(data) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set - cannot sign or verify auth tokens.');
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function signToken(payload, ttlMs = DEFAULT_TTL_MS) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString('base64url');
  return `${body}.${hmac(body)}`;
}

// ML-475: what a sign-in token may carry - who it is, and the housekeeping. Anything else (a token
// signed before 0.48.0 held Google's own access and refresh keys) is left behind when one is re-issued.
const KEPT = ['userId', 'email', 'firstName', 'surname', 'tv', 'isTestAccount'];
export const carriesGoogleKeys = (payload) => !!payload && ('access_token' in payload || 'refresh_token' in payload || 'expiry_date' in payload);
// The same sign-in, without them: same member, same token version, and the same end date (not a new 30 days).
export function withoutGoogleKeys(payload) {
  const clean = Object.fromEntries(KEPT.filter((k) => payload[k] !== undefined).map((k) => [k, payload[k]]));
  const left = payload.exp ? payload.exp - Date.now() : DEFAULT_TTL_MS;
  return signToken(clean, Math.max(left, 0));
}

export function verifyToken(token) {
  const [body, signature] = String(token).split('.');
  if (!body || !signature) throw new Error('Malformed token');

  const expected = Buffer.from(hmac(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp && Date.now() > payload.exp) {
    throw new Error('Token expired');
  }
  return payload;
}
