// ML-298 / ML-295 / ML-296: the drill tools' engine (public/drills.js) - levels, rounds and scoring.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
for (const f of ['notation.js', 'theoryEngine.js', 'drills.js']) {
    vm.runInNewContext(fs.readFileSync(new URL(`../../public/${f}`, import.meta.url), 'utf8'), sandbox);
}
const clone = (v) => JSON.parse(JSON.stringify(v));
const D = new Proxy(sandbox.self.Drills, { get: (t, k) => (typeof t[k] === 'function' ? (...a) => clone(t[k](...a)) : clone(t[k])) });
const raw = sandbox.self.Drills;
// Taps at a steady bpm: n taps starting at 0 ms
const steady = (bpm, n = 9, jitter = () => 0) => Array.from({ length: n }, (_, i) => i * 60000 / bpm + jitter(i));

describe('Tap tempo (ML-298)', () => {
    test('four levels, the last asks by speed name', () => {
        assert.deepEqual(D.TAP.LEVELS.map(l => l.id), ['listen', 'guide', 'solo', 'names']);
        assert.equal(D.tapLevel('names').prompt, 'name');
    });
    test('a round is 5 different speeds; the same seed gives the same round', () => {
        const t = D.tapTargets('solo', 42);
        assert.equal(t.length, 5);
        for (const x of t) assert.ok(x.bpm >= 50 && x.bpm <= 180 && x.bpm % 2 === 0);
        for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) assert.ok(Math.abs(t[i].bpm - t[j].bpm) >= 8);
        assert.deepEqual(D.tapTargets('solo', 42), t);
        const n = D.tapTargets('names', 7);
        assert.equal(new Set(n.map(x => x.band)).size, 5);
        for (const x of n) assert.ok(sandbox.self.TheoryEngine.SPEEDS.find(s => s.id === x.band).names.includes(x.name));
    });
    test('measuring: the median gap, so one fumbled tap does not wreck it', () => {
        assert.equal(Math.round(D.tapMeasure(steady(100)).bpm), 100);
        const oneBad = steady(100); oneBad[4] += 150;
        assert.ok(Math.abs(D.tapMeasure(oneBad).bpm - 100) < 1.5);
        assert.equal(D.tapMeasure([0, 500]), null);
    });
    test('scoring: spot on and steady = 100; 5% off = 80ish; 20% off = only steadiness points', () => {
        assert.equal(D.tapScoreOne({ bpm: 100 }, steady(100)).points, 100);
        const five = D.tapScoreOne({ bpm: 100 }, steady(105));
        assert.equal(five.direction, 'fast');
        assert.ok(five.points >= 78 && five.points <= 82, String(five.points));
        assert.equal(D.tapScoreOne({ bpm: 100 }, steady(80)).points, 20);
        assert.equal(D.tapScoreOne({ bpm: 100 }, steady(100, 5)).points, 0); // too few taps
    });
    test('a speed name: anywhere inside its band is spot on; outside, measured from the nearest edge', () => {
        assert.equal(D.tapScoreOne({ band: 'moderato' }, steady(112)).points, 100);
        assert.equal(D.tapScoreOne({ band: 'moderato' }, steady(119)).error, 0);
        const slow = D.tapScoreOne({ band: 'moderato' }, steady(102.6));
        assert.equal(slow.direction, 'slow');
        assert.ok(slow.points >= 75 && slow.points <= 80, String(slow.points));
        assert.equal(D.tapScoreOne({ band: 'presto' }, steady(230)).error, 0); // 200+ has no top
    });
    test('the live meter: on within 3%, and which way', () => {
        assert.equal(D.tapLive(100, steady(100, 2)), null);
        assert.equal(D.tapLive(100, steady(101, 6)).verdict, 'on');
        assert.equal(D.tapLive(100, steady(90, 6)).verdict, 'slow');
        const fast = D.tapLive(100, steady(130, 6));
        assert.equal(fast.verdict, 'fast');
        assert.equal(fast.pos, 1);
    });
    test('a round: the average of the five, re-scored from the taps; bad input is refused', () => {
        const targets = D.tapTargets('solo', 3);
        const r = D.scoreRound('tapTempo', 'solo', { targets, taps: targets.map(t => steady(t.bpm)) });
        assert.equal(r.score, 100);
        assert.equal(r.grade, 5);
        const half = D.scoreRound('tapTempo', 'solo', { targets, taps: targets.map((t, i) => (i < 2 ? steady(t.bpm) : [])) });
        assert.equal(half.score, 40);
        assert.throws(() => raw.scoreRound('tapTempo', 'solo', { targets, taps: [] }), /Bad Tap tempo round/);
        assert.throws(() => raw.scoreRound('tapTempo', 'nope', { targets, taps: [] }), /Unknown level/);
    });
});

