// ML-193: unit tests for the Flow journey engine (public/flowJourney.js) - the play order, tempo and
// consistency rules Play Flow runs on. Pure, no DB. Run with `npm test` (in server/) or
// `node --test server/test/` from the repo root.
//
// The engine is a browser script (it attaches window.FlowJourney), so it's loaded here with vm into a
// sandbox - the exact file the app serves, not a copy.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { flowFixtures, fixtureBlocksAsDtos } from './fixtures/flowFixtures.js';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/flowJourney.js', import.meta.url), 'utf8'), sandbox);
// Results are copied back into this realm (the sandbox's arrays have their own Array prototype, which
// strict deep-equality rejects even when the contents match).
const FJ = new Proxy(sandbox.self.FlowJourney, {
    get: (t, k) => (typeof t[k] === 'function' ? (...args) => JSON.parse(JSON.stringify(t[k](...args))) : t[k])
});

// A block with every field at its "off" value - override what a test needs. `name` is the letter the
// journey strings below use for it.
let nextId = 1;
function blk(name, o = {}) {
    return {
        id: nextId++, name, numerator: 4, denominator: 4, barCount: 1, bpm: 100, noteValue: 'crotchet',
        isRepeatStart: false, isRepeatEnd: false, repeatPlayCount: null, isSectionBoundary: false, isFinalBarline: false,
        isSegno: false, isCoda: false, gotoSegno: false, gotoSegnoThenCoda: false, gotoCoda: false, gotoStartDc: false,
        gotoStartDcThenCoda: false, isFine: false, repeatEndingNumbers: [], repeatEndingStartBar: null,
        introStartBarOffset: null, introEndBarOffset: null, fermatas: [], ramps: [],
        ...o
    };
}
// The journey as "A1 A2 B1 ..." (block name + 1-based bar), main-journey bars only unless asked.
function play(blocks, { withIntro = false, opts } = {}) {
    const j = FJ.buildJourney(blocks, opts);
    const names = new Map(blocks.map(b => [b.id, b.name]));
    const s = j.steps
        .filter(x => x.kind === 'main' || (withIntro && x.kind === 'intro'))
        .map(x => `${x.kind === 'intro' ? 'i:' : ''}${names.get(x.blockId)}${x.bar + 1}`)
        .join(' ');
    return { s, end: j.end, steps: j.steps };
}
const codes = (blocks, opts) => FJ.checkFlow(blocks, opts).map(i => i.code).sort();

describe('linear play and the end of the piece (ML-250)', () => {
    test('plays every bar in order and stops at the end', () => {
        const r = play([blk('A', { barCount: 2 }), blk('B'), blk('C', { barCount: 3 })]);
        assert.equal(r.s, 'A1 A2 B1 C1 C2 C3');
        assert.equal(r.end, 'end');
    });
    test('a final barline stops the piece there', () => {
        const blocks = [blk('A'), blk('B', { isFinalBarline: true }), blk('C')];
        const r = play(blocks);
        assert.equal(r.s, 'A1 B1');
        assert.equal(r.end, 'finalBarline');
        assert.deepEqual(codes(blocks), ['never-plays']);
    });
    test('an empty flow has no journey', () => {
        assert.deepEqual(FJ.buildJourney([]).steps, []);
    });
    test('a lead-in plays first: whole bars, or one partial bar for a pickup', () => {
        const blocks = [blk('A')];
        const whole = FJ.buildJourney(blocks, { leadIn: { id: 99, isLeadIn: true, barCount: 2, numerator: 4 } });
        assert.deepEqual(whole.steps.map(s => s.kind), ['leadIn', 'leadIn', 'main']);
        const pickup = FJ.buildJourney(blocks, { leadIn: { id: 99, isLeadIn: true, barCount: 1, pickupBeats: 2, numerator: 4 } });
        assert.deepEqual(pickup.steps.map(s => s.kind), ['leadIn', 'main']);
    });
});

