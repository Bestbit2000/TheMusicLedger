// ML-320 (epic ML-314): unit tests for the practice session builder's rules (public/practicePlan.js) -
// the blocks a session gets, who fills them and the 4:30 nudge. Loaded with vm, like flowJourney.test.js.
// ML-390: plans at any length, open-ended sessions, the Pieces pool (Prepare, focus bits, play-through),
// the 30-second rest and its message deck.
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
    test('5 and 10 minutes: the plan still fills them, keeping a focus block (ML-390)', () => {
        assert.deepEqual(PP.blockKinds(5, 'standard', 'both'), ['rehearsal']);
        assert.deepEqual(PP.blockKinds(10, 'standard', 'both'), ['warmup', 'rehearsal']);
        assert.deepEqual(PP.blockKinds(10, 'concert', 'rehearsal'), ['warmup', 'rehearsal']);
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
    test('a Prepare block runs as long as it needs (ML-390)', () => {
        assert.equal(PP.blockState(10000, Infinity), 'play');
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
    test('one block per chunk per Level up to 4, then a play-through (ML-390); a piece not set up takes one preparation block (ML-334)', () => {
        const f = PP.forecast(base);
        // Slaidburn 0 + 2 + 1, then its play-through; Floral Dance 3 + 2 + 1 + 3 + play-through; Deep Harmony
        // just its play-through; Nimrod is all at 5; Mack and Mabel is still to prepare.
        assert.deepEqual(f.pieces.map(p => p.blocks), [4, 10, 1, 0, 1]);
        assert.deepEqual(f.pieces.map(p => p.prep), [false, false, false, false, true]);
        assert.equal(f.total, 16);
        assert.equal(f.minutes, 80);
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

describe('plans (ML-390)', () => {
    test('your own plan is its row of blocks, repeating from its first Skills or Pieces block', () => {
        const mine = { blocks: ['warmup', 'scales', 'skills', 'rehearsal', 'rehearsal'] };
        assert.deepEqual(PP.blockKinds(15, mine), ['warmup', 'scales', 'skills']);
        assert.deepEqual(PP.blockKinds(40, mine), ['warmup', 'scales', 'skills', 'rehearsal', 'rehearsal', 'skills', 'rehearsal', 'rehearsal']);
        assert.deepEqual(PP.stretch(['warmup', 'scales'], 4), ['warmup', 'scales', 'warmup', 'scales']);
    });
    test('an open-ended session starts with 4 blocks and follows the pattern', () => {
        assert.deepEqual(PP.blockKinds(null, 'standard', 'both'), ['warmup', 'scales', 'skills', 'rehearsal']);
        assert.deepEqual(PP.blockKinds(null, 'concert', 'rehearsal'), ['warmup', 'rehearsal', 'rehearsal', 'rehearsal']);
        assert.deepEqual([4, 5, 6, 7].map(i => PP.openKindAt('standard', 'both', i)), ['skills', 'rehearsal', 'skills', 'rehearsal']);
        assert.equal(PP.openKindAt({ blocks: ['warmup', 'rehearsal', 'skills'] }, null, 5), 'rehearsal'); // w r s | r s r
    });
    test('the first blocks never change as an open-ended session grows', () => {
        const pat = PP.planPattern('standard', 'both');
        assert.deepEqual(PP.stretch(pat, 6).slice(0, 4), PP.stretch(pat, 4));
    });
});

describe('the Pieces pool (ML-390 Auto)', () => {
    const bit = (id, level, a, z, lastPractised = null) => ({ id, kind: 'chunk', level, startBar: a, endBar: z, lastPractised });
    const pieces = [
        { scoreId: 1, title: 'Floral Dance', chunks: [bit(1, 2, 1, 8), bit(2, 1, 9, 16, '2026-09-29T10:00:00Z'), bit(3, 4, 17, 24), bit(4, 1, 25, 32)] },
        { scoreId: 2, title: 'Deep Harmony', chunks: [] },
        { scoreId: 3, title: 'Slaidburn', chunks: [bit(5, 4, 1, 16), bit(6, 4, 17, 32), { id: 7, kind: 'group', level: null, startBar: 1, endBar: 16 }, { id: 8, kind: 'group', level: 5, startBar: 17, endBar: 32 }] },
        { scoreId: 4, title: 'Nimrod', chunks: [bit(9, 4, 1, 20)] },
    ];
    const pool = PP.piecePool(pieces);
    test('a piece with no Levels is prepared first; then everyone up to the next Level', () => {
        assert.deepEqual(pool.map(p => [p.stage, p.chunk ? p.chunk.id : p.scoreId]), [
            ['prepare', 2],
            ['practise', 4], ['practise', 2], // the 1s, never-practised first
            ['practise', 1],                  // then the 2
            ['playthrough', 7],               // Slaidburn's first half is ready; its second is done
            ['playthrough', 4],               // Nimrod is all at 4 with no parts yet
        ]);
    });
    test('focus bits at 4 or more wait for the play-through', () => {
        assert.ok(!pool.some(p => p.chunk && p.chunk.id === 3));
    });
    test('blocks take the Prepare once, then go round', () => {
        const blocks = PP.fillBlocks(['rehearsal', 'rehearsal', 'rehearsal', 'rehearsal', 'rehearsal', 'rehearsal', 'rehearsal'], pool);
        assert.deepEqual(blocks.map(b => b.stage), ['prepare', 'practise', 'practise', 'practise', 'playthrough', 'playthrough', 'practise']);
        assert.equal(blocks[0].scoreId, 2);
        assert.equal(blocks[0].chunk, null);
    });
    test('a long play-through part takes a 10-minute block', () => {
        const p = PP.piecePool([{ scoreId: 5, title: 'Snowman', chunks: [bit(1, 4, 1, 90), { id: 2, kind: 'group', level: 4, startBar: 1, endBar: 90, minutes: 10 }] }]);
        assert.equal(PP.fillBlocks(['rehearsal'], p)[0].minutes, 10);
    });
});

describe('the 30-second rest (ML-390)', () => {
    const b = (kind, stage) => ({ kind, stage, minutes: 5 });
    const blocks = [b('warmup'), b('scales'), b('rehearsal', 'prepare'), b('rehearsal', 'practise'), b('rehearsal', 'playthrough'), b('skills')];
    test('before every playing block but the first, never before a Prepare or Play-through', () => {
        assert.deepEqual(blocks.map((x, i) => PP.restBefore(blocks, i)), [false, true, false, true, false, true]);
    });
    test('the sound stops 30 seconds early when a rest follows; a Prepare has no end', () => {
        const raw = sandbox.self.PracticePlan; // not through PP: JSON would turn Infinity into null
        assert.deepEqual(blocks.map((x, i) => raw.playSeconds(blocks, i)), [270, 300, Infinity, 300, 270, 300]);
    });
    test('the message deck: once each, never the same kind twice running, a breath at least every third rest', () => {
        const msgs = [];
        ['why', 'breathe', 'body', 'think', 'fact', 'care', 'kind'].forEach((kind, k) => { for (let i = 0; i < 4; i++) msgs.push({ id: k * 10 + i, kind }); });
        let deck = null, seed = 1;
        const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
        const drawn = [];
        for (let i = 0; i < 60; i++) { const r = PP.drawRest(msgs, deck, rand); drawn.push(r.id); deck = r.deck; }
        const kinds = drawn.map(id => msgs.find(m => m.id === id).kind);
        // every other message once before any comes round again (breathing ones can come back sooner)
        const others = drawn.filter(id => msgs.find(m => m.id === id).kind !== 'breathe');
        assert.equal(new Set(others.slice(0, 24)).size, 24);
        for (let i = 1; i < kinds.length; i++) assert.ok(kinds[i] !== kinds[i - 1] || kinds[i] === 'breathe', `same kind twice at ${i}`);
        let since = 0;
        for (const k of kinds) { since = k === 'breathe' ? 0 : since + 1; assert.ok(since <= 2, 'a breath at least every third rest'); }
    });
    test('no messages: nothing to draw', () => {
        assert.equal(PP.drawRest([], null).id, null);
    });
    test('a looping warm-up gets 10% faster each round', () => {
        assert.deepEqual([1, 2, 3].map(r => PP.warmupRoundBpm(60, r)), [60, 66, 72]);
    });
});