describe('Gap trainer (ML-295)', () => {
    test('bar gaps: 3 on 1 off silences bars 3 and 7; 1 on 3 off silences all but 0 and 4', () => {
        assert.deepEqual(D.gapSchedule('bars3on1off', 1).silentBars, [3, 7]);
        assert.deepEqual(D.gapSchedule('bars2on2off', 1).silentBars, [2, 3, 6, 7]);
        assert.deepEqual(D.gapSchedule('bars1on3off', 1).silentBars, [1, 2, 3, 5, 6, 7]);
    });
    test('beat gaps: 1 and 3 click, 2 and 4 are silent; offbeats click on the "and"s and every beat is silent', () => {
        const s = raw.gapSchedule('beats13', 1);
        assert.deepEqual([0, 1, 2, 3].map(b => s.heard(0, b)), [true, false, true, false]);
        assert.equal(s.beats.filter(b => b.silent).length, 16);
        const o = raw.gapSchedule('offbeats', 1);
        assert.equal(o.clicksPerBeat, 2);
        assert.deepEqual([0, 1, 2, 3].map(c => o.heard(0, c)), [false, true, false, true]);
        assert.deepEqual([0, 1].map(c => o.heard(-1, c)), [true, false]); // the count-in is on the beat
        assert.equal(o.beats.every(b => b.silent), true);
    });
    test('random: bar 0 always clicks, at least one bar is silent, and the seed decides which', () => {
        for (let seed = 1; seed < 40; seed++) {
            const s = D.gapSchedule('random25', seed);
            assert.ok(!s.silentBars.includes(0));
            assert.ok(s.silentBars.length >= 1);
            assert.deepEqual(D.gapSchedule('random25', seed).silentBars, s.silentBars);
        }
        const avg = (id) => { let n = 0; for (let seed = 1; seed <= 200; seed++) n += D.gapSchedule(id, seed).silentBars.length; return n / 200; };
        assert.ok(avg('random50') > avg('random25') + 1);
    });
    test('scoring: every beat tapped on time = 100; the silent beats count 3/4', () => {
        const spb = 60 / 80;
        const all = Array.from({ length: 32 }, (_, k) => k * spb);
        assert.equal(D.scoreRound('gapTrainer', 'bars3on1off', { bpm: 80, seed: 1, taps: all }).score, 100);
        // Only the heard beats tapped: silent beats all 0 -> 25
        const s = raw.gapSchedule('bars3on1off', 1);
        const heardOnly = all.filter((t, k) => !s.beats[k].silent);
        const r = D.scoreRound('gapTrainer', 'bars3on1off', { bpm: 80, seed: 1, taps: heardOnly });
        assert.equal(r.score, 25);
        assert.equal(r.missed, 8);
    });
    test('drift: rushing through the gap shows as early (negative ms), and where you landed', () => {
        const spb = 60 / 80;
        const s = raw.gapSchedule('bars2on2off', 1);
        // In the silent bars, each beat 20 ms earlier than the last
        let drift = 0;
        const taps = s.beats.map((b, k) => { if (b.silent) drift -= 0.02; else drift = 0; return k * spb + drift; });
        const r = D.scoreRound('gapTrainer', 'bars2on2off', { bpm: 80, seed: 1, taps });
        assert.ok(r.drift < 0);
        assert.equal(r.landings.length, 1); // bars 2-3 silent, then bar 4 clicks (bars 6-7 end the round)
        assert.ok(r.score < 100 && r.score > 50, String(r.score));
    });
    test('bad input is refused', () => {
        assert.throws(() => raw.scoreRound('gapTrainer', 'bars3on1off', { bpm: 77, taps: [] }), /Bad Gap trainer speed/);
        assert.throws(() => raw.scoreRound('gapTrainer', 'bars3on1off', { bpm: 80, taps: ['x'] }), /Bad taps/);
    });
});

