// ML-355 batch 2: two-step sign-in's code maths (server/services/twoStep.js) - pure parts only.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
process.env.SESSION_SECRET ||= 'unit-test-secret';
const { hotp, matchingStep, stepAt, base32Encode, base32Decode, otpauthUrl, encryptSecret, decryptSecret } = await import('../services/twoStep.js');

// RFC 6238 appendix B, SHA-1: secret "12345678901234567890"; the 6-digit codes are the last 6 of the 8.
const RFC_SECRET = Buffer.from('12345678901234567890');
describe('TOTP (RFC 6238)', () => {
  test('matches the RFC test vectors', () => {
    for (const [seconds, eight] of [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037']]) {
      assert.equal(hotp(RFC_SECRET, Math.floor(seconds / 30), 8), eight);
      assert.equal(hotp(RFC_SECRET, Math.floor(seconds / 30)), eight.slice(2));
    }
  });
  test('a code from the step before or after still matches (clock drift), two steps off does not', () => {
    const now = 1234567890 * 1000;
    const s = stepAt(now);
    assert.equal(matchingStep(RFC_SECRET, hotp(RFC_SECRET, s), now), s);
    assert.equal(matchingStep(RFC_SECRET, hotp(RFC_SECRET, s - 1), now), s - 1);
    assert.equal(matchingStep(RFC_SECRET, hotp(RFC_SECRET, s + 1), now), s + 1);
    assert.equal(matchingStep(RFC_SECRET, hotp(RFC_SECRET, s - 2), now), null);
  });
  test('only 6 digits count; spaces are ignored', () => {
    const now = 59 * 1000;
    assert.equal(matchingStep(RFC_SECRET, '287 082', now), 1);
    assert.equal(matchingStep(RFC_SECRET, '28708', now), null);
    assert.equal(matchingStep(RFC_SECRET, 'abcdef', now), null);
    assert.equal(matchingStep(RFC_SECRET, '', now), null);
  });
});

describe('setup details', () => {
  test('base32 round-trips, and matches RFC 4648', () => {
    assert.equal(base32Encode(Buffer.from('foobar')), 'MZXW6YTBOI');
    const secret = Buffer.from('0123456789abcdefghij');
    assert.deepEqual(base32Decode(base32Encode(secret)), secret);
    assert.deepEqual(base32Decode('mzxw 6ytb oi'), Buffer.from('foobar'));
  });
  test('the authenticator link names the app and the account', () => {
    const url = otpauthUrl('MZXW6YTBOI', 'sam+1@example.com');
    assert.equal(url, 'otpauth://totp/The%20Music%20Ledger%3Asam%2B1%40example.com?secret=MZXW6YTBOI&issuer=The%20Music%20Ledger&algorithm=SHA1&digits=6&period=30');
  });
  test('the stored secret is encrypted, and decrypts back', () => {
    const secret = Buffer.from('0123456789abcdefghij');
    const stored = encryptSecret(secret);
    assert.ok(!stored.includes(secret.toString('base64url')));
    assert.notEqual(encryptSecret(secret), stored); // a fresh IV each time
    assert.deepEqual(decryptSecret(stored), secret);
    const [iv, tag, data] = stored.split('.');
    assert.throws(() => decryptSecret([iv, tag, data.slice(0, -2) + 'AA'].join('.'))); // tampered
  });
});
