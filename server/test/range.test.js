// ML-305 / ML-322: unit tests for the Range engine (public/range.js) - the note beyond your range, the
// run up or down to it, Levels from beats held, the hold and measure trackers, and the picker's stave.
// Pure, no DOM. Loaded with vm, exactly as the browser loads it.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
for (const f of ['notation.js', 'range.js']) vm.runInNewContext(fs.readFileSync(new URL(`../../public/${f}`, import.meta.url), 'utf8'), sandbox);
const R = sandbox.self.PlayRange;
const plain = (v) => JSON.parse(JSON.stringify(v));
const euph = { low: 'C2', high: 'F6' };           // brass band euphonium, written treble
const mine = { bottom: 'Bb3', top: 'F5' };

describe('notes', () => {
    test('MIDI numbers and spelling', () => {
        assert.equal(R.midiOf('C4'), 60);
        assert.equal(R.midiOf('Bb3'), 58);
        assert.equal(R.midiOf('F#5'), 78);
        assert.equal(R.pitchOf(61, 'sharp'), 'C#4');
        assert.equal(R.pitchOf(61, 'flat'), 'Db4');
        assert.equal(R.pitchOf(59, 'flat'), 'B3', 'white keys stay natural');
        assert.equal(R.label('F#3'), 'F♯3');
    });
});

describe('your range', () => {
    test('the note to work on is a semitone beyond your comfortable note, spelled the usual way', () => {
        assert.deepEqual(plain(R.target(mine, euph, 'up')), { midi: 78, pitch: 'F#5' });
        assert.deepEqual(plain(R.target(mine, euph, 'down')), { midi: 57, pitch: 'A3' });
        assert.deepEqual(plain(R.target({ bottom: 'C4', top: 'C5' }, euph, 'down')), { midi: 59, pitch: 'B3' });
        assert.equal(R.target({ bottom: 'C2', top: 'F6' }, euph, 'up'), null, 'at the instrument\'s limit');
        assert.equal(R.target({ bottom: 'C2', top: 'F6' }, euph, 'down'), null);
        assert.equal(R.target({ bottom: null, top: null }, euph, 'up'), null, 'no range set');
    });
    test('notes beyond run out to the instrument\'s limit, nearest first', () => {
        const up = R.notesBeyond({ bottom: 'C4', top: 'C6' }, euph, 'up');
        assert.deepEqual(plain(up).map(n => n.pitch), ['C#6', 'D6', 'Eb6', 'E6', 'F6']);
        assert.equal(R.notesBeyond({ bottom: 'D2', top: 'C6' }, euph, 'down').map(n => n.pitch).join(' '), 'C#2 C2');
    });
    test('checking a range', () => {
        assert.equal(R.checkRange(mine, euph), null);
        assert.match(R.checkRange({ bottom: 'F5', top: 'Bb3' }, euph), /lower than your top/);
        assert.match(R.checkRange({ bottom: 'A1', top: 'F5' }, euph), /C2 to F6/);
        assert.match(R.checkRange({ bottom: null, top: 'F5' }, euph), /both/);
    });
});

describe('the run', () => {
    test('up: the major scale an octave up to your top note, then the note above', () => {
        const r = R.run({ bottom: 'C4', top: 'C5' }, euph, 'up');
        assert.deepEqual(plain(r.notes), ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'C#5']);
        assert.deepEqual(plain(R.run(mine, euph, 'up').notes), ['F4', 'G4', 'A4', 'Bb4', 'C5', 'D5', 'E5', 'F5', 'F#5']);
    });
    test('down: the major scale an octave down to your bottom note, then the note below', () => {
        assert.deepEqual(plain(R.run(mine, euph, 'down').notes), ['Bb4', 'A4', 'G4', 'F4', 'Eb4', 'D4', 'C4', 'Bb3', 'A3']);
    });
    test('every key a comfortable note can be: 8 scale notes a major scale apart, then a semitone', () => {
        for (let m = 40; m <= 84; m++) {
            const top = R.pitchOf(m, 'sharp');
            const r = R.run({ bottom: 'C2', top }, { low: 'C1', high: 'C8' }, 'up');
            const midis = plain(r.notes).map(R.midiOf);
            assert.deepEqual(midis.slice(1).map((x, i) => x - midis[i]), [2, 2, 1, 2, 2, 2, 1, 1], top);
            assert.equal(midis[7], m);
        }
    });
    test('written as one bar: an accidental lasts, a return to plain gets a natural', () => {
        const w = R.writeRun(['C5', 'C#5', 'D5', 'C5']);
        assert.deepEqual(plain(w).map(x => [x.pitch, x.accidental]), [['C5', false], ['C#5', true], ['D5', false], ['Cn5', true]]);
    });
});

