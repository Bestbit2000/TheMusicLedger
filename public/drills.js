// ML-298 / ML-295 / ML-296: the engine behind the three drill tools - Tap tempo, Gap trainer and Ear.
// What each tool asks, its levels, the rounds and the scoring. Pure logic with no DOM, audio or
// storage: loaded in the browser (window.Drills, after theoryEngine.js), by the server to re-score a
// saved round from what was actually tapped or answered (server/services/drills.js), and by
// server/test/drills.test.js. Read docs/drills.md before changing a level or the scoring.
//
// Every round ends in a score out of 100 and a grade 1-5 (the Theory tool's grade limits), so the three
// tools read the same as Theory and can feed practice sessions later.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./theoryEngine.js'));
    else root.Drills = factory(root.TheoryEngine);
}(typeof self !== 'undefined' ? self : this, function (TheoryEngine) {
    'use strict';

    const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
    const round1 = (v) => Math.round(v * 10) / 10;
    const gradeFor = (score) => TheoryEngine.gradeFor(score);
    const makeRng = (seed) => TheoryEngine.makeRng(seed);
    const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
    const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    function fail(msg) { const e = new Error(msg); e.status = 400; throw e; }

    // ================================================================ Tap tempo (ML-298)
    // You're given a speed - a metronome mark, or (hardest) just its Italian name - and tap it on the pad.
    // Levels go from hearing it first with a live faster/slower meter, to the number with no help at all.
    const TAP = {
        TAPS: 9,           // 9 taps = 8 gaps between them
        TARGETS: 5,        // speeds in a round
        MIN_BPM: 50, MAX_BPM: 180,
        LEVELS: [
            { id: 'listen', label: 'Listen first', desc: 'Hear the speed for a bar, then keep it going. A meter shows faster or slower.', prompt: 'bpm', countIn: true, live: true },
            { id: 'guide', label: 'With a guide', desc: 'Just the number. A meter shows faster or slower as you tap.', prompt: 'bpm', countIn: false, live: true },
            { id: 'solo', label: 'On your own', desc: 'Just the number, no meter. See how close you were after each one.', prompt: 'bpm', countIn: false, live: false },
            { id: 'names', label: 'Speed names', desc: 'Just the Italian name (Andante, Allegro...). Tap anywhere in its range.', prompt: 'name', countIn: false, live: false },
        ],
        // How much a miss costs: 2% off = 90, 5% = 75, 10% = 50, 20% or more = 0. Steadiness (how even
        // the gaps were) is a fifth of each speed's points.
        ACCURACY_SLOPE: 500, STEADY_SLOPE: 500, STEADY_SHARE: 0.2,
        LIVE_ON: 0.03,     // the meter says "on it" within 3%
    };
    const tapLevel = (id) => TAP.LEVELS.find(l => l.id === id) || fail('Unknown Tap tempo level.');
    const speedBand = (id) => TheoryEngine.SPEEDS.find(s => s.id === id);

    // The round's speeds. Numbers: five different ones across 50-180 (multiples of 2, at least 8 apart).
    // Names: five different bands, each shown by one of its names.
    function tapTargets(levelId, seed) {
        const level = tapLevel(levelId);
        const rng = makeRng(seed);
        if (level.prompt === 'name') {
            return rng.shuffle(TheoryEngine.SPEEDS.slice()).slice(0, TAP.TARGETS)
                .map(s => ({ band: s.id, name: rng.pick(s.names), min: s.min, max: s.max }));
        }
        const out = [];
        while (out.length < TAP.TARGETS) {
            const bpm = TAP.MIN_BPM + 2 * rng.int((TAP.MAX_BPM - TAP.MIN_BPM) / 2 + 1);
            if (out.every(t => Math.abs(t.bpm - bpm) >= 8)) out.push({ bpm });
        }
        return out;
    }
    // The speed of a run of taps (ms timestamps): 60000 / the median gap, so one fumbled tap doesn't
    // wreck it; steadiness is how much the gaps vary (0 = perfectly even).
    function tapMeasure(taps) {
        if (!Array.isArray(taps) || taps.length < 3) return null;
        const gaps = [];
        for (let i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1]);
        if (gaps.some(g => !(g > 0))) return null;
        const m = mean(gaps);
        const sd = Math.sqrt(mean(gaps.map(g => (g - m) ** 2)));
        return { bpm: 60000 / median(gaps), spread: sd / m };
    }
    // How far off a measured speed is, as a fraction: of the number, or of the nearest edge of a band
    // (anywhere inside the band is spot on).
    function tapError(target, bpm) {
        if (target.band) {
            const s = speedBand(target.band);
            if (!s) return 1;
            const max = s.max === 200 ? Infinity : s.max;
            if (bpm >= s.min && bpm <= max) return 0;
            return bpm < s.min ? (s.min - bpm) / s.min : (bpm - s.max) / s.max;
        }
        return Math.abs(bpm - target.bpm) / target.bpm;
    }
    function tapScoreOne(target, taps) {
        const m = Array.isArray(taps) && taps.length >= TAP.TAPS ? tapMeasure(taps) : null;
        if (!m) return { bpm: null, error: null, points: 0 };
        const error = tapError(target, m.bpm);
        const accuracy = clamp(100 - error * 100 * TAP.ACCURACY_SLOPE / 100);
        const steady = clamp(100 - m.spread * TAP.STEADY_SLOPE);
        return { bpm: round1(m.bpm), error: Math.round(error * 1000) / 10, spread: Math.round(m.spread * 1000) / 10,
            direction: error < 0.0005 ? 'on' : (target.band ? (m.bpm < speedBand(target.band).min ? 'slow' : 'fast') : (m.bpm < target.bpm ? 'slow' : 'fast')),
            points: Math.round((1 - TAP.STEADY_SHARE) * accuracy + TAP.STEADY_SHARE * steady) };
    }
    // The live meter (Listen first / With a guide): the speed of the last few taps against the target,
    // -1 (much too slow) to +1 (much too fast), or null until there are 3 taps.
    function tapLive(targetBpm, taps) {
        if (!Array.isArray(taps) || taps.length < 3) return null;
        const m = tapMeasure(taps.slice(-5));
        if (!m) return null;
        const ratio = m.bpm / targetBpm - 1;
        return { bpm: Math.round(m.bpm), pos: clamp(ratio / 0.15, -1, 1), verdict: Math.abs(ratio) <= TAP.LIVE_ON ? 'on' : ratio < 0 ? 'slow' : 'fast' };
    }
    function tapScoreRound(levelId, details) {
        tapLevel(levelId);
        const targets = details && details.targets, taps = details && details.taps;
        if (!Array.isArray(targets) || !Array.isArray(taps) || !targets.length || targets.length > TAP.TARGETS || taps.length !== targets.length) fail('Bad Tap tempo round.');
        targets.forEach(t => { if (!(t && (isNum(t.bpm) && t.bpm >= 20 && t.bpm <= 300 || speedBand(t.band)))) fail('Bad Tap tempo speed.'); });
        taps.forEach(list => { if (!Array.isArray(list) || list.length > 40 || list.some(v => !isNum(v) || v < 0 || v > 3600000)) fail('Bad taps.'); });
        const results = targets.map((t, i) => tapScoreOne(t, taps[i]));
        const score = Math.round(results.reduce((a, r) => a + r.points, 0) / TAP.TARGETS);
        return { score, grade: gradeFor(score), results };
    }

    // ================================================================ Gap trainer (ML-295)
    // The metronome goes silent for a while and you keep the beat by tapping; when it comes back you see
    // whether you were still with it. 4/4, one count-in bar (always heard), then 8 bars. You tap every
    // crotchet beat, heard or not; the silent beats count most.
    const GAP = {
        BARS: 8, BEATS: 4, COUNT_IN_BARS: 1,
        BPMS: [60, 80, 100, 120],
        DEFAULT_BPM: 80,
        PATTERNS: [
            { id: 'bars3on1off', group: 'Bar gaps', label: '3 on, 1 off', desc: 'Three bars of clicks, one silent. The place to start.', on: 3, off: 1 },
            { id: 'bars2on2off', group: 'Bar gaps', label: '2 on, 2 off', desc: 'Two bars of clicks, two silent.', on: 2, off: 2 },
            { id: 'bars1on3off', group: 'Bar gaps', label: '1 on, 3 off', desc: 'One bar of clicks, then three on your own.', on: 1, off: 3 },
            { id: 'beats13', group: 'Beat gaps', label: 'Beats 1 and 3', desc: 'Only beats 1 and 3 click - you fill in 2 and 4.', beats: [0, 2] },
            { id: 'offbeats', group: 'Beat gaps', label: 'Offbeats', desc: 'It clicks only on the "and"s - you tap the beats in between.', offbeats: true },
            { id: 'random25', group: 'Random', label: 'Random 25%', desc: 'A quarter of the bars go silent, you can\'t tell which.', rate: 0.25 },
            { id: 'random50', group: 'Random', label: 'Random 50%', desc: 'Half the bars go silent at random.', rate: 0.5 },
        ],
        // A tap within 2.5% of a beat scores 90; 10% off, 60; a quarter of a beat or more, 0.
        OFFSET_SLOPE: 400,
        SILENT_SHARE: 0.75,     // silent beats are 3/4 of the score; the heard ones the rest
        ON_TIME: 0.05,          // within 5% of a beat reads as "on the beat"
    };
    const gapPattern = (id) => GAP.PATTERNS.find(p => p.id === id) || fail('Unknown Gap trainer pattern.');

    // Which bars (0-7, after the count-in) are silent, which clicks sound, and which beats you're scored on.
    // clicksPerBeat is 2 for the offbeat drill (the "and"s need their own click).
    function gapSchedule(patternId, seed) {
        const p = gapPattern(patternId);
        const clicksPerBeat = p.offbeats ? 2 : 1;
        let silentBars = [];
        if (p.on) for (let b = 0; b < GAP.BARS; b++) if (b % (p.on + p.off) >= p.on) silentBars.push(b);
        if (p.rate) {
            const rng = makeRng(seed);
            // Bar 0 always clicks, so you have something to start from; at least one bar is silent.
            for (let b = 1; b < GAP.BARS; b++) if (rng() < p.rate) silentBars.push(b);
            if (!silentBars.length) silentBars.push(1 + rng.int(GAP.BARS - 1));
        }
        silentBars = [...new Set(silentBars)].sort((a, b) => a - b);
        // heard(bar, clickInBar): bar -1 is the count-in (always heard in full)
        const heard = (bar, click) => {
            if (bar < 0) return !p.offbeats || click % 2 === 0; // count-in: on the beats, so you know where they are
            if (silentBars.includes(bar)) return false;
            if (p.beats) return click % clicksPerBeat === 0 && p.beats.includes(click / clicksPerBeat);
            if (p.offbeats) return click % 2 === 1;
            return true;
        };
        // A scored beat is "silent" when its own click doesn't sound.
        const beats = [];
        for (let bar = 0; bar < GAP.BARS; bar++) for (let beat = 0; beat < GAP.BEATS; beat++) {
            beats.push({ bar, beat, silent: !heard(bar, beat * clicksPerBeat) });
        }
        return { pattern: p.id, clicksPerBeat, silentBars, heard, beats, countInBeats: GAP.COUNT_IN_BARS * GAP.BEATS };
    }
    // taps: seconds from the first scored beat (bar 0 beat 1), already corrected for the output delay.
    // Each beat takes the nearest unused tap within half a beat of it.
    function gapScoreRound(patternId, details) {
        const bpm = details && details.bpm;
        if (!GAP.BPMS.includes(bpm)) fail('Bad Gap trainer speed.');
        const taps = details && details.taps;
        if (!Array.isArray(taps) || taps.length > 200 || taps.some(v => !isNum(v) || v < -5 || v > 120)) fail('Bad taps.');
        const sched = gapSchedule(patternId, details.seed);
        const spb = 60 / bpm;
        const free = taps.slice().sort((a, b) => a - b);
        const results = sched.beats.map((b, k) => {
            const t = k * spb;
            let best = -1;
            free.forEach((x, i) => { if (Math.abs(x - t) <= spb / 2 && (best < 0 || Math.abs(x - t) < Math.abs(free[best] - t))) best = i; });
            if (best < 0) return { ...b, offset: null, points: 0 };
            const offset = free.splice(best, 1)[0] - t;
            return { ...b, offset: Math.round(offset * 1000), points: Math.round(clamp(100 - Math.abs(offset) / spb * GAP.OFFSET_SLOPE)) };
        });
        const silent = results.filter(r => r.silent), heardR = results.filter(r => !r.silent);
        const avg = (rs) => rs.length ? mean(rs.map(r => r.points)) : null;
        const s = avg(silent), h = avg(heardR);
        const score = Math.round(h === null ? s : s === null ? h : GAP.SILENT_SHARE * s + (1 - GAP.SILENT_SHARE) * h);
        // Drift: the average early/late through the silent beats, and how you landed on the first beat
        // when the click came back after each gap.
        const silentOffsets = silent.filter(r => r.offset !== null).map(r => r.offset);
        const returns = [];
        results.forEach((r, i) => { if (!r.silent && i > 0 && results[i - 1].silent) returns.push(r.offset); });
        const onTimeMs = Math.round(GAP.ON_TIME * spb * 1000);
        return {
            score, grade: gradeFor(score), results,
            silentScore: s === null ? null : Math.round(s),
            drift: silentOffsets.length ? Math.round(mean(silentOffsets)) : null,
            landings: returns,
            onTimeMs,
            missed: results.filter(r => r.offset === null).length,
        };
    }

    // ================================================================ Ear (ML-296)
    // A note plays (synthesised in the app) and you name it - after a home note, on its own, or by
    // playing/singing it back into the mic. Notes are WRITTEN pitch for your instrument (the tuner's
    // transposition): a B♭ cornet's "home note" is its written C, which sounds concert B♭. By ear, a
    // sharp and its flat are the same answer (C♯ = D♭).
    const EAR = {
        QUESTIONS: 10,
        MODES: [
            { id: 'reference', label: 'With a home note', desc: 'Hear your home note (C), then a mystery note. Name the mystery note.' },
            { id: 'single', label: 'On its own', desc: 'One note, nothing to compare it with. Name it.' },
            { id: 'playback', label: 'Play it back', desc: 'Hear a note, then play or sing it. The tuner listens.' },
        ],
        // With a home note: which notes above written C can come up (semitones).
        LEVELS: [
            { id: 'root5', label: 'Home and 5th', desc: 'C and G', degrees: [0, 7] },
            { id: 'triad', label: 'Add the 3rd', desc: 'C, E and G', degrees: [0, 4, 7] },
            { id: 'pentatonic', label: 'Add 2nd and 6th', desc: 'C, D, E, G and A', degrees: [0, 2, 4, 7, 9] },
            { id: 'major', label: 'Major scale', desc: 'All of C major', degrees: [0, 2, 4, 5, 7, 9, 11] },
            { id: 'chromatic', label: 'All 12 notes', desc: 'Sharps and flats too', degrees: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
        ],
        // On its own / Play it back: plain notes, or all twelve.
        NOTE_SETS: [
            { id: 'naturals', label: 'No sharps or flats', degrees: [0, 2, 4, 5, 7, 9, 11] },
            { id: 'all', label: 'All 12 notes', degrees: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
        ],
        HOME_MIDI: 60,          // written C4
        PLAYBACK_CENTS: 50,     // Play it back: the nearest note to what you played must be the right one
    };
    const earMode = (id) => EAR.MODES.find(m => m.id === id) || fail('Unknown Ear mode.');
    function earSet(modeId, setId) {
        earMode(modeId);
        const list = modeId === 'reference' ? EAR.LEVELS : EAR.NOTE_SETS;
        return list.find(l => l.id === setId) || fail('Unknown Ear level.');
    }
    const earLevelKey = (modeId, setId) => `${modeId}:${setId}`;
    // A written note name for a semitone above C, the way it's most often written: sharps for 1/6,
    // flats for 3/8/10 (C♯, E♭, F♯, A♭, B♭).
    const NAME_OF = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const PC_OF = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
    const pcOf = (name) => (name in PC_OF ? PC_OF[name] : null);
    // The round: 10 written notes (MIDI), never the same one twice running. With a home note they sit in
    // the octave from written C4; on their own they range over two octaves (C4 to B5) so the octave
    // gives nothing away.
    function earQuestions(modeId, setId, seed) {
        const set = earSet(modeId, setId);
        const rng = makeRng(seed);
        const out = [];
        let last = null;
        while (out.length < EAR.QUESTIONS) {
            const deg = rng.pick(set.degrees);
            const octave = modeId === 'reference' ? 0 : 12 * rng.int(2);
            const midi = EAR.HOME_MIDI + deg + octave;
            if (set.degrees.length > 1 && midi === last) continue;
            last = midi;
            out.push({ midi, name: NAME_OF[deg] });
        }
        return out;
    }
    // The buttons: the level's own notes (reference), letters (naturals), or all twelve.
    function earAnswers(modeId, setId) {
        const set = earSet(modeId, setId);
        return set.degrees.map(d => NAME_OF[d]);
    }
    // Concert MIDI for a written note on an instrument whose written = concert + transposition (0-11,
    // the tuner's setting). Transposing instruments sound LOWER than written, by the transposition.
    const earConcertMidi = (writtenMidi, transposition) => writtenMidi - ((transposition % 12) + 12) % 12;
    const midiToFreq = (midi, a4 = 440) => a4 * Math.pow(2, (midi - 69) / 12);
    // Play it back: the written note nearest a detected frequency, and how far off it was.
    function earHeard(freq, transposition, a4 = 440) {
        if (!(freq > 0)) return null;
        const concert = 69 + 12 * Math.log2(freq / a4);
        const nearest = Math.round(concert);
        return { writtenMidi: nearest + ((transposition % 12) + 12) % 12, cents: Math.round((concert - nearest) * 100) };
    }
    // questions: [{ midi, answer }] - answer a note name (tapped) or, for Play it back, the written MIDI
    // the tuner settled on (null if nothing was heard). Right = the same note, in any octave.
    function earScoreRound(levelKey, details) {
        const [modeId, setId] = String(levelKey).split(':');
        const set = earSet(modeId, setId);
        const qs = details && details.questions;
        if (!Array.isArray(qs) || !qs.length || qs.length > EAR.QUESTIONS) fail('Bad Ear round.');
        const results = qs.map(q => {
            if (!q || !isNum(q.midi) || q.midi < 36 || q.midi > 96 || !set.degrees.includes(((q.midi - EAR.HOME_MIDI) % 12 + 12) % 12)) fail('Bad Ear question.');
            const want = ((q.midi % 12) + 12) % 12;
            let got = null;
            if (modeId === 'playback') got = isNum(q.answer) ? ((Math.round(q.answer) % 12) + 12) % 12 : null;
            else got = typeof q.answer === 'string' ? pcOf(q.answer) : null;
            return { midi: q.midi, answer: q.answer ?? null, correct: got === want };
        });
        const right = results.filter(r => r.correct).length;
        const score = Math.round(100 * right / EAR.QUESTIONS);
        return { score, grade: gradeFor(score), right, results };
    }

    // ================================================================ shared

    const TOOLS = {
        tapTempo: { title: 'Tap tempo', levels: TAP.LEVELS.map(l => l.id), score: tapScoreRound },
        gapTrainer: { title: 'Gap trainer', levels: GAP.PATTERNS.map(p => p.id), score: gapScoreRound },
        ear: {
            title: 'Ear',
            levels: EAR.MODES.flatMap(m => (m.id === 'reference' ? EAR.LEVELS : EAR.NOTE_SETS).map(s => earLevelKey(m.id, s.id))),
            score: earScoreRound,
        },
    };
    // Re-scores a finished round from its raw details - what the server stores, whatever the app sent.
    function scoreRound(tool, level, details) {
        const t = TOOLS[tool];
        if (!t) fail('Unknown drill.');
        if (!t.levels.includes(level)) fail('Unknown level.');
        return t.score(level, details);
    }

    return {
        TAP, GAP, EAR, TOOLS,
        tapLevel, tapTargets, tapMeasure, tapError, tapScoreOne, tapLive, tapScoreRound,
        gapPattern, gapSchedule, gapScoreRound,
        earMode, earSet, earLevelKey, earQuestions, earAnswers, earConcertMidi, earHeard, earScoreRound, midiToFreq, NAME_OF, pcOf,
        scoreRound, gradeFor,
    };
}));
