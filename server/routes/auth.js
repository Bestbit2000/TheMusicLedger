import express from 'express';
import { google } from 'googleapis';
import { getAuthorizationUrl, getTokensFromCode } from '../config/google.js';
import { signToken } from '../utils/authToken.js';

const router = express.Router();

router.get('/login', (req, res) => {
  const authUrl = getAuthorizationUrl();
  res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'No authorization code provided' });
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    // Get user info from Google
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email;

    // Create token payload with user info and Google tokens
    const tokenData = {
      userId: userEmail,
      email: userEmail,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date
    };
    const authToken = signToken(tokenData);

    // Redirect to frontend with token. Always derive this from the incoming
    // request rather than an env var - a stale FRONTEND_URL (e.g. copied
    // from a local .env into Vercel) would otherwise silently send every
    // deployment back to localhost after login.
    const frontendUrl = `${req.protocol}://${req.get('host')}`;
    res.redirect(`${frontendUrl}?authToken=${authToken}&userId=${userEmail}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
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
