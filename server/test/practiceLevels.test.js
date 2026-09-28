// ML-315 (epic ML-314): unit tests for the practice Level maths in public/flowJourney.js - Level
// speeds, session sub-beats, chunk run time / fit in a 4:30 block, suggested splits and the per-bar
// Level map behind the heat map. Pure, no DB. Loaded with vm like flowJourney.test.js, so the tested
// code is the file the app serves.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/flowJourney.js', import.meta.url), 'utf8'), sandbox);
const FJ = new Proxy(sandbox.self.FlowJourney, {
    get: (t, k) => (typeof t[k] === 'function' ? (...args) => JSON.parse(JSON.stringify(t[k](...args))) : t[k])
});

let nextId = 1;
function blk(o = {}) {
    return {
        id: nextId++, numerator: 4, denominator: 4, barCount: 1, bpm: 100, noteValue: 'crotchet',
        isRepeatStart: false, isRepeatEnd: false, repeatPlayCount: null, isSectionBoundary: false, isFinalBarline: false,
        isSegno: false, isCoda: false, gotoSegno: false, gotoSegnoThenCoda: false, gotoCoda: false, gotoStartDc: false,
        gotoStartDcThenCoda: false, isFine: false, repeatEndingNumbers: [], repeatEndingStartBar: null,
        introStartBarOffset: null, introEndBarOffset: null, fermatas: [], ramps: [],
        ...o
    };
}
const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} is not ~${b}`);

describe('Level speeds', () => {
    test('120 bpm: 35 / 50 / 70 / 85 / 100 %', () => {
        assert.deepEqual(FJ.levelPercents(120), [35, 50, 70, 85, 100]);
    });
    test('Level 1 rounds UP so no bar drops below 40 bpm', () => {
        const [p1] = FJ.levelPercents(132);
        assert.equal(p1, 35);
        assert.ok(132 * p1 / 100 >= 40);
        assert.deepEqual(FJ.levelPercents(80), [50, 65, 75, 90, 100]);
        assert.equal(80 * FJ.levelPercents(80)[0] / 100, 40);
    });
    test('every step is a multiple of 5%', () => {
        for (let bpm = 41; bpm <= 240; bpm++) {
            const p = FJ.levelPercents(bpm);
            p.forEach(x => assert.equal(x % 5, 0));
            assert.ok(bpm * p[0] / 100 >= 40, `Level 1 at ${bpm} bpm is below 40`);
            for (let k = 1; k < 5; k++) assert.ok(p[k] >= p[k - 1]);
        }
    });
    test('at or below 40 bpm every Level is full speed', () => {
        assert.deepEqual(FJ.levelPercents(40), [100, 100, 100, 100, 100]);
        assert.deepEqual(FJ.levelPercents(30), [100, 100, 100, 100, 100]);
    });
    test('levelPercent clamps the Level to 1-5', () => {
        assert.equal(FJ.levelPercent(0, 120), 35);
        assert.equal(FJ.levelPercent(9, 120), 100);
        assert.equal(FJ.levelPercent(3, 120), 70);
    });
});

describe('session sub-beats', () => {
    test('on below the threshold, off at or above it', () => {
        assert.equal(FJ.sessionSubBeats(120, 70, 100), true);   // 84 bpm
        assert.equal(FJ.sessionSubBeats(120, 85, 100), false);  // 102 bpm
        assert.equal(FJ.sessionSubBeats(100, 100, 100), false); // exactly 100
    });
    test('defaults to 100 bpm when no threshold is set', () => {
        assert.equal(FJ.sessionSubBeats(120, 80), true);  // 96
        assert.equal(FJ.sessionSubBeats(120, 90), false); // 108
    });
});

describe('slowest tempo in a chunk', () => {
    test('takes the slowest block in the range only', () => {
        const blocks = [blk({ barCount: 4, bpm: 120 }), blk({ barCount: 4, bpm: 60 }), blk({ barCount: 4, bpm: 140 })];
        assert.equal(FJ.slowestTempo(blocks, 1, 12), 60);
        assert.equal(FJ.slowestTempo(blocks, 1, 4), 120);
        assert.equal(FJ.slowestTempo(blocks, 9, 12), 140);
    });
    test('follows a ramp down', () => {
        const blocks = [blk({ barCount: 4, bpm: 120, ramps: [{ targetMode: 'custom', targetBpm: 60, endMode: 'block' }] })];
        const slow = FJ.slowestTempo(blocks, 1, 4);
        assert.ok(slow < 70 && slow >= 60, `slowest was ${slow}`);
    });
});

describe('chunk fit in a 4:30 block', () => {
    const snowman = () => [blk({ numerator: 3, denominator: 4, barCount: 60, bpm: 132 })];
    test('60 bars of 3/4 at 132, Level 1: one run, too long', () => {
        const f = FJ.chunkFit(snowman(), { startBar: 1, endBar: 60, level: 1 });
        assert.equal(f.ok, true);
        assert.equal(f.percent, 35);
        close(f.runSeconds, 60 * 3 * 60 / (132 * 0.35));
        assert.equal(f.runs, 1);
        assert.equal(f.fits, 'tooLong');
    });
    test('the same bars split into 3 x 20 fit 3 runs each', () => {
        assert.deepEqual(FJ.suggestSplit(snowman(), { startBar: 1, endBar: 60, level: 1 }), [[1, 20], [21, 40], [41, 60]]);
        const f = FJ.chunkFit(snowman(), { startBar: 1, endBar: 20, level: 1 });
        assert.equal(f.runs, 3);
        assert.equal(f.fits, 'ok');
    });
    test('a chunk that fits is left alone, and fits better at higher Levels', () => {
        const blocks = [blk({ barCount: 8, bpm: 120 })];
        assert.deepEqual(FJ.suggestSplit(blocks, { startBar: 1, endBar: 8, level: 1 }), [[1, 8]]);
        const l1 = FJ.chunkFit(blocks, { startBar: 1, endBar: 8, level: 1 });
        const l5 = FJ.chunkFit(blocks, { startBar: 1, endBar: 8, level: 5 });
        assert.equal(l1.fits, 'good');
        assert.ok(l5.runs > l1.runs);
    });
    test('a repeat inside the chunk is played as written', () => {
        const plain = [blk({ barCount: 4, bpm: 120 })];
        const repeated = [blk({ barCount: 4, bpm: 120, isRepeatStart: true, isRepeatEnd: true, repeatPlayCount: 2 }), blk({ barCount: 1, bpm: 120 })];
        const a = FJ.chunkFit(plain, { startBar: 1, endBar: 4, level: 5 });
        const b = FJ.chunkFit(repeated, { startBar: 1, endBar: 5, level: 5 });
        close(a.runSeconds, 8);
        close(b.runSeconds, 18); // 4 bars twice + bar 5, 2 s a bar
    });
    test('a fermata adds its hold', () => {
        const plain = [blk({ barCount: 1, bpm: 60 })];
        const held = [blk({ barCount: 1, bpm: 60, fermatas: [{ kind: 'fermata', barOffset: 0, beatOffset: 4, holdBeats: 3 }] })];
        close(FJ.chunkFit(plain, { startBar: 1, endBar: 1, level: 5 }).runSeconds, 4);
        close(FJ.chunkFit(held, { startBar: 1, endBar: 1, level: 5 }).runSeconds, 6);
    });
    test('bars outside the piece are reported, not guessed', () => {
        assert.equal(FJ.chunkFit([blk({ barCount: 4 })], { startBar: 3, endBar: 9, level: 1 }).reason, 'range');
    });
});

describe('the per-bar Level map', () => {
    test('a hard passage wins over the rest of the piece', () => {
        const map = FJ.barLevels(12, [
            { startBar: 1, endBar: 12, level: 4 },
            { startBar: 5, endBar: 7, level: 2 }
        ]);
        assert.deepEqual(map, [4, 4, 4, 4, 2, 2, 2, 4, 4, 4, 4, 4]);
    });
    test('unset chunks and bars stay null', () => {
        const map = FJ.barLevels(6, [{ startBar: 1, endBar: 3, level: 1 }, { startBar: 4, endBar: 5, level: null }]);
        assert.deepEqual(map, [1, 1, 1, null, null, null]);
    });
});