describe('repeats (ML-138)', () => {
    test('start to end, twice by default', () => {
        const r = play([blk('A', { isRepeatStart: true }), blk('B', { isRepeatEnd: true }), blk('C')]);
        assert.equal(r.s, 'A1 B1 A1 B1 C1');
    });
    test('play count 3', () => {
        assert.equal(play([blk('A', { isRepeatStart: true, isRepeatEnd: true, repeatPlayCount: 3 }), blk('B')]).s, 'A1 A1 A1 B1');
    });
    test('an end repeat with no start goes back to the beginning', () => {
        assert.equal(play([blk('A'), blk('B', { isRepeatEnd: true }), blk('C')]).s, 'A1 B1 A1 B1 C1');
    });
    test('a block that is both start and end repeats itself (was: went back to the start of the piece)', () => {
        assert.equal(play([blk('A'), blk('B', { isRepeatStart: true, isRepeatEnd: true, barCount: 2 }), blk('C')]).s, 'A1 B1 B2 B1 B2 C1');
    });
    test('two separate repeat regions each repeat', () => {
        const r = play([blk('A', { isRepeatStart: true }), blk('B', { isRepeatEnd: true }), blk('C', { isRepeatStart: true }), blk('D', { isRepeatEnd: true, repeatPlayCount: 3 })]);
        assert.equal(r.s, 'A1 B1 A1 B1 C1 D1 C1 D1 C1 D1');
    });
    test('pass numbers are recorded on every bar', () => {
        const r = play([blk('A', { isRepeatStart: true }), blk('B', { isRepeatEnd: true, repeatPlayCount: 3 })]);
        assert.deepEqual(r.steps.map(s => s.pass), [1, 1, 2, 2, 3, 3]);
        assert.deepEqual(r.steps.map(s => s.via), [null, null, 'repeat', null, 'repeat', null]);
    });
    test('checker: a start repeat with no end', () => {
        assert.deepEqual(codes([blk('A', { isRepeatStart: true }), blk('B')]), ['repeat-start-no-end']);
    });
    test('checker: a second end repeat with no start of its own', () => {
        const blocks = [blk('A'), blk('B', { isRepeatEnd: true }), blk('C'), blk('D', { isRepeatEnd: true })];
        assert.ok(codes(blocks).includes('repeat-end-no-start'));
        // ...and playback takes the conventional reading: back to just after the previous repeat
        assert.equal(play(blocks).s, 'A1 B1 A1 B1 C1 D1 C1 D1');
    });
    test('checker: a lone end repeat at the start of the piece is fine', () => {
        assert.deepEqual(codes([blk('A'), blk('B', { isRepeatEnd: true }), blk('C')]), []);
    });
});

