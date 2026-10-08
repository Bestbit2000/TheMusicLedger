// ML-429: the sums behind costs and usage (server/thirdParties/costs.js). Pure - no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chargesSoFar, isRunning, costSummary, periodFor, meterStatus, alertsDue, paidInMonth, parseChargeLines, billingPeriod, spendBreakdown } from '../thirdParties/costs.js';

const cost = (over) => ({ partyKey: 'claude-code', amount: 100, currency: 'USD', cadence: 'monthly', startedOn: '2026-07-10', endedOn: null, ...over });

test('a monthly cost is charged the day it starts and on that day each month after', () => {
  assert.equal(chargesSoFar(cost(), '2026-07-09'), 0);
  assert.equal(chargesSoFar(cost(), '2026-07-10'), 1);
  assert.equal(chargesSoFar(cost(), '2026-08-09'), 1);
  assert.equal(chargesSoFar(cost(), '2026-08-10'), 2);
  assert.equal(chargesSoFar(cost(), '2026-10-04'), 3); // July, August, September
});

test('weekly, yearly and one-off costs', () => {
  assert.equal(chargesSoFar(cost({ cadence: 'weekly', startedOn: '2026-09-01' }), '2026-09-14'), 2);
  assert.equal(chargesSoFar(cost({ cadence: 'weekly', startedOn: '2026-09-01' }), '2026-09-15'), 3);
  assert.equal(chargesSoFar(cost({ cadence: 'yearly', startedOn: '2025-03-01' }), '2026-02-28'), 1);
  assert.equal(chargesSoFar(cost({ cadence: 'yearly', startedOn: '2025-03-01' }), '2026-03-01'), 2);
  assert.equal(chargesSoFar(cost({ cadence: 'one_off', startedOn: '2026-01-01' }), '2026-10-04'), 1);
});

test('a cost that has ended stops being charged, and stops counting towards the running total', () => {
  const ended = cost({ endedOn: '2026-08-31' });
  assert.equal(chargesSoFar(ended, '2026-10-04'), 2);
  assert.equal(isRunning(ended, '2026-10-04'), false);
  assert.equal(isRunning(cost(), '2026-10-04'), true);
  assert.equal(isRunning(cost({ cadence: 'one_off' }), '2026-10-04'), false);
});

test('the summary is in pounds with dollars beside it, at the owner\'s rate', () => {
  const s = costSummary([
    cost(), // $100 a month from 10 July: 3 charges by 4 October
    cost({ partyKey: 'ico', amount: 52, currency: 'GBP', cadence: 'yearly', startedOn: '2026-10-01' }),
    cost({ partyKey: 'domain', amount: 12, currency: 'GBP', cadence: 'one_off', startedOn: '2026-09-01' })
  ], '2026-10-04', 1.25);
  assert.deepEqual(s.spent, { gbp: 240 + 52 + 12, usd: 300 + 65 + 15 });
  assert.deepEqual(s.perYear, { gbp: 960 + 52, usd: 1200 + 65 });
  assert.deepEqual(s.perMonth, { gbp: Math.round((1012 / 12) * 100) / 100, usd: Math.round((1265 / 12) * 100) / 100 });
  assert.deepEqual(s.byParty['claude-code'].spent, { gbp: 240, usd: 300 });
  assert.deepEqual(s.byParty['claude-code'].perMonth, { gbp: 80, usd: 100 });
  assert.equal(s.rows[0].charges, 3);
  assert.equal(s.rows[2].running, false);
});

test('a reading belongs to the period its source gives, or to its calendar month', () => {
  assert.deepEqual(periodFor('2026-10-04T10:00:00Z'), { start: '2026-10-01', end: '2026-10-31' });
  assert.deepEqual(periodFor('2026-10-04', { start: '2026-09-12', end: '2026-10-12' }), { start: '2026-09-12', end: '2026-10-12' });
});

