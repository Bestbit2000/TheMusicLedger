// ML-464: the retention rule (server/services/retentionRules.js). Pure - no database.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { tidyRule, addPeriod, unusedSince, dueDates, nextStep, isDue, removalDate, ruleInWords, retentionEmail, DEFAULT_RULE } from '../services/retentionRules.js';

const FROM = '2026-10-06T00:00:00Z';
const RULE = { enabled: true, unit: 'months', first: 22, second: 23, remove: 24 };
const iso = (d) => new Date(d).toISOString();
const acct = (over) => ({ lastSeenOn: '2027-01-15', createdAt: '2026-11-01T10:00:00Z', stage: 0, stageAt: null, ...over });

describe('the rule itself', () => {
  test('it is off until switched on, and the owner\'s rule is 22, 23 and 24 months', () => {
    assert.deepEqual(DEFAULT_RULE, { enabled: false, unit: 'months', first: 22, second: 23, remove: 24 });
    assert.deepEqual(tidyRule({ unit: 'months', first: '22', second: 23, remove: 24 }), { enabled: false, unit: 'months', first: 22, second: 23, remove: 24 });
    assert.equal(tidyRule({ ...RULE, enabled: 'yes' }).enabled, false); // only a real true switches it on
  });
  test('the three times must go up, in a unit the app knows', () => {
    assert.throws(() => tidyRule({ ...RULE, second: 22 }), /first email must come before/);
    assert.throws(() => tidyRule({ ...RULE, remove: 23 }), /first email must come before/);
    assert.throws(() => tidyRule({ ...RULE, unit: 'weeks' }), /hours, days, months or years/);
    assert.throws(() => tidyRule({ ...RULE, first: 0 }), /whole number from 1 to 1,000/);
    assert.throws(() => tidyRule({ ...RULE, remove: 'soon' }), /whole number/);
  });
  test('it says itself in words', () => {
    assert.equal(ruleInWords(RULE), 'An account not used for 22 months gets an email, another at 23 months, and is deleted at 24 months.');
    assert.equal(ruleInWords({ ...RULE, unit: 'hours', first: 1, second: 2, remove: 3 }), 'An account not used for 1 hour gets an email, another at 2 hours, and is deleted at 3 hours.');
  });
});

describe('lengths of time', () => {
  test('hours and days go by the clock', () => {
    assert.equal(iso(addPeriod('2026-10-06T10:00:00Z', 3, 'hours')), '2026-10-06T13:00:00.000Z');
    assert.equal(iso(addPeriod('2026-10-06T10:00:00Z', 2, 'days')), '2026-10-08T10:00:00.000Z');
  });
  test('months and years go by the calendar, and a short month ends on its last day', () => {
    assert.equal(iso(addPeriod('2026-10-06T00:00:00Z', 24, 'months')), '2028-10-06T00:00:00.000Z');
    assert.equal(iso(addPeriod('2027-01-31T00:00:00Z', 1, 'months')), '2027-02-28T00:00:00.000Z');
    assert.equal(iso(addPeriod('2028-02-29T00:00:00Z', 1, 'years')), '2029-02-28T00:00:00.000Z');
  });
});

describe('when an account counts as unused from', () => {
  test('the start of the day it was last seen', () => {
    assert.equal(iso(unusedSince(acct(), FROM)), '2027-01-15T00:00:00.000Z');
  });
  test('never seen: the day it was made', () => {
    assert.equal(iso(unusedSince(acct({ lastSeenOn: null }), FROM)), '2026-11-01T10:00:00.000Z');
  });
  test('never earlier than the day last-seen recording began', () => {
    assert.equal(iso(unusedSince(acct({ lastSeenOn: null, createdAt: '2026-09-08T09:00:00Z' }), FROM)), '2026-10-06T00:00:00.000Z');
  });
});

