// ML-470: the reviews that come round - when each is due, and the checks the app can make itself.
// Pure (server/services/reviewRules.js); the Dashboard line is in adminDashboardRules.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { REVIEWS, MARKED_KEYS, addMonths, reviewState, needsDoing, policyDate, policyCheck } from '../services/reviewRules.js';
import { needsYou } from '../services/adminDashboardRules.js';

const yearly = REVIEWS.find((r) => r.key === 'data-protection');
const monthly = REVIEWS.find((r) => r.key === 'site-security');
const on = (iso) => new Date(`${iso}T12:00:00Z`);

describe('the list of reviews', () => {
  test('the three that are marked, and the two with checks of their own', () => {
    assert.deepEqual(MARKED_KEYS, ['data-protection', 'childrens-code', 'breach-plan']);
    assert.deepEqual(REVIEWS.filter((r) => r.kind === 'checks').map((r) => [r.key, r.tab, r.months]), [['site-security', 'site', 1], ['omr-security', 'omr', 1]]);
    for (const r of REVIEWS) assert.ok(r.name && r.about && r.where && r.months > 0, `${r.key} is incomplete`);
    assert.deepEqual(REVIEWS.filter((r) => r.kind === 'marked').map((r) => r.months), [12, 12, 12]);
  });
});

describe('when a review is due', () => {
  test('a year, or a month, from the day it was last done', () => {
    assert.equal(addMonths('2026-10-06', 12), '2027-10-06');
    assert.equal(addMonths('2026-10-06', 1), '2026-11-06');
    assert.equal(addMonths('2027-01-31', 1), '2027-02-28'); // a short month: its last day
    assert.equal(addMonths('2028-02-29', 12), '2029-02-28');
  });

  test('never done needs doing', () => {
    const s = reviewState(yearly, null, on('2026-10-06'));
    assert.deepEqual(s, { status: 'never', dueOn: null, daysLeft: null });
    assert.equal(needsDoing(s), true);
  });

  test('a yearly review: up to date, due soon in its last 30 days, due on the day and after', () => {
    assert.deepEqual(reviewState(yearly, '2026-10-06', on('2026-10-06')), { status: 'ok', dueOn: '2027-10-06', daysLeft: 365 });
    assert.equal(reviewState(yearly, '2026-10-06', on('2027-09-05')).status, 'ok');     // 31 days left
    assert.equal(reviewState(yearly, '2026-10-06', on('2027-09-06')).status, 'soon');   // 30 days left
    assert.deepEqual(reviewState(yearly, '2026-10-06', on('2027-10-06')), { status: 'due', dueOn: '2027-10-06', daysLeft: 0 });
    assert.deepEqual(reviewState(yearly, '2026-10-06', on('2027-10-16')), { status: 'due', dueOn: '2027-10-06', daysLeft: -10 });
    assert.equal(needsDoing(reviewState(yearly, '2026-10-06', on('2027-09-06'))), false, 'due soon is a warning, not yet something to do');
    assert.equal(needsDoing(reviewState(yearly, '2026-10-06', on('2027-10-06'))), true);
  });

  test('a monthly one is "due soon" only in its last 5 days', () => {
    assert.equal(reviewState(monthly, '2026-10-06', on('2026-10-31')).status, 'ok');    // 6 days left
    assert.equal(reviewState(monthly, '2026-10-06', on('2026-11-01')).status, 'soon');  // 5 days left
    assert.equal(reviewState(monthly, '2026-10-06', on('2026-11-06')).status, 'due');
  });
});

describe('the privacy policy against the last review', () => {
  test('its date is read from the page', () => {
    assert.equal(policyDate('<p class="text-sm">Last updated: 6 October 2026</p>'), '2026-10-06');
    assert.equal(policyDate('Last updated:  21 march 2027'), '2027-03-21');
    assert.equal(policyDate('<p>No date here</p>'), null);
    assert.equal(policyDate('Last updated: 6 Octember 2026'), null);
  });

  test('changed after the last review is something to look at; not changed since is fine', () => {
    assert.equal(policyCheck('2026-10-06', '2026-10-06').ok, true);
    assert.equal(policyCheck('2026-10-06', '2027-01-01').ok, true);
    const changed = policyCheck('2027-03-21', '2026-10-06');
    assert.equal(changed.ok, false);
    assert.match(changed.text, /changed on 21 March 2027, after this was last reviewed \(6 October 2026\)/);
    assert.equal(policyCheck(null, '2026-10-06').ok, false);
    assert.equal(policyCheck('2026-10-06', null).ok, false);
  });

  test('the real policy page has a date that can be read', async () => {
    const fs = await import('node:fs');
    assert.match(policyDate(fs.readFileSync(new URL('../../public/privacy.html', import.meta.url), 'utf8')), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('the Dashboard', () => {
  test('a review that is due is under "Needs you", and opens Security', () => {
    assert.deepEqual(needsYou({ reviews: 2 }), [{ level: 'warn', page: 'security', text: '2 reviews are due - data protection, the Children\'s Code or the breach plan' }]);
    assert.deepEqual(needsYou({ reviews: 1 }).map((n) => n.text), ['1 review is due - data protection, the Children\'s Code or the breach plan']);
    assert.deepEqual(needsYou({ reviews: 0 }), []);
    assert.deepEqual(needsYou({ reviews: null }), []); // couldn't be read: left out, the rest still shows
  });
});