describe('Ear (ML-296)', () => {
    test('three modes; levels for a home note, note sets for the others', () => {
        assert.deepEqual(D.EAR.MODES.map(m => m.id), ['reference', 'single', 'playback']);
        assert.deepEqual(D.earAnswers('reference', 'root5'), ['C', 'G']);
        assert.deepEqual(D.earAnswers('reference', 'triad'), ['C', 'E', 'G']);
        assert.equal(D.earAnswers('single', 'all').length, 12);
        assert.throws(() => raw.earSet('single', 'triad'), /Unknown Ear level/);
    });
    test('a round is 10 notes from the level, never the same twice running', () => {
        const qs = D.earQuestions('reference', 'pentatonic', 9);
        assert.equal(qs.length, 10);
        for (let i = 0; i < qs.length; i++) {
            assert.ok([0, 2, 4, 7, 9].includes(qs[i].midi - 60));
            if (i) assert.notEqual(qs[i].midi, qs[i - 1].midi);
        }
        const single = D.earQuestions('single', 'naturals', 9);
        assert.ok(single.every(q => q.midi >= 60 && q.midi < 84));
    });
    test('written vs concert: a B-flat instrument\'s written C sounds concert B-flat', () => {
        assert.equal(D.earConcertMidi(60, 2), 58);
        assert.equal(D.earConcertMidi(60, 0), 60);
        assert.equal(D.earConcertMidi(60, 9), 51); // E-flat instrument
        // Play it back: concert B-flat (466.16 Hz) on a B-flat instrument is written C
        const h = D.earHeard(466.16, 2);
        assert.equal(h.writtenMidi % 12, 0);
        assert.ok(Math.abs(h.cents) <= 1);
    });
    test('scoring: right in any octave, C sharp = D flat, 10 points each', () => {
        const qs = [{ midi: 61, answer: 'Db' }, { midi: 73, answer: 'C#' }, { midi: 62, answer: 'D' }, { midi: 64, answer: 'F' }];
        const r = D.scoreRound('ear', 'single:all', { questions: qs });
        assert.deepEqual(r.results.map(x => x.correct), [true, true, true, false]);
        assert.equal(r.score, 30);
        const pb = D.scoreRound('ear', 'playback:naturals', { questions: [{ midi: 67, answer: 55 }, { midi: 64, answer: null }] });
        assert.deepEqual(pb.results.map(x => x.correct), [true, false]);
    });
    test('a note that is not in the level is refused', () => {
        assert.throws(() => raw.scoreRound('ear', 'reference:root5', { questions: [{ midi: 64, answer: 'E' }] }), /Bad Ear question/);
    });
});