describe('alternate endings (ML-249)', () => {
    test('1st and 2nd time bars', () => {
        const blocks = [blk('A', { isRepeatStart: true }), blk('B', { repeatEndingNumbers: [1], isRepeatEnd: true }), blk('C', { repeatEndingNumbers: [2] }), blk('D')];
        assert.equal(play(blocks).s, 'A1 B1 A1 C1 D1');
        assert.deepEqual(codes(blocks), []);
    });
    test('"1-2." then "3." with a 3x repeat', () => {
        const blocks = [blk('A', { isRepeatStart: true }), blk('B', { repeatEndingNumbers: [1, 2], isRepeatEnd: true, repeatPlayCount: 3 }), blk('C', { repeatEndingNumbers: [3] })];
        assert.equal(play(blocks).s, 'A1 B1 A1 B1 A1 C1');
        assert.deepEqual(codes(blocks), []);
    });
    test('three endings where the first two each repeat', () => {
        const blocks = [blk('A', { isRepeatStart: true }), blk('B', { repeatEndingNumbers: [1], isRepeatEnd: true }), blk('C', { repeatEndingNumbers: [2], isRepeatEnd: true, repeatPlayCount: 3 }), blk('D', { repeatEndingNumbers: [3] })];
        assert.equal(play(blocks).s, 'A1 B1 A1 C1 A1 D1');
    });
    test('an ending that starts part-way through its block ("from bar 2")', () => {
        const blocks = [blk('A', { isRepeatStart: true }), blk('B', { barCount: 3, repeatEndingNumbers: [1], repeatEndingStartBar: 2, isRepeatEnd: true }), blk('C', { repeatEndingNumbers: [2] })];
        assert.equal(play(blocks).s, 'A1 B1 B2 B3 A1 B1 C1');
    });
    test('endings of a later repeat start counting from pass 1 again', () => {
        const blocks = [
            blk('A', { isRepeatStart: true }), blk('B', { repeatEndingNumbers: [1], isRepeatEnd: true }), blk('C', { repeatEndingNumbers: [2] }),
            blk('D', { isRepeatStart: true }), blk('E', { repeatEndingNumbers: [1], isRepeatEnd: true }), blk('F', { repeatEndingNumbers: [2] })
        ];
        assert.equal(play(blocks).s, 'A1 B1 A1 C1 D1 E1 D1 F1');
    });
    test('checker: an ending with no repeat', () => {
        assert.deepEqual(codes([blk('A'), blk('B', { repeatEndingNumbers: [2] }), blk('C')]), ['ending-no-repeat', 'never-plays']);
    });
    test('checker: an ending for a pass the repeat never reaches', () => {
        const blocks = [blk('A', { isRepeatStart: true }), blk('B', { repeatEndingNumbers: [1], isRepeatEnd: true }), blk('C', { repeatEndingNumbers: [3] })];
        const c = codes(blocks);
        assert.ok(c.includes('ending-never-plays'));
        assert.ok(c.includes('ending-pass-missing')); // nothing for time 2
    });
    test('checker: two endings for the same pass', () => {
        const blocks = [blk('A', { isRepeatStart: true }), blk('B', { repeatEndingNumbers: [1], isRepeatEnd: true }), blk('C', { repeatEndingNumbers: [1, 2] })];
        assert.ok(codes(blocks).includes('ending-pass-twice'));
    });
});

describe('intro (ML-252)', () => {
    test('from a bar part-way through, to the end, then from bar 1', () => {
        const blocks = [blk('A', { barCount: 4, introStartBarOffset: 3 }), blk('B', { barCount: 2 })];
        assert.equal(play(blocks, { withIntro: true }).s, 'i:A3 i:A4 i:B1 i:B2 A1 A2 A3 A4 B1 B2');
    });
    test('with an end bar in a later block', () => {
        const blocks = [blk('A', { barCount: 2, introStartBarOffset: 2 }), blk('B', { barCount: 3, introEndBarOffset: 2 }), blk('C')];
        const r = play(blocks, { withIntro: true });
        assert.equal(r.s, 'i:A2 i:B1 i:B2 A1 A2 B1 B2 B3 C1');
        assert.equal(r.steps.find(s => s.kind === 'main').via, 'start');
    });
    test('the intro skips repeats and plays only the final ending', () => {
        const blocks = [blk('A', { isRepeatStart: true, introStartBarOffset: 1 }), blk('B', { repeatEndingNumbers: [1], isRepeatEnd: true }), blk('C', { repeatEndingNumbers: [2] })];
        assert.equal(play(blocks, { withIntro: true }).s, 'i:A1 i:C1 A1 B1 A1 C1');
    });
    test('the intro stops at a final barline', () => {
        const blocks = [blk('A', { introStartBarOffset: 1 }), blk('B', { isFinalBarline: true }), blk('C', { isCoda: true })];
        assert.match(play(blocks, { withIntro: true }).s, /^i:A1 i:B1 A1/);
    });
    test('checker: an end with no start, and an end before the start', () => {
        assert.deepEqual(codes([blk('A', { introEndBarOffset: 1 })]), ['intro-end-no-start']);
        assert.ok(codes([blk('A', { introEndBarOffset: 1 }), blk('B', { introStartBarOffset: 1 })]).includes('intro-end-before-start'));
    });
});