test('a meter says how full it is, where it is heading and when it would hit the limit', () => {
  // 9,390 of 1,000,000 events, 23 days into a 31-day period: nowhere near
  const quiet = meterStatus({ value: 9390, limit: 1000000, period: { start: '2026-09-12', end: '2026-10-12' }, today: '2026-10-04', cumulative: true });
  assert.equal(quiet.percent, 0.9);
  assert.equal(quiet.level, 'pass');
  assert.equal(quiet.reachesLimitOn, null);
  // 80 compute hours of 100, 10 days into October: heading for 248, the limit reached on the 13th
  const busy = meterStatus({ value: 80, limit: 100, period: { start: '2026-10-01', end: '2026-10-31' }, today: '2026-10-10', cumulative: true });
  assert.equal(busy.percent, 80);
  assert.equal(busy.level, 'warn');
  assert.equal(busy.projected, 248);
  assert.equal(busy.reachesLimitOn, '2026-10-13');
  // storage is a total, not something that resets: no projection
  const store = meterStatus({ value: 0.95, limit: 1, period: null, today: '2026-10-10', cumulative: false });
  assert.equal(store.percent, 95);
  assert.equal(store.level, 'fail');
  assert.equal(store.projected, null);
});

test('a warning is due once for each threshold reached in a period', () => {
  assert.deepEqual(alertsDue(60, []), []);
  assert.deepEqual(alertsDue(80, []), [75]);
  assert.deepEqual(alertsDue(95, [75]), [90]);
  assert.deepEqual(alertsDue(95, [75, 90]), []);
  assert.deepEqual(alertsDue(null, []), []);
});

// ML-443: actual v forecast - what was paid in one calendar month
test('paid in a month counts the payments that fell in it, in pounds', () => {
  const costs = [
    cost(), // $100 on the 10th of each month from July
    cost({ amount: 90, currency: 'GBP', cadence: 'yearly', startedOn: '2026-10-20' }),
    cost({ amount: 19, currency: 'GBP', cadence: 'one_off', startedOn: '2026-09-03' })
  ];
  assert.equal(paidInMonth(costs, '2026-10', '2026-11-15', 1.25), 170); // $100 = £80, plus the £90 yearly
  assert.equal(paidInMonth(costs, '2026-09', '2026-11-15', 1.25), 99);  // £80 plus the one-off £19
  assert.equal(paidInMonth(costs, '2026-06', '2026-11-15', 1.25), 0);   // before anything started
});

test('a month that is not over counts only what has been paid so far, and a future month nothing', () => {
  const costs = [cost(), cost({ amount: 90, currency: 'GBP', cadence: 'yearly', startedOn: '2026-10-20' })];
  assert.equal(paidInMonth(costs, '2026-10', '2026-10-06', 1.25), 0);
  assert.equal(paidInMonth(costs, '2026-10', '2026-10-10', 1.25), 80);
  assert.equal(paidInMonth(costs, '2026-10', '2026-10-20', 1.25), 170);
  assert.equal(paidInMonth(costs, '2026-12', '2026-10-20', 1.25), 0);
});

test('a weekly cost is paid as many times as its day falls in the month', () => {
  const weekly = [cost({ amount: 10, currency: 'GBP', cadence: 'weekly', startedOn: '2026-10-01' })];
  assert.equal(paidInMonth(weekly, '2026-10', '2026-12-01', 1.25), 50); // 1, 8, 15, 22, 29 October
  assert.equal(paidInMonth(weekly, '2026-11', '2026-12-01', 1.25), 40); // 5, 12, 19, 26 November
});

// Vercel's bill, line by line (the spend reader)
const charge = (over) => JSON.stringify({ BilledCost: 0, EffectiveCost: 0, ChargeCategory: 'Usage', ChargePeriodStart: '2026-10-07T00:00:00.000Z', ChargePeriodEnd: '2026-10-08T00:00:00.000Z', ConsumedQuantity: 0, ConsumedUnit: 'GB', ServiceName: 'Fast Data Transfer', SkuId: 'fast-data-transfer', Tags: {}, ...over });

test('a bill is read a line at a time, and lines for the same day and service are added up', () => {
  const text = [
    charge({ ConsumedQuantity: 0.5, BilledCost: 0.075, Tags: { ProjectName: 'app' } }),
    charge({ ConsumedQuantity: 0.25, BilledCost: 0.0375, Tags: { ProjectName: 'other' } }),
    '',
    'not json at all',
    charge({ ChargePeriodStart: '2026-10-08T00:00:00.000Z', ConsumedQuantity: 1, BilledCost: 0.15 }),
    charge({ ChargeCategory: 'Purchase', ServiceName: 'Pro', SkuId: 'pro-plan', ConsumedQuantity: null, ConsumedUnit: null, BilledCost: 20 }),
    JSON.stringify({ BilledCost: 1 }) // no day: skipped
  ].join('\r\n');
  const lines = parseChargeLines(text);
  assert.equal(lines.length, 3);
  const first = lines.find((l) => l.day === '2026-10-07' && l.sku === 'fast-data-transfer');
  assert.equal(first.quantity, 0.75);
  assert.ok(Math.abs(first.cost - 0.1125) < 1e-9);
  assert.equal(first.unit, 'GB');
  const fee = lines.find((l) => l.category === 'Purchase');
  assert.deepEqual([fee.quantity, fee.unit, fee.cost], [0, '', 20]);
  assert.deepEqual(parseChargeLines(''), []);
  assert.deepEqual(parseChargeLines(null), []);
});

