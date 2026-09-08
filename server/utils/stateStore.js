// A Passport OAuth2 "state store" that needs no server-side session at all -
// the state value is itself HMAC-signed (reusing the same primitive as
// authToken.js) with a short expiry, and verified by re-checking that
// signature on the way back. This is what gives the login flow real
// state/CSRF protection (ML-42) without depending on express-session's
// MemoryStore, which isn't reliable across separate Vercel serverless
// invocations - the default express-session-backed store would silently
// break here since the /callback request has no guarantee of landing on the
// same instance that handled /login.

import { signToken, verifyToken } from './authToken.js';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes - just long enough for a login

export class SignedStateStore {
  store(req, callback) {
    try {
      callback(null, signToken({ purpose: 'oauth-state' }, STATE_TTL_MS));
    } catch (err) {
      callback(err);
    }
  }

  verify(req, providedState, callback) {
    try {
      const payload = verifyToken(providedState);
      if (payload.purpose !== 'oauth-state') {
        return callback(null, false, { message: 'Invalid state' });
      }
      callback(null, true);
    } catch (err) {
      callback(null, false, { message: 'Invalid or expired state' });
    }
  }
}
