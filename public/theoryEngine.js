// ML-263: the Theory practice quiz engine (ML-260) - the quizzes' content, their options, question
// generation and scoring. Pure logic with no DOM or storage: loaded in the browser (window.TheoryEngine,
// after notation.js and before app.js), in Node by server/test/theoryEngine.test.js, and by the server to
// re-score saved rounds (server/services/theoryPractice.js).
//
// Questions describe WHAT to draw (Notation.staff options, a glyph name...), never SVG - the screen
// hands those to public/notation.js. Every answer is one tap on a button (confirmed on ML-260), so every
// question carries its full, fixed list of answer buttons.
//
// Intervals and Chords (ML-309 C) are grade-only quizzes: see Theory grades below.
//
// Four custom quizzes: Note names, Keys (key signatures + written-out scales), Notation (id 'symbols': name <->
// meaning, both ways, incl. rhythm, Italian terms and speeds - ML-297/301) and Mixed (all of them in turn). Every quiz deals each of its
// questions once, in a shuffled order, before any comes round again.
//
// Theory grades (ML-309, feature theory_grades): any quiz can be set to "Grade 1-5" instead of its own
// options - everything in the ABRSM Music Theory syllabus up to that grade that these quizzes can ask
// (THEORY_GRADES, and each symbol's grade). Listed for review on Admin -> Theory grades; see
// docs/theory-grades.md.
//
// Read docs/theory-practice.md before changing the scoring or grade limits.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./notation.js'));
    else root.TheoryEngine = factory(root.Notation);
}(typeof self !== 'undefined' ? self : this, function (Notation) {
    'use strict';

    // ---------------------------------------------------------------- names

    // Letters, or solfège syllables (fixed do, with the app's Sol/Ti - same as the tuner, ML-257). Notes
    // and keys are always SPELLED (C♯ vs D♭ matters when reading music), so an accidental is a suffix on
    // the syllable (Do♯, Ti♭) rather than the tuner's chromatic syllables (Di, Te).
    const SYLLABLE = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Ti' };
    const ACC_SUFFIX = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };
    function spell(letter, alter, naming) {
        return (naming === 'solfege' ? SYLLABLE[letter] : letter) + ACC_SUFFIX[alter || 0];
    }
    function parseName(name) {
        const m = /^([A-G])(#|b)?$/.exec(name);
        return { letter: m[1], alter: m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0 };
    }
    const spellName = (name, naming) => { const p = parseName(name); return spell(p.letter, p.alter, naming); };

    // ---------------------------------------------------------------- question types and par times

    // How long a question of each type "should" take - a timed round's perfect score is answering every
    // question in its par time (confirmed on ML-260 as a top pace per quiz: 40 note names, 24 key
    // signatures, 30 symbol names, 24 symbol meanings, 15 scales a minute). Mixed rounds add them up.
    const PAR = { note: 1.5, keySignature: 2.5, scale: 4, symbolName: 2, symbolMeaning: 2.5, speedName: 2.5, speedBpm: 2.5,
        // ML-309 C (Theory grades only): read two notes, a note in a key, a whole scale, a chord, two chords.
        intervalNumber: 2.5, interval: 4, degree: 3, chromatic: 6, chord: 4, inversion: 3, cadence: 5 };
    const typeOf = (questionId) => String(questionId).split(':')[0];
    const parOf = (questionId) => PAR[typeOf(questionId)] || 2;

    // ---------------------------------------------------------------- options

    // ML-354: one fixed length per kind - a longer test is the same round repeated (REPEATS, x1-x5),
    // each repeat scored on its own, and the best one counts. So a score never depends on the length.
    const ROUNDS = [
        { value: 't30', label: '30 s', seconds: 30 },
        { value: 'q10', label: '10 questions', questions: 10 },
    ];
    const DEFAULT_ROUND = 't30';
    const REPEATS = [1, 2, 3, 4, 5];
    const DEFAULT_REPEATS = 1;
    const repeatsOf = (n) => (REPEATS.includes(Number(n)) ? Number(n) : DEFAULT_REPEATS);

    // Clef is multi-select (not "Both"); alto and tenor arrived with Theory grades (ML-309).
    // showIf: { key: value } or { key: [values] } - shown only while every listed option matches.
    // gradeKeep: still shown when a Theory grade is picked (every other option is the grade's).
    const OPT = {
        clefs: { key: 'clefs', label: 'Clef', multi: true, gradeKeep: true, default: ['treble'], choices: [{ value: 'treble', label: 'Treble' }, { value: 'bass', label: 'Bass' }, { value: 'alto', label: 'Alto' }, { value: 'tenor', label: 'Tenor' }] },
        range: { key: 'range', label: 'Range, above and below', default: 0, choices: [{ value: 0, label: 'On the staff' }, { value: 2, label: '2 ledger lines' }, { value: 4, label: '4 ledger lines' }, { value: 6, label: '6 ledger lines' }] },
        accidentals: { key: 'accidentals', label: 'Sharps and flats', default: 'none', choices: [{ value: 'none', label: 'None' }, { value: 'sharps', label: 'Sharps' }, { value: 'flats', label: 'Flats' }] },
        show: { key: 'show', label: 'Show', gradeKeep: true, default: 'both', choices: [{ value: 'keySignatures', label: 'Key signatures' }, { value: 'scales', label: 'Scales' }, { value: 'both', label: 'Both' }] },
        upTo: { key: 'upTo', label: 'Up to (sharps or flats)', default: 3, choices: [{ value: 3, label: '3' }, { value: 5, label: '5' }, { value: 7, label: '7' }] },
        keyTypes: { key: 'keyTypes', label: 'Keys', default: 'both', choices: [{ value: 'sharp', label: 'Sharp keys' }, { value: 'flat', label: 'Flat keys' }, { value: 'both', label: 'Both' }] },
        modes: { key: 'modes', label: 'Major and minor', default: 'major', choices: [{ value: 'major', label: 'Major' }, { value: 'both', label: 'Major and minor' }] },
        minorForm: { key: 'minorForm', label: 'Minor scales', default: 'harmonic', showIf: { modes: 'both', show: ['scales', 'both'] }, choices: [{ value: 'harmonic', label: 'Harmonic' }, { value: 'melodic', label: 'Melodic' }, { value: 'both', label: 'Both' }] },
        set: { key: 'set', label: 'Symbols', default: 'basics', choices: [{ value: 'basics', label: 'Basics' }, { value: 'dynamics', label: 'Dynamics' }, { value: 'rhythm', label: 'Rhythm' }, { value: 'structure', label: 'Structure' }, { value: 'terms', label: 'Terms' }, { value: 'speeds', label: 'Speeds' }, { value: 'everything', label: 'Everything' }] },
        ask: { key: 'ask', label: 'Ask', gradeKeep: true, default: 'both', choices: [{ value: 'names', label: 'Names' }, { value: 'meanings', label: 'Meanings' }, { value: 'both', label: 'Both' }] },
        level: { key: 'level', label: 'Difficulty', default: 'beginner', choices: [{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }] },
    };

    const QUIZZES = [
        { id: 'noteNames', title: 'Note names', subtitle: 'Identify the note on a stave', icon: 'noteheadWhole', options: [OPT.clefs, OPT.range, OPT.accidentals] },
        { id: 'keys', title: 'Keys', subtitle: 'Key signatures and scales', icon: 'accidentalSharp', options: [OPT.clefs, OPT.show, OPT.upTo, OPT.keyTypes, OPT.modes, OPT.minorForm] },
        { id: 'symbols', title: 'Notation', subtitle: 'Symbols and speeds', icon: 'fermataAbove', options: [OPT.set, OPT.ask] },
        // ML-309 C: grade-only quizzes (feature theory_grades) - no custom options, just the grades
        // that have something to ask. The app leaves them off the list while theory_grades is off.
        { id: 'intervals', title: 'Intervals', subtitle: 'The distance between two notes', icon: 'noteHalfUp', options: [OPT.clefs], gradeOnly: true, grades: [2, 3, 4, 5] },
        { id: 'chords', title: 'Chords', subtitle: 'Triads, inversions and cadences', icon: 'noteQuarterUp', options: [OPT.clefs], gradeOnly: true, grades: [4, 5] },
        { id: 'mixed', title: 'Mixed', subtitle: 'A bit of everything', icon: 'segno', options: [OPT.clefs, OPT.level] },
    ];
    // What each Mixed level asks, from each quiz.
    const MIXED_LEVELS = {
        beginner: { range: 0, accidentals: ['none'], upTo: 3, modes: 'major', minorForm: 'harmonic', sets: ['basics', 'dynamics', 'rhythm'] },
        intermediate: { range: 2, accidentals: ['none'], upTo: 5, modes: 'both', minorForm: 'harmonic', sets: ['basics', 'dynamics', 'rhythm', 'structure'] },
        advanced: { range: 4, accidentals: ['sharps', 'flats'], upTo: 7, modes: 'both', minorForm: 'both', sets: ['everything'] },
    };

    // Smart learn only (ML-269): a round of just the questions you've been missing, from any quiz. Not in
    // QUIZZES - the list screen adds it when Smart learn is on.
    const WEAK_SPOTS = { id: 'weakSpots', title: 'Your weak spots', icon: 'coda', smartOnly: true, options: [] };
    function quiz(id) {
        const q = QUIZZES.find(x => x.id === id) || (id === WEAK_SPOTS.id ? WEAK_SPOTS : null);
        if (!q) throw new Error(`Unknown quiz: ${id}`);
        return q;
    }
    const optionVisible = (def, opts) => (!opts.grade || !!def.gradeKeep) && (!def.showIf || Object.entries(def.showIf)
        .every(([k, v]) => (Array.isArray(v) ? v.includes(opts[k]) : opts[k] === v)));

    // Fills defaults and throws out anything that isn't one of the listed choices (stored options from
    // an older version, a hand-edited localStorage value...). Always returns a complete, valid set.
    // grade: 0 = the quiz's own options, 1-5 = a Theory grade; the clefs are then only the grade's.
    function normaliseOptions(quizId, raw) {
        const out = {};
        raw = raw || {};
        const q = quiz(quizId);
        for (const def of q.options) {
            const allowed = def.choices.map(c => c.value);
            if (def.multi) {
                const v = Array.isArray(raw[def.key]) ? allowed.filter(a => raw[def.key].includes(a)) : [];
                out[def.key] = v.length ? v : def.default.slice();
            } else {
                out[def.key] = allowed.includes(raw[def.key]) ? raw[def.key] : def.default;
            }
        }
        // A grade-only quiz (ML-309 C) is always at one of its own grades - the lowest by default.
        if (q.gradeOnly) out.grade = q.grades.includes(raw.grade) ? raw.grade : q.grades[0];
        else out.grade = q.options.length && GRADE_CHOICES.includes(raw.grade) ? raw.grade : 0;
        if (out.grade && out.clefs) {
            const allowed = gradeContent(out.grade).clefs;
            const v = out.clefs.filter(c => allowed.includes(c));
            out.clefs = v.length ? v : [allowed[0]];
        }
        return out;
    }
    function round(roundId) { return ROUNDS.find(r => r.value === roundId) || ROUNDS.find(r => r.value === DEFAULT_ROUND); }

    // Identifies "the same options" for history and personal bests: results with different options
    // (or a different round type) aren't comparable. Hidden options (minor scales when minor is off)
    // don't count.
    function settingsKey(quizId, rawOptions, roundId) {
        const opts = normaliseOptions(quizId, rawOptions);
        const parts = quiz(quizId).options.filter(d => optionVisible(d, opts))
            .map(d => `${d.key}=${d.multi ? opts[d.key].slice().sort().join(',') : opts[d.key]}`);
        if (opts.grade) parts.unshift(`grade=${opts.grade}`);
        return `${quizId}|${round(roundId).value}|${parts.join(';')}`;
    }
    // "Treble, Bass · 2 ledger lines · None · 60 s" - the results screen's subtitle.
    function describeOptions(quizId, rawOptions, roundId) {
        const opts = normaliseOptions(quizId, rawOptions);
        const parts = quiz(quizId).options.filter(d => optionVisible(d, opts)).map(d => {
            const label = (v) => d.choices.find(c => c.value === v).label;
            if (d.multi) return opts[d.key].map(label).join(', ');
            if (d.key === 'upTo') return `Up to ${opts.upTo} ♯/♭`;
            if (d.key === 'ask') return `Ask: ${label(opts.ask).toLowerCase()}`;
            return label(opts[d.key]);
        });
        if (opts.grade) parts.unshift(`Grade ${opts.grade} syllabus`);
        return [...parts, round(roundId).label].join(' · ');
    }

    // ---------------------------------------------------------------- random

    // Seeded, so a test (or a bug report) can replay a round exactly.
    function makeRng(seed) {
        let a = (seed >>> 0) || 1;
        const rng = () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        rng.int = (n) => Math.floor(rng() * n);
        rng.pick = (arr) => arr[rng.int(arr.length)];
        rng.shuffle = (arr) => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = rng.int(i + 1); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
        return rng;
    }
    // Deals every item once, in a shuffled order, then reshuffles - never the same item twice running
    // (across a reshuffle too), unless there's only one.
    // With weightOf (Smart learn, ML-269) each deal is a weighted shuffle instead: see smartOrder.
    function makeDeck(items, rng, idOf, weightOf) {
        let deck = [], last = null;
        return {
            size: items.length,
            next() {
                if (!deck.length) {
                    // Nothing weighted (yet) is exactly the plain shuffle.
                    const weighted = weightOf && items.some(it => weightOf(idOf(it)) > 0);
                    deck = weighted ? smartOrder(items, rng, (it) => weightOf(idOf(it))).reverse() : rng.shuffle(items);
                    const top = deck.length - 1;
                    if (deck.length > 1 && idOf(deck[top]) === last) [deck[0], deck[top]] = [deck[top], deck[0]];
                }
                const it = deck.pop();
                last = idOf(it);
                return it;
            },
        };
    }

    // ---------------------------------------------------------------- Smart learn (ML-269)

    // Every question has a weight from 0 (known) to 10, per person: wrong +2, right -1, never below 0 or
    // above 10 - so 5 wrongs reach the top, and it takes 2 rights to undo each wrong. Smart learn doesn't
    // change WHAT a round asks, only the ORDER each deal comes in: every question still comes round once
    // per deal, but the ones you get wrong come early - and in a timed round, early is what gets asked.
    //
    // The order is a weighted random shuffle (Efraimidis-Spirakis weighted sampling): each question gets
    // the key random^(1 / (1 + weight x strength)) and the deal runs from the highest key down. That makes
    // each next question exactly (1 + weight x strength) times as likely to be picked as one you know:
    // 6x at a weight of 10, 3x at 4. All weights 0 is a plain shuffle. (This replaced the first idea,
    // 0.75 x random + 0.25 x random x weight/10, which caps the boost at a quarter of the range: in
    // simulation a weight-10 question in 30 moved only from 15th to 11th on average, against 5th here.)
    //
    // Four refinements (ML-269, agreed 2026-09-25):
    //  1. A missed question comes back later in the SAME round, retryGap questions on (again if it's
    //     missed again) - a quick correction instead of waiting for the next deal.
    //  2. Review: a question not asked for reviewAfterDays gets a temporary boost (+1 per reviewStepDays
    //     after that, up to reviewMax), so things you knew a while ago come back to be checked. Applied
    //     when the weights are loaded (effectiveWeight) - the stored weight itself only moves with answers.
    //  3. A right answer slower than slowFactor x the question's par time doesn't lower the weight: you
    //     got there, but it isn't known yet.
    //  4. "Your weak spots": a round of only the questions with a weight (see the weakSpots quiz below).
    const SMART = { max: 10, wrongStep: 2, rightStep: 1, strength: 0.5, retryGap: 3, slowFactor: 2, reviewAfterDays: 7, reviewStepDays: 7, reviewMax: 3 };
    // answer (optional): { questionId, ms } - a right answer slower than slowFactor x par leaves it be.
    function nextWeight(weight, correct, answer) {
        const w = Number(weight) || 0;
        if (!correct) return Math.min(SMART.max, w + SMART.wrongStep);
        const slow = answer && answer.ms > SMART.slowFactor * parOf(answer.questionId) * 1000;
        return slow ? w : Math.max(0, w - SMART.rightStep);
    }
    function reviewBoost(daysSinceSeen) {
        if (!(daysSinceSeen >= SMART.reviewAfterDays)) return 0;
        return Math.min(SMART.reviewMax, 1 + Math.floor((daysSinceSeen - SMART.reviewAfterDays) / SMART.reviewStepDays));
    }
    const effectiveWeight = (stored, daysSinceSeen) => Math.min(SMART.max, (Number(stored) || 0) + reviewBoost(daysSinceSeen));
    function smartOrder(items, rng, weightOf) {
        return items
            .map(it => ({ it, key: Math.pow(rng() || Number.MIN_VALUE, 1 / (1 + SMART.strength * (weightOf(it) || 0))) }))
            .sort((a, b) => b.key - a.key)
            .map(x => x.it);
    }

    // ---------------------------------------------------------------- note names

    // Staff steps (0 = bottom line) each range choice covers - both above and below the staff.
    const RANGE_STEPS = { 0: [-1, 9], 2: [-4, 12], 4: [-8, 16], 6: [-12, 20] };
    // One button per note, spelled one way only, in keyboard order - so it's always a single tap.
    const NOTE_BUTTONS = {
        none: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
        sharps: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
        flats: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
    };
    // ML-292: with sharps or flats on, every question shows the whole keyboard as three rows of 7
    // columns - the black keys spelled as sharps above the naturals and as flats below, each in its
    // key's column (style.css places them), with gaps where there's no black key. E#, B#, Cb and Fb
    // aren't offered: they're white keys, and never asked. The written note says which spelling is right.
    const KEYBOARD_BUTTONS = ['C#', 'D#', 'F#', 'G#', 'A#', ...NOTE_BUTTONS.none, 'Db', 'Eb', 'Gb', 'Ab', 'Bb'];
    // accidentals: one or more of none/sharps/flats (Mixed advanced asks both sharps and flats; each
    // question then shows that spelling's 12 buttons).
    function noteItems(clefs, range, accidentals) {
        const [lo, hi] = RANGE_STEPS[range];
        const out = [];
        for (const acc of accidentals) for (const clef of clefs) {
            for (let st = lo; st <= hi; st++) {
                const natural = Notation.pitchAtStep(st, clef);
                const letter = natural[0], octave = natural.slice(1);
                for (const n of NOTE_BUTTONS[acc].filter(x => x[0] === letter && (acc === accidentals[0] || x.length > 1))) {
                    out.push({ type: 'note', clef, name: n, pitch: n + octave, acc, range });
                }
            }
        }
        return out;
    }
    function noteQuestion(item, naming) {
        const [lo, hi] = RANGE_STEPS[item.range];
        return {
            id: `note:${item.clef}:${item.pitch}`,
            prompt: {
                text: 'Which note is this?',
                staff: { clef: item.clef, items: [{ type: 'note', pitch: item.pitch }], stepRange: [lo - 1, hi + 1] },
                label: `A note on the ${item.clef} staff`,
            },
            layout: item.acc === 'none' ? 'notes' : 'keyboard',
            answers: (item.acc === 'none' ? NOTE_BUTTONS.none : KEYBOARD_BUTTONS).map(n => ({ id: n, label: spellName(n, naming) })),
            correct: item.name,
        };
    }

    // ---------------------------------------------------------------- keys

    // Index = number of sharps/flats. Tonics as names ('F#', 'Bb').
    const KEY_TABLE = {
        major: { sharp: ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'], flat: ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'] },
        minor: { sharp: ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'], flat: ['A', 'D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab'] },
    };
    const SHARP_ORDER = 'FCGDAEB', FLAT_ORDER = 'BEADGCF';
    // Every key once: C major/A minor (no sharps or flats) counts as neither type, so it's in either set.
    function allKeys() {
        const out = [];
        for (const mode of ['major', 'minor']) {
            out.push({ mode, type: 'none', count: 0, tonic: KEY_TABLE[mode].sharp[0] });
            for (const type of ['sharp', 'flat']) for (let c = 1; c <= 7; c++) out.push({ mode, type, count: c, tonic: KEY_TABLE[mode][type][c] });
        }
        return out.map(k => ({ ...k, id: `${k.tonic} ${k.mode}` }));
    }
    const ALL_KEYS = allKeys();
    function keyPool({ upTo, keyTypes, modes }) {
        const m = modes === 'both' ? ['major', 'minor'] : ['major'];
        return ALL_KEYS.filter(k => m.includes(k.mode) && k.count <= upTo
            && (k.type === 'none' || keyTypes === 'both' || keyTypes === k.type));
    }
    const keyLabel = (k, naming) => `${spellName(k.tonic, naming)} ${k.mode}`;
    // Position on the circle of fifths (-7 flats .. +7 sharps): how "close" two keys are.
    const fifths = (k) => (k.type === 'flat' ? -k.count : k.count);
    // Three plausible wrong answers: the nearest keys round the circle of fifths in the same mode, plus
    // the relative major/minor when one is allowed (the classic mix-up). From every key, not just the
    // selected ones, so a small selection still has four real choices.
    function keyDistractors(correct, rng, { includeRelative }) {
        const sameMode = ALL_KEYS.filter(k => k.mode === correct.mode && k.id !== correct.id);
        const near = rng.shuffle(sameMode).sort((a, b) => Math.abs(fifths(a) - fifths(correct)) - Math.abs(fifths(b) - fifths(correct)));
        const out = [];
        if (includeRelative) {
            const rel = ALL_KEYS.find(k => k.mode !== correct.mode && fifths(k) === fifths(correct));
            if (rel) out.push(rel);
        }
        for (const k of near.slice(0, 5)) if (out.length < 3 && !out.some(o => o.id === k.id)) out.push(k);
        return out;
    }
    function keyAnswers(correct, rng, naming, includeRelative) {
        return rng.shuffle([correct, ...keyDistractors(correct, rng, { includeRelative })]).map(k => ({ id: k.id, label: keyLabel(k, naming) }));
    }
    // Key signature and scale items for a set of key options.
    // o.keyIds / o.minorForms (a Theory grade) replace the upTo/keyTypes/modes/minorForm options.
    function keyItems(clefs, o) {
        const keys = o.keyIds ? ALL_KEYS.filter(k => o.keyIds.includes(k.id)) : keyPool(o);
        const minorForms = o.minorForms || (o.minorForm === 'both' ? ['harmonic', 'melodic'] : [o.minorForm]);
        const includeRelative = o.keyIds ? keys.some(k => k.mode === 'minor') : o.modes === 'both';
        const out = [];
        for (const clef of clefs) for (const key of keys) {
            if (o.show !== 'scales') out.push({ type: 'keySignature', key, clef });
            if (o.show !== 'keySignatures') {
                const forms = key.mode === 'minor' ? minorForms : [null];
                for (const form of forms) out.push({ type: 'scale', key, clef, form, includeRelative });
            }
        }
        return out;
    }
    function keySignatureQuestion(item, rng, naming) {
        const { key, clef } = item;
        return {
            id: `keySignature:${clef}:${key.id}`,
            prompt: {
                // A key signature alone can't say major or minor, so the question does.
                text: `Which ${key.mode} key?`,
                staff: { clef, keySignature: key.count ? { type: key.type, count: key.count } : null, minWidth: 14 },
                label: `A key signature on the ${clef} staff`,
            },
            layout: 'choices',
            answers: keyAnswers(key, rng, naming, false),
            correct: key.id,
        };
    }
    // The key's own spelling for each letter, from its key signature.
    function keyAlters(key) {
        const alters = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
        const order = key.type === 'flat' ? FLAT_ORDER : SHARP_ORDER;
        for (let i = 0; i < key.count; i++) alters[order[i]] = key.type === 'flat' ? -1 : 1;
        return alters;
    }
    // One octave, ascending, written with accidentals (no key signature). A natural minor scale has
    // exactly its relative major's notes, so minor is shown harmonic (raised 7th) or melodic ascending
    // (raised 6th and 7th) - the forms graded exams ask for.
    function scalePitches(key, clef, form) {
        const alters = keyAlters(key);
        const t = parseName(key.tonic);
        const letters = 'CDEFGAB';
        const start = letters.indexOf(t.letter);
        // Tonic at step -2..4 (a different step for each letter): the scale sits on the staff with at
        // most a ledger line or two.
        let octave = 0;
        while (Notation.staffStep(t.letter + octave, clef) < -2) octave++;
        const out = [];
        for (let i = 0; i < 8; i++) {
            const letter = letters[(start + i) % 7];
            const oct = octave + Math.floor((start + i) / 7);
            let alter = alters[letter];
            if (key.mode === 'minor' && (i === 6 || (i === 5 && form === 'melodic'))) alter += 1;
            out.push(letter + ({ '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: 'x' })[alter] + oct);
        }
        return out;
    }

    // ---------------------------------------------------------------- scales practice (ML-9)

    // The Scales tool's own scales: any key, 1-3 octaves, up / down / up and down, a scale or its
    // arpeggio. form is 'major' for a major key, and 'harmonic' | 'melodic' | 'natural' for a minor
    // one. Melodic minor comes down as the natural minor, as it's played. Written with the key
    // signature (writeScale works out which notes still need an accidental).
    const SCALE_FORMS = ['major', 'harmonic', 'melodic', 'natural'];
    const SCALE_FORM_LABEL = { major: 'major', harmonic: 'harmonic minor', melodic: 'melodic minor', natural: 'natural minor' };
    const ACC_SUFFIX_ASCII = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: 'x' };
    function scaleKey(keyId) { return ALL_KEYS.find(k => k.id === keyId) || null; }
    function buildScale({ keyId, form, type = 'scale', octaves = 1, direction = 'up', clef = 'treble' }) {
        const key = scaleKey(keyId);
        if (!key) throw new Error('Unknown key ' + keyId);
        const minor = key.mode === 'minor';
        if (!minor) form = 'major'; else if (!['harmonic', 'melodic', 'natural'].includes(form)) form = 'harmonic';
        const alters = keyAlters(key);
        const t = parseName(key.tonic);
        const letters = 'CDEFGAB';
        const start = letters.indexOf(t.letter);
        // The bottom note sits on the staff or just under it: at step -2 or above for one octave,
        // -4 or above (two ledger lines) for more, so the top doesn't climb too far.
        const floor = octaves > 1 ? -4 : -2;
        let octave = 0;
        while (Notation.staffStep(t.letter + octave, clef) < floor) octave++;
        const degrees = type === 'arpeggio' ? [0, 2, 4] : [0, 1, 2, 3, 4, 5, 6];
        const pitch = (deg, ascending) => {
            const i = ((deg % 7) + 7) % 7, o = Math.floor(deg / 7);
            const letter = letters[(start + i) % 7];
            const oct = octave + o + Math.floor((start + i) / 7);
            let alter = alters[letter];
            if (minor && i === 6 && (form === 'harmonic' || (form === 'melodic' && ascending))) alter += 1;
            if (minor && i === 5 && form === 'melodic' && ascending) alter += 1;
            return letter + ACC_SUFFIX_ASCII[alter] + oct;
        };
        const up = [];
        for (let o = 0; o < octaves; o++) for (const d of degrees) up.push(o * 7 + d);
        up.push(octaves * 7);
        const asc = up.map(d => pitch(d, true));
        const desc = up.slice().reverse().map(d => pitch(d, false));
        const pitches = direction === 'down' ? desc : direction === 'both' ? asc.concat(desc.slice(1)) : asc;
        return {
            key, form, type, octaves, direction, clef, pitches,
            keySignature: key.count ? { type: key.type, count: key.count } : null,
            title: `${key.tonic.replace('#', '♯').replace(/^([A-G])b$/, '$1♭')} ${SCALE_FORM_LABEL[form]} ${type === 'arpeggio' ? 'arpeggio' : 'scale'}`,
        };
    }
    // Which notes need an accidental written, given the key signature: one that differs from the key
    // signature (or from an earlier accidental on the same line or space in this bar) gets one - a
    // natural sign where it goes back to plain. barLength = notes per bar (accidentals last a bar).
    function writeScale(scale, barLength) {
        const keyAlter = keyAlters(scale.key);
        let inBar = {};
        return scale.pitches.map((p, i) => {
            if (i % barLength === 0) inBar = {};
            const m = /^([A-G])(bb|b|#|x)?(-?\d+)$/.exec(p);
            const alter = { bb: -2, b: -1, '#': 1, x: 2 }[m[2]] || 0;
            const slot = m[1] + m[3];
            const current = slot in inBar ? inBar[slot] : keyAlter[m[1]];
            const show = alter !== current;
            inBar[slot] = alter;
            // A natural sign needs the pitch written with an explicit 'n'.
            return { pitch: show && alter === 0 ? m[1] + 'n' + m[3] : p, accidental: show };
        });
    }
    // "My scales": every key with up to maxSharps sharps / maxFlats flats (set separately), in the
    // chosen forms (major and/or the minor forms) and types (scale and/or arpeggio) - what Next scale
    // picks from.
    function scalePool({ maxSharps = 7, maxFlats = 7, forms = SCALE_FORMS, types = ['scale'] }) {
        const out = [];
        for (const key of ALL_KEYS) {
            if (key.type === 'sharp' && key.count > maxSharps) continue;
            if (key.type === 'flat' && key.count > maxFlats) continue;
            const keyForms = key.mode === 'major' ? ['major'] : ['harmonic', 'melodic', 'natural'];
            for (const form of keyForms.filter(f => forms.includes(f))) for (const type of types) out.push({ keyId: key.id, form, type });
        }
        return out;
    }

    function scaleQuestion(item, rng, naming) {
        const { key, clef, form } = item;
        return {
            id: `scale:${clef}:${key.id}${key.mode === 'minor' ? `:${form}` : ''}`,
            prompt: {
                text: 'Which scale is this?',
                staff: { clef, items: scalePitches(key, clef, form).map(p => ({ type: 'note', pitch: p })), noteGap: 1.2 },
                label: `A scale on the ${clef} staff`,
            },
            layout: 'choices',
            answers: keyAnswers(key, rng, naming, item.includeRelative),
            correct: key.id,
        };
    }

    // ---------------------------------------------------------------- symbols

    // Symbols on a scrap of staff leave the clef off, so there's only one symbol on show. Articulations
    // sit under stem-up notes in the spaces, as engraved. `render` is what the screen hands to Notation.
    // Terms (Italian words) are printed as in music: tempo words bold and upright, the rest italic.
    const on = (items, extra) => ({ type: 'staff', staff: { hideClef: true, clef: 'treble', noteGap: 1.4, items, ...(extra || {}) } });
    const n = (pitch, more) => ({ type: 'note', pitch, ...(more || {}) });
    const q = (pitch, below) => n(pitch, { head: 'noteQuarterUp', below });
    const rest = (glyph, step) => on([{ type: 'mark', glyph, step }], { minWidth: 5 });
    const time = (top, bottom) => on([{ type: 'timeSig', top, bottom }], { minWidth: 6 });
    const word = (text, bold) => ({ type: 'text', text, italic: !bold, bold: !!bold });
    const SYMBOLS = [
        // Basics
        { id: 'trebleClef', set: 'basics', name: 'Treble clef', meaning: 'Sets the higher notes: its curl circles the G line', render: { type: 'symbol', glyph: 'gClef' } },
        { id: 'bassClef', set: 'basics', name: 'Bass clef', meaning: 'Sets the lower notes: its two dots sit either side of the F line', render: { type: 'symbol', glyph: 'fClef' } },
        { id: 'sharp', set: 'basics', name: 'Sharp', meaning: 'Raise the note by a semitone', render: { type: 'symbol', glyph: 'accidentalSharp' } },
        { id: 'flat', set: 'basics', name: 'Flat', meaning: 'Lower the note by a semitone', render: { type: 'symbol', glyph: 'accidentalFlat' } },
        { id: 'natural', set: 'basics', name: 'Natural', meaning: 'Cancel a sharp or flat', render: { type: 'symbol', glyph: 'accidentalNatural' } },
        { id: 'fermata', set: 'basics', name: 'Fermata', meaning: 'Hold the note longer than written', render: on([n('B4', { above: 'fermataAbove' })]) },
        { id: 'breathMark', set: 'basics', name: 'Breath mark', meaning: 'Take a breath here', render: on([n('G4'), { type: 'mark', glyph: 'breathMarkComma', step: 9 }, n('A4')]) },
        { id: 'caesura', set: 'basics', name: 'Caesura', meaning: 'A short silence: stop, then carry on', render: on([n('G4'), { type: 'mark', glyph: 'caesura', step: 6 }, n('A4')]) },
        { id: 'staccato', set: 'basics', name: 'Staccato', meaning: 'Play the note short and detached', render: on([q('F4', 'articStaccatoBelow'), q('A4', 'articStaccatoBelow')]) },
        { id: 'accent', set: 'basics', name: 'Accent', meaning: 'Play the note with extra emphasis', render: on([q('F4', 'articAccentBelow'), q('A4', 'articAccentBelow')]) },
        { id: 'tenuto', set: 'basics', name: 'Tenuto', meaning: 'Hold the note for its full length', render: on([q('F4', 'articTenutoBelow'), q('A4', 'articTenutoBelow')]) },
        { id: 'tie', set: 'basics', name: 'Tie', meaning: 'Join two notes of the same pitch into one longer note', render: on([q('G4'), q('G4')], { spans: [{ kind: 'tie', from: 0, to: 1 }] }) },
        { id: 'slur', set: 'basics', name: 'Slur', meaning: 'Play the notes smoothly, without a gap', render: on([q('E4'), q('F4'), q('A4')], { spans: [{ kind: 'slur', from: 0, to: 2 }] }) },
        // Dynamics
        { id: 'pp', set: 'dynamics', name: 'Pianissimo', meaning: 'Very quiet', render: { type: 'symbol', glyph: 'dynamicPP' } },
        { id: 'p', set: 'dynamics', name: 'Piano', meaning: 'Quiet', render: { type: 'symbol', glyph: 'dynamicPiano' } },
        { id: 'mp', set: 'dynamics', name: 'Mezzo piano', meaning: 'Moderately quiet', render: { type: 'symbol', glyph: 'dynamicMP' } },
        { id: 'mf', set: 'dynamics', name: 'Mezzo forte', meaning: 'Moderately loud', render: { type: 'symbol', glyph: 'dynamicMF' } },
        { id: 'f', set: 'dynamics', name: 'Forte', meaning: 'Loud', render: { type: 'symbol', glyph: 'dynamicForte' } },
        { id: 'ff', set: 'dynamics', name: 'Fortissimo', meaning: 'Very loud', render: { type: 'symbol', glyph: 'dynamicFF' } },
        { id: 'sfz', set: 'dynamics', name: 'Sforzando', meaning: 'A sudden, strong accent on one note', render: { type: 'symbol', glyph: 'dynamicSforzato' } },
        { id: 'crescendo', set: 'dynamics', name: 'Crescendo', meaning: 'Gradually get louder', render: { type: 'hairpin', dir: 'cresc' } },
        { id: 'diminuendo', set: 'dynamics', name: 'Diminuendo', meaning: 'Gradually get quieter', render: { type: 'hairpin', dir: 'dim' } },
        // Rhythm - note lengths in beats of 4/4 (a crotchet beat), as beginners learn them.
        { id: 'semibreve', set: 'rhythm', name: 'Semibreve', meaning: 'A note lasting 4 beats', render: on([n('A4')], { minWidth: 5 }) },
        { id: 'dottedMinim', set: 'rhythm', name: 'Dotted minim', meaning: 'A note lasting 3 beats', render: on([n('A4', { head: 'noteHalfUp', dots: 1 })], { minWidth: 5 }) },
        { id: 'minim', set: 'rhythm', name: 'Minim', meaning: 'A note lasting 2 beats', render: on([n('A4', { head: 'noteHalfUp' })], { minWidth: 5 }) },
        { id: 'crotchet', set: 'rhythm', name: 'Crotchet', meaning: 'A note lasting 1 beat', render: on([n('A4', { head: 'noteQuarterUp' })], { minWidth: 5 }) },
        { id: 'quaver', set: 'rhythm', name: 'Quaver', meaning: 'A note lasting half a beat', render: on([n('A4', { head: 'note8thUp' })], { minWidth: 5 }) },
        { id: 'semiquaver', set: 'rhythm', name: 'Semiquaver', meaning: 'A note lasting a quarter of a beat', render: on([n('A4', { head: 'note16thUp' })], { minWidth: 5 }) },
        { id: 'semibreveRest', set: 'rhythm', name: 'Semibreve rest', meaning: 'A whole bar of silence', render: rest('restWhole', 6) },
        { id: 'minimRest', set: 'rhythm', name: 'Minim rest', meaning: '2 beats of silence', render: rest('restHalf', 4) },
        { id: 'crotchetRest', set: 'rhythm', name: 'Crotchet rest', meaning: '1 beat of silence', render: rest('restQuarter', 4) },
        { id: 'quaverRest', set: 'rhythm', name: 'Quaver rest', meaning: 'Half a beat of silence', render: rest('rest8th', 4) },
        { id: 'semiquaverRest', set: 'rhythm', name: 'Semiquaver rest', meaning: 'A quarter of a beat of silence', render: rest('rest16th', 4) },
        { id: 'time44', set: 'rhythm', name: 'Four-four time', meaning: '4 crotchet beats in a bar', render: time(4, 4) },
        { id: 'time34', set: 'rhythm', name: 'Three-four time', meaning: '3 crotchet beats in a bar', render: time(3, 4) },
        { id: 'time24', set: 'rhythm', name: 'Two-four time', meaning: '2 crotchet beats in a bar', render: time(2, 4) },
        { id: 'time68', set: 'rhythm', name: 'Six-eight time', meaning: '6 quavers in a bar, felt as 2 beats', render: time(6, 8) },
        { id: 'commonTime', set: 'rhythm', name: 'Common time', meaning: 'Another way of writing 4/4', render: on([{ type: 'timeSig', glyph: 'timeSigCommon' }], { minWidth: 6 }) },
        { id: 'cutTime', set: 'rhythm', name: 'Cut common time', meaning: '2 minim beats in a bar (2/2)', render: on([{ type: 'timeSig', glyph: 'timeSigCutCommon' }], { minWidth: 6 }) },
        // Structure
        { id: 'startRepeat', set: 'structure', name: 'Start repeat', meaning: 'The repeated section starts here', render: on([{ type: 'barline', glyph: 'repeatLeft' }, n('G4'), n('A4')]) },
        { id: 'endRepeat', set: 'structure', name: 'End repeat', meaning: 'Go back to the start repeat (or the beginning) and play again', render: on([n('G4'), n('A4'), { type: 'barline', glyph: 'repeatRight' }]) },
        { id: 'doubleBar', set: 'structure', name: 'Double bar line', meaning: 'The end of a section', render: on([n('G4'), n('A4'), { type: 'barline', glyph: 'barlineDouble' }]) },
        { id: 'finalBarline', set: 'structure', name: 'Final bar line', meaning: 'The end of the piece', render: on([n('G4'), n('A4'), { type: 'barline', glyph: 'barlineFinal' }]) },
        { id: 'segno', set: 'structure', name: 'Segno', meaning: 'The sign that D.S. sends you back to', render: { type: 'symbol', glyph: 'segno' } },
        { id: 'coda', set: 'structure', name: 'Coda', meaning: 'Jump to the ending section marked with this sign', render: { type: 'symbol', glyph: 'coda' } },
        { id: 'daCapo', set: 'structure', name: 'Da capo (D.C.)', meaning: 'Go back to the beginning', render: { type: 'symbol', glyph: 'daCapo' } },
        { id: 'dalSegno', set: 'structure', name: 'Dal segno (D.S.)', meaning: 'Go back to the sign', render: { type: 'symbol', glyph: 'dalSegno' } },
        { id: 'fine', set: 'structure', name: 'Fine', meaning: 'The end: stop here after a D.C. or D.S.', render: word('Fine') },
        { id: 'firstTimeBar', set: 'structure', name: '1st time bar', meaning: 'Play this bar the first time only; skip it on the repeat', render: on([n('G4'), n('A4'), { type: 'barline', glyph: 'barlineSingle' }], { spans: [{ kind: 'volta', from: 0, to: 2, text: '1.' }] }) },
        { id: 'introBrackets', set: 'structure', name: 'Intro brackets', meaning: 'The bars to play as the introduction', render: on([n('G4'), n('A4'), { type: 'barline', glyph: 'barlineSingle' }, n('B4'), n('C5')], { spans: [{ kind: 'intro', from: 0, to: 4 }] }) },
        // Terms - the word is the symbol, so "name" questions ask what it means, and "meaning"
        // questions show the meaning and ask for the word.
        { id: 'largo', set: 'terms', name: 'Largo', meaning: 'Very slow and broad', render: word('Largo', true) },
        { id: 'adagio', set: 'terms', name: 'Adagio', meaning: 'Slow', render: word('Adagio', true) },
        { id: 'andante', set: 'terms', name: 'Andante', meaning: 'At a walking pace', render: word('Andante', true) },
        { id: 'moderato', set: 'terms', name: 'Moderato', meaning: 'At a moderate speed', render: word('Moderato', true) },
        { id: 'allegro', set: 'terms', name: 'Allegro', meaning: 'Fast and lively', render: word('Allegro', true) },
        { id: 'presto', set: 'terms', name: 'Presto', meaning: 'Very fast', render: word('Presto', true) },
        { id: 'rit', set: 'terms', name: 'rit.', meaning: 'Gradually slow down (ritardando)', render: word('rit.') },
        { id: 'accel', set: 'terms', name: 'accel.', meaning: 'Gradually speed up (accelerando)', render: word('accel.') },
        { id: 'aTempo', set: 'terms', name: 'a tempo', meaning: 'Back to the original speed', render: word('a tempo') },
        { id: 'legato', set: 'terms', name: 'legato', meaning: 'Smoothly, with no gaps between notes', render: word('legato') },
        { id: 'dolce', set: 'terms', name: 'dolce', meaning: 'Sweetly', render: word('dolce') },
        { id: 'cantabile', set: 'terms', name: 'cantabile', meaning: 'In a singing style', render: word('cantabile') },
        { id: 'sempre', set: 'terms', name: 'sempre', meaning: 'Always', render: word('sempre') },
        { id: 'pocoAPoco', set: 'terms', name: 'poco a poco', meaning: 'Little by little', render: word('poco a poco') },
        { id: 'molto', set: 'terms', name: 'molto', meaning: 'Very, much', render: word('molto') },

        // ---- Theory grades only (ML-309, gradeOnly: not in the custom sets, so custom rounds and their
        // personal bests are unchanged). A draft for review on Admin -> Theory grades.
        { id: 'altoClef', set: 'basics', grade: 4, gradeOnly: true, name: 'Alto clef', meaning: 'A C clef: middle C is the middle line', render: { type: 'staff', staff: { clef: 'alto', noteGap: 1.4, items: [n('C4')], minWidth: 8 } } },
        { id: 'tenorClef', set: 'basics', grade: 5, gradeOnly: true, name: 'Tenor clef', meaning: 'A C clef: middle C is the 4th line up', render: { type: 'staff', staff: { clef: 'tenor', noteGap: 1.4, items: [n('C4')], minWidth: 8 } } },
        { id: 'doubleSharp', set: 'basics', grade: 4, gradeOnly: true, name: 'Double sharp', meaning: 'Raise the note by two semitones', render: { type: 'symbol', glyph: 'accidentalDoubleSharp' } },
        { id: 'doubleFlat', set: 'basics', grade: 4, gradeOnly: true, name: 'Double flat', meaning: 'Lower the note by two semitones', render: { type: 'symbol', glyph: 'accidentalDoubleFlat' } },
        { id: 'trill', set: 'basics', grade: 4, gradeOnly: true, name: 'Trill', meaning: 'Alternate quickly between the note and the note above', render: { type: 'symbol', glyph: 'ornamentTrill' } },
        { id: 'turn', set: 'basics', grade: 4, gradeOnly: true, name: 'Turn', meaning: 'Play the note above, the note, the note below, then the note', render: { type: 'symbol', glyph: 'ornamentTurn' } },
        { id: 'upperMordent', set: 'basics', grade: 4, gradeOnly: true, name: 'Upper mordent', meaning: 'Quickly play the note, the note above, then the note again', render: { type: 'symbol', glyph: 'ornamentShortTrill' } },
        { id: 'lowerMordent', set: 'basics', grade: 4, gradeOnly: true, name: 'Lower mordent', meaning: 'Quickly play the note, the note below, then the note again', render: { type: 'symbol', glyph: 'ornamentMordent' } },
        { id: 'acciaccatura', set: 'basics', grade: 4, gradeOnly: true, name: 'Acciaccatura', meaning: 'A crushed grace note, played as quickly as possible', render: { type: 'symbol', glyph: 'graceNoteAcciaccaturaStemUp' } },
        { id: 'appoggiatura', set: 'basics', grade: 4, gradeOnly: true, name: 'Appoggiatura', meaning: 'A leaning grace note that takes time from the main note', render: { type: 'symbol', glyph: 'graceNoteAppoggiaturaStemUp' } },
        { id: 'time22', set: 'rhythm', grade: 2, gradeOnly: true, name: 'Two-two time', meaning: '2 minim beats in a bar', render: time(2, 2) },
        { id: 'time32', set: 'rhythm', grade: 2, gradeOnly: true, name: 'Three-two time', meaning: '3 minim beats in a bar', render: time(3, 2) },
        { id: 'time42', set: 'rhythm', grade: 2, gradeOnly: true, name: 'Four-two time', meaning: '4 minim beats in a bar', render: time(4, 2) },
        { id: 'time38', set: 'rhythm', grade: 3, gradeOnly: true, name: 'Three-eight time', meaning: '3 quavers in a bar, felt as 1 beat', render: time(3, 8) },
        { id: 'time98', set: 'rhythm', grade: 3, gradeOnly: true, name: 'Nine-eight time', meaning: '9 quavers in a bar, felt as 3 beats', render: time(9, 8) },
        { id: 'time128', set: 'rhythm', grade: 3, gradeOnly: true, name: 'Twelve-eight time', meaning: '12 quavers in a bar, felt as 4 beats', render: time(12, 8) },
        { id: 'time64', set: 'rhythm', grade: 3, gradeOnly: true, name: 'Six-four time', meaning: '6 crotchets in a bar, felt as 2 beats', render: time(6, 4) },
        { id: 'time54', set: 'rhythm', grade: 5, gradeOnly: true, name: 'Five-four time', meaning: '5 crotchet beats in a bar', render: time(5, 4) },
        { id: 'time78', set: 'rhythm', grade: 5, gradeOnly: true, name: 'Seven-eight time', meaning: '7 quavers in a bar, in uneven groups', render: time(7, 8) },
        { id: 'demisemiquaver', set: 'rhythm', grade: 3, gradeOnly: true, name: 'Demisemiquaver', meaning: 'A note lasting an eighth of a beat', render: on([n('A4', { head: 'note32ndUp' })], { minWidth: 5 }) },
        { id: 'demisemiquaverRest', set: 'rhythm', grade: 3, gradeOnly: true, name: 'Demisemiquaver rest', meaning: 'An eighth of a beat of silence', render: rest('rest32nd', 4) },
        { id: 'breve', set: 'rhythm', grade: 4, gradeOnly: true, name: 'Breve', meaning: 'A note lasting 8 beats (two semibreves)', render: on([n('A4', { head: 'noteDoubleWhole' })], { minWidth: 5 }) },
        { id: 'dcAlFine', set: 'structure', grade: 2, gradeOnly: true, name: 'D.C. al Fine', meaning: 'Go back to the beginning and play up to Fine', render: word('D.C. al Fine') },
        { id: 'dsAlCoda', set: 'structure', grade: 3, gradeOnly: true, name: 'D.S. al Coda', meaning: 'Go back to the sign, then jump to the coda at "To Coda"', render: word('D.S. al Coda') },
        // Terms, grade by grade.
        ...[
            [1, 'allegretto', 'allegretto', 'Fairly quick (not as quick as allegro)', true],
            [1, 'lento', 'lento', 'Slow (often a little slower than adagio)', true],
            [1, 'rall', 'rall.', 'Gradually getting slower (rallentando)'],
            [1, 'riten', 'riten.', 'Held back: slower at once (ritenuto)'],
            [1, 'decresc', 'decresc.', 'Gradually getting quieter (decrescendo)'],
            [1, 'cresc', 'cresc.', 'Gradually getting louder (crescendo)'],
            [1, 'mezzo', 'mezzo', 'Half, moderately'],
            [2, 'grazioso', 'grazioso', 'Gracefully'],
            [2, 'vivace', 'vivace', 'Lively, quick', true],
            [2, 'prestissimo', 'prestissimo', 'As fast as possible', true],
            [2, 'meno', 'meno', 'Less'],
            [2, 'piu', 'più', 'More'],
            [2, 'poco', 'poco', 'A little'],
            [2, 'con', 'con', 'With'],
            [2, 'moto', 'moto', 'Movement'],
            [2, 'ma', 'ma', 'But'],
            [3, 'maNonTroppo', 'ma non troppo', 'But not too much'],
            [3, 'sostenuto', 'sostenuto', 'Sustained'],
            [3, 'tranquillo', 'tranquillo', 'Calm'],
            [3, 'espressivo', 'espressivo', 'Expressively'],
            [3, 'giocoso', 'giocoso', 'Playful, merry'],
            [3, 'leggiero', 'leggiero', 'Lightly, nimbly'],
            [3, 'maestoso', 'maestoso', 'Majestically'],
            [3, 'senza', 'senza', 'Without'],
            [3, 'mosso', 'mosso', 'With movement'],
            [3, 'assai', 'assai', 'Very'],
            [3, 'sottoVoce', 'sotto voce', 'In an undertone, quietly'],
            [3, 'simile', 'sim.', 'In the same way (simile)'],
            [4, 'animato', 'animato', 'Animated, lively'],
            [4, 'brillante', 'brillante', 'Brilliantly'],
            [4, 'comodo', 'comodo', 'At a comfortable speed'],
            [4, 'deciso', 'deciso', 'With determination'],
            [4, 'energico', 'energico', 'Energetically'],
            [4, 'graveTerm', 'grave', 'Very slow, solemn', true],
            [4, 'largamente', 'largamente', 'Broadly'],
            [4, 'marcato', 'marcato', 'Emphatic, accented'],
            [4, 'pesante', 'pesante', 'Heavily'],
            [4, 'risoluto', 'risoluto', 'Boldly, strongly'],
            [4, 'scherzando', 'scherzando', 'Playfully, jokingly'],
            [4, 'semplice', 'semplice', 'Simply'],
            [4, 'subito', 'subito', 'Suddenly'],
            [4, 'vivo', 'vivo', 'Very lively, brisk'],
            [4, 'attacca', 'attacca', 'Go straight on to the next section'],
            [5, 'affettuoso', 'affettuoso', 'With feeling, affectionately'],
            [5, 'agitato', 'agitato', 'Agitated'],
            [5, 'allargando', 'allargando', 'Broadening out, often getting slower and louder'],
            [5, 'calando', 'calando', 'Getting softer and slower, dying away'],
            [5, 'conForza', 'con forza', 'With force'],
            [5, 'morendo', 'morendo', 'Dying away'],
            [5, 'smorzando', 'smorzando', 'Dying away in tone and speed'],
            [5, 'stringendo', 'stringendo', 'Gradually getting faster'],
            [5, 'rubato', 'rubato', 'With some freedom of time'],
            [5, 'tempoPrimo', 'tempo primo', 'Back to the first speed'],
            [5, 'teneramente', 'teneramente', 'Tenderly, gently'],
            [5, 'nobilmente', 'nobilmente', 'Nobly'],
        ].map(([grade, id, name, meaning, tempo]) => ({ id, set: 'terms', grade, gradeOnly: true, name, meaning, render: word(name, !!tempo) })),
    ];
    // The Theory grade each of the original symbols belongs to (ML-309; the grade-only ones above carry
    // their own). Not listed = not in any grade (intro brackets are a band thing, not in the syllabus).
    const SYMBOL_GRADE = {
        trebleClef: 1, bassClef: 1, sharp: 1, flat: 1, natural: 1, fermata: 1, breathMark: 1, staccato: 1, accent: 1, tie: 1, slur: 1, tenuto: 2, caesura: 3,
        pp: 1, p: 1, mp: 1, mf: 1, f: 1, ff: 1, crescendo: 1, diminuendo: 1, sfz: 2,
        semibreve: 1, dottedMinim: 1, minim: 1, crotchet: 1, quaver: 1, semiquaver: 1, semibreveRest: 1, minimRest: 1, crotchetRest: 1, quaverRest: 1, semiquaverRest: 1,
        time44: 1, time34: 1, time24: 1, commonTime: 1, cutTime: 2, time68: 3,
        startRepeat: 1, endRepeat: 1, doubleBar: 1, finalBarline: 1, daCapo: 1, fine: 1, dalSegno: 2, segno: 2, firstTimeBar: 2, coda: 3,
        adagio: 1, allegro: 1, andante: 1, moderato: 1, rit: 1, accel: 1, aTempo: 1, legato: 1, dolce: 1, cantabile: 1, largo: 2, presto: 2, sempre: 2, molto: 2, pocoAPoco: 2,
    };
    for (const sym of SYMBOLS) if (SYMBOL_GRADE[sym.id]) sym.grade = SYMBOL_GRADE[sym.id];
    const SET_IDS = ['basics', 'dynamics', 'rhythm', 'structure', 'terms', 'speeds'];
    // A set list is the custom sets (grade-only symbols left out), or ['grade:N'] - every symbol up to Grade N.
    const symbolsIn = (sets) => {
        const g = sets.length === 1 && /^grade:\d$/.test(sets[0]) ? Number(sets[0].slice(6)) : 0;
        if (g) return SYMBOLS.filter(s => s.grade && s.grade <= g);
        return SYMBOLS.filter(s => !s.gradeOnly && (sets.includes('everything') || sets.includes(s.set)));
    };
    function symbolItems(sets, ask) {
        const out = [];
        for (const sym of symbolsIn(sets)) {
            if (ask !== 'meanings') out.push({ type: 'symbolName', sym, sets });
            if (ask !== 'names') out.push({ type: 'symbolMeaning', sym, sets });
        }
        // Speeds (ML-297): "names" is a bpm -> its speed name, "meanings" a speed name -> its bpm band.
        if (sets.includes('everything') || sets.includes('speeds')) {
            for (const speed of SPEEDS) {
                if (ask !== 'meanings') out.push({ type: 'speedName', speed });
                if (ask !== 'names') out.push({ type: 'speedBpm', speed });
            }
        }
        return out;
    }

    // ---------------------------------------------------------------- speeds (ML-297)

    // The Italian speed names, each a band of the app's 15-200 bpm range. Some bands have two names
    // for much the same speed (Grave or Largo): either is right, and a question never shows both.
    // speedFor(bpm) is also what every tempo box shows under its bpm.
    const SPEEDS = [
        { id: 'grave', names: ['Grave', 'Largo'], min: 15, max: 55, meaning: 'Very slow, solemn' },
        { id: 'adagio', names: ['Adagio', 'Lento'], min: 56, max: 75, meaning: 'Slow, at ease' },
        { id: 'andante', names: ['Andante'], min: 76, max: 107, meaning: 'At a walking pace' },
        { id: 'moderato', names: ['Moderato'], min: 108, max: 119, meaning: 'At a moderate speed' },
        { id: 'allegro', names: ['Allegro'], min: 120, max: 155, meaning: 'Fast, lively' },
        { id: 'vivace', names: ['Vivace'], min: 156, max: 175, meaning: 'Quick and spirited' },
        { id: 'presto', names: ['Presto', 'Prestissimo'], min: 176, max: 200, meaning: 'Very fast' },
    ];
    const speedFor = (bpm) => SPEEDS.find(s => bpm <= s.max) || SPEEDS[SPEEDS.length - 1];
    const speedLabel = (bpm) => speedFor(Number(bpm) || 0).names.join(' / ');
    const bandLabel = (s) => `${s.min}-${s.max}${s.max === 200 ? '+' : ''} bpm`;
    // Wrong answers are the neighbouring bands first (Moderato is confused with Andante and Allegro,
    // not with Grave), then the next ones out.
    function speedChoices(correct, rng) {
        const i = SPEEDS.indexOf(correct);
        const others = rng.shuffle(SPEEDS.filter(s => s !== correct)).sort((a, b) => Math.abs(SPEEDS.indexOf(a) - i) - Math.abs(SPEEDS.indexOf(b) - i));
        return [correct, ...others.slice(0, 3)].sort((x, y) => SPEEDS.indexOf(x) - SPEEDS.indexOf(y)); // slow to fast, like a scale
    }
    // A bpm inside the band, a round number where the band allows (it's what a score would print).
    function speedBpmIn(s, rng) {
        const round5 = [];
        for (let b = Math.ceil(s.min / 5) * 5; b <= s.max; b += 5) round5.push(b);
        return round5.length ? rng.pick(round5) : s.min + rng.int(s.max - s.min + 1);
    }
    const pickName = (s, rng) => rng.pick(s.names);
    function speedNameQuestion(item, rng) {
        const { speed } = item;
        const bpm = speedBpmIn(speed, rng);
        return {
            id: `speedName:${speed.id}`,
            prompt: { text: 'Which speed is this?', render: { type: 'tempo', bpm }, label: `Crotchet equals ${bpm}` },
            layout: 'choices',
            answers: speedChoices(speed, rng).map(s => ({ id: s.id, label: pickName(s, rng) })),
            correct: speed.id,
        };
    }
    function speedBpmQuestion(item, rng) {
        const { speed } = item;
        const name = pickName(speed, rng);
        return {
            id: `speedBpm:${speed.id}`,
            prompt: { text: 'About how fast is this?', render: word(name, true), label: name },
            layout: 'choices',
            answers: speedChoices(speed, rng).map(s => ({ id: s.id, label: bandLabel(s) })),
            correct: speed.id,
        };
    }
    // Wrong answers from the same set as the right one first (terms with terms, rests with rests...),
    // then the rest of the chosen sets, then anything.
    function symbolChoices(correct, sets, rng) {
        const pool = symbolsIn(sets);
        const same = rng.shuffle(pool.filter(s => s.id !== correct.id && s.set === correct.set));
        const chosen = rng.shuffle(pool.filter(s => s.id !== correct.id && s.set !== correct.set));
        // Custom rounds never see the grade-only symbols (ML-309) - not even as filler - so their
        // rounds stay exactly as before; a grade round's filler is other graded symbols.
        const graded = sets.length === 1 && /^grade:/.test(sets[0]);
        const universe = SYMBOLS.filter(s => (graded ? s.grade : !s.gradeOnly));
        const rest = rng.shuffle(universe.filter(s => s.id !== correct.id && !pool.includes(s)));
        return rng.shuffle([correct, ...same.concat(chosen, rest).slice(0, 3)]);
    }
    function symbolNameQuestion(item, rng) {
        const { sym } = item;
        const term = sym.set === 'terms';
        const choices = symbolChoices(sym, item.sets, rng);
        return {
            id: `symbolName:${sym.id}`,
            prompt: { text: term ? 'What does this mean?' : 'What is this called?', render: sym.render, label: term ? sym.name : 'A music symbol' },
            layout: 'choices',
            answers: choices.map(s => ({ id: s.id, label: term ? s.meaning : s.name })),
            correct: sym.id,
        };
    }
    function symbolMeaningQuestion(item, rng) {
        const { sym } = item;
        return {
            id: `symbolMeaning:${sym.id}`,
            prompt: { text: sym.set === 'terms' ? 'Which term means…' : 'Which symbol means…', meaning: sym.meaning },
            layout: 'symbols',
            // The symbol's name is its accessible label - for a screen reader this becomes a
            // meaning-to-name question, which still teaches the same thing.
            answers: symbolChoices(sym, item.sets, rng).map(s => ({ id: s.id, label: s.name, render: s.render })),
            correct: sym.id,
        };
    }

    // ---------------------------------------------------------------- intervals, chords, degrees, chromatic (ML-309 C)

    // Grade-only question types (the Intervals and Chords quizzes, and Keys / Mixed at a grade): what the
    // ABRSM Grades 2-5 syllabus asks about intervals, technical names, the chromatic scale, triads,
    // inversions and cadences. Written only (no sound). Pitches are spelled strings, as everywhere here.
    const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const LETTER_ORDER = 'CDEFGAB';
    const semisOf = (pitch) => { const p = Notation.parsePitch(pitch); return p.octave * 12 + SEMI[p.letter] + p.alter; };
    const pitchName = (letter, alter, octave) => letter + ACC_SUFFIX_ASCII[alter] + octave;
    // The note `steps` letters above (0 = the same letter), `semis` semitones above - or null if that
    // needs more than a double sharp or flat.
    function noteAbove(pitch, steps, semis) {
        const p = Notation.parsePitch(pitch);
        const d = LETTER_ORDER.indexOf(p.letter) + steps;
        const letter = LETTER_ORDER[((d % 7) + 7) % 7], octave = p.octave + Math.floor(d / 7);
        const alter = semisOf(pitch) + semis - (octave * 12 + SEMI[letter]);
        return Math.abs(alter) <= 2 ? pitchName(letter, alter, octave) : null;
    }
    // The lowest octave that puts this letter at or above a staff step (the bottom note of a question).
    function placeAt(letter, alter, clef, floor) {
        let octave = 0;
        while (Notation.staffStep(letter + octave, clef) < floor) octave++;
        return pitchName(letter, alter, octave);
    }

    // --- Intervals. Size in semitones of a major/perfect interval of each simple number (8 = octave). ---
    const INTERVAL_BASE = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };
    const PERFECT_TYPE = [1, 4, 5];
    const QUALITY_SHIFT = { perfect: { dim: -1, perfect: 0, aug: 1 }, major: { dim: -2, minor: -1, major: 0, aug: 1 } };
    const QUALITY_LABEL = { perfect: 'perfect', major: 'major', minor: 'minor', aug: 'augmented', dim: 'diminished' };
    const ordinal = (n) => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
    const simpleOf = (number) => ((number - 1) % 7) + 1;
    const qualityType = (number) => (PERFECT_TYPE.includes(simpleOf(number)) ? 'perfect' : 'major');
    const intervalSemis = (quality, number) => INTERVAL_BASE[simpleOf(number)] + 12 * Math.floor((number - 1) / 7) + QUALITY_SHIFT[qualityType(number)][quality];
    // { quality, number } between two spelled notes (low first), or null if it isn't one of the five qualities.
    function intervalBetween(low, high) {
        const number = Notation.diatonic(high) - Notation.diatonic(low) + 1;
        if (number < 1) return null;
        const shift = semisOf(high) - semisOf(low) - (intervalSemis(qualityType(number) === 'perfect' ? 'perfect' : 'major', number));
        const quality = Object.keys(QUALITY_SHIFT[qualityType(number)]).find(q => QUALITY_SHIFT[qualityType(number)][q] === shift);
        return quality ? { quality, number } : null;
    }
    // "Major 3rd", "Perfect octave", "Compound minor 6th" (Grade 5 names compound intervals this way).
    function intervalLabel(quality, number) {
        const q = QUALITY_LABEL[quality];
        const cap = (s) => s[0].toUpperCase() + s.slice(1);
        if (number > 8) return `Compound ${q} ${number === 15 ? 'octave' : ordinal(simpleOf(number))}`;
        return cap(`${q} ${number === 8 ? 'octave' : ordinal(number)}`);
    }
    const intervalId = (quality, number) => quality + number;
    const numberLabel = (number) => (number === 8 ? 'Octave' : ordinal(number));
    // The intervals Grade 4 (simple, within an octave) and Grade 5 (compound, up to two octaves less a
    // 2nd) ask between any two notes. Augmented and diminished only where exam papers use them.
    const SIMPLE_INTERVALS = [['minor', 2], ['major', 2], ['aug', 2], ['minor', 3], ['major', 3], ['dim', 4], ['perfect', 4], ['aug', 4], ['dim', 5], ['perfect', 5], ['aug', 5], ['minor', 6], ['major', 6], ['aug', 6], ['dim', 7], ['minor', 7], ['major', 7], ['perfect', 8]];
    const COMPOUND_INTERVALS = [['minor', 9], ['major', 9], ['minor', 10], ['major', 10], ['perfect', 11], ['aug', 11], ['dim', 12], ['perfect', 12], ['minor', 13], ['major', 13], ['minor', 14], ['major', 14]];
    // The bottom notes of "any two notes": the 17 keyboard spellings the note-name quizzes use.
    const LOW_NAMES = [...NOTE_BUTTONS.none, 'C#', 'D#', 'F#', 'G#', 'A#', 'Db', 'Eb', 'Gb', 'Ab', 'Bb'];
    // One staff height for every interval question (a compound interval climbs three ledger lines).
    const INTERVAL_STEPS = [-5, 16];

    // Above the tonic of a key (Grades 2 and 3): the scale's notes - in a minor key the harmonic and
    // melodic forms' (minor 3rd and 6th, major 6th and 7th).
    function tonicIntervals(key, clef) {
        const tonic = placeAt(parseName(key.tonic).letter, parseName(key.tonic).alter, clef, -2);
        const list = key.mode === 'major'
            ? [['major', 2], ['major', 3], ['perfect', 4], ['perfect', 5], ['major', 6], ['major', 7], ['perfect', 8]]
            : [['major', 2], ['minor', 3], ['perfect', 4], ['perfect', 5], ['minor', 6], ['major', 6], ['major', 7], ['perfect', 8]];
        return list.map(([q, n]) => [tonic, noteAbove(tonic, n - 1, intervalSemis(q, n))]).filter(([, h]) => h);
    }
    // grade: 2 = number only above the tonic of the major keys; 3 = number and quality above the tonic;
    // 4 = + any two notes within an octave; 5 = + compound. keyIds: the grade's keys.
    function intervalItems(clefs, grade, keyIds) {
        const out = [], seen = new Set();
        const add = (it) => { const id = itemKey(it); if (!seen.has(id)) { seen.add(id); out.push(it); } };
        const keys = ALL_KEYS.filter(k => keyIds.includes(k.id) && (grade > 2 || k.mode === 'major'));
        for (const clef of clefs) {
            for (const key of keys) for (const [low, high] of tonicIntervals(key, clef)) add({ type: grade === 2 ? 'intervalNumber' : 'interval', clef, low, high, wide: grade >= 4 });
            if (grade < 4) continue;
            const lists = [[SIMPLE_INTERVALS, -2], ...(grade >= 5 ? [[COMPOUND_INTERVALS, -4]] : [])];
            for (const [list, floor] of lists) for (const name of LOW_NAMES) {
                const p = parseName(name);
                const low = placeAt(p.letter, p.alter, clef, floor);
                for (const [q, n] of list) {
                    const high = noteAbove(low, n - 1, intervalSemis(q, n));
                    if (high) add({ type: 'interval', clef, low, high, wide: true });
                }
            }
        }
        return out;
    }
    // Two notes, drawn one after the other (melodic) or together (harmonic) - either, at random: the
    // question is the same.
    function intervalStaff(item, rng) {
        const items = rng() < 0.5 ? [{ type: 'chord', notes: [{ pitch: item.low }, { pitch: item.high }] }] : [{ type: 'note', pitch: item.low }, { type: 'note', pitch: item.high }];
        return { clef: item.clef, items, stepRange: INTERVAL_STEPS, minWidth: 12 };
    }
    function intervalNumberQuestion(item, rng) {
        const { number } = intervalBetween(item.low, item.high);
        const others = rng.shuffle([2, 3, 4, 5, 6, 7, 8].filter(x => x !== number)).sort((a, b) => Math.abs(a - number) - Math.abs(b - number));
        return {
            id: `intervalNumber:${item.clef}:${item.low}:${item.high}`,
            prompt: { text: 'What is the number of this interval?', staff: intervalStaff(item, rng), label: `Two notes on the ${item.clef} staff` },
            layout: 'choices',
            answers: [number, ...others.slice(0, 3)].sort((a, b) => a - b).map(x => ({ id: String(x), label: numberLabel(x) })),
            correct: String(number),
        };
    }
    // Wrong answers are the nearest intervals in size (a minor 3rd for a major 3rd, a perfect 4th...),
    // augmented and diminished only from Grade 4 (item.wide) - so a Grade 3 round never offers a name
    // the grade hasn't taught.
    function intervalQuestion(item, rng) {
        const iv = intervalBetween(item.low, item.high);
        const size = intervalSemis(iv.quality, iv.number);
        const pool = [];
        for (let n = Math.max(2, iv.number - 2); n <= Math.min(15, iv.number + 2); n++) {
            for (const q of Object.keys(QUALITY_SHIFT[qualityType(n)])) {
                if (n === iv.number && q === iv.quality) continue;
                if (!item.wide && (q === 'aug' || q === 'dim')) continue;
                if ((n > 8) !== (iv.number > 8) && n !== 8) continue; // compound with compound (the octave sits between)
                pool.push({ quality: q, number: n, size: intervalSemis(q, n) });
            }
        }
        const others = rng.shuffle(pool).sort((a, b) => Math.abs(a.size - size) - Math.abs(b.size - size)).slice(0, 3);
        const answers = [{ ...iv, size }, ...others].sort((a, b) => a.size - b.size || a.number - b.number);
        return {
            id: `interval:${item.clef}:${item.low}:${item.high}`,
            prompt: { text: 'Which interval is this?', staff: intervalStaff(item, rng), label: `Two notes on the ${item.clef} staff` },
            layout: 'choices',
            answers: answers.map(a => ({ id: intervalId(a.quality, a.number), label: intervalLabel(a.quality, a.number) })),
            correct: intervalId(iv.quality, iv.number),
        };
    }

    // --- Technical names of the scale degrees (Grade 4). A minor key's 7th is the raised leading note. ---
    const DEGREE_NAMES = ['Tonic', 'Supertonic', 'Mediant', 'Subdominant', 'Dominant', 'Submediant', 'Leading note'];
    // The key's own note at a degree (1-7), written against the key signature.
    function keyNote(key, pitch) {
        const alters = keyAlters(key);
        const p = Notation.parsePitch(pitch);
        const show = p.alter !== alters[p.letter];
        return { pitch: show && p.alter === 0 ? `${p.letter}n${p.octave}` : pitch, accidental: show };
    }
    function degreeItems(clefs, keyIds) {
        const out = [];
        for (const clef of clefs) for (const key of ALL_KEYS.filter(k => keyIds.includes(k.id))) {
            for (let degree = 1; degree <= 7; degree++) out.push({ type: 'degree', clef, key, degree });
        }
        return out;
    }
    function degreeQuestion(item, rng, naming) {
        const { key, clef, degree } = item;
        const note = keyNote(key, scalePitches(key, clef, 'harmonic')[degree - 1]);
        const others = rng.shuffle([1, 2, 3, 4, 5, 6, 7].filter(d => d !== degree)).sort((a, b) => Math.abs(a - degree) - Math.abs(b - degree));
        return {
            id: `degree:${clef}:${key.id}:${degree}`,
            prompt: {
                text: `Which degree of ${keyLabel(key, naming)} is this?`,
                staff: { clef, keySignature: key.count ? { type: key.type, count: key.count } : null, items: [{ type: 'note', ...note }], stepRange: [-3, 11], minWidth: 14 },
                label: `A note in ${keyLabel(key, naming)}, ${clef} clef`,
            },
            layout: 'choices',
            answers: [degree, ...others.slice(0, 3)].sort((a, b) => a - b).map(d => ({ id: `deg${d}`, label: DEGREE_NAMES[d - 1] })),
            correct: `deg${degree}`,
        };
    }

    // --- The chromatic scale (Grade 4): is it written correctly? Every letter used once or twice (the
    // tonic's letter once, plus the octave), in order, a semitone at a time. The right version is the
    // harmonic chromatic scale (tonic and dominant once, every other letter twice); a wrong one respells
    // one note so a letter is used three times, or skipped.
    const CHROMATIC_STEPS = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7]; // letters above the tonic, note by note
    function chromaticScale(tonicName, clef) {
        const t = parseName(tonicName);
        const tonic = placeAt(t.letter, t.alter, clef, -2);
        const out = CHROMATIC_STEPS.map((steps, i) => noteAbove(tonic, steps, i));
        return out.every(p => p && Math.abs(Notation.parsePitch(p).alter) <= 1) ? out : null;
    }
    // Why a spelling breaks the rule (null = it's right).
    function chromaticFault(pitches) {
        const letters = pitches.slice(0, 12).map(p => Notation.parsePitch(p).letter);
        for (const l of LETTER_ORDER) {
            const n = letters.filter(x => x === l).length;
            if (n > 2) return `${l} is used ${n} times`;
            if (n === 0) return `there is no ${l}`;
        }
        return null;
    }
    // Every single-note respelling (to the letter above or below, one sharp or flat at most) that breaks
    // the rule - in a fixed order, so an id can name one by its index.
    function chromaticMistakes(pitches) {
        const out = [];
        for (let i = 1; i < 12; i++) for (const dir of [1, -1]) {
            const p = noteAbove(pitches[i], dir, 0);
            if (!p || Math.abs(Notation.parsePitch(p).alter) > 1) continue;
            const wrong = pitches.slice();
            wrong[i] = p;
            if (chromaticFault(wrong)) out.push(wrong);
        }
        return out;
    }
    // The tonics: the Grade 4 major keys whose harmonic chromatic scale needs no double sharps or flats.
    function chromaticItems(clefs, keyIds) {
        const out = [];
        for (const clef of clefs) for (const key of ALL_KEYS.filter(k => k.mode === 'major' && keyIds.includes(k.id))) {
            const right = chromaticScale(key.tonic, clef);
            if (!right) continue;
            const wrongs = chromaticMistakes(right);
            out.push({ type: 'chromatic', clef, tonic: key.tonic, variant: 'ok' });
            // One wrong version per tonic and clef, so a round is about half right, half wrong.
            if (wrongs.length) out.push({ type: 'chromatic', clef, tonic: key.tonic, variant: (key.count * 7 + clef.length) % wrongs.length });
        }
        return out;
    }
    // Written as one bar: an accidental lasts to the end, and a note going back to plain gets a natural.
    function writeAccidentals(pitches) {
        const inBar = {};
        return pitches.map((pitch) => {
            const p = Notation.parsePitch(pitch);
            const slot = p.letter + p.octave;
            const show = p.alter !== (inBar[slot] || 0);
            inBar[slot] = p.alter;
            return { type: 'note', head: 'noteheadBlack', pitch: show && p.alter === 0 ? `${p.letter}n${p.octave}` : pitch, accidental: show };
        });
    }
    function chromaticQuestion(item) {
        const right = chromaticScale(item.tonic, item.clef);
        const pitches = item.variant === 'ok' ? right : chromaticMistakes(right)[item.variant];
        const fault = chromaticFault(pitches);
        return {
            id: `chromatic:${item.clef}:${item.tonic}:${item.variant}`,
            prompt: {
                text: 'Is this chromatic scale written correctly?',
                staff: { clef: item.clef, items: writeAccidentals(pitches), noteGap: 0.9, stepRange: [-3, 11] },
                label: `A chromatic scale on the ${item.clef} staff`,
            },
            layout: 'choices',
            answers: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }],
            correct: fault ? 'no' : 'yes',
            // Says why, not just which: the rule is the thing to learn.
            feedback: fault ? `Not quite: it's wrong - ${fault}.` : "Not quite: it's right - every letter is used once or twice, in order.",
        };
    }

    // --- Triads (Grades 4 and 5), inversions and cadences (Grade 5), in close position with the key
    // signature. A minor key's chords come from its harmonic minor (a major V, a diminished II). ---
    const CHORD_ROMAN = { 1: 'I', 2: 'II', 4: 'IV', 5: 'V' };
    const CHORD_LABEL = { 1: 'Tonic (I)', 2: 'Supertonic (II)', 4: 'Subdominant (IV)', 5: 'Dominant (V)' };
    const INVERSION_LABEL = ['Root position (a)', '1st inversion (b)', '2nd inversion (c)'];
    // The chord's notes, bottom up: root, 3rd, 5th rotated by the inversion; the bass note on the staff
    // at step `floor` or above (or near `near`, a staff step, for the second chord of a cadence).
    function triad(key, clef, degree, inversion, near) {
        const scale = scalePitches(key, clef, 'harmonic').slice(0, 7);
        const tones = [0, 2, 4].map(i => scale[(degree - 1 + i) % 7]);
        const rotated = tones.slice(inversion).concat(tones.slice(0, inversion));
        const bass = Notation.parsePitch(rotated[0]);
        let low = placeAt(bass.letter, bass.alter, clef, -1);
        if (near !== undefined) {
            const lp = Notation.parsePitch(low);
            let best = low;
            for (const o of [lp.octave - 1, lp.octave, lp.octave + 1]) {
                const cand = pitchName(lp.letter, lp.alter, o);
                const st = Notation.staffStep(cand, clef);
                if (st >= -3 && st <= 5 && Math.abs(st - near) < Math.abs(Notation.staffStep(best, clef) - near)) best = cand;
            }
            low = best;
        }
        const out = [low];
        for (const t of rotated.slice(1)) {
            const tp = Notation.parsePitch(t);
            let p = pitchName(tp.letter, tp.alter, Notation.parsePitch(out[out.length - 1]).octave);
            if (Notation.diatonic(p) <= Notation.diatonic(out[out.length - 1])) p = pitchName(tp.letter, tp.alter, Notation.parsePitch(p).octave + 1);
            out.push(p);
        }
        return out;
    }
    const chordStaffItem = (key, pitches) => ({ type: 'chord', notes: pitches.map(p => keyNote(key, p)) });
    const keySigOf = (key) => (key.count ? { type: key.type, count: key.count } : null);
    // degrees: which chords (1, 2, 4, 5); inversions: which positions (0-2).
    function chordItems(clefs, keyIds, degrees, inversions, type) {
        const out = [];
        for (const clef of clefs) for (const key of ALL_KEYS.filter(k => keyIds.includes(k.id))) {
            for (const degree of degrees) for (const inversion of inversions) out.push({ type, clef, key, degree, inversion, withII: degrees.includes(2) });
        }
        return out;
    }
    function chordQuestion(item, rng, naming) {
        const { key, clef, degree, inversion } = item;
        const choices = item.withII || degree === 2 ? [1, 2, 4, 5] : [1, 4, 5];
        return {
            id: `chord:${clef}:${key.id}:${degree}:${inversion}`,
            prompt: {
                text: `In ${keyLabel(key, naming)}, which chord is this?`,
                staff: { clef, keySignature: keySigOf(key), items: [chordStaffItem(key, triad(key, clef, degree, inversion))], stepRange: [-3, 13], minWidth: 14 },
                label: `A chord in ${keyLabel(key, naming)}, ${clef} clef`,
            },
            layout: 'choices',
            answers: choices.map(d => ({ id: CHORD_ROMAN[d], label: CHORD_LABEL[d] })),
            correct: CHORD_ROMAN[degree],
        };
    }
    function inversionQuestion(item, rng, naming) {
        const { key, clef, degree, inversion } = item;
        return {
            id: `inversion:${clef}:${key.id}:${degree}:${inversion}`,
            prompt: {
                text: `This is chord ${CHORD_ROMAN[degree]} in ${keyLabel(key, naming)}. Which position?`,
                staff: { clef, keySignature: keySigOf(key), items: [chordStaffItem(key, triad(key, clef, degree, inversion))], stepRange: [-3, 13], minWidth: 14 },
                label: `Chord ${CHORD_ROMAN[degree]} in ${keyLabel(key, naming)}, ${clef} clef`,
            },
            layout: 'choices',
            answers: INVERSION_LABEL.map((label, i) => ({ id: 'abc'[i], label })),
            correct: 'abc'[inversion],
        };
    }
    // Two chords in root position. Perfect V-I, plagal IV-I, imperfect ending on V (from I, II or IV).
    const CADENCES = [[5, 1, 'perfect'], [4, 1, 'plagal'], [1, 5, 'imperfect'], [2, 5, 'imperfect'], [4, 5, 'imperfect']];
    const CADENCE_LABEL = { perfect: 'Perfect', imperfect: 'Imperfect', plagal: 'Plagal' };
    function cadenceItems(clefs, keyIds) {
        const out = [];
        for (const clef of clefs) for (const key of ALL_KEYS.filter(k => keyIds.includes(k.id))) {
            for (const [from, to] of CADENCES) out.push({ type: 'cadence', clef, key, from, to });
        }
        return out;
    }
    function cadenceQuestion(item, rng, naming) {
        const { key, clef, from, to } = item;
        const kind = CADENCES.find(c => c[0] === from && c[1] === to)[2];
        const first = triad(key, clef, from, 0);
        const second = triad(key, clef, to, 0, Notation.staffStep(first[0], clef));
        return {
            id: `cadence:${clef}:${key.id}:${from}-${to}`,
            prompt: {
                text: `The end of a phrase in ${keyLabel(key, naming)}. Which cadence?`,
                staff: { clef, keySignature: keySigOf(key), items: [chordStaffItem(key, first), chordStaffItem(key, second), { type: 'barline', glyph: 'barlineFinal' }], stepRange: [-3, 13], minWidth: 16 },
                label: `Two chords in ${keyLabel(key, naming)}, ${clef} clef`,
            },
            layout: 'choices',
            answers: ['perfect', 'imperfect', 'plagal'].map(k => ({ id: k, label: CADENCE_LABEL[k] })),
            correct: kind,
        };
    }

    // ---------------------------------------------------------------- Theory grades (ML-309)

    // What each grade ADDS, for the parts the quizzes ask (the symbols and terms carry their own grade).
    // gradeContent(g) is everything up to and including g - grades are cumulative. A draft from the ABRSM
    // Music Theory syllabus (Grades 1-5); docs/theory-grades.md has the sources and what's not covered yet.
    //   range: ledger lines above and below (RANGE_STEPS); accidentals: note-name spellings asked;
    //   majors/minors: key tonics added; upTo: every key with up to that many sharps or flats;
    //   minorForms: the minor scale forms asked.
    //   ML-309 C - intervals: how far the Intervals quiz goes ('number' above the tonic, 'tonic' number
    //   and quality above the tonic, 'simple' any two notes within an octave, 'compound'); chords: the
    //   triads added; technicalNames, chromatic, inversions, cadences: asked from that grade on.
    const THEORY_GRADES = [
        { grade: 1, clefs: ['treble', 'bass'], range: 0, accidentals: ['none'], majors: ['C', 'G', 'D', 'F'], minors: [], minorForms: [] },
        { grade: 2, range: 2, accidentals: ['sharps', 'flats'], majors: ['A', 'Bb', 'Eb'], minors: ['A', 'E', 'D'], minorForms: ['harmonic'], intervals: 'number' },
        { grade: 3, range: 4, upTo: 4, minorForms: ['melodic'], intervals: 'tonic' },
        { grade: 4, clefs: ['alto'], upTo: 5, intervals: 'simple', chords: [1, 4, 5], technicalNames: true, chromatic: true },
        { grade: 5, clefs: ['tenor'], upTo: 6, intervals: 'compound', chords: [2], inversions: true, cadences: true },
    ];
    const INTERVAL_TEXT = {
        number: 'number only (2nd to octave), above the tonic of the major keys',
        tonic: 'number and quality (major, minor, perfect), above the tonic of the major and minor keys',
        simple: 'any two notes within an octave, augmented and diminished too',
        compound: 'compound intervals, up to two octaves',
    };
    const GRADE_CHOICES = THEORY_GRADES.map(g => g.grade);
    function gradeContent(grade) {
        const out = { grade, clefs: [], range: 0, accidentals: [], keyIds: [], minorForms: [], intervals: null, chords: [], technicalNames: false, chromatic: false, inversions: false, cadences: false };
        for (const g of THEORY_GRADES.filter(x => x.grade <= grade)) {
            out.clefs.push(...(g.clefs || []));
            if (g.intervals) out.intervals = g.intervals;
            out.chords.push(...(g.chords || []));
            for (const k of ['technicalNames', 'chromatic', 'inversions', 'cadences']) if (g[k]) out[k] = true;
            if (g.range !== undefined) out.range = g.range;
            out.accidentals.push(...(g.accidentals || []));
            out.keyIds.push(...(g.majors || []).map(t => `${t} major`), ...(g.minors || []).map(t => `${t} minor`));
            if (g.upTo) out.keyIds.push(...ALL_KEYS.filter(k => k.count <= g.upTo).map(k => k.id));
            out.minorForms.push(...(g.minorForms || []));
        }
        out.keyIds = ALL_KEYS.map(k => k.id).filter(id => out.keyIds.includes(id)); // circle-of-fifths order, once each
        out.chords.sort((a, b) => a - b);
        out.symbols = SYMBOLS.filter(s => s.grade && s.grade <= grade);
        return out;
    }
    // Admin -> Theory grades: per grade, what it adds - for someone to check against the syllabus.
    function gradeSummary() {
        return THEORY_GRADES.map(({ grade }) => {
            const now = gradeContent(grade), before = grade > 1 ? gradeContent(grade - 1) : null;
            const added = (list, prev) => list.filter(x => !(prev || []).includes(x));
            // ML-309 C: the new question types, in words.
            const topics = [];
            if (now.intervals && (!before || before.intervals !== now.intervals)) topics.push({ label: 'Intervals', text: INTERVAL_TEXT[now.intervals] });
            if (now.technicalNames && !(before && before.technicalNames)) topics.push({ label: 'Technical names', text: 'tonic, supertonic, mediant, subdominant, dominant, submediant, leading note - a note in a key' });
            if (now.chromatic && !(before && before.chromatic)) topics.push({ label: 'Chromatic scale', text: 'is it written correctly? Every letter once or twice, a semitone at a time' });
            const newChords = added(now.chords, before && before.chords);
            if (newChords.length) topics.push({ label: 'Chords', text: `${newChords.map(d => `${DEGREE_NAMES[d - 1].toLowerCase()} (${CHORD_ROMAN[d]})`).join(', ')} triads, in root position${now.inversions ? ' and inversions' : ''}` });
            if (now.inversions && !(before && before.inversions)) topics.push({ label: 'Inversions', text: 'root position, 1st and 2nd inversion (a, b, c) of I, II, IV and V' });
            if (now.cadences && !(before && before.cadences)) topics.push({ label: 'Cadences', text: 'perfect (V-I), imperfect (I, II or IV to V), plagal (IV-I)' });
            return {
                topics,
                grade,
                clefs: added(now.clefs, before && before.clefs),
                range: now.range,
                rangeChanged: !before || before.range !== now.range,
                accidentals: added(now.accidentals, before && before.accidentals),
                keys: added(now.keyIds, before && before.keyIds),
                minorForms: added(now.minorForms, before && before.minorForms),
                symbols: SYMBOLS.filter(s => s.grade === grade).map(s => ({ id: s.id, set: s.set, name: s.name, meaning: s.meaning })),
            };
        });
    }
    // The items a quiz asks at a grade (the grade's content, the clefs and Show/Ask the player chose).
    function gradeItems(quizId, opts) {
        const G = gradeContent(opts.grade);
        const keyOpts = { keyIds: G.keyIds, minorForms: G.minorForms.length ? G.minorForms : ['harmonic'] };
        const sets = [`grade:${opts.grade}`];
        // ML-309 C: each new question type is its own group, so the round takes them in turn and a big
        // group (every interval between any two notes) doesn't swamp a small one (cadences).
        const g = opts.grade;
        const intervals = () => (G.intervals ? intervalItems(opts.clefs, g, G.keyIds) : []);
        const degrees = () => (G.technicalNames ? degreeItems(opts.clefs, G.keyIds) : []);
        const chromatic = () => (G.chromatic ? chromaticItems(opts.clefs, G.keyIds) : []);
        const chords = () => (G.chords.length ? chordItems(opts.clefs, G.keyIds, G.chords, G.inversions ? [0, 1, 2] : [0], 'chord') : []);
        const inversions = () => (G.inversions ? chordItems(opts.clefs, G.keyIds, G.chords, [0, 1, 2], 'inversion') : []);
        const cadences = () => (G.cadences ? cadenceItems(opts.clefs, G.keyIds) : []);
        if (quizId === 'noteNames') return { note: noteItems(opts.clefs, G.range, G.accidentals) };
        // Keys: technical names and the chromatic scale come with scales (not with "key signatures" only).
        if (quizId === 'keys') {
            const scalesToo = opts.show !== 'keySignatures';
            return { keys: keyItems(opts.clefs, { ...keyOpts, show: opts.show }), degree: scalesToo ? degrees() : [], chromatic: scalesToo ? chromatic() : [] };
        }
        if (quizId === 'symbols') return { symbols: symbolItems(sets, opts.ask) };
        if (quizId === 'intervals') return { interval: intervals() };
        if (quizId === 'chords') return { chord: chords(), inversion: inversions(), cadence: cadences() };
        return {
            note: noteItems(opts.clefs, G.range, G.accidentals),
            keySignature: keyItems(opts.clefs, { ...keyOpts, show: 'keySignatures' }),
            scale: keyItems(opts.clefs, { ...keyOpts, show: 'scales' }),
            symbolName: symbolItems(sets, 'names'),
            symbolMeaning: symbolItems(sets, 'meanings'),
            // Mixed at a grade also asks the grade's intervals, technical names and chords (one group each).
            interval: intervals(),
            degree: degrees(),
            chord: [...chords(), ...inversions(), ...cadences()],
        };
    }

    // ---------------------------------------------------------------- question source

    // Rebuilds a question from its id (the key its Smart learn weight is stored under) - how "Your weak
    // spots" asks exactly the questions you've missed, whichever quiz first asked them. null if the id
    // isn't a question this version knows (a renamed symbol, say).
    function itemFromId(id) {
        const [type, a, b, c] = String(id).split(':');
        if (type === 'note') {
            const m = /^([A-G][#b]?)(-?\d+)$/.exec(b || '');
            if (!Notation.CLEFS[a] || !m) return null;
            const st = Notation.staffStep(b, a);
            const range = [0, 2, 4, 6].find(r => st >= RANGE_STEPS[r][0] && st <= RANGE_STEPS[r][1]);
            if (range === undefined) return null;
            const acc = m[1].includes('#') ? 'sharps' : m[1].includes('b') ? 'flats' : 'none';
            return { type, clef: a, name: m[1], pitch: b, acc, range };
        }
        if (type === 'keySignature' || type === 'scale') {
            const key = ALL_KEYS.find(k => k.id === b);
            if (!Notation.CLEFS[a] || !key) return null;
            if (type === 'keySignature') return { type, key, clef: a };
            const form = key.mode === 'minor' ? (c === 'melodic' ? 'melodic' : 'harmonic') : null;
            return { type, key, clef: a, form, includeRelative: true };
        }
        if (type === 'symbolName' || type === 'symbolMeaning') {
            const sym = SYMBOLS.find(s => s.id === a);
            return sym ? { type, sym, sets: [sym.set] } : null;
        }
        if (type === 'speedName' || type === 'speedBpm') {
            const speed = SPEEDS.find(s => s.id === a);
            return speed ? { type, speed } : null;
        }
        // ML-309 C. Rebuilt items are checked by building them (a malformed id throws, and is dropped).
        const ok = (it) => { try { build(it, makeRng(1), 'letters'); return it; } catch (e) { return null; } };
        const [, , , , e] = String(id).split(':');
        if (!Notation.CLEFS[a]) return null;
        if (type === 'intervalNumber' || type === 'interval') {
            if (!/^[A-G](bb|b|#|x)?-?\d+$/.test(b || '') || !/^[A-G](bb|b|#|x)?-?\d+$/.test(c || '')) return null;
            const iv = intervalBetween(b, c);
            // Augmented/diminished wrong answers only when the interval itself is one (see intervalQuestion).
            return iv ? ok({ type, clef: a, low: b, high: c, wide: iv.quality === 'aug' || iv.quality === 'dim' }) : null;
        }
        if (type === 'degree') {
            const key = ALL_KEYS.find(k => k.id === b), degree = Number(c);
            return key && degree >= 1 && degree <= 7 ? { type, clef: a, key, degree } : null;
        }
        if (type === 'chromatic') {
            const variant = c === 'ok' ? 'ok' : Number(c);
            if (!/^[A-G][#b]?$/.test(b || '') || (variant !== 'ok' && !Number.isInteger(variant))) return null;
            const right = chromaticScale(b, a);
            if (!right || (variant !== 'ok' && !chromaticMistakes(right)[variant])) return null;
            return { type, clef: a, tonic: b, variant };
        }
        if (type === 'chord' || type === 'inversion') {
            const key = ALL_KEYS.find(k => k.id === b), degree = Number(c), inversion = Number(e);
            return key && CHORD_ROMAN[degree] && [0, 1, 2].includes(inversion) ? { type, clef: a, key, degree, inversion, withII: degree === 2 } : null;
        }
        if (type === 'cadence') {
            const key = ALL_KEYS.find(k => k.id === b), [from, to] = String(c).split('-').map(Number);
            return key && CADENCES.some(x => x[0] === from && x[1] === to) ? { type, clef: a, key, from, to } : null;
        }
        return null;
    }
    // A plain-words name for a question, for the weak spots list ("B♭4 on the treble staff").
    function describeQuestion(id, naming) {
        const it = itemFromId(id);
        if (!it) return null;
        if (it.type === 'note') { const m = /^([A-G][#b]?)(-?\d+)$/.exec(it.pitch); return `${spellName(m[1], naming)}${m[2]} on the ${it.clef} staff`; }
        if (it.type === 'keySignature') return `${keyLabel(it.key, naming)} key signature, ${it.clef} clef`;
        if (it.type === 'scale') return `${keyLabel(it.key, naming)}${it.form ? ` (${it.form})` : ''} scale, ${it.clef} clef`;
        if (it.type === 'speedName') return `${it.speed.names.join(' / ')}: from its bpm`;
        if (it.type === 'speedBpm') return `${it.speed.names.join(' / ')}: how fast`;
        const pn = (p) => { const q = Notation.parsePitch(p); return spell(q.letter, q.alter, naming) + q.octave; };
        if (it.type === 'intervalNumber' || it.type === 'interval') return `${pn(it.low)} up to ${pn(it.high)}, ${it.clef} clef${it.type === 'intervalNumber' ? ' (number)' : ''}`;
        if (it.type === 'degree') return `The ${DEGREE_NAMES[it.degree - 1].toLowerCase()} of ${keyLabel(it.key, naming)}, ${it.clef} clef`;
        if (it.type === 'chromatic') return `A chromatic scale on ${spellName(it.tonic, naming)}${it.variant === 'ok' ? '' : ' (written wrongly)'}, ${it.clef} clef`;
        if (it.type === 'chord') return `Chord ${CHORD_ROMAN[it.degree]}${it.inversion ? 'abc'[it.inversion] : ''} in ${keyLabel(it.key, naming)}, ${it.clef} clef`;
        if (it.type === 'inversion') return `Chord ${CHORD_ROMAN[it.degree]}${'abc'[it.inversion]} in ${keyLabel(it.key, naming)}: its position`;
        if (it.type === 'cadence') return `${CHORD_ROMAN[it.from]}-${CHORD_ROMAN[it.to]} in ${keyLabel(it.key, naming)}: which cadence`;
        const term = it.sym.set === 'terms';
        return it.type === 'symbolName' ? `${it.sym.name}: ${term ? 'what it means' : 'its name'}` : `${it.sym.name}: from its meaning`;
    }

    // Every distinct question a quiz can ask with these options. weakSpots asks the questions that have
    // a Smart learn weight (from the weights passed in), nothing else.
    function itemsFor(quizId, opts, weights) {
        if (quizId === 'weakSpots') {
            return { weak: Object.keys(weights || {}).filter(id => weights[id] > 0).map(itemFromId).filter(Boolean) };
        }
        if (opts.grade) return gradeItems(quizId, opts);
        if (quizId === 'noteNames') return { note: noteItems(opts.clefs, opts.range, [opts.accidentals]) };
        if (quizId === 'keys') return { keys: keyItems(opts.clefs, opts) };
        if (quizId === 'symbols') return { symbols: symbolItems(opts.set === 'everything' ? ['everything'] : [opts.set], opts.ask) };
        if (quizId === 'mixed') {
            const L = MIXED_LEVELS[opts.level];
            const keyOpts = { upTo: L.upTo, keyTypes: 'both', modes: L.modes, minorForm: L.minorForm };
            return {
                note: noteItems(opts.clefs, L.range, L.accidentals),
                keySignature: keyItems(opts.clefs, { ...keyOpts, show: 'keySignatures' }),
                scale: keyItems(opts.clefs, { ...keyOpts, show: 'scales' }),
                symbolName: symbolItems(L.sets, 'names'),
                symbolMeaning: symbolItems(L.sets, 'meanings'),
            };
        }
        return quiz(quizId); // throws
    }
    // The question id each item becomes (the same as the question builders') - what Smart learn weights
    // are stored under.
    const itemKey = (it) => it.type === 'note' ? `note:${it.clef}:${it.pitch}`
        : it.type === 'keySignature' ? `keySignature:${it.clef}:${it.key.id}`
        : it.type === 'scale' ? `scale:${it.clef}:${it.key.id}${it.key.mode === 'minor' ? `:${it.form}` : ''}`
        : it.speed ? `${it.type}:${it.speed.id}`
        : it.type === 'intervalNumber' || it.type === 'interval' ? `${it.type}:${it.clef}:${it.low}:${it.high}`
        : it.type === 'degree' ? `degree:${it.clef}:${it.key.id}:${it.degree}`
        : it.type === 'chromatic' ? `chromatic:${it.clef}:${it.tonic}:${it.variant}`
        : it.type === 'chord' || it.type === 'inversion' ? `${it.type}:${it.clef}:${it.key.id}:${it.degree}:${it.inversion}`
        : it.type === 'cadence' ? `cadence:${it.clef}:${it.key.id}:${it.from}-${it.to}`
        : `${it.type}:${it.sym.id}`;
    function build(item, rng, naming) {
        if (item.type === 'intervalNumber') return intervalNumberQuestion(item, rng);
        if (item.type === 'interval') return intervalQuestion(item, rng);
        if (item.type === 'degree') return degreeQuestion(item, rng, naming);
        if (item.type === 'chromatic') return chromaticQuestion(item);
        if (item.type === 'chord') return chordQuestion(item, rng, naming);
        if (item.type === 'inversion') return inversionQuestion(item, rng, naming);
        if (item.type === 'cadence') return cadenceQuestion(item, rng, naming);
        if (item.type === 'note') return noteQuestion(item, naming);
        if (item.type === 'keySignature') return keySignatureQuestion(item, rng, naming);
        if (item.type === 'scale') return scaleQuestion(item, rng, naming);
        if (item.type === 'symbolName') return symbolNameQuestion(item, rng);
        if (item.type === 'speedName') return speedNameQuestion(item, rng);
        if (item.type === 'speedBpm') return speedBpmQuestion(item, rng);
        return symbolMeaningQuestion(item, rng);
    }
    // Deals the quiz's questions in a shuffled order, each once before any repeats. Mixed takes the
    // question types in turn (shuffled, each type once per turn) so no one type swamps the round, and
    // each type deals its own questions the same way. `size` is how many different questions there are.
    // weights ({ questionId: 0-10 }, Smart learn only): each deal is weighted to put your weak questions
    // first, and record() updates them as the round goes, so a later deal in the same round uses them
    // too. Without weights it's a plain shuffle with no memory.
    // With Smart learn, a missed question is also queued to come back retryGap questions later in the
    // same round (and again if it's missed again).
    function questionSource(quizId, rawOptions, { seed = Date.now(), naming = 'letters', weights = null } = {}) {
        const opts = normaliseOptions(quizId, rawOptions);
        const rng = makeRng(seed);
        const w = weights ? { ...weights } : null;
        const weightOf = w ? (id) => w[id] || 0 : null;
        const groups = Object.entries(itemsFor(quizId, opts, w)).filter(([, items]) => items.length);
        const decks = groups.map(([type, items]) => ({ type, deck: makeDeck(items, rng, itemKey, weightOf) }));
        const typeDeck = decks.length ? makeDeck(decks, rng, (d) => d.type) : null;
        const byId = new Map(groups.flatMap(([, items]) => items.map(it => [itemKey(it), it])));
        const retries = []; // [{ id, due }] - due counts down one per question dealt
        let lastId = null;
        return {
            options: opts,
            smart: !!w,
            size: byId.size,
            next() {
                if (!typeDeck) return null;
                for (const r of retries) r.due--;
                const i = retries.findIndex(r => r.due <= 0 && r.id !== lastId);
                const item = i >= 0 ? byId.get(retries.splice(i, 1)[0].id) : typeDeck.next().deck.next();
                lastId = itemKey(item);
                return build(item, rng, naming);
            },
            // ms: how long the answer took (a slow right answer doesn't lower the weight).
            record(questionId, correct, ms) {
                if (!w) return;
                w[questionId] = nextWeight(w[questionId], correct, { questionId, ms });
                if (!correct && byId.has(questionId) && !retries.some(r => r.id === questionId)) retries.push({ id: questionId, due: SMART.retryGap });
            },
        };
    }

    // ---------------------------------------------------------------- scoring

    const TIMING = { wrongRevealMs: 1500, minAnswerMs: 300 };
    const GRADE_LIMITS = [[90, 5], [70, 4], [50, 3], [30, 2]];
    const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
    function gradeFor(score) {
        for (const [min, g] of GRADE_LIMITS) if (score >= min) return g;
        return 1;
    }
    // answers: [{ questionId, correct }]. Right +1, wrong -1 (on a 4-choice question random guessing
    // loses points).
    //  - Timed: each answer is worth its question's par time, so a perfect score is answering every
    //    question in par; faster than that can't score over 100. 100 x (par of the right answers - par
    //    of the wrong ones) / the round's length.
    //  - Fixed: out of the number of questions; time is kept separately and doesn't affect the score.
    function scoreRound(roundId, answers) {
        const r = round(roundId);
        const right = answers.filter(a => a.correct).length;
        const wrong = answers.length - right;
        let score;
        if (r.seconds) {
            const net = answers.reduce((sum, a) => sum + (a.correct ? 1 : -1) * parOf(a.questionId), 0);
            score = clamp(100 * net / r.seconds);
        } else {
            score = clamp(100 * (right - wrong) / r.questions);
        }
        return { right, wrong, score, grade: gradeFor(score) };
    }
    // ML-354: a repeated test. answers carry block (1..repeats); blockMs is each block's time (a fixed
    // round's own clock; timed blocks are the round's length). Every block is scored as a round on its
    // own and the best one is the result: highest score, then the quicker, then the earlier. Returns
    // that block's right/wrong/score/grade, which block it was (1-based), and every block's score.
    function scoreBlocks(roundId, answers, repeats, blockMs) {
        const n = repeatsOf(repeats);
        const blocks = Array.from({ length: n }, (_, i) => ({
            ...scoreRound(roundId, answers.filter(a => (a.block || 1) === i + 1)),
            ms: blockMs && Number.isFinite(blockMs[i]) ? blockMs[i] : 0
        }));
        let best = 0;
        blocks.forEach((b, i) => { if (b.score > blocks[best].score || (b.score === blocks[best].score && b.ms < blocks[best].ms)) best = i; });
        const { right, wrong, score, grade, ms } = blocks[best];
        return { right, wrong, score, grade, ms, bestBlock: best + 1, blockScores: blocks.map(b => b.score) };
    }

    return {
        QUIZZES, ROUNDS, DEFAULT_ROUND, REPEATS, DEFAULT_REPEATS, repeatsOf, scoreBlocks, SYMBOLS, SET_IDS, SPEEDS, speedFor, speedLabel, KEY_TABLE, RANGE_STEPS, NOTE_BUTTONS, KEYBOARD_BUTTONS, MIXED_LEVELS, SCALE_FORMS, SCALE_FORM_LABEL, buildScale, writeScale, scalePool, TIMING, GRADE_LIMITS, PAR,
        quiz, round, normaliseOptions, optionVisible, settingsKey, describeOptions,
        makeRng, questionSource, itemsFor, SMART, nextWeight, smartOrder, reviewBoost, effectiveWeight, itemFromId, describeQuestion, WEAK_SPOTS, scalePitches, keyPool, keyAlters, noteItems, parOf,
        spell, spellName, scoreRound, gradeFor, ALL_KEYS,
        THEORY_GRADES, GRADE_CHOICES, gradeContent, gradeSummary,
        intervalBetween, intervalLabel, noteAbove, chromaticScale, chromaticFault, chromaticMistakes, triad, DEGREE_NAMES
    };
}));