test('the cost of a line is the larger of what is billed and what it is worth', () => {
  // usage the plan's credit pays for may be billed at nothing but still has a value
  const [line] = parseChargeLines(charge({ BilledCost: 0, EffectiveCost: 0.3 }));
  assert.equal(line.cost, 0.3);
  const [other] = parseChargeLines(charge({ BilledCost: '0.4', EffectiveCost: 0 }));
  assert.equal(other.cost, 0.4);
});

test('a billing period runs from the billing day to the day before the next one', () => {
  assert.deepEqual(billingPeriod(7, '2026-10-07'), { start: '2026-10-07', end: '2026-11-06' });
  assert.deepEqual(billingPeriod(7, '2026-10-06'), { start: '2026-09-07', end: '2026-10-06' });
  assert.deepEqual(billingPeriod(7, '2027-01-03'), { start: '2026-12-07', end: '2027-01-06' });
  assert.deepEqual(billingPeriod(1, '2026-02-15'), { start: '2026-02-01', end: '2026-02-28' });
  assert.deepEqual(billingPeriod(31, '2026-02-15'), { start: '2026-01-28', end: '2026-02-27' }); // kept to the 28th
  assert.deepEqual(billingPeriod('nonsense', '2026-10-20'), { start: '2026-10-01', end: '2026-10-31' });
});

test('where the usage is going: each service so far, where it is heading, and for each member', () => {
  const period = { start: '2026-10-07', end: '2026-11-06' }; // 31 days
  const line = (over) => ({ day: '2026-10-07', sku: 'cpu', service: 'Fluid Active CPU', category: 'Usage', unit: 'Hours', quantity: 0, cost: 0, ...over });
  const lines = [
    line({ quantity: 1, cost: 0.177 }),
    line({ day: '2026-10-08', quantity: 1, cost: 0.177 }),
    line({ sku: 'transfer', service: 'Fast Data Transfer', unit: 'GB', quantity: 4, cost: 0.6 }),
    line({ sku: 'pro', service: 'Pro', category: 'Purchase', unit: '', quantity: 0, cost: 20 }), // the plan's fee is not usage
    line({ day: '2026-10-01', quantity: 50, cost: 9 }) // before the period
  ];
  const b = spendBreakdown(lines, period, '2026-10-08', 2); // day 2 of 31
  assert.deepEqual([b.daysIn, b.daysTotal, b.members], [2, 31, 2]);
  assert.equal(b.total, 0.954);
  assert.equal(b.projected, 14.787);
  assert.equal(b.perMember, 7.3935);
  assert.deepEqual(b.services.map((s) => s.sku), ['transfer', 'cpu']); // dearest first
  const cpu = b.services[1];
  assert.deepEqual([cpu.quantity, cpu.cost, cpu.projectedQuantity, cpu.projectedCost], [2, 0.354, 31, 5.487]);
  assert.deepEqual(cpu.perMember, { quantity: 15.5, cost: 2.7435 });
  assert.deepEqual(b.daily, [{ day: '2026-10-07', cost: 0.777 }, { day: '2026-10-08', cost: 0.177 }]);
});

test('with nobody seen in the period there is no figure for each member, and no usage is nothing', () => {
  const period = { start: '2026-10-07', end: '2026-11-06' };
  const b = spendBreakdown([{ day: '2026-10-07', sku: 'cpu', service: 'CPU', category: 'Usage', unit: 'Hours', quantity: 1, cost: 0.2 }], period, '2026-10-07', 0);
  assert.equal(b.perMember, null);
  assert.equal(b.services[0].perMember, null);
  const none = spendBreakdown([], period, '2026-10-07', 3);
  assert.deepEqual([none.total, none.projected, none.services.length], [0, 0, 0]);
  // a day after the period has ended is not projected past its end
  assert.equal(spendBreakdown([{ day: '2026-10-07', sku: 'cpu', service: 'CPU', category: 'Usage', unit: 'Hours', quantity: 1, cost: 0.2 }], period, '2026-12-01', 1).projected, 0.2);
});
