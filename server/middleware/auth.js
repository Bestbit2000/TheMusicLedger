// Simple token verification - tokens are passed from the client
// The token format should include both access and refresh tokens

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    // Extract the token payload (should contain userId)
    const token = authHeader.substring(7);
    const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());

    req.userId = tokenData.userId;
    req.googleAccessToken = tokenData.access_token;
    req.googleRefreshToken = tokenData.refresh_token;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function getUserTokens(req) {
  return {
    access_token: req.googleAccessToken,
    refresh_token: req.googleRefreshToken,
    expiry_date: req.googleRefreshToken ? null : undefined
  };
}

export async function saveUserTokens(tokens) {
  // Tokens are managed on the client side, no server-side storage needed
  return tokens;
}
