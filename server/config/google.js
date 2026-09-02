import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export { oauth2Client };

export function getSheetsClient(tokens) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  auth.setCredentials(tokens);
  return google.sheets({ version: 'v4', auth });
}

export function getAuthorizationUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/spreadsheets'
    ],
    prompt: 'consent'
  });
}

export async function getTokensFromCode(code) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
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
