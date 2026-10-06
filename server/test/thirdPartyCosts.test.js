// ML-429: the sums behind costs and usage (server/thirdParties/costs.js). Pure - no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chargesSoFar, isRunning, costSummary, periodFor, meterStatus, alertsDue, paidInMonth } from '../thirdParties/costs.js';

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
