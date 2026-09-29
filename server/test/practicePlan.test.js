// ML-320 (epic ML-314): unit tests for the practice session builder's rules (public/practicePlan.js) -
// the blocks a session gets, who fills them and the 4:30 nudge. Loaded with vm, like flowJourney.test.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/practicePlan.js', import.meta.url), 'utf8'), sandbox);
const PP = new Proxy(sandbox.self.PracticePlan, {
    get: (t, k) => (typeof t[k] === 'function' ? (...args) => JSON.parse(JSON.stringify(t[k](...args))) : t[k])
});
const count = (kinds, k) => kinds.filter(x => x === k).length;

describe('blocks', () => {
    test('5 and 10 minutes: you choose every block', () => {
        assert.deepEqual(PP.blockKinds(5, 'standard', 'both'), ['choose']);
        assert.deepEqual(PP.blockKinds(10, 'standard', 'both'), ['choose', 'choose']);
    });
    test('Standard starts Warm-up, Scales; Concert drops Scales', () => {
        assert.deepEqual(PP.blockKinds(15, 'standard', 'rehearsal'), ['warmup', 'scales', 'rehearsal']);
        assert.deepEqual(PP.blockKinds(15, 'concert', 'rehearsal'), ['warmup', 'rehearsal', 'rehearsal']);
    });
    test('Both splits the rest in half, the odd block to Rehearsal', () => {
        const k = PP.blockKinds(45, 'standard', 'both'); // 9 blocks: 2 lead + 7
        assert.equal(k.length, 9);
        assert.equal(count(k, 'skills'), 3);
        assert.equal(count(k, 'rehearsal'), 4);
        const c = PP.blockKinds(45, 'concert', 'both'); // 1 lead + 8
        assert.equal(count(c, 'skills'), 4);
        assert.equal(count(c, 'rehearsal'), 4);
    });
    test('Skills or Rehearsal focus takes every block after the template', () => {
        assert.equal(count(PP.blockKinds(30, 'standard', 'skills'), 'skills'), 4);
        assert.equal(count(PP.blockKinds(30, 'standard', 'rehearsal'), 'rehearsal'), 4);
    });
    test('length is kept to 5-120 in 5-minute steps', () => {
        assert.equal(PP.clampMinutes(3), 5);
        assert.equal(PP.clampMinutes(47), 45);
        assert.equal(PP.clampMinutes(500), 120);
        assert.equal(PP.blockKinds(120, 'standard', 'both').length, 24);
    });
});

describe('filling blocks', () => {
    const chunks = [
        { id: 3, scoreId: 1, title: 'Slaidburn', level: 4, lastPractised: null },
        { id: 1, scoreId: 2, title: 'Floral Dance', level: 1, lastPractised: '2026-09-26T10:00:00Z' },
        { id: 2, scoreId: 2, title: 'Floral Dance', level: 1, lastPractised: null },
    ];
    test('Rehearsal takes the weakest first, never-practised before practised, then goes round', () => {
        const blocks = PP.plan(35, 'concert', 'rehearsal', chunks); // warm-up + 6 rehearsal
        assert.deepEqual(blocks.filter(b => b.kind === 'rehearsal').map(b => b.chunk.id), [2, 1, 3, 2, 1, 3]);
    });
    test('no chunks: Rehearsal blocks say so', () => {
        const blocks = PP.plan(15, 'standard', 'rehearsal', []);
        assert.equal(blocks[2].chunk, null);
    });
    test('Skills blocks rotate through the playing tools', () => {
        const tools = PP.plan(30, 'standard', 'skills', []).filter(b => b.kind === 'skills').map(b => b.tool);
        assert.deepEqual(tools, ['tapTempo', 'gapTrainer', 'warmups', 'ear']);
    });
});

describe('the 4:30 nudge', () => {
    test('play until 4:30, nudge for 30 s, then move on', () => {
        assert.equal(PP.blockState(0), 'play');
        assert.equal(PP.blockState(269), 'play');
        assert.equal(PP.blockState(270), 'nudge');
        assert.equal(PP.blockState(299), 'nudge');
        assert.equal(PP.blockState(300), 'next');
    });
    test('Keep going pushes the next nudge 5 minutes on', () => {
        const at = 270 + PP.KEEP_GOING_SECONDS;
        assert.equal(PP.blockState(400, at), 'play');
        assert.equal(PP.blockState(at, at), 'nudge');
        assert.equal(PP.blockState(at + 30, at), 'next');
    });
});