// ML-399: SmartLearn in the drills it can work in - Pitch (notes) and Tempo (speed bands).
describe('SmartLearn in Pitch and Tempo (ML-399)', () => {
    const count = (list, f) => list.filter(f).length;
    test('Pitch: no weights is the same round as before; a weighted note comes up more', () => {
        assert.deepEqual(D.earQuestions('reference', 'major', 5), D.earQuestions('reference', 'major', 5, {}));
        assert.deepEqual(D.earQuestions('reference', 'major', 5), D.earQuestions('reference', 'major', 5, { 4: 0 }));
        let plain = 0, weighted = 0;
        for (let seed = 1; seed <= 200; seed++) {
            plain += count(D.earQuestions('reference', 'major', seed), q => q.midi === 64);
            weighted += count(D.earQuestions('reference', 'major', seed, { 4: 10 }), q => q.midi === 64);
        }
        assert.ok(weighted > plain * 2, `E came up ${weighted} times weighted against ${plain}`);
        for (let seed = 1; seed <= 50; seed++) {
            const qs = D.earQuestions('reference', 'major', seed, { 4: 10 });
            for (let i = 1; i < qs.length; i++) assert.notEqual(qs[i].midi, qs[i - 1].midi);
        }
    });
    test('Pitch: a missed note comes back three notes later, never twice running', () => {
        const qs = [60, 64, 67, 62, 65, 69, 71, 60, 64, 67].map(midi => ({ midi, name: '?' }));
        assert.equal(raw.earRetry(qs, 0), true);
        assert.equal(qs[3].midi, 60);
        const near = [60, 64, 60, 62, 65].map(midi => ({ midi, name: '?' }));
        assert.equal(raw.earRetry(near, 0), false, 'it is already due just before');
        assert.equal(raw.earRetry(qs, 8), false, 'too near the end of the round');
    });
    test('Pitch: the answer time and Play again taps are kept, and never change the score', () => {
        const questions = [{ midi: 60, answer: 'C', ms: 900.4, replays: 2 }, { midi: 67, answer: 'G' }];
        const r = D.scoreRound('ear', 'reference:root5', { questions });
        assert.deepEqual(r.results.map(x => [x.ms, x.replays]), [[900, 2], [null, 0]]);
        assert.equal(r.score, D.scoreRound('ear', 'reference:root5', { questions: questions.map(q => ({ midi: q.midi, answer: q.answer })) }).score);
    });
    test('Pitch: hesitated = well over your own speed, or Play again first; a wrong answer is never marked', () => {
        const q = (midi, answer, ms, replays = 0) => ({ midi, answer, ms, replays });
        const details = { questions: [q(60, 'C', 3000), q(64, 'E', 800), q(67, 'G', 900), q(64, 'E', 2600), q(60, 'C', 850), q(67, 'G', 700, 1), q(64, 'E', 900), q(60, 'G', 5000), q(67, 'G', 950), q(64, 'E', 800)] };
        const result = D.scoreRound('ear', 'reference:triad', details);
        const s = D.earSmartAnswers('reference:triad', result);
        assert.equal(s.answers[0].questionId, 'ear:reference:triad:0');
        assert.equal(s.answers[1].questionId, 'ear:reference:triad:4');
        assert.deepEqual(s.marks, [null, null, null, 'slow', null, 'slow', null, null, null, null]);
        assert.equal(s.answers[7].correct, false);
        // Play it back has no answer time: only Play again marks it
        const pb = D.earSmartAnswers('playback:naturals', D.scoreRound('ear', 'playback:naturals', { questions: [{ midi: 60, answer: 60 }, { midi: 62, answer: 62, replays: 1 }] }));
        assert.deepEqual(pb.marks, [null, 'slow']);
    });
    test('Tempo: no weights is the same round as before; a weighted band comes up more, still 5 speeds 8 apart', () => {
        for (const level of ['solo', 'names']) {
            assert.deepEqual(D.tapTargets(level, 7), D.tapTargets(level, 7, {}));
            assert.deepEqual(D.tapTargets(level, 7), D.tapTargets(level, 7, { andante: 0 }));
        }
        let plain = 0, weighted = 0;
        for (let seed = 1; seed <= 200; seed++) {
            const inBand = (t) => t.bpm >= 56 && t.bpm <= 75;
            plain += count(D.tapTargets('solo', seed), inBand);
            const round = D.tapTargets('solo', seed, { adagio: 10 });
            weighted += count(round, inBand);
            assert.equal(round.length, 5);
            for (const a of round) { assert.ok(a.bpm >= 50 && a.bpm <= 180 && a.bpm % 2 === 0); for (const b of round) if (a !== b) assert.ok(Math.abs(a.bpm - b.bpm) >= 8); }
        }
        assert.ok(weighted > plain * 1.5, `Adagio speeds: ${weighted} weighted against ${plain}`);
        let named = 0;
        for (let seed = 1; seed <= 200; seed++) {
            const round = D.tapTargets('names', seed, { presto: 10 });
            assert.equal(new Set(round.map(t => t.band)).size, 5);
            named += count(round, t => t.band === 'presto');
        }
        assert.ok(named > 175, `Presto in ${named} of 200 rounds (5 of 7 bands a round is 143 by chance)`);
    });
    test('Tempo: a speed\'s points stand in - under 70 to work on, 70-89 nearly, 90 or more known', () => {
        const details = { targets: [{ bpm: 60 }, { bpm: 100 }, { band: 'allegro' }] };
        const s = D.tapSmartAnswers('solo', details, { results: [{ points: 95 }, { points: 80 }, { points: 40 }] });
        assert.deepEqual(s.answers.map(a => [a.questionId, a.correct]), [['tap:solo:adagio', true], ['tap:solo:andante', true], ['tap:solo:allegro', false]]);
        assert.deepEqual(s.marks, [null, 'slow', null]);
    });
});
