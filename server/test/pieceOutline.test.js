// ML-424: unit tests for quick piece entry's rules (public/pieceOutline.js) - an outline (bars, marks,
// exceptions, extras) becomes the same blocks the bar-by-bar editor makes. The three big cases are real
// pieces entered by hand on production (4 Oct 2026); the expected block starts are theirs, less the few
// splits that had no reason (no mark, no change). Loaded with vm, like practicePlan.test.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const load = (file) => { const sandbox = { self: {} }; vm.runInNewContext(fs.readFileSync(new URL(`../../public/${file}`, import.meta.url), 'utf8'), sandbox); return sandbox.self; };
const raw = load('pieceOutline.js').PieceOutline;
const PO = new Proxy(raw, { get: (t, k) => (typeof t[k] === 'function' ? (...args) => JSON.parse(JSON.stringify(t[k](...args))) : t[k]) });
const FlowJourney = load('flowJourney.js').FlowJourney;

const numbers = (list) => list.map(bar => ({ bar }));
const timeFrom = (runs, bars, main) => { const time = {}; let sig = main; for (let b = 1; b <= bars; b++) { const r = runs.find(x => x[0] === b); if (r) sig = r[1]; if (sig !== main) time[b] = sig; } return time; };
const starts = (blocks) => blocks.filter(b => !b.isLeadIn).map(b => b.from);
const blockAt = (blocks, bar) => blocks.find(b => b.from === bar);

const pirates = {
    bars: 235, leadIn: true, mainSig: '4/4', mainBpm: 105, mainNote: null, markKind: 'numbers',
    marks: numbers([7, 21, 30, 38, 46, 55, 65, 74, 79, 87, 96, 108, 121, 132, 136, 141, 147, 154, 166, 179, 183, 193, 202, 209, 217, 226]),
    time: timeFrom([[7, '3/4'], [45, '4/4'], [46, '3/4'], [50, '4/4'], [55, '6/4'], [56, '4/4'], [64, '6/4'], [65, '3/4'], [121, '4/4'], [136, '6/4'], [137, '4/4'], [138, '5/4'], [139, '4/4'], [140, '5/4'], [141, '4/4'], [142, '3/4'], [143, '4/4'], [146, '3/4'], [147, '4/4'], [165, '3/4'], [171, '4/4'], [201, '2/4'], [202, '4/4'], [232, '2/4'], [233, '4/4']], 235, '4/4'),
    speeds: [{ bar: 7, bpm: 100 }, { bar: 55, bpm: 70, noteValue: 'minim' }, { bar: 65, bpm: 174, noteValue: 'crotchet' }, { bar: 163, bpm: 72, noteValue: 'minim' }, { bar: 165, bpm: 63, noteValue: 'crotchet' }, { bar: 183, bpm: 120 }],
    extras: [{ type: 'pause', kind: 'fermata', bar: 162, beat: 4, holdBeats: 3, playbackMode: 'tone' }, { type: 'pause', kind: 'fermata', bar: 235, beat: 4, holdBeats: 4, playbackMode: 'tone' }]
};
const shrek = {
    bars: 100, leadIn: false, mainSig: '4/4', mainBpm: 120, mainNote: null, markKind: 'numbers',
    marks: numbers([5, 13, 29, 39, 46, 54, 62, 73, 89]), time: { 36: '2/4' },
    speeds: [{ bar: 5, bpm: 100 }, { bar: 23, bpm: 127 }, { bar: 29, bpm: 105 }, { bar: 36, bpm: 104 }],
    extras: [{ type: 'repeatEndings', from: 89, to: 98, times: 2, e1From: 98, e2To: 100 }]
};
const mammaMia = {
    bars: 145, leadIn: false, mainSig: '4/4', mainBpm: 135, mainNote: null, markKind: 'numbers',
    marks: numbers([9, 17, 25, 41, 50, 59, 67, 78, 86, 94, 107, 119, 135]), time: { 76: '2/4' },
    speeds: [{ bar: 41, bpm: 120 }, { bar: 73, bpm: 100 }, { bar: 101, bpm: 80 }, { bar: 107, bpm: 104 }],
    extras: [
        { type: 'repeat', from: 67, to: 70, times: 2 },
        { type: 'ramp', from: 105, to: 105, startBeat: 1, target: 'custom', bpm: 104 },
        { type: 'repeat', from: 107, to: 110, times: 2 },
        { type: 'repeatEndings', from: 129, to: 132, times: 2, e1From: 131, e2To: 134 }
    ]
};

