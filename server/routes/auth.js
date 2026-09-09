import express from 'express';
import passport from '../config/passport.js';
import { signToken } from '../utils/authToken.js';

const router = express.Router();

// Route paths deliberately unchanged (/login, /callback, not the more
// conventional /google, /google/callback) - these are already registered as
// Google's authorized redirect URIs across every environment; renaming them
// would mean re-registering all five.
router.get('/login', passport.authenticate('google', {
  // 'spreadsheets' scope dropped 2026-09-09 - nothing has talked to Google
  // Sheets since the Postgres cutover (ML-21). The sheet itself is kept
  // around unused, not deleted, so no scope is needed to read/write it.
  scope: ['email', 'profile'],
  accessType: 'offline',
  prompt: 'consent', // forces a refresh_token on every login, not just the first
  session: false
}));

router.get('/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, tokenData) => {
    if (err || !tokenData) {
      console.error('OAuth callback error:', err || 'no user returned');
      return res.status(500).json({ error: 'Authentication failed', details: err?.message });
    }

    const authToken = signToken(tokenData);

    // Redirect to frontend with token. Always derive this from the incoming
    // request rather than an env var - a stale FRONTEND_URL (e.g. copied
    // from a local .env into Vercel) would otherwise silently send every
    // deployment back to localhost after login.
    const frontendUrl = `${req.protocol}://${req.get('host')}`;
    res.redirect(`${frontendUrl}?authToken=${authToken}&userId=${tokenData.userId}`);
  })(req, res, next);
});

// Lets an automated tester (or a human) get a valid session without going
// through Google's real consent screen - for sandbox/dev only. Fails closed
// as a 404 (not 401/403) so a misconfigured NODE_ENV doesn't even reveal
// this endpoint exists. Requires TEST_LOGIN_SECRET to be set server-side at
// all, regardless of NODE_ENV, so an empty/unset secret can never match.
router.post('/test-login', (req, res) => {
  const secret = process.env.TEST_LOGIN_SECRET;
  const provided = req.body?.secret;

  if (!secret || process.env.NODE_ENV === 'production' || provided !== secret) {
    return res.status(404).json({ error: 'Not found' });
  }

  const userId = req.body?.userId || 'claude-test@themusicledger.local';
  const authToken = signToken({ userId, email: userId, isTestAccount: true });
  res.json({ authToken, userId });
});

export default router;
