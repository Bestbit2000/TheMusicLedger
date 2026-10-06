import express from 'express';
import passport from '../config/passport.js';
import { signToken } from '../utils/authToken.js';
import { currentTokenVersion, forgetTokenVersion } from '../services/tokenVersions.js';
import { passwordLoginEnabled, login, forgotPassword, resetPassword, describeLink, acceptInvite, appUrl, secondStep, setupFromChallenge, confirmSetupFromChallenge } from '../services/passwordAuth.js';
import { mailIsReal } from '../services/mail.js';
import { limitLinkTries } from '../services/passwordAuth.js';
import { describeEmailChange, confirmEmailChange } from '../services/emailChange.js';
import { sendError } from '../utils/httpErrors.js';
import { clientDevice } from '../middleware/auth.js';

// ML-355: every login token carries the account's token version (tv) - read fresh, not from the cache,
// so a login straight after a password reset isn't signed with the old number.
async function freshTokenVersion(email) {
  forgetTokenVersion(email);
  return currentTokenVersion(email);
}

const router = express.Router();

// ML-475: the sign-in token goes back to the page after the "#". That part of an address is never sent
// to a server, so the token is in no request log and no Referer; the page reads it and takes it out of
// the address at once (AuthManager.handleCallback). It used to be "?authToken=...", which is sent.
const handBack = (req, authToken, userId) =>
  `${req.protocol}://${req.get('host')}/#authToken=${encodeURIComponent(authToken)}&userId=${encodeURIComponent(userId)}`;

// Route paths deliberately unchanged (/login, /callback, not the more
// conventional /google, /google/callback) - these are already registered as
// Google's authorized redirect URIs across every environment; renaming them
// would mean re-registering all five.
router.get('/login', async (req, res, next) => {
  // Google OAuth is skipped entirely when running locally, so local dev
  // doesn't need real Google credentials or a browser consent screen.
  // Two independent gates, not one (ML-140) - this used to check only
  // NODE_ENV === 'development', on the assumption that Vercel always sets
  // NODE_ENV=production for both Production and Preview. That assumption
  // turned out to be wrong for this deployment: NODE_ENV=development ended
  // up set on the real production environment, and this bypass silently
  // handed every visitor the same seeded local-dev account instead of ever
  // running real Google auth - nobody could reach their own account.
  // ALLOW_LOCAL_DEV_LOGIN has no legitimate reason to ever be set in Vercel
  // (unlike NODE_ENV, which plenty of tooling sets by convention), so it
  // acts as a second lock a single misconfigured env var can't open alone.
  // Both must be set in server/.env for local dev - see server/README.md.
  if (process.env.NODE_ENV === 'development' && process.env.ALLOW_LOCAL_DEV_LOGIN === 'true') {
    // ?as=admin (ML-310): a second account, a super admin on dev, for back-tests of admin-only actions
    // (publishing a piece to the public library) - local-dev itself is an ordinary standard_member.
    // ?as=standard (ML-345): a third account, a standard member, for back-tests of what Standard
    // members can't see (local-dev is a beta tester on dev since 071_feature_access.sql).
    const admin = req.query.as === 'admin';
    const standard = req.query.as === 'standard';
    const userId = admin ? 'local-admin@themusicledger.local' : standard ? 'local-standard@themusicledger.local' : 'local-dev@themusicledger.local';
    const authToken = signToken({
      userId,
      tv: await freshTokenVersion(userId),
      firstName: 'Local',
      surname: admin ? 'Admin' : standard ? 'Standard' : 'Dev'
    });
    return res.redirect(handBack(req, authToken, userId));
  }
  next();
}, passport.authenticate('google', {
  // 'spreadsheets' scope dropped 2026-09-09 - nothing has talked to Google
  // Sheets since the Postgres cutover (ML-21). The sheet itself is kept
  // around unused, not deleted, so no scope is needed to read/write it.
  // ML-475: no offline access and no forced consent - both were only there to get a refresh key, and
  // the app never calls Google again for a member. Google now signs a returning member straight in.
  scope: ['email', 'profile'],
  session: false
}));

router.get('/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, async (err, tokenData) => {
    if (err || !tokenData) {
      console.error('OAuth callback error:', err || 'no user returned');
      return res.status(500).json({ error: 'Authentication failed', details: err?.message });
    }

    let authToken;
    try {
      authToken = signToken({ ...tokenData, tv: await freshTokenVersion(tokenData.userId) });
    } catch (e) {
      console.error('OAuth callback token error:', e.message);
      return res.status(500).json({ error: 'Authentication failed' });
    }

    // Redirect to frontend with token. Always derive this from the incoming
    // request rather than an env var - a stale FRONTEND_URL (e.g. copied
    // from a local .env into Vercel) would otherwise silently send every
    // deployment back to localhost after login.
    res.redirect(handBack(req, authToken, tokenData.userId));
  })(req, res, next);
});