describe('typing the rehearsal marks (ML-424)', () => {
    test('spaces, commas, semicolons and new lines all separate; in order, once each', () => {
        assert.deepEqual(PO.parseBarList('21, 7 30;38\n46 ,, 7', 235), { bars: [7, 21, 30, 38, 46], bad: [] });
    });
    test('what isn\'t a bar of the piece is handed back', () => {
        assert.deepEqual(PO.parseBarList('7 A 0 300 12', 235), { bars: [7, 12], bad: ['A', '0', '300'] });
    });
    test('numbers name themselves; letters or words keep their label; none means none', () => {
        assert.deepEqual(PO.marksOf({ bars: 50, markKind: 'numbers', marks: [{ bar: 21 }, { bar: 7 }] }), [{ bar: 7, label: '7' }, { bar: 21, label: '21' }]);
        assert.deepEqual(PO.marksOf({ bars: 50, markKind: 'text', marks: [{ bar: 9, label: 'A' }, { bar: 17, label: ' Verse 2 ' }, { bar: 20, label: '' }] }), [{ bar: 9, label: 'A' }, { bar: 17, label: 'Verse 2' }]);
        assert.deepEqual(PO.marksOf({ bars: 50, markKind: 'none', marks: [{ bar: 9, label: 'A' }] }), []);
    });
    test('the sections the bars are drawn in: one per mark, or the whole piece with no marks', () => {
        assert.deepEqual(PO.sections({ bars: 20, markKind: 'numbers', marks: [{ bar: 5 }, { bar: 13 }] }), [{ from: 1, to: 4, label: null }, { from: 5, to: 12, label: '5' }, { from: 13, to: 20, label: '13' }]);
        assert.deepEqual(PO.sections({ bars: 20, markKind: 'none', marks: [] }), [{ from: 1, to: 20, label: null }]);
    });
});

describe('the outline as blocks - three pieces entered by hand on production (ML-424)', () => {
    test('Pirates of the Caribbean: 235 bars become the same 44 blocks and a count-in', () => {
        const { blocks, clashes } = PO.buildBlocks(pirates);
        assert.deepEqual(clashes, []);
        assert.deepEqual(starts(blocks), [1, 7, 21, 30, 38, 45, 46, 50, 55, 56, 64, 65, 74, 79, 87, 96, 108, 121, 132, 136, 137, 138, 139, 140, 141, 142, 143, 146, 147, 154, 163, 165, 166, 171, 179, 183, 193, 201, 202, 209, 217, 226, 232, 233]);
        assert.equal(blocks[0].isLeadIn, true);
        assert.equal(blocks.reduce((s, b) => s + (b.isLeadIn ? 0 : b.barCount), 0), 235);
        const b55 = blockAt(blocks, 55);
        assert.deepEqual([b55.sig, b55.bpm, b55.noteValue, b55.rehearsalMark, b55.barCount], ['6/4', 70, 'minim', '55', 1]);
        assert.deepEqual([blockAt(blocks, 56).bpm, blockAt(blocks, 56).noteValue, blockAt(blocks, 56).rehearsalMark], [70, 'minim', null]); // the speed carries on
        assert.deepEqual(blockAt(blocks, 154).fermatas, [{ kind: 'fermata', barOffset: 8, beatOffset: 4, holdBeats: 3, playbackMode: 'tone' }]);
        assert.deepEqual(blockAt(blocks, 233).fermatas, [{ kind: 'fermata', barOffset: 2, beatOffset: 4, holdBeats: 4, playbackMode: 'tone' }]);
    });
    test('Shrek Dance Party: a repeat whose 1st ending is its last bar', () => {
        const { blocks, clashes } = PO.buildBlocks(shrek);
        assert.deepEqual(clashes, []);
        assert.deepEqual(starts(blocks), [1, 5, 13, 23, 29, 36, 37, 39, 46, 54, 62, 73, 89, 99]);
        const rep = blockAt(blocks, 89), second = blockAt(blocks, 99);
        assert.deepEqual([rep.isRepeatStart, rep.isRepeatEnd, rep.repeatPlayCount, rep.repeatEndingNumbers, rep.repeatEndingStartBar], [true, true, 2, [1], 10]);
        assert.deepEqual([second.repeatEndingNumbers, second.repeatEndingStartBar, second.barCount], [[2], 1, 2]);
        assert.deepEqual([blockAt(blocks, 36).sig, blockAt(blocks, 36).bpm, blockAt(blocks, 37).sig, blockAt(blocks, 37).bpm], ['2/4', 104, '4/4', 104]);
    });
    test('Mamma Mia: three repeats, endings and a speed-up, exactly as stored by hand', () => {
        const { blocks, clashes } = PO.buildBlocks(mammaMia);
        assert.deepEqual(clashes, []);
        assert.deepEqual(starts(blocks), [1, 9, 17, 25, 41, 50, 59, 67, 71, 73, 76, 77, 78, 86, 94, 101, 107, 111, 119, 129, 133, 135]);
        assert.deepEqual(blockAt(blocks, 101).ramps, [{ startBarOffset: 4, startBeatOffset: 1, endMode: 'specific', endBarOffset: 5, endBeatOffset: 1, targetMode: 'custom', targetBpm: 104 }]);
        const rep = blockAt(blocks, 129);
        assert.deepEqual([rep.isRepeatStart, rep.isRepeatEnd, rep.repeatEndingNumbers, rep.repeatEndingStartBar], [true, true, [1], 3]);
        assert.deepEqual(blockAt(blocks, 133).repeatEndingNumbers, [2]);
        assert.deepEqual([blockAt(blocks, 67).isRepeatStart, blockAt(blocks, 67).isRepeatEnd, blockAt(blocks, 67).rehearsalMark], [true, true, '67']);
    });
    test('the pieces play: the journey engine\'s own check finds nothing wrong with them', () => {
        const meter = (sig) => { const [n, d] = sig.split('/').map(Number); return { numerator: n, denominator: d }; };
        [pirates, shrek, mammaMia].forEach(o => {
            const blocks = raw.buildBlocks(o).blocks.map(b => ({ ...b, ...meter(b.sig) }));
            const errors = FlowJourney.checkFlow(blocks).filter(i => i.severity === 'error');
            assert.deepEqual(JSON.parse(JSON.stringify(errors)), []);
            assert.equal(FlowJourney.buildJourney(blocks).steps.length > 0, true);
        });
    });
    test('Mamma Mia is played in the right order: the repeat\'s endings', () => {
        const meter = (sig) => { const [n, d] = sig.split('/').map(Number); return { numerator: n, denominator: d }; };
        const blocks = raw.buildBlocks({ ...mammaMia, extras: [mammaMia.extras[3]] }).blocks.map(b => ({ ...b, ...meter(b.sig) }));
        // one step a bar: 145 written bars, plus bars 129-130 played a second time (131-132 only the first)
        const steps = FlowJourney.buildJourney(blocks).steps;
        assert.equal(steps.length, 147);
        const written = Array.from(steps, s => blocks[s.blockIndex].from + s.bar);
        assert.deepEqual(written.slice(128, 136), [129, 130, 131, 132, 129, 130, 133, 134]);
    });
});

