// ML-443: the Dashboard's rules (server/services/adminDashboardRules.js). Pure - no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { daysToLaunch, needsYou } from '../services/adminDashboardRules.js';

test('days to launch count to the first of the launch month', () => {
  assert.equal(daysToLaunch('2027-01', new Date('2026-10-06T15:00:00Z')), 87);
  assert.equal(daysToLaunch('2026-10', new Date('2026-10-01T00:00:00Z')), 0);
  assert.equal(daysToLaunch('2026-09', new Date('2026-10-06T00:00:00Z')), -35);
});

test('days to launch are left out when there is no launch month', () => {
  assert.equal(daysToLaunch('', new Date()), null);
  assert.equal(daysToLaunch('next year', new Date()), null);
});

test('nothing waiting gives an empty list', () => {
  assert.deepEqual(needsYou({ feedback: 0, attention: 0, limits: [], tests: { failed: 0 }, security: { runDue: false, upstreamChanged: false } }), []);
});

test('a part that could not be read is left out, not counted as a problem', () => {
  assert.deepEqual(needsYou({ feedback: null, attention: 0, limits: null, tests: null, security: null }), []);
});

test('the most pressing comes first, and each item names the page that deals with it', () => {
  const list = needsYou({
    feedback: 3, attention: 1,
    limits: [{ name: 'Database compute', percent: 92, level: 'fail' }],
    tests: { failed: 2 },
    security: { runDue: true, upstreamChanged: true }
  });
  assert.deepEqual(list.map((n) => n.page), ['release-tests', 'costs-usage', 'security', 'security', 'feedback', 'third-parties']);
  assert.deepEqual(list.map((n) => n.level), ['fail', 'fail', 'warn', 'warn', 'info', 'info']);
  assert.equal(list[0].text, '2 back-tests are failing');
  assert.equal(list[1].text, "Database compute is at 92% of the plan's limit");
  assert.equal(list[4].text, '3 pieces of feedback not looked at yet');
  assert.equal(list[5].text, '1 third-party item needs attention');
});
