// ML-263: the Theory practice quiz engine (ML-260) - the quizzes' content, their options, question
// generation and scoring. Pure logic with no DOM or storage: loaded in the browser (window.TheoryEngine,
// after notation.js and before app.js), in Node by server/test/theoryEngine.test.js, and by the server to
// re-score saved rounds (server/services/theoryPractice.js).
//
// Questions describe WHAT to draw (Notation.staff options, a glyph name...), never SVG - the screen
// hands those to public/notation.js. Every answer is one tap on a button (confirmed on ML-260), so every
// question carries its full, fixed list of answer buttons.
//
// Four quizzes: Note names, Keys (key signatures + written-out scales), Notation (id 'symbols': name <->
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
    const PAR = { note: 1.5, keySignature: 2.5, scale: 4, symbolName: 2, symbolMeaning: 2.5, speedName: 2.5, speedBpm: 2.5 };
    const typeOf = (questionId) => String(questionId).split(':')[0];
    const parOf = (questionId) => PAR[typeOf(questionId)] || 2;

    // ---------------------------------------------------------------- options

    const ROUNDS = [
        { value: 't30', label: '30 s', seconds: 30 },
        { value: 't60', label: '60 s', seconds: 60 },
        { value: 'q10', label: '10 questions', questions: 10 },
        { value: 'q20', label: '20 questions', questions: 20 },
    ];
    const DEFAULT_ROUND = 't60';

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
        level: { key: 'level', label: 'Level', default: 'beginner', choices: [{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }] },
    };

    const QUIZZES = [
        { id: 'noteNames', title: 'Note names', subtitle: 'Identify the note on a stave', icon: 'noteheadWhole', options: [OPT.clefs, OPT.range, OPT.accidentals] },
        { id: 'keys', title: 'Keys', subtitle: 'Key signatures and scales', icon: 'accidentalSharp', options: [OPT.clefs, OPT.show, OPT.upTo, OPT.keyTypes, OPT.modes, OPT.minorForm] },
        { id: 'symbols', title: 'Notation', subtitle: 'Symbols and speeds', icon: 'fermataAbove', options: [OPT.set, OPT.ask] },
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
        out.grade = q.options.length && GRADE_CHOICES.includes(raw.grade) ? raw.grade : 0;
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

    // ---------------------------------------------------------------- Theory grades (ML-309)

    // What each grade ADDS, for the parts the quizzes ask (the symbols and terms carry their own grade).
    // gradeContent(g) is everything up to and including g - grades are cumulative. A draft from the ABRSM
    // Music Theory syllabus (Grades 1-5); docs/theory-grades.md has the sources and what's not covered yet.
    //   range: ledger lines above and below (RANGE_STEPS); accidentals: note-name spellings asked;
    //   majors/minors: key tonics added; upTo: every key with up to that many sharps or flats;
    //   minorForms: the minor scale forms asked.
    const THEORY_GRADES = [
        { grade: 1, clefs: ['treble', 'bass'], range: 0, accidentals: ['none'], majors: ['C', 'G', 'D', 'F'], minors: [], minorForms: [] },
        { grade: 2, range: 2, accidentals: ['sharps', 'flats'], majors: ['A', 'Bb', 'Eb'], minors: ['A', 'E', 'D'], minorForms: ['harmonic'] },
        { grade: 3, range: 4, upTo: 4, minorForms: ['melodic'] },
        { grade: 4, clefs: ['alto'], upTo: 5 },
        { grade: 5, clefs: ['tenor'], upTo: 6 },
    ];
    const GRADE_CHOICES = THEORY_GRADES.map(g => g.grade);
    function gradeContent(grade) {
        const out = { grade, clefs: [], range: 0, accidentals: [], keyIds: [], minorForms: [] };
        for (const g of THEORY_GRADES.filter(x => x.grade <= grade)) {
            out.clefs.push(...(g.clefs || []));
            if (g.range !== undefined) out.range = g.range;
            out.accidentals.push(...(g.accidentals || []));
            out.keyIds.push(...(g.majors || []).map(t => `${t} major`), ...(g.minors || []).map(t => `${t} minor`));
            if (g.upTo) out.keyIds.push(...ALL_KEYS.filter(k => k.count <= g.upTo).map(k => k.id));
            out.minorForms.push(...(g.minorForms || []));
        }
        out.keyIds = ALL_KEYS.map(k => k.id).filter(id => out.keyIds.includes(id)); // circle-of-fifths order, once each
        out.symbols = SYMBOLS.filter(s => s.grade && s.grade <= grade);
        return out;
    }
    // Admin -> Theory grades: per grade, what it adds - for someone to check against the syllabus.
    function gradeSummary() {
        return THEORY_GRADES.map(({ grade }) => {
            const now = gradeContent(grade), before = grade > 1 ? gradeContent(grade - 1) : null;
            const added = (list, prev) => list.filter(x => !(prev || []).includes(x));
            return {
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
        if (quizId === 'noteNames') return { note: noteItems(opts.clefs, G.range, G.accidentals) };
        if (quizId === 'keys') return { keys: keyItems(opts.clefs, { ...keyOpts, show: opts.show }) };
        if (quizId === 'symbols') return { symbols: symbolItems(sets, opts.ask) };
        return {
            note: noteItems(opts.clefs, G.range, G.accidentals),
            keySignature: keyItems(opts.clefs, { ...keyOpts, show: 'keySignatures' }),
            scale: keyItems(opts.clefs, { ...keyOpts, show: 'scales' }),
            symbolName: symbolItems(sets, 'names'),
            symbolMeaning: symbolItems(sets, 'meanings'),
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
        : `${it.type}:${it.sym.id}`;
    function build(item, rng, naming) {
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

    return {
        QUIZZES, ROUNDS, DEFAULT_ROUND, SYMBOLS, SET_IDS, SPEEDS, speedFor, speedLabel, KEY_TABLE, RANGE_STEPS, NOTE_BUTTONS, KEYBOARD_BUTTONS, MIXED_LEVELS, SCALE_FORMS, SCALE_FORM_LABEL, buildScale, writeScale, scalePool, TIMING, GRADE_LIMITS, PAR,
        quiz, round, normaliseOptions, optionVisible, settingsKey, describeOptions,
        makeRng, questionSource, itemsFor, SMART, nextWeight, smartOrder, reviewBoost, effectiveWeight, itemFromId, describeQuestion, WEAK_SPOTS, scalePitches, keyPool, keyAlters, noteItems, parOf,
        spell, spellName, scoreRound, gradeFor, ALL_KEYS,
        THEORY_GRADES, GRADE_CHOICES, gradeContent, gradeSummary
    };
}));
