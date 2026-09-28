// ML-306: the engine behind the Rhythm tool - the rhythms (word rhythms and the Takadimi crib sheet),
// how they're written, when each note falls in a round, the speed Levels, and scoring a round from
// your taps (strict) or from what the microphone heard (lenient). Pure logic with no DOM, audio or
// storage: loaded in the browser (window.Rhythm, after theoryEngine.js), by the server to re-score a
// saved round (server/services/drills.js) and by server/test/rhythm.test.js. Read docs/rhythm.md
// before changing a rhythm, a Level or the scoring.
//
// Time is counted in crotchets (a quaver is 0.5); a "beat" is what the click counts - a crotchet in
// 4/4, a dotted crotchet (1.5 crotchets) in 6/8.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./theoryEngine.js'));
    else root.Rhythm = factory(root.TheoryEngine);
}(typeof self !== 'undefined' ? self : this, function (TheoryEngine) {
    'use strict';

    const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
    function fail(msg) { const e = new Error(msg); e.status = 400; throw e; }

    // ---------------------------------------------------------------- the rhythms

    const SIMPLE = { top: 4, bottom: 4, beatLen: 1, beats: 4 };   // 4/4: 4 crotchet beats
    const COMPOUND = { top: 6, bottom: 8, beatLen: 1.5, beats: 2 }; // 6/8: 2 dotted-crotchet beats
    // A note: v = written value (1 crotchet, 0.5 quaver, 0.25 semiquaver, 2 minim), len = time in
    // crotchets, dots, rest, syl = the syllable under it.
    const N = (v, len, syl, more) => ({ v, len, syl, ...(more || {}) });
    const R = (v, len) => ({ v, len, rest: true });

    // One beat of semiquaver slots (Takadimi: ta ka di mi). The 15 patterns: 8 start on the beat, 7 with
    // a rest - every onset set of the four slots, in teaching order.
    const SLOT = ['ta', 'ka', 'di', 'mi'];
    const ONE_BEAT = [[0], [0, 2], [0, 1, 2, 3], [0, 1, 2], [0, 2, 3], [0, 3], [0, 1], [0, 1, 3], [2], [2, 3], [1, 2, 3], [1, 3], [1, 2], [1], [3]];
    const VALUE_OF = { 1: [0.25, 0], 2: [0.5, 0], 3: [0.5, 1], 4: [1, 0] }; // slots -> [written value, dots]
    function beatPattern(onsets) {
        const notes = [];
        const first = onsets[0];
        if (first === 1) notes.push(R(0.25, 0.25));
        if (first === 2) notes.push(R(0.5, 0.5));
        if (first === 3) notes.push(R(0.5, 0.5), R(0.25, 0.25));
        onsets.forEach((o, i) => {
            const slots = (onsets[i + 1] ?? 4) - o;
            const [v, dots] = VALUE_OF[slots];
            notes.push(N(v, slots / 4, SLOT[o], dots ? { dots } : null));
        });
        return { id: 'b-' + onsets.map(o => SLOT[o]).join(''), set: 'beat', name: onsets.map(o => SLOT[o]).join(' '), beats: 1, meter: SIMPLE, notes };
    }
    const PATTERNS = [
        // Word rhythms (the owner's agreed words, 2026-09-27).
        { id: 'w-plum', set: 'words', name: 'Plum', beats: 1, meter: SIMPLE, notes: [N(1, 1, 'Plum')] },
        { id: 'w-apple', set: 'words', name: 'Ap-ple', beats: 1, meter: SIMPLE, notes: [N(0.5, 0.5, 'Ap'), N(0.5, 0.5, 'ple')] },
        { id: 'w-pomegranate', set: 'words', name: 'Pom-e-gran-ate', beats: 1, meter: SIMPLE, notes: [N(0.25, 0.25, 'Pom'), N(0.25, 0.25, 'e'), N(0.25, 0.25, 'gran'), N(0.25, 0.25, 'ate')] },
        { id: 'w-amsterdam', set: 'words', name: 'Am-ster-dam', beats: 2, meter: SIMPLE, notes: [N(0.5, 0.5, 'Am'), N(0.5, 0.5, 'ster'), N(1, 1, 'dam')] },
        // The one-beat crib sheet.
        ...ONE_BEAT.map(beatPattern),
        // Two beats.
        { id: 't-minim', set: 'two', name: 'ta - a', beats: 2, meter: SIMPLE, notes: [N(2, 2, 'ta')] },
        { id: 't-dotted', set: 'two', name: 'ta - - di', beats: 2, meter: SIMPLE, notes: [N(1, 1.5, 'ta', { dots: 1 }), N(0.5, 0.5, 'di')] },
        { id: 't-syncopa', set: 'two', name: 'ta di - di', beats: 2, meter: SIMPLE, notes: [N(0.5, 0.5, 'ta'), N(1, 1, 'di'), N(0.5, 0.5, 'di')] },
        // Triplets (a beat in three: ta ki da).
        { id: 'tr-takida', set: 'triplets', name: 'ta ki da', beats: 1, tuplet: 3, meter: SIMPLE, notes: [N(0.5, 1 / 3, 'ta'), N(0.5, 1 / 3, 'ki'), N(0.5, 1 / 3, 'da')] },
        { id: 'tr-tada', set: 'triplets', name: 'ta - da', beats: 1, tuplet: 3, meter: SIMPLE, notes: [N(1, 2 / 3, 'ta'), N(0.5, 1 / 3, 'da')] },
        { id: 'tr-taki', set: 'triplets', name: 'ta ki -', beats: 1, tuplet: 3, meter: SIMPLE, notes: [N(0.5, 1 / 3, 'ta'), N(1, 2 / 3, 'ki')] },
        { id: 'tr-kida', set: 'triplets', name: '- ki da', beats: 1, tuplet: 3, meter: SIMPLE, notes: [R(0.5, 1 / 3), N(0.5, 1 / 3, 'ki'), N(0.5, 1 / 3, 'da')] },
        // 6/8 (a dotted-crotchet beat: ta ki da; in semiquavers ta va ki di da ma).
        { id: 'c-ta', set: 'six8', name: 'ta', beats: 1, meter: COMPOUND, notes: [N(1, 1.5, 'ta', { dots: 1 })] },
        { id: 'c-takida', set: 'six8', name: 'ta ki da', beats: 1, meter: COMPOUND, notes: [N(0.5, 0.5, 'ta'), N(0.5, 0.5, 'ki'), N(0.5, 0.5, 'da')] },
        { id: 'c-tada', set: 'six8', name: 'ta - da', beats: 1, meter: COMPOUND, notes: [N(1, 1, 'ta'), N(0.5, 0.5, 'da')] },
        { id: 'c-taki', set: 'six8', name: 'ta ki -', beats: 1, meter: COMPOUND, notes: [N(0.5, 0.5, 'ta'), N(1, 1, 'ki')] },
        { id: 'c-tadida', set: 'six8', name: 'ta - di da', beats: 1, meter: COMPOUND, notes: [N(0.5, 0.75, 'ta', { dots: 1 }), N(0.25, 0.25, 'di'), N(0.5, 0.5, 'da')] },
        { id: 'c-semis', set: 'six8', name: 'ta va ki di da ma', beats: 1, meter: COMPOUND, notes: ['ta', 'va', 'ki', 'di', 'da', 'ma'].map(s => N(0.25, 0.25, s)) },
    ];
    const SETS = [
        { id: 'words', label: 'Words', desc: 'Plum, Ap-ple, Pom-e-gran-ate, Am-ster-dam' },
        { id: 'beat', label: 'One beat', desc: 'All 15 one-beat semiquaver rhythms: 8 start on the beat, 7 with a rest (ta ka di mi)' },
        { id: 'two', label: 'Two beats', desc: 'A minim, a dotted crotchet and quaver, and the syncopation quaver-crotchet-quaver' },
        { id: 'triplets', label: 'Triplets', desc: 'A beat in three: ta ki da' },
        { id: 'six8', label: '6/8', desc: 'Two dotted-crotchet beats a bar: ta ki da' },
    ];
    const pattern = (id) => PATTERNS.find(p => p.id === id) || fail('Unknown rhythm.');
    const patternsIn = (setId) => PATTERNS.filter(p => p.set === setId);
    const setOf = (id) => SETS.find(s => s.id === id) || fail('Unknown rhythm set.');

    // ---------------------------------------------------------------- speed Levels

    // Level N = you've played the rhythm at that speed and scored grade 4 or 5. The click counts beats:
    // crotchets in 4/4, dotted crotchets in 6/8 (slower numbers, the same feel).
    const LEVEL_BPM = { simple: [60, 72, 84, 96, 108], compound: [40, 48, 56, 64, 72] };
    const PASS_GRADE = 4;
    const kindOf = (p) => (p.meter === COMPOUND ? 'compound' : 'simple');
    const levelBpms = (p) => LEVEL_BPM[kindOf(p)];
    // The speed to practise next: the next Level's, or Level 5's once you're there.
    const nextBpm = (p, level) => levelBpms(p)[Math.min(4, Math.max(0, level || 0))];
    // The Level a round earns: the highest Level whose speed you played at or above, if you passed.
    function levelEarned(p, bpm, grade) {
        if (grade < PASS_GRADE) return 0;
        const bpms = levelBpms(p);
        let l = 0;
        bpms.forEach((b, i) => { if (bpm >= b) l = i + 1; });
        return l;
    }

    // ---------------------------------------------------------------- a round

    // A round is a bar to count you in, then BARS bars of the rhythm - repeated to fill each bar - or, for
    // "play through the sheet", one bar of each rhythm in a set. Onsets are in beats from bar 1, beat 1.
    const ROUND = { BARS: 2, COUNT_IN_BARS: 1, MIN_BPM: 30, MAX_BPM: 160 };
    function barOf(p) {
        const reps = p.meter.beats / p.beats;
        const notes = [];
        for (let k = 0; k < reps; k++) for (const nt of p.notes) notes.push(nt);
        return notes;
    }
    // level: a rhythm id, or 'sheet:<set>'. Returns the bars (their rhythms) and every note's onset.
    function schedule(level) {
        let bars;
        if (String(level).startsWith('sheet:')) bars = patternsIn(setOf(level.slice(6)).id);
        else { const p = pattern(level); bars = Array.from({ length: ROUND.BARS }, () => p); }
        const meter = bars[0].meter;
        const onsets = [];
        bars.forEach((p, bar) => {
            let t = 0;
            barOf(p).forEach((nt, i) => {
                if (!nt.rest) onsets.push({ bar, index: i, beat: bar * meter.beats + t / meter.beatLen, pattern: p.id });
                t += nt.len;
            });
        });
        return { bars, meter, onsets, totalBeats: bars.length * meter.beats };
    }
    // How a bar is written: Notation.staff items (the time signature, one group per beat - or per rhythm
    // when it spans beats - a barline). cls marks each note so the screen can light the one playing.
    // words: false leaves the syllables off (a small picture of the rhythm, with its name beside it).
    function barItems(p, { withTimeSig = true, barline = 'barlineSingle', clsPrefix = null, words = true } = {}) {
        const items = withTimeSig ? [{ type: 'timeSig', top: p.meter.top, bottom: p.meter.bottom }] : [];
        const reps = p.meter.beats / p.beats;
        let k = 0;
        for (let r = 0; r < reps; r++) {
            items.push({
                type: 'group', tuplet: p.tuplet || null, beatLen: p.meter.beatLen,
                notes: p.notes.map(nt => ({ ...nt, word: nt.rest || !words ? undefined : nt.syl, cls: clsPrefix ? `${clsPrefix}${k++}` : undefined })),
            });
        }
        if (barline) items.push({ type: 'barline', glyph: barline });
        return items;
    }

    // ---------------------------------------------------------------- scoring

    // Each written note is matched to the nearest tap (or heard note) within half the gap to its
    // neighbours. Full marks within OK of the note, nothing at ZERO or later; a note with nothing near it
    // scores 0; each extra tap takes EXTRA_PENALTY off. Listening through the microphone is lenient: the
    // windows are wider, and a steady delay (the phone's own lag, or playing a touch behind) is taken
    // out first - only the spread around it counts.
    const SCORING = {
        tap: { OK: 0.04, ZERO: 0.15, EXTRA_PENALTY: 4 },
        mic: { OK: 0.09, ZERO: 0.25, EXTRA_PENALTY: 1, MAX_SHIFT: 0.3 },
    };
    const METHODS = ['tap', 'mic'];
    // details: { bpm, method, taps: [seconds from bar 1 beat 1, after the output delay] }.
    function scoreRound(level, details) {
        const bpm = details && details.bpm, method = details && details.method;
        if (!isNum(bpm) || bpm < ROUND.MIN_BPM || bpm > ROUND.MAX_BPM) fail('Bad rhythm speed.');
        if (!METHODS.includes(method)) fail('Bad rhythm method.');
        const taps = details.taps;
        if (!Array.isArray(taps) || taps.length > 400 || taps.some(v => !isNum(v) || v < -5 || v > 300)) fail('Bad taps.');
        const S = SCORING[method];
        const sched = schedule(level);
        const spb = 60 / bpm;
        const times = sched.onsets.map(o => o.beat * spb);
        const lastT = sched.totalBeats * spb;
        let heard = taps.filter(t => t > -spb && t < lastT + spb).sort((a, b) => a - b);
        // Lenient: take out a steady delay, from a first rough match (median of the nearest offsets).
        let shift = 0;
        if (method === 'mic' && heard.length) {
            const near = times.map(t => heard.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), heard[0]) - t).filter(d => Math.abs(d) <= S.MAX_SHIFT);
            if (near.length) shift = median(near);
            heard = heard.map(t => t - shift);
        }
        const free = heard.slice();
        const results = sched.onsets.map((o, k) => {
            const t = times[k];
            const before = k > 0 ? t - times[k - 1] : spb, after = k < times.length - 1 ? times[k + 1] - t : spb;
            const win = Math.min(before, after) / 2 + (method === 'mic' ? 0.03 : 0);
            let best = -1;
            free.forEach((x, i) => { if (Math.abs(x - t) <= win && (best < 0 || Math.abs(x - t) < Math.abs(free[best] - t))) best = i; });
            if (best < 0) return { ...o, offset: null, points: 0 };
            const off = free.splice(best, 1)[0] - t;
            const a = Math.abs(off);
            const points = a <= S.OK ? 100 : Math.round(clamp(100 * (1 - (a - S.OK) / (S.ZERO - S.OK))));
            return { ...o, offset: Math.round(off * 1000), points };
        });
        const extra = free.length;
        const score = Math.round(clamp(mean(results.map(r => r.points)) - extra * S.EXTRA_PENALTY));
        const hitOffsets = results.filter(r => r.offset !== null).map(r => r.offset);
        // Per rhythm (play through the sheet): each bar's own score.
        const perPattern = sched.bars.map((p, bar) => {
            const rs = results.filter(r => r.bar === bar);
            return { pattern: p.id, bar, score: Math.round(mean(rs.map(r => r.points))) };
        });
        return {
            score, grade: TheoryEngine.gradeFor(score), results, method,
            onTime: results.filter(r => r.points === 100).length,
            missed: results.filter(r => r.offset === null).length,
            extra,
            drift: hitOffsets.length ? Math.round(mean(hitOffsets)) : null, // after the steady delay, for mic
            shift: Math.round(shift * 1000),
            onTimeMs: Math.round(S.OK * 1000),
            perPattern,
        };
    }
    // The Level each rhythm in a round earned (a single rhythm, or each bar of the sheet at grade 4+).
    function levelsFromRound(level, details, result) {
        if (String(level).startsWith('sheet:')) {
            return result.perPattern.map(pp => ({ pattern: pp.pattern, level: levelEarned(pattern(pp.pattern), details.bpm, TheoryEngine.gradeFor(pp.score)) }));
        }
        return [{ pattern: level, level: levelEarned(pattern(level), details.bpm, result.grade) }];
    }

    // ---------------------------------------------------------------- listening

    // Note starts from the microphone's loudness, about 60 times a second: a start is a jump in level
    // (RISE times the quietest of the last LOOKBACK_S, and above FLOOR), at least GAP_S after the last
    // one - a clap, a sung syllable or a tongued note. After a start it waits for the sound to dip (below
    // DIP of its peak) before it will hear another, so a held note is one start, not many. Feed it
    // (seconds, rms); it returns the start time or null.
    const ONSET = { FLOOR: 0.02, RISE: 1.8, GAP_S: 0.08, LOOKBACK_S: 0.06, DIP: 0.6 };
    function onsetDetector() {
        const hist = []; // [t, rms]
        let last = -Infinity, armed = true, peak = 0;
        return {
            feed(t, rms) {
                const recent = hist.filter(([ht]) => t - ht <= ONSET.LOOKBACK_S).map(h => h[1]);
                const ref = recent.length ? Math.min(...recent) : 0;
                hist.push([t, rms]);
                while (hist.length && t - hist[0][0] > 0.3) hist.shift();
                if (!armed) {
                    peak = Math.max(peak, rms);
                    if (rms < peak * ONSET.DIP) armed = true;
                }
                if (armed && rms >= ONSET.FLOOR && rms >= ref * ONSET.RISE && t - last >= ONSET.GAP_S) {
                    last = t; armed = false; peak = rms;
                    return t;
                }
                return null;
            },
        };
    }

    return {
        PATTERNS, SETS, LEVEL_BPM, PASS_GRADE, ROUND, SCORING, METHODS, ONSET, SIMPLE, COMPOUND,
        pattern, patternsIn, setOf, levelBpms, nextBpm, levelEarned, barOf, schedule, barItems, scoreRound, levelsFromRound, onsetDetector,
    };
}));
