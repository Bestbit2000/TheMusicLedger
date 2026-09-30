// ML-377: unit tests for the home greeting and its line of encouragement (public/homeGreeting.js).
// Pure, no DOM. Loaded with vm, exactly as the browser loads it.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/homeGreeting.js', import.meta.url), 'utf8'), sandbox);
const G = sandbox.self.HomeGreeting;

// Wednesday 30 September 2026 at the given hour, local time.
const at = (hour, day = 30, month = 8) => new Date(2026, month, day, hour, 0, 0);
const s = (dateStr, duration = 30, category = 'Practise', instrumentName = null) => ({ dateStr, duration, category, instrumentName });
const keys = (ctx) => G.lines(ctx).map(l => l.key);
const text = (ctx, key) => (G.lines(ctx).find(l => l.key === key) || {}).text;
const never = () => 0.99; // never picks "Ready to practise?"

describe('the greeting', () => {
    test('time of day, with no comma before the name', () => {
        assert.equal(G.greeting({ name: 'Andrew', now: at(9), random: never }), 'Good morning Andrew');
        assert.equal(G.greeting({ name: 'Andrew', now: at(14), random: never }), 'Good afternoon Andrew');
        assert.equal(G.greeting({ name: 'Andrew', now: at(19), random: never }), 'Good evening Andrew');
    });
    test('now and then "Ready to practise?" instead', () => {
        assert.equal(G.greeting({ name: 'Andrew', now: at(9), random: () => 0 }), 'Ready to practise, Andrew?');
    });
    test('already practised today beats everything', () => {
        assert.equal(G.greeting({ name: 'Andrew', now: at(23), sessions: [s('2026-09-30')] }), 'Nice work today Andrew');
    });
    test('late at night', () => {
        assert.equal(G.greeting({ name: 'Andrew', now: at(23), sessions: [s('2026-09-29')] }), 'Burning the midnight oil, Andrew?');
        assert.equal(G.greeting({ name: 'Andrew', now: at(2) }), 'Burning the midnight oil, Andrew?');
    });
    test('back after three days or more', () => {
        assert.equal(G.greeting({ name: 'Andrew', now: at(10), sessions: [s('2026-09-27')] }), 'Welcome back Andrew');
        assert.equal(G.greeting({ name: 'Andrew', now: at(10), sessions: [s('2026-09-28')], random: never }), 'Good morning Andrew');
    });
    test('the weekend', () => {
        assert.equal(G.greeting({ name: 'Andrew', now: at(10, 3, 9) }), 'Happy Saturday Andrew');
        assert.equal(G.greeting({ name: 'Andrew', now: at(10, 4, 9) }), 'Happy Sunday Andrew');
    });
    test('no name, no greeting', () => {
        assert.equal(G.greeting({ name: '', now: at(9) }), '');
    });
});

describe('the line under it', () => {
    test('a new player gets a welcome, and only that', () => {
        assert.equal(keys({ now: at(9), sessions: [] }).join(), 'welcome');
    });
    test('a streak from two days, counted from yesterday before today is logged', () => {
        assert.equal(text({ now: at(9), sessions: [s('2026-09-29'), s('2026-09-28'), s('2026-09-27')] }, 'streak'), "You're on a 3-day streak");
        assert.equal(text({ now: at(9), sessions: [s('2026-09-29')] }, 'streak'), undefined, 'one day is not a streak');
        assert.equal(text({ now: at(9), sessions: [s('2026-09-29', 30, 'Rehearsal'), s('2026-09-28', 30, 'Rehearsal')] }, 'streak'), undefined, 'practise sessions only');
    });
    test('close to the record, or a new record - never "you broke it"', () => {
        const old = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'].map(d => s(d));
        assert.equal(text({ now: at(9), sessions: [...old, s('2026-09-29'), s('2026-09-28'), s('2026-09-27')] }, 'record'), '2 more days to beat your best streak of 5');
        assert.equal(text({ now: at(9), sessions: [s('2026-09-29'), s('2026-09-28'), s('2026-09-27')] }, 'record'), 'Your longest streak yet - 3 days');
        assert.equal(text({ now: at(9), sessions: [...old, s('2026-09-29'), s('2026-09-28')] }, 'record'), '3 more days to beat your best streak of 5');
    });
    test('time this month, and where it is heading only when the projection is switched on', () => {
        const sessions = [s('2026-09-10', 120), s('2026-09-20', 140), s('2026-08-31', 500)];
        assert.equal(text({ now: at(9, 20), sessions }, 'month'), '4h 20m practised this month');
        assert.equal(text({ now: at(9, 20), sessions }, 'projection'), undefined);
        assert.equal(text({ now: at(9, 20), sessions, showProjection: true }, 'projection'), 'On track for 6h 30m this month');
        assert.equal(text({ now: at(9, 30), sessions, showProjection: true }, 'projection'), undefined, 'not on the last day of the month');
        assert.equal(text({ now: at(9, 2, 9), sessions: [s('2026-10-01', 60)], showProjection: true }, 'projection'), undefined, 'not in the first days');
    });
    test('sessions this week (from Monday) and the last session, with its instrument', () => {
        const sessions = [s('2026-09-29', 30, 'Practise', 'B♭ Euphonium'), s('2026-09-28'), s('2026-09-27')];
        assert.equal(text({ now: at(9), sessions }, 'week'), '2 sessions this week');
        assert.equal(text({ now: at(9), sessions }, 'last'), 'Last practised yesterday - on B♭ Euphonium');
        assert.equal(text({ now: at(9), sessions: [s('2026-09-20')] }, 'last'), undefined, 'a long time ago is not a nudge we show');
    });
    test('the practice year, a concert and the pace, Level 5 passages, the note being stretched to', () => {
        const ctx = { now: at(9), sessions: [s('2026-09-10', 90)], practiceYearStart: '2026-09-01',
            concert: { name: 'Spring concert', days: 12 }, pace: { name: 'Spring concert', perDay: 3 }, levelFive: 2, rangeNote: { note: 'C♯6', level: 3 } };
        assert.equal(text(ctx, 'year'), '1h 30m so far this practice year');
        assert.equal(text(ctx, 'concert'), 'Spring concert in 12 days');
        assert.equal(text(ctx, 'pace'), 'About 3 blocks a day to be ready for Spring concert');
        assert.equal(text(ctx, 'levels'), '2 passages at Level 5');
        assert.equal(text(ctx, 'range'), 'C♯6 is at Level 3 - keep stretching');
        assert.equal(text({ ...ctx, concert: { name: 'Spring concert', days: 0 } }, 'concert'), undefined);
    });
    test('never a discouraging line', () => {
        const all = G.lines({ now: at(9), sessions: [s('2026-06-01')], showProjection: true }).map(l => l.text).join(' | ');
        assert.doesNotMatch(all, /haven't|missed|broke|behind|only/i);
    });
});

describe('picking one', () => {
    test('keeps the one you had while it is still true, else picks at random', () => {
        const c = [{ key: 'a', text: 'A' }, { key: 'b', text: 'B' }];
        assert.equal(G.pickLine(c, 'b', () => 0).key, 'b');
        assert.equal(G.pickLine(c, 'gone', () => 0.6).key, 'b');
        assert.equal(G.pickLine([], 'a'), null);
    });
    test('formats minutes', () => {
        assert.equal(G.formatMinutes(45), '45m');
        assert.equal(G.formatMinutes(180), '3h');
        assert.equal(G.formatMinutes(260), '4h 20m');
    });
});
