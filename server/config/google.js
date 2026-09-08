// The login/callback OAuth2 flow itself now lives in server/config/passport.js
// (ML-42) - this file is left with just what's still needed afterwards:
// building an authenticated Sheets client from already-issued tokens, and
// refreshing an access token via its refresh_token.

import { google } from 'googleapis';

export function getSheetsClient(tokens) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  auth.setCredentials(tokens);
  return google.sheets({ version: 'v4', auth });
}

export async function refreshAccessToken(refreshToken) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  auth.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await auth.refreshAccessToken();
  return credentials;
}

export const SHEET_ID = process.env.GOOGLE_SHEET_ID;

export const SHEET_RANGES = {
  practise: { date: 'B', duration: 'C', year: 'A' },
  rehearsal: { who: 'F', date: 'G', duration: 'H', year: 'E' },
  lesson: { who: 'K', date: 'L', duration: 'M', year: 'J' },
  performance: { who: 'P', date: 'Q', duration: 'R', year: 'O' }
};