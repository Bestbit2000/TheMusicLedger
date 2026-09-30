// ML-345: the feature-access rule (server/services/features.js, featureOn) - Live AND the account
// type's own switch; Super admin always; a type with no switch yet doesn't have it; a key that isn't in
// the catalog isn't gated. Pure: the pool is created but never queried.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
const { featureOn, limitFor, ACCOUNT_TYPE_KEYS } = await import('../services/features.js');

const entry = (live, levels) => ({ live, levels });

describe('featureOn', () => {
  test('on only when Live and on for the account type', () => {
    const e = entry(true, { standard_member: false, premium_member: true });
    assert.equal(featureOn(e, 'premium_member'), true);
    assert.equal(featureOn(e, 'standard_member'), false);
  });
  test('Live off turns it off for everyone - Super admin too', () => {
    const e = entry(false, { premium_member: true });
    assert.equal(featureOn(e, 'premium_member'), false);
    assert.equal(featureOn(e, 'super_admin'), false);
  });
  test('Super admin always has a Live feature, with or without a switch', () => {
    assert.equal(featureOn(entry(true, {}), 'super_admin'), true);
  });
  test('a brand-new feature (no switch for a type) is Super admin only', () => {
    const e = entry(true, {});
    for (const t of ACCOUNT_TYPE_KEYS.filter(k => k !== 'super_admin')) assert.equal(featureOn(e, t), false, t);
  });
  test('a key that isn\'t in the catalog isn\'t gated', () => {
    assert.equal(featureOn(undefined, 'standard_member'), true);
  });
  test('no account in context: Live alone', () => {
    assert.equal(featureOn(entry(true, {}), null), true);
    assert.equal(featureOn(entry(false, {}), null), false);
  });
  test('six account types, Teacher among them (ML-346)', () => {
    assert.deepEqual([...ACCOUNT_TYPE_KEYS], ['standard_member', 'premium_member', 'beta_tester', 'teacher', 'band_admin', 'super_admin']);
  });
});

// ML-383: limits by account type (limitFor) - the type's own number; a type with no number gets the
// fallback; no account in context gets the lowest (safest); an unknown limit gets the fallback.
describe('feature limits (ML-383)', () => {
  const values = { standard_member: 10, premium_member: 100, super_admin: 100 };
  test("the account type's own number", () => {
    assert.equal(limitFor(values, 'standard_member', 50), 10);
    assert.equal(limitFor(values, 'premium_member', 50), 100);
    assert.equal(limitFor(values, 'super_admin', 50), 100);
  });
  test('a type with no number gets the fallback', () => {
    assert.equal(limitFor(values, 'teacher', 50), 50);
  });
  test('no account in context gets the lowest', () => {
    assert.equal(limitFor(values, null, 50), 10);
  });
  test('an unknown limit gets the fallback', () => {
    assert.equal(limitFor(undefined, 'standard_member', 7), 7);
  });
  test('0 is a real limit, not "missing"', () => {
    assert.equal(limitFor({ standard_member: 0 }, 'standard_member', 10), 0);
  });
});
