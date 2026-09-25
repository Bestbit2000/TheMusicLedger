// ML-263: the Theory practice quiz engine (ML-260) - the 5 quizzes' content, their options, question
// generation and scoring. Pure logic with no DOM or storage: loaded in the browser (window.TheoryEngine,
// after notation.js and before app.js) and in Node by server/test/theoryEngine.test.js.
//
// Questions describe WHAT to draw (Notation.staff options, a glyph name...), never SVG - the screen
// hands those to public/notation.js. Every answer is one tap on a button (confirmed on ML-260), so every
// question carries its full, fixed list of answer buttons.
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

    // ---------------------------------------------------------------- options

    const ROUNDS = [
        { value: 't30', label: '30 s', seconds: 30 },
        { value: 't60', label: '60 s', seconds: 60 },
        { value: 'q10', label: '10 questions', questions: 10 },
        { value: 'q20', label: '20 questions', questions: 20 },
    ];
    const DEFAULT_ROUND = 't60';

    // Clef is multi-select (not "Both") so alto/tenor can be added later without reworking the options.
    const OPT = {
        clefs: { key: 'clefs', label: 'Clef', multi: true, default: ['treble'], choices: [{ value: 'treble', label: 'Treble' }, { value: 'bass', label: 'Bass' }] },
        range: { key: 'range', label: 'Range, above and below', default: 0, choices: [{ value: 0, label: 'On the staff' }, { value: 2, label: '2 ledger lines' }, { value: 4, label: '4 ledger lines' }, { value: 6, label: '6 ledger lines' }] },
        accidentals: { key: 'accidentals', label: 'Sharps and flats', default: 'none', choices: [{ value: 'none', label: 'None' }, { value: 'sharps', label: 'Sharps' }, { value: 'flats', label: 'Flats' }] },
        upTo: { key: 'upTo', label: 'Up to (sharps or flats)', default: 3, choices: [{ value: 1, label: '1' }, { value: 3, label: '3' }, { value: 5, label: '5' }, { value: 7, label: '7' }] },
        keyTypes: { key: 'keyTypes', label: 'Keys', default: 'both', choices: [{ value: 'sharp', label: 'Sharp keys' }, { value: 'flat', label: 'Flat keys' }, { value: 'both', label: 'Both' }] },
        modes: { key: 'modes', label: 'Major and minor', default: 'major', choices: [{ value: 'major', label: 'Major' }, { value: 'both', label: 'Major and minor' }] },
        minorForm: { key: 'minorForm', label: 'Minor form', default: 'harmonic', showIf: { modes: 'both' }, choices: [{ value: 'harmonic', label: 'Harmonic' }, { value: 'melodic', label: 'Melodic' }, { value: 'both', label: 'Both' }] },
        set: { key: 'set', label: 'Symbols', default: 'basics', choices: [{ value: 'basics', label: 'Basics' }, { value: 'dynamics', label: 'Dynamics' }, { value: 'structure', label: 'Structure' }, { value: 'everything', label: 'Everything' }] },
    };

    // topPace: right answers per minute that count as a perfect timed score (confirmed on ML-260).
    const QUIZZES = [
        { id: 'noteNames', title: 'Note names', topPace: 40, icon: 'noteheadWhole', options: [OPT.clefs, OPT.range, OPT.accidentals] },
        { id: 'keySignatures', title: 'Key signatures', topPace: 24, icon: 'accidentalSharp', options: [OPT.clefs, OPT.upTo, OPT.keyTypes, OPT.modes] },
        { id: 'symbolNames', title: 'Symbol names', topPace: 30, icon: 'fermataAbove', options: [OPT.set] },
        { id: 'symbolMeanings', title: 'Symbol meanings', topPace: 24, icon: 'segno', options: [OPT.set] },
        { id: 'scales', title: 'Scales by their notes', topPace: 15, icon: 'accidentalFlat', options: [OPT.clefs, OPT.upTo, OPT.keyTypes, OPT.modes, OPT.minorForm] },
    ];
    function quiz(id) {
        const q = QUIZZES.find(x => x.id === id);
        if (!q) throw new Error(`Unknown quiz: ${id}`);
        return q;
    }
    const optionVisible = (def, opts) => !def.showIf || Object.entries(def.showIf).every(([k, v]) => opts[k] === v);

    // Fills defaults and throws out anything that isn't one of the listed choices (stored options from
    // an older version, a hand-edited localStorage value...). Always returns a complete, valid set.
    function normaliseOptions(quizId, raw) {
        const out = {};
        raw = raw || {};
        for (const def of quiz(quizId).options) {
            const allowed = def.choices.map(c => c.value);
            if (def.multi) {
                const v = Array.isArray(raw[def.key]) ? allowed.filter(a => raw[def.key].includes(a)) : [];
                out[def.key] = v.length ? v : def.default.slice();
            } else {
                out[def.key] = allowed.includes(raw[def.key]) ? raw[def.key] : def.default;
            }
        }
        return out;
    }
    function round(roundId) { return ROUNDS.find(r => r.value === roundId) || ROUNDS.find(r => r.value === DEFAULT_ROUND); }

    // Identifies "the same options" for history and personal bests: results with different options
    // (or a different round type) aren't comparable. Hidden options (minor form when minor is off)
    // don't count.
    function settingsKey(quizId, rawOptions, roundId) {
        const opts = normaliseOptions(quizId, rawOptions);
        const parts = quiz(quizId).options.filter(d => optionVisible(d, opts))
            .map(d => `${d.key}=${d.multi ? opts[d.key].slice().sort().join(',') : opts[d.key]}`);
        return `${quizId}|${round(roundId).value}|${parts.join(';')}`;
    }
    // "Treble, bass · 2 ledger lines · 60 s" - the results screen's subtitle.
    function describeOptions(quizId, rawOptions, roundId) {
        const opts = normaliseOptions(quizId, rawOptions);
        const parts = quiz(quizId).options.filter(d => optionVisible(d, opts)).map(d => {
            const label = (v) => d.choices.find(c => c.value === v).label;
            if (d.multi) return opts[d.key].map(label).join(', ');
            if (d.key === 'upTo') return `Up to ${opts.upTo} ♯/♭`;
            return label(opts[d.key]);
        });
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

    // ---------------------------------------------------------------- 1. note names

    // Staff steps (0 = bottom line) each range choice covers - both above and below the staff.
    const RANGE_STEPS = { 0: [-1, 9], 2: [-4, 12], 4: [-8, 16], 6: [-12, 20] };
    // One button per note, spelled one way only, in keyboard order - so it's always a single tap.
    const NOTE_BUTTONS = {
        none: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
        sharps: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
        flats: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
    };
    function noteNamePool(opts) {
        const [lo, hi] = RANGE_STEPS[opts.range];
        const names = NOTE_BUTTONS[opts.accidentals];
        const pool = [];
        for (const clef of opts.clefs) {
            for (let st = lo; st <= hi; st++) {
                const natural = Notation.pitchAtStep(st, clef);
                const letter = natural[0], octave = natural.slice(1);
                for (const n of names.filter(x => x[0] === letter)) pool.push({ clef, name: n, pitch: n + octave });
            }
        }
        return pool;
    }
    function noteNameQuestion(item, opts, naming) {
        const [lo, hi] = RANGE_STEPS[opts.range];
        return {
            id: `${item.clef}:${item.pitch}`,
            prompt: {
                text: 'Which note is this?',
                staff: { clef: item.clef, items: [{ type: 'note', pitch: item.pitch }], stepRange: [lo - 1, hi + 1] },
                label: `A note on the ${item.clef} staff`,
            },
            layout: 'notes',
            answers: NOTE_BUTTONS[opts.accidentals].map(n => ({ id: n, label: spellName(n, naming) })),
            correct: item.name,
        };
    }

    // ---------------------------------------------------------------- keys (quizzes 2 and 5)

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
    function keyPool(opts) {
        const modes = opts.modes === 'both' ? ['major', 'minor'] : ['major'];
        return ALL_KEYS.filter(k => modes.includes(k.mode) && k.count <= opts.upTo
            && (k.type === 'none' || opts.keyTypes === 'both' || opts.keyTypes === k.type));
    }
    const keyLabel = (k, naming) => `${spellName(k.tonic, naming)} ${k.mode}`;
    // Position on the circle of fifths (-7 flats .. +7 sharps): how "close" two keys are.
    const fifths = (k) => (k.type === 'flat' ? -k.count : k.count);
    // Three plausible wrong answers: the nearest keys round the circle of fifths in the same mode, plus
    // the relative major/minor when one is allowed (the classic mix-up). From every key, not just the
    // selected ones, so even "up to 1" has four real choices.
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

    function keySignatureQuestion(key, clef, rng, naming) {
        return {
            id: `${clef}:${key.id}`,
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

    // ---------------------------------------------------------------- 5. scales

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
    function scaleQuestion(key, clef, form, rng, naming) {
        return {
            id: `${clef}:${key.id}${key.mode === 'minor' ? `:${form}` : ''}`,
            prompt: {
                text: 'Which scale is this?',
                staff: { clef, items: scalePitches(key, clef, form).map(p => ({ type: 'note', pitch: p })), noteGap: 1.2 },
                label: `A scale on the ${clef} staff`,
                detail: key.mode === 'minor' ? form : null,
            },
            layout: 'choices',
            answers: keyAnswers(key, rng, naming, true),
            correct: key.id,
        };
    }

    // ---------------------------------------------------------------- 3 & 4. symbols

    // Symbols on a scrap of staff leave the clef off, so there's only one symbol on show. Articulations
    // sit under stem-up notes in the spaces, as engraved. `render` is what the screen hands to Notation.
    const on = (items, extra) => ({ type: 'staff', staff: { hideClef: true, clef: 'treble', noteGap: 1.4, items, ...(extra || {}) } });
    const n = (pitch, more) => ({ type: 'note', pitch, ...(more || {}) });
    const q = (pitch, below) => n(pitch, { head: 'noteQuarterUp', below });
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
        // Structure
        { id: 'startRepeat', set: 'structure', name: 'Start repeat', meaning: 'The repeated section starts here', render: on([{ type: 'barline', glyph: 'repeatLeft' }, n('G4'), n('A4')]) },
        { id: 'endRepeat', set: 'structure', name: 'End repeat', meaning: 'Go back to the start repeat (or the beginning) and play again', render: on([n('G4'), n('A4'), { type: 'barline', glyph: 'repeatRight' }]) },
        { id: 'doubleBar', set: 'structure', name: 'Double bar line', meaning: 'The end of a section', render: on([n('G4'), n('A4'), { type: 'barline', glyph: 'barlineDouble' }]) },
        { id: 'finalBarline', set: 'structure', name: 'Final bar line', meaning: 'The end of the piece', render: on([n('G4'), n('A4'), { type: 'barline', glyph: 'barlineFinal' }]) },
        { id: 'segno', set: 'structure', name: 'Segno', meaning: 'The sign that D.S. sends you back to', render: { type: 'symbol', glyph: 'segno' } },
        { id: 'coda', set: 'structure', name: 'Coda', meaning: 'Jump to the ending section marked with this sign', render: { type: 'symbol', glyph: 'coda' } },
        { id: 'daCapo', set: 'structure', name: 'Da capo (D.C.)', meaning: 'Go back to the beginning', render: { type: 'symbol', glyph: 'daCapo' } },
        { id: 'dalSegno', set: 'structure', name: 'Dal segno (D.S.)', meaning: 'Go back to the sign', render: { type: 'symbol', glyph: 'dalSegno' } },
        { id: 'fine', set: 'structure', name: 'Fine', meaning: 'The end: stop here after a D.C. or D.S.', render: { type: 'text', text: 'Fine', italic: true } },
        { id: 'firstTimeBar', set: 'structure', name: '1st time bar', meaning: 'Play this bar the first time only; skip it on the repeat', render: on([n('G4'), n('A4'), { type: 'barline', glyph: 'barlineSingle' }], { spans: [{ kind: 'volta', from: 0, to: 2, text: '1.' }] }) },
        { id: 'introBrackets', set: 'structure', name: 'Intro brackets', meaning: 'The bars to play as the introduction', render: on([n('G4'), n('A4'), { type: 'barline', glyph: 'barlineSingle' }, n('B4'), n('C5')], { spans: [{ kind: 'intro', from: 0, to: 4 }] }) },
    ];
    const symbolsIn = (set) => SYMBOLS.filter(s => set === 'everything' || s.set === set);
    function symbolChoices(correct, set, rng) {
        // Wrong answers from the same set first (that's the difficulty chosen), topped up from the rest.
        const same = rng.shuffle(symbolsIn(set).filter(s => s.id !== correct.id));
        const rest = rng.shuffle(SYMBOLS.filter(s => s.id !== correct.id && !same.includes(s)));
        return rng.shuffle([correct, ...same.concat(rest).slice(0, 3)]);
    }
    function symbolNameQuestion(sym, opts, rng) {
        return {
            id: sym.id,
            prompt: { text: 'What is this called?', render: sym.render, label: 'A music symbol' },
            layout: 'choices',
            answers: symbolChoices(sym, opts.set, rng).map(s => ({ id: s.id, label: s.name })),
            correct: sym.id,
        };
    }
    function symbolMeaningQuestion(sym, opts, rng) {
        return {
            id: sym.id,
            prompt: { text: 'Which symbol means…', meaning: sym.meaning },
            layout: 'symbols',
            // The symbol's name is its accessible label - for a screen reader this becomes a
            // meaning-to-name question, which still teaches the same thing.
            answers: symbolChoices(sym, opts.set, rng).map(s => ({ id: s.id, label: s.name, render: s.render })),
            correct: sym.id,
        };
    }

    // ---------------------------------------------------------------- question source

    // next() never repeats the question just asked (unless there's only one possible question).
    function questionSource(quizId, rawOptions, { seed = Date.now(), naming = 'letters' } = {}) {
        const opts = normaliseOptions(quizId, rawOptions);
        const rng = makeRng(seed);
        let make;
        if (quizId === 'noteNames') {
            const pool = noteNamePool(opts);
            make = () => noteNameQuestion(rng.pick(pool), opts, naming);
        } else if (quizId === 'keySignatures') {
            const pool = keyPool(opts);
            make = () => keySignatureQuestion(rng.pick(pool), rng.pick(opts.clefs), rng, naming);
        } else if (quizId === 'scales') {
            const pool = keyPool(opts);
            make = () => {
                const key = rng.pick(pool);
                const form = opts.minorForm === 'both' ? rng.pick(['harmonic', 'melodic']) : opts.minorForm;
                return scaleQuestion(key, rng.pick(opts.clefs), form, rng, naming);
            };
        } else if (quizId === 'symbolNames' || quizId === 'symbolMeanings') {
            const pool = symbolsIn(opts.set);
            const build = quizId === 'symbolNames' ? symbolNameQuestion : symbolMeaningQuestion;
            make = () => build(rng.pick(pool), opts, rng);
        } else {
            quiz(quizId); // throws
        }
        let lastId = null;
        return {
            options: opts,
            next() {
                let qn = make();
                for (let tries = 0; qn.id === lastId && tries < 20; tries++) qn = make();
                lastId = qn.id;
                return qn;
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
    // Right +1, wrong -1 (on a 4-choice question random guessing loses points). Timed: out of the
    // quiz's top pace for the round's length, so going faster than that can't score over 100.
    // Fixed: out of the number of questions; time is kept separately and doesn't affect the score.
    function scoreRound(quizId, roundId, { right, wrong }) {
        const r = round(roundId);
        const net = right - wrong;
        const score = r.seconds ? clamp(100 * net / (quiz(quizId).topPace * r.seconds / 60)) : clamp(100 * net / r.questions);
        return { score, grade: gradeFor(score) };
    }

    return {
        QUIZZES, ROUNDS, DEFAULT_ROUND, SYMBOLS, KEY_TABLE, RANGE_STEPS, NOTE_BUTTONS, TIMING, GRADE_LIMITS,
        quiz, round, normaliseOptions, optionVisible, settingsKey, describeOptions,
        makeRng, questionSource, scalePitches, keyPool, keyAlters, noteNamePool,
        spell, spellName, scoreRound, gradeFor, ALL_KEYS
    };
}));