// Lets an automated tester (or a human) get a valid session without going
// through Google's real consent screen - for sandbox/dev only. Fails closed
// as a 404 (not 401/403) so a misconfigured NODE_ENV doesn't even reveal
// this endpoint exists. Requires TEST_LOGIN_SECRET to be set server-side at
// all, regardless of NODE_ENV, so an empty/unset secret can never match.
router.post('/test-login', async (req, res) => {
  const secret = process.env.TEST_LOGIN_SECRET;
  const provided = req.body?.secret;

  // ML-231: never on the live site, whatever NODE_ENV says there (it was once set to "development"
  // on production by mistake - VERCEL_ENV is set by Vercel itself and can't be got wrong that way)
  if (!secret || process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || provided !== secret) {
    return res.status(404).json({ error: 'Not found' });
  }

  const userId = req.body?.userId || 'claude-test@themusicledger.local';
  const authToken = signToken({ userId, email: userId, isTestAccount: true, tv: await freshTokenVersion(userId) });
  res.json({ authToken, userId });
});

// ---- ML-355: email + password login (docs/password-login.md). All 404 while password_login is off. ----
// Tokens come back as JSON (the page stores them) rather than in a redirect URL.

// Which login methods the login screen offers - the one thing it asks before anyone has logged in.
router.get('/methods', async (req, res) => {
  try {
    res.json({ google: true, password: await passwordLoginEnabled() });
  } catch (error) {
    res.json({ google: true, password: false });
  }
});

router.post('/password/login', async (req, res) => {
  try {
    res.json(await login(req.body?.email, req.body?.password, req.ip));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/password/forgot', async (req, res) => {
  try {
    await forgotPassword(req.body?.email, req.ip, appUrl(req));
    // The same answer whether or not there is an account. ML-479: and an honest one where no email goes
    res.json(mailIsReal()
      ? { message: "If that email has an account, we've sent it a link to choose a new password." }
      : { message: "This site doesn't send emails, so no link has been sent.", notSentHere: true });
  } catch (error) {
    sendError(res, error);
  }
});

// The invite / reset link screens: what the link is for (the email), then the new password.
router.get('/link/:purpose/:secret', async (req, res) => {
  try {
    if (!['invite', 'reset'].includes(req.params.purpose)) return res.status(404).json({ error: 'Not found' });
    res.json(await describeLink(req.params.secret, req.params.purpose, req.ip));
  } catch (error) {
    sendError(res, error);
  }
});

// ML-465: the screen a "confirm my new email address" link opens - what it will do, then doing it.
// Whoever holds the link is the one who can read the new inbox; no sign-in is needed (they may have
// lost the old address). A sign-in token, if the device has one, only says whether this device was
// signed in as that account.
router.get('/email-change/:secret', async (req, res) => {
  try {
    await limitLinkTries(req.ip);
    res.json(await describeEmailChange(req.params.secret));
  } catch (error) {
    sendError(res, error);
  }
});
router.post('/email-change/confirm', async (req, res) => {
  try {
    await limitLinkTries(req.ip);
    const header = req.headers.authorization || '';
    res.json(await confirmEmailChange(req.body?.token, appUrl(req), header.startsWith('Bearer ') ? header.slice(7) : null));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/invite/accept', async (req, res) => {
  try {
    res.json(await acceptInvite(req.body?.token, req.body?.password, req.ip, clientDevice(req)));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/password/reset', async (req, res) => {
  try {
    res.json(await resetPassword(req.body?.token, req.body?.password, req.ip));
  } catch (error) {
    sendError(res, error);
  }
});

// ML-355 batch 2: the code after the password (or setting it up, for a super admin who hasn't yet).
// Each takes the short-lived challenge the password step returned.
router.post('/two-step', async (req, res) => {
  try {
    res.json(await secondStep(req.body?.challenge, req.body?.code, req.ip));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/two-step/setup', async (req, res) => {
  try {
    res.json(await setupFromChallenge(req.body?.challenge, req.ip));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/two-step/setup/confirm', async (req, res) => {
  try {
    res.json(await confirmSetupFromChallenge(req.body?.challenge, req.body?.code, req.ip));
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
