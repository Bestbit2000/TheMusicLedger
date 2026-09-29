import { verifyToken } from '../utils/authToken.js';
import { getOrCreateAccount, isSuperAdmin, getAccountLevel } from '../services/accounts.js';
import { featureContext, ACCOUNT_TYPE_KEYS } from '../services/features.js';
import { tokenIsCurrent } from '../services/tokenVersions.js';

// ML-355: a token signed before the account's last password reset is refused ("signed out everywhere").
// A database error answers 500, not 401 - a 401 logs the app out (ML-48), which a blip mustn't do.
async function rejectOldToken(tokenData, res) {
  let current;
  try { current = await tokenIsCurrent(tokenData); } catch (error) {
    console.error('Token version check failed:', error.message);
    res.status(500).json({ error: 'Could not check your login - try again' });
    return true;
  }
  if (!current) { res.status(401).json({ error: 'Invalid or expired token' }); return true; }
  return false;
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.substring(7);
    const tokenData = verifyToken(token);
    if (await rejectOldToken(tokenData, res)) return;

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

// ML-179: same check as requireAuth, but also accepts ?token=... as a fallback when the
// Authorization header is missing. Needed only for the Blob upload-token routes -
// @vercel/blob/client's upload() makes its own internal fetch() to handleUploadUrl with a
// hardcoded header set (just content-type), with no option to attach a custom Authorization
// header, so the token has to travel via the URL app.js builds instead. Deliberately a separate
// function, not a change to requireAuth itself, so no other route gains a query-string auth path.
export async function requireAuthFromQueryOrHeader(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const token = headerToken || req.query.token;
    if (!token) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const tokenData = verifyToken(token);
    if (await rejectOldToken(tokenData, res)) return;

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
//
// ML-345: also works out the account type, which decides the account's features, and runs the rest
// of the request with it (featureContext), so every isFeatureEnabled check answers for this account.
// A super admin can preview the app as another type (Admin -> Feature access, "Preview the app as")
// with the X-Preview-Level header - only a super admin's is honoured, and admin routes still check
// the real level (requireSuperAdmin reads the database).
export async function resolveAccount(req, res, next) {
  let level;
  try {
    req.accountId = await getOrCreateAccount(req.userId, req.firstName, req.surname);
    level = await getAccountLevel(req.accountId);
  } catch (error) {
    console.error('Account resolution error:', error.message);
    return res.status(500).json({ error: 'Failed to resolve account' });
  }
  req.realAccountLevel = level;
  const preview = req.headers['x-preview-level'];
  req.accountLevel = level === 'super_admin' && ACCOUNT_TYPE_KEYS.includes(preview) ? preview : level;
  featureContext.run({ accountLevel: req.accountLevel }, next);
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