describe('signs and jumps (ML-250)', () => {
    test('D.C.: back to the start, no repeats the second time, on to the end', () => {
        const blocks = [blk('A', { isRepeatStart: true }), blk('B', { isRepeatEnd: true }), blk('C', { gotoStartDc: true })];
        const r = play(blocks);
        assert.equal(r.s, 'A1 B1 A1 B1 C1 A1 B1 C1');
        assert.equal(r.end, 'end');
        assert.equal(r.steps.filter(s => s.via === 'dc').length, 1);
    });
    test('D.C. al Fine stops at the Fine (ignored the first time)', () => {
        const blocks = [blk('A'), blk('B', { isFine: true }), blk('C', { gotoStartDc: true, isFinalBarline: true })];
        const r = play(blocks);
        assert.equal(r.s, 'A1 B1 C1 A1 B1');
        assert.equal(r.end, 'fine');
        assert.deepEqual(codes(blocks), []);
    });
    test('D.S. al Fine', () => {
        const blocks = [blk('A'), blk('B', { isSegno: true }), blk('C', { isFine: true }), blk('D', { gotoSegno: true, isFinalBarline: true })];
        assert.equal(play(blocks).s, 'A1 B1 C1 D1 B1 C1');
    });
    test('D.S. al Coda: To Coda is ignored until after the jump', () => {
        const blocks = [blk('A'), blk('B', { isSegno: true }), blk('C', { gotoCoda: true }), blk('D', { gotoSegnoThenCoda: true }), blk('E', { isCoda: true, isFinalBarline: true })];
        const r = play(blocks);
        assert.equal(r.s, 'A1 B1 C1 D1 B1 C1 E1');
        assert.equal(r.end, 'finalBarline');
        assert.deepEqual(r.steps.filter(s => s.via).map(s => s.via), ['ds', 'coda']);
        assert.deepEqual(codes(blocks), []);
    });
    test('D.C. al Coda', () => {
        const blocks = [blk('A'), blk('B', { gotoCoda: true }), blk('C', { gotoStartDcThenCoda: true }), blk('D', { isCoda: true })];
        assert.equal(play(blocks).s, 'A1 B1 C1 A1 B1 D1');
    });
    test('after a D.S., only the final ending plays', () => {
        const blocks = [blk('A', { isSegno: true, isRepeatStart: true }), blk('B', { repeatEndingNumbers: [1], isRepeatEnd: true }), blk('C', { repeatEndingNumbers: [2], gotoSegno: true }), blk('D')];
        assert.equal(play(blocks).s, 'A1 B1 A1 C1 A1 C1 D1');
    });
    test('a jump only happens once', () => {
        const r = play([blk('A'), blk('B', { gotoStartDc: true })]);
        assert.equal(r.s, 'A1 B1 A1 B1');
    });
    test('a jump on the same bar as a final barline happens first', () => {
        const blocks = [blk('A', { isSegno: true }), blk('B', { gotoSegno: true, isFinalBarline: true })];
        assert.equal(play(blocks).s, 'A1 B1 A1 B1');
    });
    test('a repeat is finished before the jump on the same bar', () => {
        assert.equal(play([blk('A', { isRepeatStart: true }), blk('B', { isRepeatEnd: true, gotoStartDc: true })]).s, 'A1 B1 A1 B1 A1 B1');
    });
    test('checker: D.S. with no segno plays straight on (and is flagged)', () => {
        const blocks = [blk('A'), blk('B', { gotoSegno: true })];
        assert.equal(play(blocks).s, 'A1 B1');
        assert.deepEqual(codes(blocks), ['ds-no-segno']);
    });
    test('checker: al Coda with no To Coda, no coda; To Coda with nothing to use it', () => {
        assert.deepEqual(codes([blk('A'), blk('B', { gotoStartDcThenCoda: true })]), ['al-coda-no-coda', 'al-coda-no-to-coda']);
        assert.deepEqual(codes([blk('A', { gotoCoda: true }), blk('B', { isCoda: true })]), ['to-coda-unused']);
        assert.deepEqual(codes([blk('A', { gotoCoda: true }), blk('B')]), ['to-coda-no-coda']);
    });
    test('checker: two segnos, two codas, two jumps', () => {
        const c = codes([blk('A', { isSegno: true, isCoda: true }), blk('B', { isSegno: true, isCoda: true, gotoSegno: true }), blk('C', { gotoStartDc: true })]);
        ['two-segnos', 'two-codas', 'two-jumps'].forEach(x => assert.ok(c.includes(x), x));
    });
    test('checker: a Fine with no D.S./D.C. is ignored (warning)', () => {
        const blocks = [blk('A', { isFine: true }), blk('B')];
        assert.equal(play(blocks).s, 'A1 B1');
        assert.deepEqual(codes(blocks), ['fine-unused']);
    });
    test('checker: Fine or To Coda outside the jumped-back section is never reached', () => {
        assert.ok(codes([blk('A', { isFine: true }), blk('B', { isSegno: true }), blk('C', { gotoSegno: true })]).includes('fine-unreachable'));
        assert.ok(codes([blk('A', { gotoCoda: true }), blk('B', { isSegno: true }), blk('C', { gotoSegnoThenCoda: true }), blk('D', { isCoda: true })]).includes('to-coda-unreachable'));
    });
    test('checker: segno after its D.S.', () => {
        assert.ok(codes([blk('A', { gotoSegno: true }), blk('B', { isSegno: true })]).includes('segno-after-ds'));
    });
});

