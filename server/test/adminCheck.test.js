// ML-518: the admin panel's "prove it's you" check - how long a check lasts, where it is asked, that
// it rides on the sign-in token without changing anything else about it, and the guard itself.
// No database. docs/admin-passkey.md.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_SECRET ||= 'test-secret-for-admin-check';
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
const { adminCheckRequired, checkState, checkedToken, slidToken, lockedToken, IDLE_MS, MAX_MS } = await import('../services/adminCheckRules.js');
const { signToken, verifyToken } = await import('../utils/authToken.js');
const { requireAdminCheck } = await import('../middleware/auth.js');
const { default: pool } = await import('../config/db.js');
test.after(() => pool.end().catch(() => {}));

const MIN = 60 * 1000;
const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);

describe('where the check is asked', () => {
  test('everywhere but a developer\'s machine with the local sign-in on', () => {
    assert.equal(adminCheckRequired({ NODE_ENV: 'development', ALLOW_LOCAL_DEV_LOGIN: 'true' }), false);
    assert.equal(adminCheckRequired({ NODE_ENV: 'development' }), true);
    assert.equal(adminCheckRequired({ ALLOW_LOCAL_DEV_LOGIN: 'true' }), true);
    assert.equal(adminCheckRequired({ NODE_ENV: 'production' }), true);
    assert.equal(adminCheckRequired({}), true);
  });
  test('on Vercel always, whatever else is set there (NODE_ENV was once "development" on the live site)', () => {
    for (const VERCEL_ENV of ['production', 'preview', 'development']) {
      assert.equal(adminCheckRequired({ VERCEL_ENV, NODE_ENV: 'development', ALLOW_LOCAL_DEV_LOGIN: 'true' }), true);
    }
  });
  test('ADMIN_CHECK=on asks for it on a developer\'s machine too - and nothing switches it off', () => {
    assert.equal(adminCheckRequired({ ADMIN_CHECK: 'on', NODE_ENV: 'development', ALLOW_LOCAL_DEV_LOGIN: 'true' }), true);
    assert.equal(adminCheckRequired({ ADMIN_CHECK: 'off', NODE_ENV: 'production' }), true);
    assert.equal(adminCheckRequired({ ADMIN_CHECK: 'off', VERCEL_ENV: 'production' }), true);
  });
});

describe('how long a check lasts', () => {
  test('15 minutes without use, and 8 hours at most (the owner, 10 Oct 2026)', () => {
    assert.equal(IDLE_MS, 15 * MIN);
    assert.equal(MAX_MS, 8 * 60 * MIN);
  });
  test('no check, or one that can\'t be read, is not fresh', () => {
    for (const adm of [undefined, null, {}, { at: 'x', seen: NOW }, { at: NOW }, 'yes', true]) assert.equal(checkState(adm, NOW).fresh, false);
  });
  test('fresh while it is used; stale 15 minutes after it was last used', () => {
    assert.equal(checkState({ at: NOW, seen: NOW, how: 'passkey' }, NOW).fresh, true);
    assert.equal(checkState({ at: NOW, seen: NOW, how: 'passkey' }, NOW + 15 * MIN).fresh, true);
    assert.equal(checkState({ at: NOW, seen: NOW, how: 'passkey' }, NOW + 15 * MIN + 1).fresh, false);
    // used 10 minutes in: good until 25 minutes
    assert.equal(checkState({ at: NOW, seen: NOW + 10 * MIN, how: 'passkey' }, NOW + 24 * MIN).fresh, true);
    assert.equal(checkState({ at: NOW, seen: NOW + 10 * MIN, how: 'passkey' }, NOW + 26 * MIN).fresh, false);
  });
  test('8 hours after it was made it is stale, however much it has been used', () => {
    const adm = { at: NOW, seen: NOW + MAX_MS - MIN, how: 'passkey' };
    assert.equal(checkState(adm, NOW + MAX_MS).fresh, true);
    assert.equal(checkState(adm, NOW + MAX_MS + 1).fresh, false);
    assert.equal(checkState(adm, NOW + MAX_MS - 30 * 1000).until, NOW + MAX_MS);
  });
  test('times that can\'t be right are refused', () => {
    assert.equal(checkState({ at: NOW + 10 * MIN, seen: NOW + 10 * MIN }, NOW).fresh, false); // made in the future
    assert.equal(checkState({ at: NOW, seen: NOW - MIN }, NOW).fresh, false);                  // used before it was made
  });
  test('the token is handed back with the time moved on at most once a minute', () => {
    assert.equal(checkState({ at: NOW, seen: NOW }, NOW + 30 * 1000).slide, false);
    assert.equal(checkState({ at: NOW, seen: NOW }, NOW + 61 * 1000).slide, true);
  });
  test('how it was made: only "code" counts as a code', () => {
    assert.equal(checkState({ at: NOW, seen: NOW, how: 'code' }, NOW).how, 'code');
    assert.equal(checkState({ at: NOW, seen: NOW, how: 'passkey' }, NOW).how, 'passkey');
    assert.equal(checkState({ at: NOW, seen: NOW }, NOW).how, 'passkey');
  });
});

