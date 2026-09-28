// ML-306: unit tests for the Rhythm engine (public/rhythm.js) - the rhythms and how they add up, the
// round's onsets, the speed Levels, scoring taps (strict) and heard notes (lenient), and the onset
// detector. Pure, no DOM. Loaded with vm, exactly as the browser loads it; the notation for every
// rhythm is drawn to prove it engraves.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
for (const f of ['notation.js', 'theoryEngine.js', 'rhythm.js']) vm.runInNewContext(fs.readFileSync(new URL(`../../public/${f}`, import.meta.url), 'utf8'), sandbox);
const R = sandbox.self.Rhythm;
const N = sandbox.self.Notation;
const plain = (v) => JSON.parse(JSON.stringify(v));

describe('the rhythms', () => {
    test('every rhythm fills its beats exactly, and a bar of it draws', () => {
        for (const p of R.PATTERNS) {
            const total = p.notes.reduce((a, n) => a + n.len, 0);
            assert.ok(Math.abs(total - p.beats * p.meter.beatLen) < 1e-9, `${p.id} adds up to ${total}`);
            assert.equal(p.meter.beats % p.beats, 0, `${p.id} fits a bar`);
            const svg = N.staff({ clef: 'treble', hideClef: true, items: plain(R.barItems(p)) });
            assert.match(svg, /<svg/);
        }
    });
    test('the one-beat crib sheet: all 15, 8 on the beat and 7 with a rest, every one different', () => {
        const beat = plain(R.patternsIn('beat'));
        assert.equal(beat.length, 15);
        assert.equal(beat.filter(p => !p.notes[0].rest).length, 8);
        assert.equal(new Set(beat.map(p => p.name)).size, 15);
        assert.deepEqual(beat.slice(0, 3).map(p => p.name), ['ta', 'ta di', 'ta ka di mi']);
        const tami = beat.find(p => p.name === 'ta mi');
        assert.deepEqual(tami.notes.map(n => [n.v, n.len, n.dots || 0]), [[0.5, 0.75, 1], [0.25, 0.25, 0]], 'dotted quaver, semiquaver');
        const mi = beat.find(p => p.name === 'mi');
        assert.deepEqual(mi.notes.map(n => [n.rest ? 'rest' : 'note', n.v]), [['rest', 0.5], ['rest', 0.25], ['note', 0.25]]);
    });
    test('the words, and every set has rhythms', () => {
        assert.deepEqual(plain(R.patternsIn('words')).map(p => p.name), ['Plum', 'Ap-ple', 'Pom-e-gran-ate', 'Am-ster-dam']);
        for (const s of R.SETS) assert.ok(R.patternsIn(s.id).length >= 3, s.id);
    });
});

describe('a round', () => {
    test('two bars of the rhythm after a bar\'s count-in: onsets in beats from bar 1', () => {
        const s = plain(R.schedule('w-apple'));
        assert.equal(s.onsets.length, 16);
        assert.deepEqual(s.onsets.slice(0, 4).map(o => o.beat), [0, 0.5, 1, 1.5]);
        assert.equal(s.totalBeats, 8);
        const six8 = plain(R.schedule('c-takida'));
        assert.deepEqual(six8.onsets.slice(0, 4).map(o => Math.round(o.beat * 1000) / 1000), [0, 0.333, 0.667, 1], '6/8: three quavers to a dotted-crotchet beat');
        const trip = plain(R.schedule('tr-kida'));
        assert.equal(trip.onsets[0].beat.toFixed(3), '0.333', 'the rest comes first');
    });
    test('play through the sheet: one bar of each rhythm in the set', () => {
        const s = plain(R.schedule('sheet:beat'));
        assert.equal(s.bars.length, 15);
        assert.equal(s.totalBeats, 60);
        assert.throws(() => R.schedule('sheet:nope'));
        assert.throws(() => R.schedule('nope'));
    });
});

describe('Levels', () => {
    test('a Level is the fastest Level speed you passed at (grade 4+)', () => {
        const p = R.pattern('w-apple');
        assert.deepEqual(plain(R.levelBpms(p)), [60, 72, 84, 96, 108]);
        assert.equal(R.levelEarned(p, 84, 4), 3);
        assert.equal(R.levelEarned(p, 90, 5), 3);
        assert.equal(R.levelEarned(p, 84, 3), 0, 'grade 3 earns nothing');
        assert.equal(R.levelEarned(p, 50, 5), 0, 'slower than Level 1');
        assert.equal(R.nextBpm(p, 0), 60);
        assert.equal(R.nextBpm(p, 2), 84);
        assert.equal(R.nextBpm(p, 5), 108);
        assert.deepEqual(plain(R.levelBpms(R.pattern('c-ta'))), [40, 48, 56, 64, 72], '6/8 counts dotted crotchets');
    });
});