describe('extras and clashes (ML-424)', () => {
    const base = { bars: 40, leadIn: false, mainSig: '4/4', mainBpm: 100, mainNote: null, markKind: 'numbers', marks: numbers([9, 17]), time: {}, speeds: [{ bar: 25, bpm: 120 }] };
    const build = (extras) => PO.buildBlocks({ ...base, extras });
    test('"to the next speed": the speed-up ends where the speed changes', () => {
        const { blocks, clashes } = build([{ type: 'ramp', from: 23, to: 24, target: 'next' }]);
        assert.deepEqual(clashes, []);
        assert.deepEqual(blockAt(blocks, 17).ramps, [{ startBarOffset: 6, startBeatOffset: 1, endMode: 'block_end', endBarOffset: null, endBeatOffset: null, targetMode: 'next_block', targetBpm: null }]);
    });
    test('"to the next speed" that stops short, or a speed-up across a rehearsal mark, is a clash', () => {
        assert.equal(build([{ type: 'ramp', from: 20, to: 22, target: 'next' }]).clashes.length, 1);
        assert.equal(build([{ type: 'ramp', from: 15, to: 18, target: 'custom', bpm: 90 }]).clashes.length, 1);
    });
    test('bars that make no sense are clashes, and the piece is still built without them', () => {
        const { blocks, clashes } = build([{ type: 'repeat', from: 12, to: 10, times: 2 }, { type: 'repeatEndings', from: 9, to: 16, times: 2, e1From: 20, e2To: 18 }, { type: 'pause', kind: 'fermata', bar: 99, beat: 1, holdBeats: 2 }]);
        assert.deepEqual(clashes.map(c => c.extra), [0, 1, 2]);
        assert.deepEqual(starts(blocks), [1, 9, 17, 25]);
    });
    test('signs: a segno or coda starts a block, a jump or Fine ends one', () => {
        const { blocks, clashes } = build([{ type: 'sign', sign: 'segno', bar: 5 }, { type: 'sign', sign: 'toCoda', bar: 12 }, { type: 'sign', sign: 'dsCoda', bar: 32 }, { type: 'sign', sign: 'coda', bar: 33 }]);
        assert.deepEqual(clashes, []);
        assert.deepEqual(starts(blocks), [1, 5, 9, 13, 17, 25, 33]);
        assert.equal(blockAt(blocks, 5).isSegno, true);
        assert.equal(blockAt(blocks, 9).gotoCoda, true);
        assert.equal(blockAt(blocks, 25).gotoSegnoThenCoda, true);
        assert.equal(blockAt(blocks, 33).isCoda, true);
    });
    test('a repeat played 3 times: the 1st ending is for passes 1 and 2, the 2nd for pass 3', () => {
        const { blocks } = build([{ type: 'repeatEndings', from: 9, to: 16, times: 3, e1From: 15, e2To: 18 }]);
        assert.deepEqual([blockAt(blocks, 9).repeatEndingNumbers, blockAt(blocks, 9).repeatEndingStartBar, blockAt(blocks, 9).repeatPlayCount], [[1, 2], 7, 3]);
        assert.deepEqual(blockAt(blocks, 17).repeatEndingNumbers, [3]);
    });
    test('an intro: from a bar, to a bar', () => {
        const { blocks } = build([{ type: 'intro', from: 19, to: 24 }]);
        assert.deepEqual([blockAt(blocks, 17).introStartBarOffset, blockAt(blocks, 17).introEndBarOffset], [3, 8]);
    });
    test('the summary line', () => {
        assert.deepEqual(PO.summary(mammaMia), { bars: 145, marks: 13, speeds: 5, exceptions: 1, extras: 4, blocks: 22, clashes: 0 });
    });
});
