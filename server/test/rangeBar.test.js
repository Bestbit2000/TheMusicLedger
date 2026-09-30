// ML-370 / ML-384: the range bar (public/rangeBar.js) - one drawing for See your range, the range picker
// and My instruments' slim bar. Markup and the "still to learn" line only.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Loaded with vm, exactly as the browser loads it (after notation.js and range.js).
const sandbox = { self: {} };
for (const f of ['notation.js', 'range.js', 'rangeBar.js']) vm.runInNewContext(fs.readFileSync(new URL(`../../public/${f}`, import.meta.url), 'utf8'), sandbox);
const RangeBar = sandbox.self.RangeBar;

// A euphonium-like instrument, written pitch: C2 to F6 usual, brass (so a 4th past the top).
const euph = { family: 'Brass', rangeLow: 'C2', rangeHigh: 'F6' };

describe('range bar (ML-384)', () => {
  test('ctxOf turns written pitches into MIDI numbers', () => {
    const c = RangeBar.ctxOf(euph, 'F3', 'G5');
    assert.equal([c.low, c.usualHigh, c.bottom, c.top].join(), '36,89,53,79');
  });
  test('the full bar: your range, the stretch past the usual top, ends and key, still to learn', () => {
    const { html, text } = RangeBar.html(euph, RangeBar.ctxOf(euph, 'F3', 'G5'));
    assert.match(html, /range-bar-yours/);
    assert.match(html, /range-bar-stretch/);
    assert.match(html, /F6 usual top/);
    assert.match(html, /range-bar-key/);
    assert.equal(text, 'Still to learn: 17 notes below, 10 notes up to the usual top.');
  });
  test('the slim bar is the bar alone - no ends, key or text', () => {
    const { html, text } = RangeBar.html(euph, RangeBar.ctxOf(euph, 'F3', 'G5'), { slim: true });
    assert.match(html, /class="range-bar is-slim"/);
    assert.doesNotMatch(html, /range-bar-ends|range-bar-key/);
    assert.equal(text, '');
  });
  test('ctx.stretch overrides the family rule (the picker knows the outer limit)', () => {
    const { html } = RangeBar.html({ family: 'Strings' }, { ...RangeBar.ctxOf(euph, 'F3', 'G5'), stretch: 5 });
    assert.match(html, /range-bar-stretch/);
    const none = RangeBar.html(euph, { ...RangeBar.ctxOf(euph, 'F3', 'G5'), stretch: 0 });
    assert.doesNotMatch(none.html, /range-bar-stretch/);
  });
  test('past the usual top says so', () => {
    const { text } = RangeBar.html(euph, RangeBar.ctxOf(euph, 'C2', 'Ab6'));
    assert.equal(text, "You play the whole of the usual range. You're 3 notes past the usual top - keep going if it's comfortable.");
  });
  test('nothing without the instrument\'s range or your notes', () => {
    assert.equal(RangeBar.html(euph, RangeBar.ctxOf(euph, null, null)).html, '');
    assert.equal(RangeBar.html({ family: 'Brass' }, RangeBar.ctxOf({}, 'F3', 'G5')).html, '');
  });
  test('the label is escaped', () => {
    const { html } = RangeBar.html(euph, RangeBar.ctxOf(euph, 'F3', 'G5'));
    assert.match(html, /aria-label="Your range, F3 to G5, inside the instrument&#39;s C2 to F6 - and up to B♭6 with experience"/);
  });
});
