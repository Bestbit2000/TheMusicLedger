import { verifyToken } from '../utils/authToken.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.substring(7);
    const tokenData = verifyToken(token);

    req.userId = tokenData.userId;
    req.googleAccessToken = tokenData.access_token;
    req.googleRefreshToken = tokenData.refresh_token;
    req.googleExpiryDate = tokenData.expiry_date;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function getUserTokens(req) {
  return {
    access_token: req.googleAccessToken,
    refresh_token: req.googleRefreshToken,
    expiry_date: req.googleExpiryDate
  };
}

export async function saveUserTokens(tokens) {
  // Tokens are managed on the client side, no server-side storage needed
  return tokens;
}