describe('the ML-204 fixture Flows', () => {
    const journeyOf = (suffix) => {
        const f = flowFixtures.find(x => x.title.includes(suffix));
        const all = fixtureBlocksAsDtos(f);
        const leadIn = all.find(b => b.isLeadIn) || null;
        const blocks = all.filter(b => !b.isLeadIn);
        const idx = new Map(blocks.map((b, i) => [b.id, i]));
        const j = FJ.buildJourney(blocks, { leadIn });
        return { j, blocks, leadIn, seq: j.steps.filter(s => s.kind === 'main').map(s => `${idx.get(s.blockId)}.${s.bar + 1}`), issues: FJ.checkFlow(blocks, { leadIn }) };
    };
    test('A - repeats, voltas & metres', () => {
        const { j, seq, issues } = journeyOf(' A ');
        assert.equal(j.steps[0].kind, 'leadIn');
        // block 2 ("1-2." from bar 2, 3x) plays in full twice, then only its first bar; block 3 ("3.") once
        const b2 = seq.filter(s => s.startsWith('2.'));
        assert.deepEqual(b2, ['2.1', '2.2', '2.3', '2.1', '2.2', '2.3', '2.1']);
        assert.equal(seq.filter(s => s.startsWith('3.')).length, 2);
        assert.equal(seq.filter(s => s === '4.1').length, 2); // 6/8 block repeats itself
        assert.equal(j.end, 'finalBarline');
        // its first block is a start repeat with no end before the next start - a fixture shortcut the checker catches
        assert.deepEqual(issues.map(i => i.code), ['repeat-start-no-end']);
    });
    test('B - D.S. al Coda', () => {
        const { j, seq, issues } = journeyOf(' B ');
        assert.deepEqual(seq.map(s => s.split('.')[0]).filter((x, k, a) => x !== a[k - 1]), ['0', '1', '2', '3', '1', '2', '4']);
        assert.equal(j.end, 'finalBarline');
        assert.deepEqual(issues, []);
    });
    test('C - D.S. al Fine', () => {
        const { j, seq, issues } = journeyOf(' C ');
        assert.deepEqual(seq.map(s => s.split('.')[0]).filter((x, k, a) => x !== a[k - 1]), ['0', '1', '2', '3', '1', '2']);
        assert.equal(j.end, 'fine');
        assert.deepEqual(issues, []);
    });
    test('D - D.C. al Coda', () => {
        const { j, seq, issues } = journeyOf(' D ');
        assert.deepEqual(seq.map(s => s.split('.')[0]).filter((x, k, a) => x !== a[k - 1]), ['0', '1', '2', '0', '1', '3']);
        assert.equal(j.end, 'finalBarline');
        assert.deepEqual(issues, []);
    });
    test('E - pauses, ramps, intro, D.C. al Fine', () => {
        const { j, seq, issues } = journeyOf(' E ');
        const intro = j.steps.filter(s => s.kind === 'intro');
        assert.equal(intro.length, 8 + 2); // block 0 bars 1-8, block 1 bars 1-2
        assert.deepEqual(seq.map(s => s.split('.')[0]).filter((x, k, a) => x !== a[k - 1]), ['0', '1', '2', '0', '1']);
        assert.equal(j.end, 'fine');
        assert.deepEqual(issues, []);
    });
});

