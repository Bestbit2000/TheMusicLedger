// ML-518: the rules of the admin panel's "prove it's you" check - pure, no database, so the guard in
// middleware/auth.js and the unit tests (server/test/adminCheck.test.js) share them.
// docs/admin-passkey.md.
//
// A check is written in the sign-in token as `adm`: { at, seen, how }
//   at   - when the check was made (ms)
//   seen - when the admin panel was last used with it (ms)
//   how  - 'passkey' or 'code' (an authenticator or recovery code). A new passkey can only be made
//          on a check made with a code.
import { reissue } from '../utils/authToken.js';

export const IDLE_MS = 15 * 60 * 1000;      // the owner, 10 Oct 2026: 15 minutes without use
export const MAX_MS = 8 * 60 * 60 * 1000;   // and never longer than 8 hours
const SLIDE_AFTER_MS = 60 * 1000;           // the token is handed back at most once a minute

// Asked everywhere except a developer's machine with the local sign-in switched on - the same two
// settings that open /auth/login?as=admin, which Vercel never has (VERCEL_ENV is Vercel's own and
// wins). ADMIN_CHECK=on asks for it there too, to try it out.
export function adminCheckRequired(env = process.env) {
  if (env.ADMIN_CHECK === 'on' || env.VERCEL_ENV) return true;
  return !(env.NODE_ENV === 'development' && env.ALLOW_LOCAL_DEV_LOGIN === 'true');
}

// Is this check still good? slide: time to hand the token back with `seen` moved on.
export function checkState(adm, now) {
  const at = Number(adm?.at);
  const seen = Number(adm?.seen);
  const stale = { fresh: false, slide: false, how: null, until: null };
  if (!adm || !Number.isFinite(at) || !Number.isFinite(seen)) return stale;
  if (at > now + SLIDE_AFTER_MS || seen > now + SLIDE_AFTER_MS || seen < at) return stale; // not one of ours
  if (now - seen > IDLE_MS || now - at > MAX_MS) return stale;
  return { fresh: true, slide: now - seen > SLIDE_AFTER_MS, how: adm.how === 'code' ? 'code' : 'passkey', until: Math.min(seen + IDLE_MS, at + MAX_MS) };
}

export const checkedToken = (payload, how, now) => reissue(payload, { adm: { at: now, seen: now, how } });
export const slidToken = (payload, now) => reissue(payload, { adm: { ...payload.adm, seen: now } });
export const lockedToken = (payload) => reissue(payload, { adm: undefined });
