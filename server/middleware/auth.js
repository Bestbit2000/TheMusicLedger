import { verifyToken, carriesGoogleKeys, withoutGoogleKeys } from '../utils/authToken.js';
import { getOrCreateAccount, isSuperAdmin, getAccountLevel, touchLastSeen } from '../services/accounts.js';
import { featureContext, ACCOUNT_TYPE_KEYS } from '../services/features.js';
import { tokenIsCurrent } from '../services/tokenVersions.js';
import { isWriteId, claimWrite, releaseWrite } from '../services/clientWrites.js';
import { adminCheckRequired, checkState, slidToken } from '../services/adminCheckRules.js';

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

// ML-475: a token signed before 0.48.0 carries Google's own access and refresh keys. The member is
// handed the same sign-in without them (X-Refreshed-Token - the app swaps to it at once), and the
// refresh key is cancelled at Google so the copy left in the old token is worth nothing. Neither is
// waited for or allowed to fail the request.
const cancelled = new Set();
function dropGoogleKeys(tokenData, res) {
  if (!carriesGoogleKeys(tokenData)) return;
  try { res.set('X-Refreshed-Token', withoutGoogleKeys(tokenData)); } catch (error) { console.error('Token not re-issued:', error.message); }
  const key = tokenData.refresh_token || tokenData.access_token;
  if (!key || cancelled.has(key)) return;
  cancelled.add(key);
  // A fixed Google address - nothing here comes from the request but the key itself
  fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: key }), signal: AbortSignal.timeout(5000)
  }).catch(() => { cancelled.delete(key); }); // try again another time
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
    dropGoogleKeys(tokenData, res);

    req.tokenPayload = tokenData; // ML-518: the admin panel's check rides on the token (requireAdminCheck)
    req.tokenVersion = Number(tokenData.tv || 0);
    req.userId = tokenData.userId;
    req.firstName = tokenData.firstName || '';
    req.surname = tokenData.surname || '';
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

    req.tokenVersion = Number(tokenData.tv || 0);
    req.userId = tokenData.userId;
    req.firstName = tokenData.firstName || '';
    req.surname = tokenData.surname || '';
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
// ML-392: what a sign-up alert says about the device - the browser's User-Agent, and Chrome's phone model
// when it sends it (asked for with Accept-CH, server/app.js).
export const clientDevice = (req) => ({ userAgent: req.get('user-agent') || '', model: req.get('sec-ch-ua-model') || '' });

export async function resolveAccount(req, res, next) {
  let level;
  try {
    req.accountId = await getOrCreateAccount(req.userId, req.firstName, req.surname, clientDevice(req), req.tokenVersion ?? null);
    level = await getAccountLevel(req.accountId);
    touchLastSeen(req.accountId); // ML-443: the day they last used the app (once a day, not waited for)
  } catch (error) {
    // ML-465: a token for an address that has since been deleted or changed - signed out, not an error
    if (error.status === 401) return res.status(401).json({ error: 'Invalid or expired token' });
    console.error('Account resolution error:', error.message);
    return res.status(500).json({ error: 'Failed to resolve account' });
  }
  req.realAccountLevel = level;
  const preview = req.headers['x-preview-level'];
  req.accountLevel = level === 'super_admin' && ACCOUNT_TYPE_KEYS.includes(preview) ? preview : level;
  // ML-220: something logged offline and sent later carries its own id. The second time the same id
  // arrives (the app didn't hear the first answer) it is not done again. A write that fails gives its
  // id back, so the next try goes through.
  const writeId = req.get('x-client-write-id');
  if (req.method !== 'GET' && isWriteId(writeId)) {
    try {
      if (!(await claimWrite(req.accountId, writeId))) return res.json({ alreadySaved: true });
      res.on('finish', () => { if (res.statusCode >= 400) releaseWrite(req.accountId, writeId).catch((error) => console.error('Client write not released:', error.message)); });
    } catch (error) {
      console.error('Client write check failed:', error.message);
      return res.status(500).json({ error: 'Failed to check the request' });
    }
  }
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

// ML-518: on top of being a super admin, the admin panel asks them to prove it is them - a passkey or
// an authenticator code - and that check lasts 15 minutes without use, 8 hours at most
// (docs/admin-passkey.md). Chained after requireSuperAdmin on every admin route but the ones that
// make the check (/gate...). The check is written in the sign-in token itself (`adm`), which only the
// server can sign; while the panel is in use the token is handed back with the time moved on
// (X-Refreshed-Token, as ML-475 does). Not asked where the local dev sign-in is on.
export function requireAdminCheck(req, res, next) {
  if (!adminCheckRequired()) return next();
  const now = Date.now();
  const state = checkState(req.tokenPayload?.adm, now);
  if (!state.fresh) return res.status(403).json({ error: 'Prove it\'s you to carry on in the admin panel.', adminCheck: 'needed' });
  if (state.slide) {
    try { res.set('X-Refreshed-Token', slidToken(req.tokenPayload, now)); } catch (error) { console.error('Admin check not moved on:', error.message); }
  }
  next();
}