describe('passages', () => {
    test('merge consecutive bars; split at jumps, passes and block changes', () => {
        const blocks = [blk('A', { barCount: 3, isRepeatStart: true }), blk('B', { isRepeatEnd: true })];
        const p = FJ.passagesOf(FJ.buildJourney(blocks).steps);
        assert.deepEqual(p.map(x => [x.blockIndex, x.fromBar, x.toBar, x.pass, x.via]), [[0, 0, 2, 1, null], [1, 0, 0, 1, null], [0, 0, 2, 2, 'repeat'], [1, 0, 0, 2, null]]);
    });
});

describe('tempo ramps (ML-251)', () => {
    test('no ramps: the block tempo throughout', () => {
        const blocks = [blk('A', { barCount: 2, bpm: 90 })];
        [0, 3, 7.5].forEach(p => assert.equal(FJ.tempoAt(blocks, 0, p), 90));
    });
    test('to the next block by the end of the block', () => {
        const blocks = [blk('A', { barCount: 2, bpm: 100, ramps: [{ startBarOffset: 1, startBeatOffset: 1, endMode: 'block_end', targetMode: 'next_block' }] }), blk('B', { bpm: 60 })];
        assert.equal(FJ.tempoAt(blocks, 0, 3), 100); // bar 1 beat 4: before the ramp
        assert.equal(FJ.tempoAt(blocks, 0, 4), 100); // bar 2 beat 1: the ramp starts from here
        assert.equal(FJ.tempoAt(blocks, 0, 6), 80);  // half-way
        assert.equal(FJ.tempoAt(blocks, 0, 7), 70);  // last beat
        assert.equal(FJ.tempoAt(blocks, 0, 8), 60);  // the boundary: the next block's tempo
    });
    test('a custom target reached mid-block is then held', () => {
        const blocks = [blk('A', { barCount: 2, bpm: 100, ramps: [{ startBarOffset: 0, startBeatOffset: 1, endMode: 'specific', endBarOffset: 0, endBeatOffset: 3, targetMode: 'custom', targetBpm: 120 }] })];
        assert.equal(FJ.tempoAt(blocks, 0, 1), 110);
        assert.equal(FJ.tempoAt(blocks, 0, 2), 120);
        assert.equal(FJ.tempoAt(blocks, 0, 6), 120);
    });
    test('two ramps one after another: the second starts from where the first finished', () => {
        const blocks = [blk('A', { barCount: 3, bpm: 100, ramps: [
            { startBarOffset: 0, startBeatOffset: 1, endMode: 'specific', endBarOffset: 1, endBeatOffset: 1, targetMode: 'custom', targetBpm: 140 },
            { startBarOffset: 2, startBeatOffset: 1, endMode: 'block_end', targetMode: 'custom', targetBpm: 80 }
        ] })];
        assert.equal(FJ.tempoAt(blocks, 0, 2), 120);
        assert.equal(FJ.tempoAt(blocks, 0, 6), 140);
        assert.equal(FJ.tempoAt(blocks, 0, 10), 110);
        assert.equal(FJ.tempoAt(blocks, 0, 12), 80);
    });
    test('compound metre: ramp positions are written beats', () => {
        const blocks = [blk('A', { numerator: 6, denominator: 8, barCount: 2, bpm: 60, ramps: [{ startBarOffset: 1, startBeatOffset: 1, endMode: 'block_end', targetMode: 'custom', targetBpm: 90 }] })];
        assert.equal(FJ.tempoAt(blocks, 0, 5), 60);
        assert.equal(FJ.tempoAt(blocks, 0, 9), 75);
    });
    test('a next-block ramp on the last block is left flat and flagged', () => {
        const blocks = [blk('A', { bpm: 100, ramps: [{ startBarOffset: 0, startBeatOffset: 1, endMode: 'block_end', targetMode: 'next_block' }] })];
        assert.equal(FJ.tempoAt(blocks, 0, 3), 100);
        assert.deepEqual(codes(blocks), ['stale-setting']);
    });
    test('checker: a ramp that ends before it starts (the tempo steps straight to its target)', () => {
        const blocks = [blk('A', { barCount: 2, bpm: 100, ramps: [{ startBarOffset: 1, startBeatOffset: 1, endMode: 'specific', endBarOffset: 0, endBeatOffset: 2, targetMode: 'custom', targetBpm: 80 }] })];
        assert.deepEqual(codes(blocks), ['ramp-ends-before-start']);
        assert.equal(FJ.tempoAt(blocks, 0, 3), 100);
        assert.equal(FJ.tempoAt(blocks, 0, 4), 80);
    });
    test('checker: overlapping ramps', () => {
        const blocks = [blk('A', { barCount: 2, ramps: [
            { startBarOffset: 0, startBeatOffset: 1, endMode: 'block_end', targetMode: 'custom', targetBpm: 120 },
            { startBarOffset: 1, startBeatOffset: 1, endMode: 'block_end', targetMode: 'custom', targetBpm: 80 }
        ] })];
        assert.deepEqual(codes(blocks), ['ramps-overlap']);
    });
});

