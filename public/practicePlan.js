// ML-320 (epic ML-314): the practice session builder's rules - which 5-minute blocks a session gets,
// and which chunk each Pieces block practises. Pure logic, no DOM: loaded in the browser
// (window.PracticePlan, before app.js), in Node by server/test/practicePlan.test.js, and by the server
// (the rest-message deck, ML-390).
//
//   - A session is minutes / 5 blocks (5-120 minutes), or open-ended ("Keep going", ML-390): it starts
//     with 4 blocks and adds one each time you finish one, following the plan's pattern.
//   - A plan (ML-390's word for a template) fills them. Standard = Warm-up, Scales, then the focus.
//     Concert = Warm-up, then the focus. Your own plans are a row of blocks (ML-390) - or, made before
//     ML-390, opening blocks + a focus. Short sessions keep at least one focus block.
//   - Focus: skills (every other block Skills), rehearsal (all Pieces), or both (half each; an odd
//     block goes to Pieces). 'rehearsal' stays the stored id of a Pieces block.
//   - Pieces blocks (ML-390 Auto): a piece not prepared yet gets a Prepare block first; then focus bits
//     (below Level 4) lowest Level first, so every piece moves up a Level together; then, once every bar
//     of a piece is at 4, its play-through parts. Skills blocks rotate through your skills list.
//   - The 30-second rest (ML-390) comes before every playing block except the first, and never before a
//     Prepare or a Play-through.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.PracticePlan = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const BLOCK_MINUTES = 5;
    const MIN_MINUTES = 5;
    const MAX_MINUTES = 120;
    const NUDGE_SECONDS = 270;     // 4:30 - the sound stops, then the 30-second rest
    const REST_SECONDS = 30;       // ML-390: the rest between blocks
    const OPEN_START_BLOCKS = 4;   // ML-390: an open-ended session starts with 4 blocks (20 minutes)
    const TARGET_LEVEL = 4;        // ML-390: focus bits go up to Level 4, then the piece is played through
    const WARMUP_ROUND_STEP = 0.1; // ML-390: each round of a looping warm-up is 10% faster
    // ML-342: a template holds its focus too (the planner no longer asks) - Standard is half Skills,
    // half Pieces; Concert is all Pieces. Your own templates carry their own focus.
    const TEMPLATES = {
        standard: { label: 'Standard', lead: ['warmup', 'scales'], focus: 'both', blurb: 'A bit of everything' },
        concert: { label: 'Concert', lead: ['warmup'], focus: 'rehearsal', blurb: 'Mostly your pieces' }
    };
    const FOCUS_LABELS = { skills: 'Skills', both: 'Skills and Pieces', rehearsal: 'Pieces' };
    const templateFocus = (template) => (template && template.focus) || (TEMPLATES[template] && TEMPLATES[template].focus) || 'both';
    // ML-390: "Rehearsal" blocks are called Pieces on screen (the stored id stays 'rehearsal').
    const KINDS = {
        warmup: 'Warm-up', scales: 'Scales', skills: 'Skills', rehearsal: 'Pieces', choose: 'Choose a block'
    };
    const PLAN_KINDS = ['warmup', 'scales', 'skills', 'rehearsal'];
    // A Pieces block's stage (ML-390): preparing a new piece, practising a focus bit, or a play-through.
    const STAGES = { prepare: 'Prepare', practise: 'Pieces', playthrough: 'Play-through' };
    // The playing tools a Skills block can open, in the order they rotate (ML-321 turns this into your own list).
    const SKILL_TOOLS = [
        { tool: 'tapTempo', label: 'Tempo' },
        { tool: 'gapTrainer', label: 'Pulse' },
        { tool: 'warmups', label: 'Warm-ups' },
        { tool: 'ear', label: 'Pitch - Play it back' }
    ];

    const clampMinutes = (m) => Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Math.round((Number(m) || MIN_MINUTES) / BLOCK_MINUTES) * BLOCK_MINUTES));

    // A template: 'standard' / 'concert', or one of your own - { lead: ['warmup', ...] } (ML-320 follow-up).
    const templateLead = (template) => (template && Array.isArray(template.lead) ? template.lead : (TEMPLATES[template] || TEMPLATES.standard).lead);

    // ML-390: your own plan made in "Build my plan" is its whole row of blocks.
    const ownBlocks = (template) => (template && Array.isArray(template.blocks) && template.blocks.length ? template.blocks.filter(k => PLAN_KINDS.includes(k)) : null);

    // The block kinds for n blocks of a lead + focus plan (the built-in ones, and ones saved before
    // ML-390). The opening blocks never take the whole session: at least one block is left for the focus.
    function leadFocusKinds(n, template, focus) {
        const lead = templateLead(template).slice(0, n > 1 ? n - 1 : 0);
        const rest = n - lead.length;
        let skills = 0;
        if (focus === 'skills') skills = rest;
        else if (focus === 'both') skills = Math.floor(rest / 2);
        return [...lead, ...new Array(skills).fill('skills'), ...new Array(rest - skills).fill('rehearsal')];
    }
    // A row of blocks stretched (or cut) to n: past its end it repeats from its first Skills or Pieces
    // block, so a warm-up isn't repeated. The first n blocks never change as n grows.
    function stretch(pattern, n) {
        const p = (pattern || []).filter(k => PLAN_KINDS.includes(k));
        if (!p.length) return new Array(n).fill('rehearsal');
        if (n <= p.length) return p.slice(0, n);
        let from = p.findIndex(k => k === 'skills' || k === 'rehearsal');
        if (from < 0) from = 0;
        const loop = p.slice(from);
        const out = p.slice();
        for (let i = 0; out.length < n; i++) out.push(loop[i % loop.length]);
        return out;
    }
    // A plan's pattern for an open-ended session (ML-390): your own row, or the lead then the focus
    // (both = Skills, Pieces, Skills, Pieces...).
    function planPattern(template, focus) {
        const own = ownBlocks(template);
        if (own) return own;
        const f = focus || templateFocus(template);
        return [...templateLead(template), ...(f === 'both' ? ['skills', 'rehearsal'] : f === 'skills' ? ['skills'] : ['rehearsal'])];
    }

    // The block kinds for a session, in order. minutes null = open-ended: the first n blocks
    // (OPEN_START_BLOCKS to start), each new one following the plan's pattern.
    function blockKinds(minutes, template, focus, openBlocks) {
        if (minutes === null) return stretch(planPattern(template, focus), openBlocks || OPEN_START_BLOCKS);
        const n = clampMinutes(minutes) / BLOCK_MINUTES;
        const own = ownBlocks(template);
        return own ? stretch(own, n) : leadFocusKinds(n, template, focus);
    }
    // The kind of block number i (0-based) in an open-ended session.
    const openKindAt = (template, focus, i) => stretch(planPattern(template, focus), i + 1)[i];

    // --- What fills the Pieces blocks (ML-390 Auto) ---
    const whenMs = (x) => (x ? Date.parse(x) : 0);
    const isGroup = (c) => c.kind === 'group';
    // The pieces a session can use: [{ scoreId, title, chunks: [{ id, kind, startBar, endBar, level,
    // label, lastPractised, minutes? }] }] (/api/practice/pieces). Returns what the Pieces blocks take,
    // in order: a Prepare for every piece with no Levels yet (each once), then every focus bit below
    // Level 4 and every play-through part that's ready, lowest Level first, then practised longest ago -
    // so all the 1s go up to 2 before any 2 goes to 3, and play-throughs (at 4) come after the focus bits.
    // A play-through part is ready once every bar inside it is at Level 4 or more; a piece whose bars are
    // all there but has no parts yet gets one "play-through" item (the server makes the parts).
    function piecePool(pieces) {
        const prepare = [];
        const rest = [];
        (pieces || []).forEach(p => {
            const base = (p.chunks || []).filter(c => !isGroup(c));
            const groups = (p.chunks || []).filter(isGroup);
            const set = base.filter(c => c.level != null);
            const item = (stage, chunk, extra) => ({ stage, scoreId: p.scoreId, title: p.title, chunk: chunk ? { ...chunk, scoreId: p.scoreId, title: p.title } : null, ...extra });
            if (!set.length) { prepare.push(item('prepare', null)); return; }
            set.filter(c => c.level < TARGET_LEVEL).forEach(c => rest.push(item('practise', c, { level: c.level, lastPractised: c.lastPractised })));
            const inside = (g) => base.filter(c => c.startBar >= g.startBar && c.endBar <= g.endBar);
            const ready = (g) => { const xs = inside(g); return xs.length > 0 && xs.every(c => c.level != null && c.level >= TARGET_LEVEL); };
            groups.filter(g => ready(g) && (g.level == null || g.level < 5)).forEach(g => rest.push(item('playthrough', { ...g, level: g.level || TARGET_LEVEL }, { level: g.level || TARGET_LEVEL, lastPractised: g.lastPractised, minutes: g.minutes || BLOCK_MINUTES })));
            if (!groups.length && set.length === base.length && set.every(c => c.level >= TARGET_LEVEL) && set.some(c => c.level < 5)) {
                rest.push(item('playthrough', null, { level: TARGET_LEVEL, lastPractised: null }));
            }
        });
        rest.sort((a, b) => a.level - b.level || whenMs(a.lastPractised) - whenMs(b.lastPractised));
        return [...prepare, ...rest];
    }

    // What each block does. pool: piecePool's items - or, as before ML-390, plain chunks (each one a
    // focus bit). Pieces blocks take the Prepares once each, then go round the rest; a Pieces block with
    // nothing to give says so (chunk: null, stage 'practise').
    // skills (ML-321): your skills list [{ key, stepIndex, lastPractised, done? }] - Skills blocks go to
    // the one practised longest ago (never practised first), skipping finished ones; with an empty list
    // they rotate through the playing tools instead.
    function fillBlocks(kinds, pool, skills) {
        const items = (pool || []).map(x => (x && x.stage ? x : { stage: 'practise', chunk: x, level: x.level, lastPractised: x.lastPractised }));
        const prepare = items.filter(x => x.stage === 'prepare');
        const rest = items.filter(x => x.stage !== 'prepare');
        if (!items.some(x => x.stage && x.stage !== 'practise')) rest.sort((a, b) => a.level - b.level || whenMs(a.lastPractised) - whenMs(b.lastPractised));
        const skillPool = (skills || []).filter(x => !x.done).slice().sort((a, b) => whenMs(a.lastPractised) - whenMs(b.lastPractised));
        let p = 0, r = 0, s = 0;
        return kinds.map((kind) => {
            const block = { kind, minutes: BLOCK_MINUTES };
            if (kind === 'rehearsal') {
                const it = p < prepare.length ? prepare[p++] : rest.length ? rest[r++ % rest.length] : null;
                block.stage = it ? it.stage : 'practise';
                block.chunk = it ? it.chunk : null;
                if (it && it.stage !== 'practise') { block.scoreId = it.scoreId; block.title = it.title; }
                if (it && it.minutes) block.minutes = it.minutes;
            }
            if (kind === 'skills') {
                if (skillPool.length) block.skill = skillPool[s++ % skillPool.length];
                else block.tool = SKILL_TOOLS[s++ % SKILL_TOOLS.length].tool;
            }
            return block;
        });
    }

    function plan(minutes, template, focus, chunks, skills) {
        return fillBlocks(blockKinds(minutes, template, focus), chunks, skills);
    }

    // --- The rest and the block clock (ML-390) ---
    // A block you play: Warm-up, Scales, Skills, or Pieces practice (not Prepare / Play-through).
    const isPlayingBlock = (b) => !!b && PLAN_KINDS.includes(b.kind) && !(b.kind === 'rehearsal' && (b.stage === 'prepare' || b.stage === 'playthrough'));
    // The 30-second rest comes before every playing block except the first one.
    const restBefore = (blocks, i) => i > 0 && isPlayingBlock(blocks[i]);
    // Seconds of playing in block i before the sound stops: its minutes, less the rest if one follows.
    // A Prepare runs as long as it needs (Infinity) - you move on when it's done.
    function playSeconds(blocks, i) {
        const b = blocks[i];
        if (!b) return 0;
        if (b.kind === 'rehearsal' && b.stage === 'prepare') return Infinity;
        return (Number(b.minutes) || BLOCK_MINUTES) * 60 - (restBefore(blocks, i + 1) ? REST_SECONDS : 0);
    }

    // Where the runner is: elapsedSeconds into the current block, and the second the sound stops at.
    // 'play' until then, 'nudge' from there (30 s to move on), 'next' once the block's 5 minutes are up.
    function blockState(elapsedSeconds, nudgeAt) {
        const at = Number.isFinite(nudgeAt) || nudgeAt === Infinity ? nudgeAt : NUDGE_SECONDS;
        if (elapsedSeconds < at) return 'play';
        if (elapsedSeconds < at + (BLOCK_MINUTES * 60 - NUDGE_SECONDS)) return 'nudge';
        return 'next';
    }

    // --- The rest's messages (ML-390) ---
    // A player's deck: every message they can get, shuffled, each shown once before any comes round
    // again. Never the same kind twice running, and a breathing one at least every third rest.
    // messages: [{ id, kind }] (the ones for this player); deck: { remaining: [id], lastKind,
    // sinceBreath } (or null to start); rand: () => [0, 1). Returns { id, deck } - id null when there are
    // no messages at all.
    function drawRest(messages, deck, rand) {
        const r = rand || Math.random;
        const all = (messages || []).filter(m => m && m.id != null);
        if (!all.length) return { id: null, deck: { remaining: [], lastKind: null, sinceBreath: 0 } };
        const kindOf = new Map(all.map(m => [m.id, m.kind]));
        const d = deck || {};
        let remaining = (d.remaining || []).filter(id => kindOf.has(id));
        if (!remaining.length) {
            remaining = all.map(m => m.id);
            for (let i = remaining.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [remaining[i], remaining[j]] = [remaining[j], remaining[i]]; }
        }
        const breathDue = (d.sinceBreath || 0) >= 2;
        let k = breathDue ? remaining.findIndex(id => kindOf.get(id) === 'breathe') : -1;
        // A breath is due but the deck has none left: any breathing exercise again (they come round
        // more often than the rest - exercises you get better at), and the deck keeps its place.
        if (breathDue && k < 0) {
            const breaths = all.filter(m => m.kind === 'breathe');
            if (breaths.length) {
                const pick = breaths[Math.floor(r() * breaths.length)];
                return { id: pick.id, deck: { remaining, lastKind: 'breathe', sinceBreath: 0 } };
            }
        }
        if (k < 0) k = remaining.findIndex(id => kindOf.get(id) !== d.lastKind);
        if (k < 0) k = 0;
        const id = remaining[k];
        const kind = kindOf.get(id);
        return { id, deck: { remaining: remaining.filter((x, i) => i !== k), lastKind: kind, sinceBreath: kind === 'breathe' ? 0 : (d.sinceBreath || 0) + 1 } };
    }

    // A looping warm-up block (ML-390): round 1 at the exercise's own speed, each round after it 10% faster.
    const warmupRoundBpm = (bpm, round) => Math.round(Number(bpm) * (1 + WARMUP_ROUND_STEP * Math.max(0, (Number(round) || 1) - 1)));

    const toolLabel = (tool) => (SKILL_TOOLS.find(t => t.tool === tool) || { label: tool }).label;

    // --- The readiness forecast for a practice list (ML-319) ---
    // A piece's blocks to Level 5, assuming one 5-minute block moves one chunk up one Level. Nothing is
    // guessed: a piece with no chunks, or a chunk with no Level, is left out and named instead.
    // ML-390: focus bits go up to Level 4, then the piece is played through - one block for each
    // play-through part (join-up group) still below 5, or one play-through block while it has no parts
    // yet (they're made once every bar is at 4). A piece already all at 5 needs nothing.
    function pieceBlocks(chunks) {
        const base = (chunks || []).filter(c => c.kind !== 'group');
        const groups = (chunks || []).filter(c => c.kind === 'group');
        if (!base.length) return { blocks: null, unset: 0, joinUp: false };
        const set = base.filter(c => c.level != null);
        const joinUp = groups.length > 0;
        const focus = set.reduce((sum, c) => sum + Math.max(0, TARGET_LEVEL - c.level), 0);
        const allFive = set.length > 0 && set.every(c => c.level >= 5);
        const through = joinUp ? groups.filter(g => g.level !== 5).length : (allFive || !set.length ? 0 : 1);
        return { blocks: focus + through, unset: base.length - set.length, joinUp };
    }
    const DAY_MS = 86400000;
    const dayNumber = (iso) => Math.floor(Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`) / DAY_MS);
    // ML-334: a piece that isn't set up yet takes one block first - preparation for practice (say how
    // well you can play it, or play it through, so it gets its Levels). After that its Levels decide.
    const PREP_BLOCKS = 1;

    // input: { pieces: [{ title, chunks }], eventDate (the target date, or null), today (YYYY-MM-DD) }.
    // ML-333: nothing to type in - the list works out how many five-minute blocks it takes and, with a
    // target date, the pace that gets there: blocks a day (rounded up) and the minutes that is.
    // Returns the per-piece blocks (prep: true for a piece still to prepare), the total, what isn't
    // counted, the days to go and the daily pace.
    function forecast(input) {
        const pieces = (input.pieces || []).map(p => {
            const b = pieceBlocks(p.chunks);
            return b.blocks === null ? { title: p.title, ...b, prep: true, blocks: PREP_BLOCKS } : { title: p.title, ...b, prep: false };
        });
        const total = pieces.reduce((s, p) => s + p.blocks, 0);
        const notCounted = [];
        pieces.forEach(p => {
            if (p.prep) notCounted.push(`${p.title}: after preparing it, its Levels decide the rest`);
            else if (p.unset) notCounted.push(`${p.title}: ${p.unset} chunk${p.unset === 1 ? '' : 's'} with no Level yet`);
        });
        const days = input.eventDate ? Math.max(0, dayNumber(input.eventDate) - dayNumber(input.today)) : null;
        const perDay = days && total ? Math.ceil(total / days) : null;
        return { pieces, total, minutes: total * BLOCK_MINUTES, days, perDay, perDayMinutes: perDay === null ? null : perDay * BLOCK_MINUTES, notCounted };
    }

    // ML-343: warm-up lists - what a session's Warm-up blocks play. Everyone has these four; your own
    // (kinds + in order or random) are stored on the server (warmup_lists). External = your own warm-up
    // away from the app: nothing on screen, just the block's timer.
    const WARMUP_LISTS = [
        { id: 'external', name: 'External warm-up', external: true, desc: 'Your own warm-up - just the timer' },
        { id: 'each', name: 'One of each kind', each: true, desc: 'One warm-up of every kind, in order' },
        { id: 'brass', name: 'Brass basics', kinds: ['long-tones', 'lip-slurs'], random: false, desc: 'Long tones, then lip slurs' },
        { id: 'all', name: 'Everything, random', kinds: null, random: true, desc: 'All the warm-ups, in random order' }
    ];
    // The exercises a list plays, as ids in order. exercises: [{ id, kind }] in the tool's own order;
    // kindOrder: every kind id, in the tool's order; rand: () => [0, 1) (tests pass a fixed one).
    function warmupSequence(list, exercises, kindOrder, rand) {
        const r = rand || Math.random;
        const all = exercises || [];
        if (!list || list.external) return [];
        if (list.each) {
            return kindOrder.map(k => all.filter(ex => ex.kind === k)).filter(xs => xs.length).map(xs => xs[Math.floor(r() * xs.length)].id);
        }
        const kinds = list.kinds && list.kinds.length ? list.kinds : kindOrder;
        const ids = kindOrder.filter(k => kinds.includes(k)).flatMap(k => all.filter(ex => ex.kind === k)).map(ex => ex.id);
        if (list.random) {
            for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
        }
        return ids;
    }

    return {
        WARMUP_LISTS, warmupSequence,
        BLOCK_MINUTES, MIN_MINUTES, MAX_MINUTES, NUDGE_SECONDS, REST_SECONDS, OPEN_START_BLOCKS, TARGET_LEVEL, TEMPLATES, KINDS, STAGES, PLAN_KINDS, SKILL_TOOLS,
        clampMinutes, blockKinds, stretch, planPattern, openKindAt, piecePool, fillBlocks, plan, blockState, toolLabel, pieceBlocks, forecast, PREP_BLOCKS, templateFocus, FOCUS_LABELS,
        isPlayingBlock, restBefore, playSeconds, drawRest, warmupRoundBpm, WARMUP_ROUND_STEP
    };
}));