describe('scoring', () => {
    const exact = (level, bpm, shift = 0, jitter = () => 0) => plain(R.schedule(level)).onsets.map((o, i) => o.beat * 60 / bpm + shift + jitter(i));
    test('every note on time scores 100', () => {
        const r = R.scoreRound('b-takadimi', { bpm: 72, method: 'tap', taps: exact('b-takadimi', 72) });
        assert.deepEqual([r.score, r.grade, r.missed, r.extra, r.onTime], [100, 5, 0, 0, 32]);
    });
    test('taps: 40 ms is on time, 150 ms is worth nothing, a missed note 0, an extra tap costs', () => {
        const base = exact('w-plum', 60);
        assert.equal(R.scoreRound('w-plum', { bpm: 60, method: 'tap', taps: base.map(t => t + 0.04) }).score, 100);
        assert.equal(R.scoreRound('w-plum', { bpm: 60, method: 'tap', taps: base.map(t => t + 0.095) }).score, 50);
        assert.equal(R.scoreRound('w-plum', { bpm: 60, method: 'tap', taps: base.map(t => t + 0.2) }).score, 0);
        assert.equal(R.scoreRound('w-plum', { bpm: 60, method: 'tap', taps: base.slice(0, 4) }).score, 50);
        assert.equal(R.scoreRound('w-plum', { bpm: 60, method: 'tap', taps: [...base, 0.5, 1.5] }).score, 92);
    });
    test('the microphone is lenient: a steady delay is taken out, and the windows are wider', () => {
        const late = exact('w-apple', 72, 0.12, (i) => (i % 2 ? 0.05 : -0.05));
        const mic = R.scoreRound('w-apple', { bpm: 72, method: 'mic', taps: late });
        const tap = R.scoreRound('w-apple', { bpm: 72, method: 'tap', taps: late });
        assert.equal(mic.score, 100, 'a steady 120 ms lag and ±50 ms wobble');
        assert.ok(Math.abs(mic.shift - 120) <= 50);
        assert.ok(tap.score < 40, `the same taps, tapped: ${tap.score}`);
    });
    test('play through the sheet scores each rhythm, and each earns its own Level', () => {
        const taps = exact('sheet:words', 84).filter((t, i) => i < 12); // Plum's bar (4) and Ap-ple's (8)
        const details = { bpm: 84, method: 'tap', taps };
        const r = R.scoreRound('sheet:words', details);
        assert.deepEqual(plain(r.perPattern).map(p => p.score), [100, 100, 0, 0]);
        assert.deepEqual(plain(R.levelsFromRound('sheet:words', details, r)).map(x => x.level), [3, 3, 0, 0]);
    });
    test('bad rounds are refused', () => {
        assert.throws(() => R.scoreRound('w-plum', { bpm: 10, method: 'tap', taps: [] }));
        assert.throws(() => R.scoreRound('w-plum', { bpm: 60, method: 'hum', taps: [] }));
        assert.throws(() => R.scoreRound('w-plum', { bpm: 60, method: 'tap', taps: ['x'] }));
    });
});

describe('listening', () => {
    test('note starts: a jump in level, not a steady note, not twice within 80 ms', () => {
        const d = R.onsetDetector();
        const found = [];
        const feed = (from, to, rms) => { for (let t = from; t < to; t += 0.016) { const x = d.feed(t, rms(t)); if (x !== null) found.push(Math.round(x * 100) / 100); } };
        feed(0, 0.5, () => 0.005);                 // quiet room
        feed(0.5, 1.0, () => 0.2);                 // a note starts at 0.5 and is held
        feed(1.0, 1.1, () => 0.01);                // tongued gap
        feed(1.1, 1.5, () => 0.2);                 // the next note
        assert.equal(found.length, 2, JSON.stringify(found));
        assert.ok(Math.abs(found[0] - 0.5) < 0.02 && Math.abs(found[1] - 1.1) < 0.03, JSON.stringify(found));
    });
});