describe('Levels', () => {
    test('beats held -> Level 1-4', () => {
        assert.deepEqual([0, 0.3, 1.9, 2, 3.9, 4, 6, 7.9].map(R.levelForBeats), [0, 1, 1, 2, 2, 3, 4, 4]);
    });
    test('Level 5 is 8 beats three goes in a row; a shorter go starts the run again; Levels never go down', () => {
        let s = R.applyGo(null, 8);
        assert.deepEqual(plain(s), { level: 4, streak: 1, bestBeats: 8, goes: 1, reachedFive: false });
        s = R.applyGo(s, 9);
        assert.equal(s.level, 4);
        s = R.applyGo(s, 3);
        assert.deepEqual([s.level, s.streak], [4, 0], 'a short go: back to none in a row, Level kept');
        s = R.applyGo(s, 8); s = R.applyGo(s, 8);
        assert.equal(s.reachedFive, false);
        s = R.applyGo(s, 12);
        assert.deepEqual([s.level, s.streak, s.reachedFive, s.goes, s.bestBeats], [5, 3, true, 6, 12]);
        assert.equal(R.applyGo(s, 8).reachedFive, false, 'only the go that gets there');
        assert.equal(R.applyGo(null, 99).bestBeats, R.MAX_BEATS, 'capped');
    });
    test('Held it / Not yet', () => {
        assert.equal(R.applyGo(null, R.SELF_BEATS.held).level, 4);
        assert.equal(R.applyGo(null, R.SELF_BEATS.notYet).level, 0);
    });
});

describe('listening', () => {
    test('a frequency is heard as the written note (a euphonium in treble sounds a 9th lower)', () => {
        assert.deepEqual(plain(R.heardWritten(440, 0)), { midi: 69, cents: 0 });
        // concert Bb2 (116.54 Hz) on a treble-clef euphonium is written C4
        assert.equal(R.heardWritten(116.54, -14).midi, 60);
        assert.equal(R.heardWritten(-1, 0), null);
        assert.equal(R.heardWritten(452, 0).midi, 69, 'out of tune still counts as the note');
    });
    test('the hold: starts after 150 ms on the note, survives short gaps, ends 400 ms after it stops', () => {
        const h = R.holdTracker(70, 60); // one beat = 1 s
        for (let t = 0; t < 100; t += 16) assert.equal(h.feed(t, 69).holding, false, 'the wrong note');
        let s;
        for (let t = 100; t <= 3100; t += 16) s = h.feed(t, t > 2000 && t < 2200 ? null : 70); // a 200 ms wobble
        assert.equal(s.holding, true);
        for (let t = 3116; t <= 3600; t += 16) s = h.feed(t, null);
        assert.equal(s.done, true);
        assert.ok(Math.abs(s.beats - 3.0) < 0.05, `about 3 beats, got ${s.beats}`);
        assert.equal(h.feed(4000, 70).beats, s.beats, 'finished: later notes change nothing');
    });
    test('the hold: a blip on the note is not a start', () => {
        const h = R.holdTracker(70, 60);
        let s;
        for (let t = 0; t < 100; t += 16) s = h.feed(t, 70);
        for (let t = 100; t < 700; t += 16) s = h.feed(t, null);
        assert.deepEqual([s.holding, s.done, s.beats], [false, false, 0]);
    });
    test('measuring: the lowest and highest notes held steady for a second, inside the instrument\'s limit', () => {
        const m = R.rangeMeasurer({ low: 'C3', high: 'C6' });
        let t = 0;
        const hold = (midi, ms) => { let r; for (const end = t + ms; t < end; t += 16) r = m.feed(t, midi); return r; };
        hold(60, 1200); hold(62, 500); hold(55, 1100); hold(84, 1500); hold(30, 2000); hold(null, 300); hold(86, 1200);
        const r = hold(null, 100);
        assert.deepEqual([r.low, r.high, r.bottom, r.top], [55, 84, 'G3', 'C6'], '62 too short; 30 and 86 outside the limit');
    });
});

describe('the picker\'s stave', () => {
    test('a tap picks the natural note at that step, inside the limit; -/+ move a semitone, spelled the usual way', () => {
        assert.equal(R.pitchAtStep(0, 'treble', euph), 'E4');
        assert.equal(R.pitchAtStep(-30, 'treble', euph), 'C2', 'clamped to the limit');
        assert.equal(R.stepSemitone('E4', 1, euph), 'F4');
        assert.equal(R.stepSemitone('F4', 1, euph), 'F#4');
        assert.equal(R.stepSemitone('F#4', -1, euph), 'F4');
        assert.equal(R.stepSemitone('F4', -1, euph), 'E4');
        assert.equal(R.stepSemitone('A4', -1, euph), 'Ab4');
        assert.equal(R.stepSemitone('A3', 1, euph), 'Bb3', 'the usual spelling, not A♯');
        assert.equal(R.stepSemitone('D4', -1, euph), 'C#4');
        assert.equal(R.stepSemitone('F6', 1, euph), 'F6', 'no further than the limit');
    });
});
