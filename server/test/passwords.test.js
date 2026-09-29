// ML-355: password hashing and the password rules (server/services/passwords.js).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, passwordProblem, PASSWORD_MIN } from '../services/passwords.js';

describe('password hashing', () => {
  test('a hash verifies its own password only, and never contains it', async () => {
    const hash = await hashPassword('Tuba-practice-2026!');
    assert.match(hash, /^scrypt\$32768\$8\$1\$[\w-]+\$[\w-]+$/);
    assert.ok(!hash.includes('Tuba'));
    assert.equal(await verifyPassword('Tuba-practice-2026!', hash), true);
    assert.equal(await verifyPassword('tuba-practice-2026!', hash), false);
    assert.equal(await verifyPassword('', hash), false);
  });
  test('the same password hashes differently each time (a fresh salt)', async () => {
    assert.notEqual(await hashPassword('same password here'), await hashPassword('same password here'));
  });
  test('the cost is read from the hash, so old hashes keep working if it changes', async () => {
    const hash = await hashPassword('Cornet-scales-daily-7');
    const [, , r, p, salt, key] = hash.split('$');
    const crypto = await import('node:crypto');
    const cheap = crypto.scryptSync('Cornet-scales-daily-7', Buffer.from(salt, 'base64url'), 64, { N: 1024, r: Number(r), p: Number(p) });
    assert.equal(await verifyPassword('Cornet-scales-daily-7', ['scrypt', 1024, r, p, salt, cheap.toString('base64url')].join('$')), true);
    assert.notEqual(key, cheap.toString('base64url'));
  });
  test('anything that isn\'t a scrypt hash never verifies', async () => {
    assert.equal(await verifyPassword('x', ''), false);
    assert.equal(await verifyPassword('x', 'plain-text-password'), false);
    assert.equal(await verifyPassword('x', null), false);
  });
});

describe('password rules', () => {
  test(`at least ${PASSWORD_MIN} characters, at most 200`, async () => {
    process.env.PASSWORD_BREACH_CHECK = 'off'; // no network in unit tests
    assert.match(await passwordProblem('short'), /at least 10/);
    assert.match(await passwordProblem('x'.repeat(201)), /no more than 200/);
    assert.equal(await passwordProblem('ten chars!'), null);
    assert.match(await passwordProblem(undefined), /at least/);
  });
});