describe('written beats to metronome clicks (ML-255)', () => {
    test('simple metre', () => {
        const b = blk('A');
        assert.equal(FJ.writtenBeatToClick(b, 3, 4), 2);
        assert.equal(FJ.writtenBeatToClick(b, 3, 8), 4); // sub-beats on
    });
    test('6/8 conducted in 2', () => {
        const b = blk('A', { numerator: 6, denominator: 8 });
        assert.equal(FJ.meterInfo(b).macroBeatsPerBar, 2);
        assert.equal(FJ.writtenBeatToClick(b, 4, 6), 3); // sub-beats on: exact
        assert.equal(FJ.writtenBeatToClick(b, 4, 2), 1); // sub-beats off: the second dotted crotchet
        assert.equal(FJ.writtenBeatToClick(b, 6, 2), 1);
        assert.equal(FJ.writtenBeatToClick(b, 1, 2), 0);
    });
    test('pauses in a bar, fermata and caesura', () => {
        const b = blk('A', { barCount: 2, fermatas: [{ kind: 'fermata', barOffset: 1, beatOffset: 3, holdBeats: 2 }, { kind: 'caesura', barOffset: 1, beatOffset: 4, holdBeats: 1 }, { kind: 'fermata', barOffset: 0, beatOffset: 1, holdBeats: 1 }] });
        assert.deepEqual(FJ.pausesInBar(b, 1, 4).map(p => [p.kind, p.click, p.holdBeats]), [['fermata', 2, 2], ['caesura', 3, 1]]);
    });
    test('checker: a pause or alternate ending past the end of a shortened block', () => {
        assert.deepEqual(codes([blk('A', { barCount: 2, fermatas: [{ kind: 'fermata', barOffset: 4, beatOffset: 1, holdBeats: 1 }] })]), ['stale-setting']);
    });
});
