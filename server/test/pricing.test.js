// ML-242: the public pricing page's answer (server/services/pricing.js, pricingFrom) - Standard and Premium
// only, only the listed features and limits, Live AND the type's own switch, a key not in the catalog left
// out so the page keeps what it typed. Pure: the pool is created but never queried.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
const { pricingFrom, PRICING_PLANS, PRICING_FEATURES, PRICING_LIMITS } = await import('../services/pricing.js');

const entry = (live, levels) => ({ live, levels });

describe('pricingFrom', () => {
  const matrix = new Map([
    ['flow_create', entry(true, { standard_member: true, premium_member: true })],
    ['theory_practice', entry(true, { standard_member: false, premium_member: true })],
    ['tuner_rewind', entry(false, { standard_member: true, premium_member: true })],
    ['band_welcome', entry(true, { standard_member: true, premium_member: true })]
  ]);
  const limits = new Map([
    ['home_tools', { standard_member: 4, premium_member: 12, super_admin: 12 }],
    ['invites_per_day', { standard_member: 10, premium_member: 10 }]
  ]);
  const out = pricingFrom(matrix, limits);

  test('only Standard and Premium', () => {
    assert.deepEqual(Object.keys(out), PRICING_PLANS);
  });

  test("each type's own switch, and Live off is off for both", () => {
    assert.equal(out.standard_member.features.flow_create, true);
    assert.equal(out.standard_member.features.theory_practice, false);
    assert.equal(out.premium_member.features.theory_practice, true);
    assert.equal(out.premium_member.features.tuner_rewind, false);
  });

  test('a listed key not in the catalog is left out, so the page keeps its typed cell', () => {
    assert.ok(!('piece_files' in out.standard_member.features));
  });

  test('nothing beyond the listed features and limits', () => {
    for (const plan of PRICING_PLANS) {
      for (const key of Object.keys(out[plan].features)) assert.ok(PRICING_FEATURES.includes(key), key);
      for (const key of Object.keys(out[plan].limits)) assert.ok(PRICING_LIMITS.includes(key), key);
    }
    assert.ok(!('band_welcome' in out.standard_member.features));
    assert.ok(!('invites_per_day' in out.standard_member.limits));
  });

  test("each type's own limit", () => {
    assert.equal(out.standard_member.limits.home_tools, 4);
    assert.equal(out.premium_member.limits.home_tools, 12);
  });
});
