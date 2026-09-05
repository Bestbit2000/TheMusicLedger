import express from 'express';
import { google } from 'googleapis';
import { getAuthorizationUrl, getTokensFromCode } from '../config/google.js';

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
    const authToken = Buffer.from(JSON.stringify(tokenData)).toString('base64');

    // Redirect to frontend with token. Prefer an explicit FRONTEND_URL if set,
    // otherwise derive it from the incoming request so this works correctly
    // on localhost and on Vercel without needing extra configuration.
    const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    res.redirect(`${frontendUrl}?authToken=${authToken}&userId=${userEmail}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
});

export default router;