describe('the readiness forecast (ML-319)', () => {
    const c = (kind, level, a = 1, z = 8) => ({ kind, level, startBar: a, endBar: z });
    const cobham = [
        { title: 'Slaidburn', chunks: [c('whole', 4, 1, 32), c('hard', 2, 5, 10), c('hard', 3, 25, 28)] },
        { title: 'Floral Dance', chunks: [c('chunk', 1), c('chunk', 2), c('chunk', 3), c('chunk', 1), c('chunk', null)] },
        { title: 'Deep Harmony', chunks: [c('whole', 4)] },
        { title: 'Nimrod', chunks: [c('whole', 5)] },
        { title: 'Mack and Mabel', chunks: [] },
    ];
    const base = { pieces: cobham, eventDate: '2026-10-11', today: '2026-09-27' };
    test('one block per chunk per Level; a piece not set up takes one preparation block (ML-334)', () => {
        const f = PP.forecast(base);
        assert.deepEqual(f.pieces.map(p => p.blocks), [6, 13, 1, 0, 1]);
        assert.deepEqual(f.pieces.map(p => p.prep), [false, false, false, false, true]);
        assert.equal(f.total, 21);
        assert.equal(f.minutes, 105);
        assert.deepEqual(f.notCounted, ['Floral Dance: 1 chunk with no Level yet', 'Mack and Mabel: after preparing it, its Levels decide the rest']);
    });
    test('with a target date: the daily pace, rounded up (ML-333)', () => {
        const f = PP.forecast(base);
        assert.equal(f.days, 14);
        assert.equal(f.perDay, 2);
        assert.equal(f.perDayMinutes, 10);
    });
    test('join-up groups: chunks to Level 4, then one block per group not yet at 5', () => {
        const withGroup = [...cobham[1].chunks, c('group', null, 1, 40)];
        assert.equal(PP.pieceBlocks(withGroup).blocks, 3 + 2 + 1 + 3 + 1);
        assert.equal(PP.pieceBlocks([c('chunk', 5), c('group', 5)]).blocks, 0);
    });
    test('no target date, or nothing to do: no pace', () => {
        assert.equal(PP.forecast({ ...base, eventDate: null }).perDay, null);
        assert.equal(PP.forecast({ ...base, pieces: [cobham[3]] }).perDay, null);
    });
});

describe('warm-up lists (ML-343)', () => {
    const kinds = ['long-tones', 'lip-slurs', 'flexibility'];
    const ex = [
        { id: 1, kind: 'long-tones' }, { id: 2, kind: 'long-tones' },
        { id: 3, kind: 'lip-slurs' }, { id: 4, kind: 'lip-slurs' },
        { id: 5, kind: 'flexibility' }
    ];
    const list = (id) => PP.WARMUP_LISTS.find(l => l.id === id);
    test('the four standard lists', () => {
        assert.deepEqual(Array.from(PP.WARMUP_LISTS, l => l.name), ['External warm-up', 'One of each kind', 'Brass basics', 'Everything, random']);
    });
    test('External plays nothing - just the timer', () => {
        assert.deepEqual(PP.warmupSequence(list('external'), ex, kinds), []);
    });
    test('One of each kind: one per kind, in the kinds\' order', () => {
        assert.deepEqual(PP.warmupSequence(list('each'), ex, kinds, () => 0), [1, 3, 5]);
        assert.deepEqual(PP.warmupSequence(list('each'), ex, kinds, () => 0.99), [2, 4, 5]);
    });
    test('Brass basics: long tones then lip slurs, in order', () => {
        assert.deepEqual(PP.warmupSequence(list('brass'), ex, kinds), [1, 2, 3, 4]);
    });
    test('random: the same exercises, shuffled', () => {
        const seq = PP.warmupSequence(list('all'), ex, kinds, () => 0);
        assert.deepEqual([...seq].sort(), [1, 2, 3, 4, 5]);
        assert.notDeepEqual(seq, [1, 2, 3, 4, 5]);
    });
    test('your own list: its kinds, in the tool\'s kind order', () => {
        assert.deepEqual(PP.warmupSequence({ kinds: ['flexibility', 'long-tones'], random: false }, ex, kinds), [1, 2, 5]);
    });
});

describe('your own templates and the skills list (ML-320 follow-up, ML-321)', () => {
    test('a template of your own sets the opening blocks', () => {
        const mine = { lead: ['warmup', 'skills', 'scales'] };
        assert.deepEqual(PP.blockKinds(30, mine, 'rehearsal'), ['warmup', 'skills', 'scales', 'rehearsal', 'rehearsal', 'rehearsal']);
        assert.deepEqual(PP.blockKinds(20, { lead: [] }, 'both'), ['skills', 'skills', 'rehearsal', 'rehearsal']);
    });
    test('Skills blocks go to the skill practised longest ago, never-practised first, finished ones skipped', () => {
        const skills = [
            { key: 'tapTempo', lastPractised: '2026-09-26T10:00:00Z' },
            { key: 'gapTrainer', lastPractised: null },
            { key: 'scales:major', lastPractised: '2026-09-20T10:00:00Z' },
            { key: 'ear:playback', lastPractised: null, done: true },
        ];
        const keys = PP.plan(30, 'standard', 'skills', [], skills).filter(b => b.kind === 'skills').map(b => b.skill.key);
        assert.deepEqual(keys, ['gapTrainer', 'scales:major', 'tapTempo', 'gapTrainer']);
    });
    test('an empty skills list falls back to the playing tools', () => {
        assert.equal(PP.plan(15, 'concert', 'skills', [], []).filter(b => b.kind === 'skills')[0].tool, 'tapTempo');
    });

});