describe('the check rides on the sign-in token', () => {
  const signIn = () => verifyToken(signToken({ userId: 'a@example.com', firstName: 'A', surname: 'B', tv: 3 }, 20 * 24 * 60 * MIN));
  test('making a check changes nothing else: same member, same token version, same end date', () => {
    const before = signIn();
    const after = verifyToken(checkedToken(before, 'code', Date.now()));
    assert.equal(after.userId, before.userId);
    assert.equal(after.tv, 3);
    assert.ok(Math.abs(after.exp - before.exp) < 2000, 'the sign-in does not get a new 30 days');
    assert.equal(after.adm.how, 'code');
    assert.equal(checkState(after.adm, Date.now()).fresh, true);
  });
  test('moving the time on keeps when the check was made, so the 8 hours still count from then', () => {
    const made = Date.now() - 20 * MIN;
    const token = verifyToken(checkedToken(signIn(), 'passkey', made));
    const slid = verifyToken(slidToken({ ...token, adm: { ...token.adm, seen: made + 10 * MIN } }, Date.now()));
    assert.equal(slid.adm.at, made);
    assert.equal(slid.adm.how, 'passkey');
    assert.ok(slid.adm.seen > made + 10 * MIN);
  });
  test('locking takes the check out and leaves the sign-in', () => {
    const locked = verifyToken(lockedToken(verifyToken(checkedToken(signIn(), 'passkey', Date.now()))));
    assert.equal(locked.adm, undefined);
    assert.equal(locked.userId, 'a@example.com');
  });
  test('a check can\'t be written by hand: a changed token no longer verifies', () => {
    const token = signToken({ userId: 'a@example.com', tv: 0 });
    const [, signature] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ userId: 'a@example.com', tv: 0, adm: { at: Date.now(), seen: Date.now(), how: 'code' }, exp: Date.now() + MIN })).toString('base64url')}.${signature}`;
    assert.throws(() => verifyToken(forged), /signature/);
  });
});

describe('the QR code on the set-up screen (ML-519)', () => {
  const LINK = 'otpauth://totp/Notably%20Better%3Aa%40example.com?secret=ZRFVQTBOBT2DKHQIVMUZ5H3DFD5P6IXL&issuer=Notably%20Better&algorithm=SHA1&digits=6&period=30';
  test('is a square QR code with the three corner squares a scanner looks for', async () => {
    const { qrModules } = await import('../services/adminCheck.js');
    const m = qrModules(LINK);
    assert.ok(m.length >= 21 && m.every((row) => row.length === m.length));
    const corner = (r0, c0) => Array.from({ length: 7 }, (_, r) => Array.from({ length: 7 }, (__, c) => (m[r0 + r][c0 + c] ? '#' : '.')).join('')).join('/');
    const FINDER = '#######/#.....#/#.###.#/#.###.#/#.###.#/#.....#/#######';
    assert.equal(corner(0, 0), FINDER);
    assert.equal(corner(0, m.length - 7), FINDER);
    assert.equal(corner(m.length - 7, 0), FINDER);
  });
  test('is sent as a picture that carries its own black on white and a quiet border', async () => {
    const { qrImage, qrModules } = await import('../services/adminCheck.js');
    const uri = qrImage(LINK);
    assert.match(uri, /^data:image\/svg\+xml;base64,/);
    const svg = Buffer.from(uri.split(',')[1], 'base64').toString('utf8');
    const size = qrModules(LINK).length + 8;
    assert.ok(svg.includes(`viewBox="0 0 ${size} ${size}"`));
    assert.ok(svg.includes('fill="#fff"') && svg.includes('fill="#000"'));
    assert.ok(!/<script|href|on\w+=/.test(svg));
    assert.notEqual(qrImage(LINK), qrImage(LINK.replace('ZRFV', 'AAAA')));
  });
});

describe('the guard on every admin route', () => {
  const run = (adm, env) => {
    const kept = { ...process.env };
    for (const k of ['ADMIN_CHECK', 'VERCEL_ENV', 'NODE_ENV', 'ALLOW_LOCAL_DEV_LOGIN']) delete process.env[k];
    Object.assign(process.env, env);
    const out = { status: 200, body: null, headers: {}, next: false };
    const res = { status(s) { out.status = s; return res; }, json(b) { out.body = b; return res; }, set(k, v) { out.headers[k] = v; return res; } };
    try {
      requireAdminCheck({ tokenPayload: { userId: 'a@example.com', tv: 0, exp: Date.now() + 60 * MIN, ...(adm ? { adm } : {}) } }, res, () => { out.next = true; });
    } finally {
      for (const k of ['ADMIN_CHECK', 'VERCEL_ENV', 'NODE_ENV', 'ALLOW_LOCAL_DEV_LOGIN']) delete process.env[k];
      Object.assign(process.env, kept);
    }
    return out;
  };
  const LIVE = { VERCEL_ENV: 'production', NODE_ENV: 'production' };
  test('refuses a super admin who hasn\'t proved it is them, in words the page can act on', () => {
    const out = run(null, LIVE);
    assert.equal(out.next, false);
    assert.equal(out.status, 403);
    assert.equal(out.body.adminCheck, 'needed');
  });
  test('refuses a check that has run out', () => {
    const old = Date.now() - 16 * MIN;
    assert.equal(run({ at: old, seen: old, how: 'passkey' }, LIVE).next, false);
  });
  test('lets a fresh check through, and hands the token back once a minute has gone', () => {
    const justNow = run({ at: Date.now(), seen: Date.now(), how: 'passkey' }, LIVE);
    assert.equal(justNow.next, true);
    assert.equal(justNow.headers['X-Refreshed-Token'], undefined);
    const made = Date.now() - 5 * MIN;
    const later = run({ at: made, seen: made, how: 'code' }, LIVE);
    assert.equal(later.next, true);
    const handed = verifyToken(later.headers['X-Refreshed-Token']);
    assert.equal(handed.adm.at, made);
    assert.equal(handed.adm.how, 'code');
    assert.ok(handed.adm.seen > made);
  });
  test('is not asked on a developer\'s machine with the local sign-in on', () => {
    assert.equal(run(null, { NODE_ENV: 'development', ALLOW_LOCAL_DEV_LOGIN: 'true' }).next, true);
  });
});
