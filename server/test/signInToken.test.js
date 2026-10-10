// ML-475: the sign-in token carries who someone is and nothing of Google's, and is never put where a
// server would see it in an address. Pure checks (no database), plus the source of the three files that
// decide it - so a later change can't quietly put either back.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.SESSION_SECRET ||= 'test-secret-for-signInToken';
const { signToken, verifyToken, carriesGoogleKeys, withoutGoogleKeys } = await import('../utils/authToken.js');

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // without its comments

describe('a token signed before 0.48.0, which carried Google\'s keys', () => {
  const old = { userId: 'sam@example.com', email: 'sam@example.com', firstName: 'Sam', surname: 'Reed', tv: 3,
    access_token: 'ya29.secret', refresh_token: '1//secret', expiry_date: 1790000000000 };

  test('is recognised, and a clean one is not', () => {
    assert.equal(carriesGoogleKeys(verifyToken(signToken(old))), true);
    assert.equal(carriesGoogleKeys({ userId: 'sam@example.com', tv: 3 }), false);
    assert.equal(carriesGoogleKeys({ userId: 'sam@example.com', refresh_token: undefined }), true); // the field being there at all
    assert.equal(carriesGoogleKeys(null), false);
  });

  test('is re-issued as the same sign-in without them', () => {
    const before = verifyToken(signToken(old));
    const after = verifyToken(withoutGoogleKeys(before));
    assert.deepEqual(Object.keys(after).sort(), ['email', 'exp', 'firstName', 'surname', 'tv', 'userId']);
    assert.deepEqual([after.userId, after.email, after.firstName, after.surname, after.tv], ['sam@example.com', 'sam@example.com', 'Sam', 'Reed', 3]);
    assert.equal(carriesGoogleKeys(after), false);
    assert.ok(!JSON.stringify(after).includes('secret'));
  });

  test('keeps its end date - re-issuing is not 30 more days', () => {
    const before = verifyToken(signToken(old, 60 * 60 * 1000)); // an hour left
    const after = verifyToken(withoutGoogleKeys(before));
    assert.ok(Math.abs(after.exp - before.exp) < 2000, `end date moved by ${after.exp - before.exp} ms`);
  });

  test('keeps a test account marked as one, and drops anything it does not know', () => {
    const after = verifyToken(withoutGoogleKeys(verifyToken(signToken({ userId: 't@x.local', isTestAccount: true, tv: 1, access_token: 'a', somethingElse: 'x' }))));
    assert.equal(after.isTestAccount, true);
    assert.equal('somethingElse' in after, false);
  });
});

describe('the code that makes and hands over the token', () => {
  test('Google\'s keys are dropped where they arrive, and never asked to last', () => {
    const passport = code('../config/passport.js');
    for (const word of ['access_token', 'refresh_token', 'expiry_date']) assert.ok(!passport.includes(word), `passport.js still mentions ${word}`);
    const routes = code('../routes/auth.js');
    assert.ok(!/accessType\s*:/.test(routes), 'the sign-in asks Google for offline access again');
    assert.ok(!/prompt\s*:\s*'consent'/.test(routes), 'the sign-in forces Google\'s consent screen again');
  });

  test('nothing on the server reads Google\'s keys from a request', () => {
    const middleware = code('../middleware/auth.js');
    assert.ok(!/req\.google\w+/.test(middleware), 'the auth middleware puts Google\'s keys on the request again');
    assert.ok(!/getUserTokens|saveUserTokens/.test(middleware));
  });

  test('the token goes back to the page after the "#", never in the part of the address a server sees', () => {
    const routes = code('../routes/auth.js');
    assert.ok(!/\?authToken=/.test(routes), 'auth.js puts the token in the query string again');
    assert.ok(/\/#authToken=\$\{encodeURIComponent\(authToken\)\}/.test(routes));
    assert.equal((routes.match(/res\.redirect\(/g) || []).length, (routes.match(/res\.redirect\((handBack|closedPage)\(/g) || []).length, 'a redirect in auth.js does not go through handBack');
    // ML-502: the one other redirect - a closed account goes back to the sign-in screen with no token at all
    assert.ok(routes.includes("const closedPage = (req) => `${req.protocol}://${req.get('host')}/#closed`;"), 'closedPage carries something other than #closed');
  });

  test('the page reads it from there and takes it out of the address', () => {
    const app = read('../../public/app.js');
    const at = app.indexOf('async handleCallback()');
    const handler = app.slice(at, app.indexOf('accept(token, userId) {', at));
    assert.ok(handler.includes('window.location.hash'));
    assert.ok(handler.includes('window.history.replaceState({}, document.title, window.location.pathname)'));
  });
});
