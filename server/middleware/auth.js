import { verifyToken } from '../utils/authToken.js';
import { getOrCreateAccount, isSuperAdmin } from '../services/accounts.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.substring(7);
    const tokenData = verifyToken(token);

    req.userId = tokenData.userId;
    req.firstName = tokenData.firstName || '';
    req.surname = tokenData.surname || '';
    req.googleAccessToken = tokenData.access_token;
    req.googleRefreshToken = tokenData.refresh_token;
    req.googleExpiryDate = tokenData.expiry_date;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Resolves the logged-in Google email to a real accounts.id, creating the
// row on first sight. Separate from requireAuth (token validity) so the two
// concerns - "is this token real" and "does a database row exist for it" -
// stay independently testable. Routes that touch the database use both:
// router.get(path, requireAuth, resolveAccount, handler).
export async function resolveAccount(req, res, next) {
  try {
    req.accountId = await getOrCreateAccount(req.userId, req.firstName, req.surname);
    next();
  } catch (error) {
    console.error('Account resolution error:', error.message);
    res.status(500).json({ error: 'Failed to resolve account' });
  }
}

// ML-77: gates the whole admin panel (server/routes/admin.js) to super_admin
// accounts - closes the gap flagged in that file's own header comment, where
// every admin route previously only required being logged in at all, same as
// any other route. Chained after resolveAccount, same as requireAuth/
// resolveAccount themselves: router.get(path, requireAuth, resolveAccount,
// requireSuperAdmin, handler).
export async function requireSuperAdmin(req, res, next) {
  try {
    if (!(await isSuperAdmin(req.accountId))) {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify admin access' });
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