describe('what happens next', () => {
  test('the three dates for the owner\'s rule', () => {
    const d = dueDates(acct(), RULE, FROM);
    assert.deepEqual([iso(d.first), iso(d.second), iso(d.remove)], ['2028-11-15T00:00:00.000Z', '2028-12-15T00:00:00.000Z', '2029-01-15T00:00:00.000Z']);
  });
  test('nothing sent yet: the first email, at 22 months - not a day before', () => {
    assert.deepEqual({ ...nextStep(acct(), RULE, FROM), when: iso(nextStep(acct(), RULE, FROM).when) }, { step: 1, when: '2028-11-15T00:00:00.000Z' });
    assert.equal(isDue(acct(), RULE, FROM, new Date('2028-11-14T23:59:00Z')), false);
    assert.equal(isDue(acct(), RULE, FROM, new Date('2028-11-15T00:00:00Z')), true);
  });
  test('sent on time, the second email and the deletion come on their own dates', () => {
    const two = nextStep(acct({ stage: 1, stageAt: '2028-11-15T06:00:00Z' }), RULE, FROM);
    assert.equal(two.step, 2);
    assert.equal(iso(two.when), '2028-12-15T06:00:00.000Z'); // a full month after the first really went
    const three = nextStep(acct({ stage: 2, stageAt: '2028-12-15T06:00:00Z' }), RULE, FROM);
    assert.equal(three.step, 3);
    assert.equal(iso(three.when), '2029-01-15T06:00:00.000Z');
  });
  test('switched on late, an account long unused still gets its full warning: a month between each step', () => {
    // unused since January 2027; the rule is only switched on in June 2030
    const one = nextStep(acct(), RULE, FROM);
    assert.equal(isDue(acct(), RULE, FROM, new Date('2030-06-01T06:00:00Z')), true);
    assert.equal(one.step, 1);
    const two = nextStep(acct({ stage: 1, stageAt: '2030-06-01T06:00:00Z' }), RULE, FROM);
    assert.equal(iso(two.when), '2030-07-01T06:00:00.000Z');
    const three = nextStep(acct({ stage: 2, stageAt: '2030-07-01T06:00:00Z' }), RULE, FROM);
    assert.equal(iso(three.when), '2030-08-01T06:00:00.000Z');
    assert.equal(isDue(acct({ stage: 2, stageAt: '2030-07-01T06:00:00Z' }), RULE, FROM, new Date('2030-07-31T00:00:00Z')), false);
  });
  test('the date an email promises is the date the deletion can really happen', () => {
    assert.equal(iso(removalDate(acct(), RULE, FROM, 1, new Date('2028-11-15T06:00:00Z'))), '2029-01-15T06:00:00.000Z');
    assert.equal(iso(removalDate(acct(), RULE, FROM, 1, new Date('2030-06-01T06:00:00Z'))), '2030-08-01T06:00:00.000Z');
    assert.equal(iso(removalDate(acct(), RULE, FROM, 2, new Date('2028-12-15T06:00:00Z'))), '2029-01-15T06:00:00.000Z');
  });
  test('in hours, for trying it out', () => {
    const rule = { enabled: true, unit: 'hours', first: 1, second: 2, remove: 3 };
    const a = acct({ lastSeenOn: '2026-10-07' });
    assert.equal(iso(nextStep(a, rule, FROM).when), '2026-10-07T01:00:00.000Z');
    assert.equal(iso(nextStep({ ...a, stage: 1, stageAt: '2026-10-07T09:00:00Z' }, rule, FROM).when), '2026-10-07T10:00:00.000Z');
    assert.equal(iso(nextStep({ ...a, stage: 2, stageAt: '2026-10-07T10:00:00Z' }, rule, FROM).when), '2026-10-07T11:00:00.000Z');
  });
});

describe('the emails', () => {
  const about = { firstName: 'Sam', rule: RULE, removeOn: '2029-01-15T06:00:00Z', appUrl: 'https://example.test' };
  test('the first says how long, the date, and that signing in is all it takes', () => {
    const m = retentionEmail(1, about);
    assert.match(m.subject, /has not been used for a while/);
    assert.match(m.text, /^Hello Sam,/);
    assert.match(m.text, /not used The Music Ledger for 22 months/);
    assert.match(m.text, /deleted on 15 January 2029/);
    assert.match(m.text, /just sign in before then: https:\/\/example\.test/);
    assert.match(m.text, /remind you once more/);
  });
  test('the second says it is the last reminder', () => {
    const m = retentionEmail(2, about);
    assert.match(m.subject, /Last reminder/);
    assert.match(m.text, /for 23 months/);
    assert.match(m.text, /This is the last reminder/);
  });
  test('the third says it has been done, and that they are welcome back', () => {
    const m = retentionEmail(3, { ...about, firstName: '' });
    assert.match(m.subject, /has been deleted/);
    assert.match(m.text, /^Hello,/);
    assert.match(m.text, /not been used for 24 months/);
    assert.match(m.text, /welcome back/);
  });
});
