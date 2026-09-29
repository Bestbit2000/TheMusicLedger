// ML-320 (epic ML-314): the practice session builder's rules - which 5-minute blocks a session gets,
// and which chunk each Rehearsal block practises. Pure logic, no DOM: loaded in the browser
// (window.PracticePlan, before app.js) and in Node by server/test/practicePlan.test.js.
//
//   - A session is minutes / 5 blocks (5-120 minutes).
//   - 5 and 10 minutes: you choose every block (they start as "choose").
//   - 15 minutes and up: a template fills them. Standard = Warm-up, Scales, then the focus.
//     Concert = Warm-up, then the focus (Scales dropped when time is short before a concert).
//   - Focus: skills (every other block Skills), rehearsal (all Rehearsal), or both (half each; an odd
//     block goes to Rehearsal).
//   - Rehearsal blocks take chunks weakest first (lowest Level, then practised longest ago); with more
//     blocks than chunks they come round again. Skills blocks rotate through the playing tools.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.PracticePlan = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const BLOCK_MINUTES = 5;
    const MIN_MINUTES = 5;
    const MAX_MINUTES = 120;
    const NUDGE_SECONDS = 270;     // the 4:30 nudge
    const KEEP_GOING_SECONDS = 300; // "Keep going" nudges again 5 minutes later
    // ML-342: a template holds its focus too (the planner no longer asks) - Standard is half Skills,
    // half Rehearsal; Concert is all Rehearsal. Your own templates carry their own focus.
    const TEMPLATES = {
        standard: { label: 'Standard', lead: ['warmup', 'scales'], focus: 'both' },
        concert: { label: 'Concert', lead: ['warmup'], focus: 'rehearsal' }
    };
    const FOCUS_LABELS = { skills: 'Skills', both: 'Skills and Rehearsal', rehearsal: 'Rehearsal' };
    const templateFocus = (template) => (template && template.focus) || (TEMPLATES[template] && TEMPLATES[template].focus) || 'both';
    const KINDS = {
        warmup: 'Warm-up', scales: 'Scales', skills: 'Skills', rehearsal: 'Rehearsal', choose: 'Choose a block'
    };
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

    // The block kinds for a session, in order.
    function blockKinds(minutes, template, focus) {
        const n = clampMinutes(minutes) / BLOCK_MINUTES;
        if (n < 3) return new Array(n).fill('choose');
        const lead = templateLead(template).slice(0, n);
        const rest = n - lead.length;
        let skills = 0;
        if (focus === 'skills') skills = rest;
        else if (focus === 'both') skills = Math.floor(rest / 2);
        return [...lead, ...new Array(skills).fill('skills'), ...new Array(rest - skills).fill('rehearsal')];
    }

    // What each block does. chunks: FlowJourney-style chunks with { id, scoreId, title, level,
    // lastPractised } (the server's /api/practice/chunks, already weakest first). Rehearsal blocks go
    // round the chunks; a Rehearsal block with none to give says so (chunk: null).
    // skills (ML-321): your skills list [{ key, stepIndex, lastPractised, done? }] - Skills blocks go to
    // the one practised longest ago (never practised first), skipping finished ones; with an empty list
    // they rotate through the playing tools instead.
    const whenMs = (x) => (x ? Date.parse(x) : 0);
    function fillBlocks(kinds, chunks, skills) {
        const pool = (chunks || []).slice().sort((a, b) => a.level - b.level || whenMs(a.lastPractised) - whenMs(b.lastPractised));
        const skillPool = (skills || []).filter(x => !x.done).slice().sort((a, b) => whenMs(a.lastPractised) - whenMs(b.lastPractised));
        let r = 0, s = 0;
        return kinds.map((kind) => {
            const block = { kind, minutes: BLOCK_MINUTES };
            if (kind === 'rehearsal') block.chunk = pool.length ? pool[r++ % pool.length] : null;
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

    // Where the runner is: elapsedSeconds into the current block, and the second it should nudge at.
    // 'play' until then, 'nudge' from there (30 s to move on), 'next' once the block's 5 minutes are up
    // (or, after Keep going, 30 s after the later nudge).
    function blockState(elapsedSeconds, nudgeAt) {
        const at = Number.isFinite(nudgeAt) ? nudgeAt : NUDGE_SECONDS;
        if (elapsedSeconds < at) return 'play';
        if (elapsedSeconds < at + (BLOCK_MINUTES * 60 - NUDGE_SECONDS)) return 'nudge';
        return 'next';
    }

    const toolLabel = (tool) => (SKILL_TOOLS.find(t => t.tool === tool) || { label: tool }).label;

    // --- The readiness forecast for a practice list (ML-319) ---
    // A piece's blocks to Level 5, assuming one 5-minute block moves one chunk up one Level. Nothing is
    // guessed: a piece with no chunks, or a chunk with no Level, is left out and named instead.
    // With join-up groups (any 'group' chunk) the chunks only need Level 4, then each group needs one
    // run-through block until it's at Level 5.
    function pieceBlocks(chunks) {
        const base = (chunks || []).filter(c => c.kind !== 'group');
        const groups = (chunks || []).filter(c => c.kind === 'group');
        if (!base.length) return { blocks: null, unset: 0, joinUp: false };
        const set = base.filter(c => c.level != null);
        const joinUp = groups.length > 0;
        const target = joinUp ? 4 : 5;
        const blocks = set.reduce((sum, c) => sum + Math.max(0, target - c.level), 0) + (joinUp ? groups.filter(g => g.level !== 5).length : 0);
        return { blocks, unset: base.length - set.length, joinUp };
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
        BLOCK_MINUTES, MIN_MINUTES, MAX_MINUTES, NUDGE_SECONDS, KEEP_GOING_SECONDS, TEMPLATES, KINDS, SKILL_TOOLS,
        clampMinutes, blockKinds, fillBlocks, plan, blockState, toolLabel, pieceBlocks, forecast, PREP_BLOCKS, templateFocus, FOCUS_LABELS
    };
}));
