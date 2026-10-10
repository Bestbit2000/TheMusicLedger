// ML-263: unit tests for the Theory quiz engine (public/theoryEngine.js). Pure, no DOM. Loads
// notation.js and theoryEngine.js into one sandbox, exactly as the browser does.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
for (const f of ['notation.js', 'theoryEngine.js']) {
    vm.runInNewContext(fs.readFileSync(new URL(`../../public/${f}`, import.meta.url), 'utf8'), sandbox);
}
const clone = (v) => JSON.parse(JSON.stringify(v));
const wrap = (o) => new Proxy(o, { get: (t, k) => (typeof t[k] === 'function' ? (...a) => clone(t[k](...a)) : clone(t[k])) });
const T = wrap(sandbox.self.TheoryEngine);
const N = sandbox.self.Notation;
// questionSource returns an object with a method, so it can't go through the cloning proxy.
const source = (...a) => sandbox.self.TheoryEngine.questionSource(...a);
const take = (src, count) => Array.from({ length: count }, () => clone(src.next()));
const typeOf = (id) => id.split(':')[0];

// Every combination of a quiz's options.
function combos(quizId) {
    const defs = T.QUIZZES.find(q => q.id === quizId).options;
    let out = [{}];
    for (const d of defs) {
        const values = d.multi
            ? [[d.choices[0].value], [d.choices[1].value], d.choices.map(c => c.value)]
            : d.choices.map(c => c.value);
        out = out.flatMap(o => values.map(v => ({ ...o, [d.key]: v })));
    }
    return out;
}

const SEMIS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(pitch) {
    const p = N.parsePitch(pitch);
    return (p.octave + 1) * 12 + SEMIS[p.letter] + p.alter;
}
const steps = (pitches) => pitches.slice(1).map((p, i) => midi(p) - midi(pitches[i])).join('');

describe('options', () => {
    test('the quizzes (Intervals and Chords are grade-only, ML-309 C)', () => {
        assert.deepEqual(T.QUIZZES.map(q => q.id), ['noteNames', 'keys', 'symbols', 'intervals', 'chords', 'mixed']);
        assert.deepEqual(T.QUIZZES.filter(q => q.gradeOnly).map(q => q.id), ['intervals', 'chords']);
    });
    test('defaults fill in, and anything not on the list is thrown out', () => {
        assert.deepEqual(T.normaliseOptions('noteNames', {}), { clefs: ['treble'], range: 0, accidentals: 'none', grade: 0 });
        assert.deepEqual(T.normaliseOptions('noteNames', { clefs: ['bass', 'soprano'], range: 3, accidentals: 'sharps', grade: 9 }), { clefs: ['bass'], range: 0, accidentals: 'sharps', grade: 0 });
        assert.deepEqual(T.normaliseOptions('noteNames', { clefs: [] }).clefs, ['treble']);
        assert.equal(T.normaliseOptions('keys', { upTo: 1 }).upTo, 3, 'up to 1 is no longer offered');
        assert.deepEqual(T.QUIZZES.find(q => q.id === 'keys').options.find(o => o.key === 'upTo').choices.map(c => c.value), [3, 5, 7]);
        assert.throws(() => T.normaliseOptions('nope', {}));
    });
    test('minor scales option only with minor keys and scales on', () => {
        const def = T.QUIZZES.find(q => q.id === 'keys').options.find(o => o.key === 'minorForm');
        assert.equal(T.optionVisible(def, { modes: 'both', show: 'both' }), true);
        assert.equal(T.optionVisible(def, { modes: 'both', show: 'scales' }), true);
        assert.equal(T.optionVisible(def, { modes: 'both', show: 'keySignatures' }), false);
        assert.equal(T.optionVisible(def, { modes: 'major', show: 'both' }), false);
    });
    test('settings key: same options = same key, whatever the order; hidden options ignored', () => {
        const a = T.settingsKey('noteNames', { clefs: ['treble', 'bass'], range: 2 }, 't30');
        assert.equal(a, T.settingsKey('noteNames', { clefs: ['bass', 'treble'], range: 2 }, 't30'));
        assert.notEqual(a, T.settingsKey('noteNames', { clefs: ['bass', 'treble'], range: 2 }, 'q10'));
        assert.equal(T.settingsKey('keys', { modes: 'major', minorForm: 'melodic' }, 'q10'), T.settingsKey('keys', { modes: 'major', minorForm: 'harmonic' }, 'q10'));
        assert.notEqual(T.settingsKey('keys', { modes: 'both', minorForm: 'melodic' }, 'q10'), T.settingsKey('keys', { modes: 'both', minorForm: 'harmonic' }, 'q10'));
        assert.equal(T.settingsKey('noteNames', {}, 'bogus'), T.settingsKey('noteNames', {}, 't30'));
    });
    test('describes a set of options for the results screen', () => {
        assert.equal(T.describeOptions('noteNames', { clefs: ['treble', 'bass'], range: 2 }, 't30'), 'Treble, Bass · 2 ledger lines · None · 30 s');
        assert.equal(T.describeOptions('keys', { modes: 'both' }, 'q10'), 'Treble · Both · Up to 3 ♯/♭ · Both · Major and minor · Harmonic · 10 questions');
        assert.equal(T.describeOptions('symbols', { set: 'terms', ask: 'meanings' }, 't30'), 'Terms · Ask: meanings · 30 s');
    });
});

describe('every quiz, every option combination', () => {
    for (const q of T.QUIZZES) {
        test(q.id, () => {
            for (const opts of combos(q.id)) {
                const src = source(q.id, opts, { seed: 42 });
                assert.ok(src.size > 0, `no questions for ${JSON.stringify(opts)}`);
                const qs = take(src, Math.min(60, src.size * 2 + 5));
                qs.forEach((qn, i) => {
                    const ids = qn.answers.map(a => a.id);
                    assert.equal(new Set(ids).size, ids.length, `duplicate answers ${qn.id}`);
                    assert.ok(hasRight(qn), `right answer missing ${qn.id}`);
                    if (typeOf(qn.id) === 'note') assert.ok(ids.length === 7 || ids.length === 17);
                    else if (['keySignature', 'scale'].includes(typeOf(qn.id))) assert.equal(ids.length, 18, qn.id); // ML-438: the note keyboard and C flat
                    else assert.ok(({ chord: [3, 4], inversion: [3], cadence: [3], chromatic: [2] }[typeOf(qn.id)] || [4]).includes(ids.length), `${qn.id} ${JSON.stringify(opts)}`);
                    if (i && src.size > 1) assert.notEqual(qn.id, qs[i - 1].id, 'same question twice in a row');
                    if (qn.prompt.staff) N.staff(qn.prompt.staff);
                });
            }
        });
    }
    test('the same seed gives the same round', () => {
        const ids = (seed) => take(source('noteNames', { range: 6, accidentals: 'flats' }, { seed }), 25).map(q => q.id);
        assert.deepEqual(ids(7), ids(7));
        assert.notDeepEqual(ids(7), ids(8));
    });
});

describe('dealing: every question once before any repeats', () => {
    for (const [quizId, opts] of [['noteNames', {}], ['noteNames', { range: 6, accidentals: 'sharps', clefs: ['treble', 'bass'] }], ['keys', { upTo: 7, modes: 'both', minorForm: 'both' }], ['symbols', { set: 'everything' }]]) {
        test(`${quizId} ${JSON.stringify(opts)}`, () => {
            const src = source(quizId, opts, { seed: 3 });
            const firstDeal = take(src, src.size).map(q => q.id);
            assert.equal(new Set(firstDeal).size, src.size, 'a repeat before every question was asked');
            const secondDeal = take(src, src.size).map(q => q.id);
            assert.deepEqual(new Set(secondDeal), new Set(firstDeal), 'the second deal is the same questions again');
        });
    }
    test('mixed takes the question types in turn', () => {
        for (const level of ['beginner', 'intermediate', 'advanced']) {
            const src = source('mixed', { level, clefs: ['treble', 'bass'] }, { seed: 11 });
            const types = take(src, 50).map(q => typeOf(q.id));
            for (let i = 0; i + 5 <= 50; i += 5) assert.equal(new Set(types.slice(i, i + 5)).size, 5, `level ${level}: every type once in each run of 5`);
        }
    });
});

describe('note names', () => {
    const pitches = (clefs, range, acc = 'none') => T.noteItems(clefs, range, [acc]).map(p => p.pitch);
    test('ranges: on the staff is D4-G5 treble / F2-B3 bass, and 6 lines reaches G2-D7 / B0-F5', () => {
        const t0 = pitches(['treble'], 0);
        assert.equal(t0[0], 'D4'); assert.equal(t0[t0.length - 1], 'G5'); assert.equal(t0.length, 11);
        const b0 = pitches(['bass'], 0);
        assert.equal(b0[0], 'F2'); assert.equal(b0[b0.length - 1], 'B3');
        const t6 = pitches(['treble'], 6);
        assert.equal(t6[0], 'G2'); assert.equal(t6[t6.length - 1], 'D7');
        const b6 = pitches(['bass'], 6);
        assert.equal(b6[0], 'B0'); assert.equal(b6[b6.length - 1], 'F5');
    });
    test('every note needs no more ledger lines than the range allows', () => {
        for (const range of [0, 2, 4, 6]) for (const clef of ['treble', 'bass']) {
            for (const p of T.noteItems([clef], range, ['sharps'])) {
                assert.ok(N.ledgerSteps(N.staffStep(p.pitch, clef)).length <= range, `${p.pitch} ${clef} range ${range}`);
            }
        }
    });
    test('sharps/flats: only the 12 one-spelling notes, matching the buttons', () => {
        const names = (acc) => new Set(T.noteItems(['treble'], 6, [acc]).map(p => p.name));
        assert.deepEqual([...names('sharps')].sort(), T.NOTE_BUTTONS.sharps.slice().sort());
        assert.deepEqual([...names('flats')].sort(), T.NOTE_BUTTONS.flats.slice().sort());
    });
    test('mixed advanced asks sharps and flats, each with its own 12 buttons, naturals once', () => {
        const items = T.noteItems(['treble'], 0, ['sharps', 'flats']);
        assert.equal(new Set(items.map(i => i.pitch)).size, items.length);
        assert.ok(items.some(i => i.name === 'C#') && items.some(i => i.name === 'Db'));
    });
    test('solfège labels are spelled syllables', () => {
        const q = clone(source('noteNames', { accidentals: 'flats' }, { seed: 1, naming: 'solfege' }).next());
        assert.deepEqual(q.answers.map(a => a.label), ['Do♯', 'Re♯', 'Fa♯', 'Sol♯', 'La♯', 'Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti', 'Re♭', 'Mi♭', 'Sol♭', 'La♭', 'Ti♭']);
    });
    test('ML-292: sharps/flats questions show the keyboard - 5 sharps, 7 naturals, 5 flats, no E#/B#/Cb/Fb', () => {
        for (const acc of ['sharps', 'flats', 'both']) {
            const q = clone(source('noteNames', { accidentals: acc }, { seed: 3 }).next());
            assert.equal(q.layout, 'keyboard');
            assert.deepEqual(q.answers.map(a => a.id), T.KEYBOARD_BUTTONS);
            for (const x of ['E#', 'B#', 'Cb', 'Fb']) assert.ok(!q.answers.some(a => a.id === x));
        }
        assert.equal(clone(source('noteNames', { accidentals: 'none' }, { seed: 3 }).next()).layout, 'notes');
    });
    test('sharps and flats "Both": the naturals once, every black key in both spellings', () => {
        const src = source('noteNames', { accidentals: 'both' }, { seed: 5 });
        const names = new Set(take(src, src.size).map(q => q.correct));
        for (const n of ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C#', 'Db', 'F#', 'Gb', 'A#', 'Bb']) assert.ok(names.has(n), `${n} never asked`);
        const size = (acc) => source('noteNames', { accidentals: acc }, { seed: 5 }).size;
        assert.equal(size('both'), size('sharps') + size('flats') - size('none'));
        assert.equal(T.describeOptions('noteNames', { accidentals: 'both' }, 'q10'), 'Treble · On the staff · Sharps and flats · 10 questions');
    });
});

describe('keys', () => {
    const k = (id) => T.ALL_KEYS.find(x => x.id === id);
    test('the 30 keys, with the right number of sharps or flats', () => {
        assert.equal(T.ALL_KEYS.length, 30);
        assert.deepEqual([k('D major').type, k('D major').count], ['sharp', 2]);
        assert.deepEqual([k('Eb major').type, k('Eb major').count], ['flat', 3]);
        assert.deepEqual([k('F# minor').type, k('F# minor').count], ['sharp', 3]);
        assert.deepEqual([k('Cb major').type, k('Cb major').count], ['flat', 7]);
        assert.deepEqual(T.keyAlters(k('Eb major')), { C: 0, D: 0, E: -1, F: 0, G: 0, A: -1, B: -1 });
    });
    test('how many questions: key signatures, scales, both', () => {
        const size = (o) => source('keys', o, { seed: 1 }).size;
        assert.equal(size({ show: 'keySignatures' }), 7);       // up to 3, both, major
        assert.equal(size({ show: 'scales' }), 7);
        assert.equal(size({}), 14);
        assert.equal(size({ show: 'keySignatures', upTo: 7, modes: 'both', clefs: ['treble', 'bass'] }), 60);
        assert.equal(size({ show: 'scales', upTo: 7, modes: 'both', minorForm: 'both' }), 45); // 15 major + 15 minor x 2 forms
    });
    // ML-438: a key is answered on the note keyboard - the same 18 buttons in the same order every time
    test('key signature questions say major or minor, and the answer is the key\'s note on the keyboard', () => {
        for (const q of take(source('keys', { show: 'keySignatures', upTo: 7, modes: 'both' }, { seed: 3 }), 60)) {
            const key = T.ALL_KEYS.find(x => x.id === q.id.split(':')[2]);
            assert.equal(q.prompt.text, `Which ${key.mode} key?`);
            assert.equal(q.layout, 'keyboard');
            assert.deepEqual(q.answers.map(a => a.id), T.KEY_BUTTONS);
            assert.equal(q.correct, key.tonic);
            assert.equal(q.modes, undefined);
            // ML-516: with major and minor both in play the mode is also shown under the keyboard, given
            assert.deepEqual(q.shownModes.map(m => m.id), ['major', 'minor']);
            assert.equal(q.modeGiven, key.mode);
        }
        // ...and in a major-only quiz there is no such row
        for (const q of take(source('keys', { show: 'keySignatures', upTo: 7, modes: 'major' }, { seed: 3 }), 20)) {
            assert.equal(q.shownModes, null);
            assert.equal(q.modeGiven, null);
        }
        assert.ok(T.KEY_BUTTONS.includes('Cb') && T.ALL_KEYS.every(k => T.KEY_BUTTONS.includes(k.tonic)), 'every key has its button');
    });
});

// ML-438: a two-tap question's right answer is a key ("F# minor"): its note is on the keyboard, its mode under it
function hasRight(q) {
    if (!q.modes) return q.answers.some(a => a.id === q.correct);
    const cut = q.correct.lastIndexOf(' ');
    return q.answers.some(a => a.id === q.correct.slice(0, cut)) && q.modes.some(m => m.id === q.correct.slice(cut + 1));
}

describe('scales', () => {
    const k = (id) => T.ALL_KEYS.find(x => x.id === id);
    test('C major and A minor, both forms', () => {
        assert.deepEqual(T.scalePitches(k('C major'), 'treble'), ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
        assert.deepEqual(T.scalePitches(k('A minor'), 'treble', 'harmonic'), ['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G#5', 'A5']);
        assert.deepEqual(T.scalePitches(k('A minor'), 'bass', 'melodic'), ['A2', 'B2', 'C3', 'D3', 'E3', 'F#3', 'G#3', 'A3']);
        assert.equal(T.scalePitches(k('D# minor'), 'treble', 'harmonic')[6], 'Cx5');
    });
    test('every key, both clefs: the right step pattern, one of each letter, sitting on the staff', () => {
        for (const key of T.ALL_KEYS) for (const clef of ['treble', 'bass']) for (const form of ['harmonic', 'melodic']) {
            const ps = T.scalePitches(key, clef, form);
            const want = key.mode === 'major' ? '2212221' : form === 'harmonic' ? '2122131' : '2122221';
            assert.equal(steps(ps), want, `${key.id} ${form} ${clef}: ${ps.join(' ')}`);
            assert.equal(new Set(ps.slice(0, 7).map(p => p[0])).size, 7);
            const st = N.staffStep(ps[0], clef);
            assert.ok(st >= -2 && st <= 4, `${key.id} tonic at step ${st}`);
        }
    });
    // ML-438: with major and minor in play a scale takes two taps - the note, then Major or Minor
    test('with minor on, a scale is answered with its note and Major or Minor; with major only the question says major', () => {
        for (const q of take(source('keys', { show: 'scales', upTo: 7, modes: 'both' }, { seed: 5 }), 40)) {
            const key = T.ALL_KEYS.find(x => x.id === q.correct);
            assert.ok(key, q.correct);
            assert.equal(q.prompt.text, 'Which scale is this?');
            assert.deepEqual(q.modes.map(m => m.id), ['major', 'minor']);
            assert.deepEqual(q.answers.map(a => a.id), T.KEY_BUTTONS);
        }
        for (const q of take(source('keys', { show: 'scales', upTo: 7, modes: 'major' }, { seed: 5 }), 20)) {
            assert.equal(q.prompt.text, 'Which major scale is this?');
            assert.equal(q.modes, null);
            assert.ok(T.KEY_BUTTONS.includes(q.correct));
        }
    });
    test('the keyboard greys out the notes that are no key in the round - but never the right one, and not in weak spots', () => {
        // major keys up to 3 sharps or flats: C, G, D, A and F, B flat, E flat - 7 of the 18 buttons
        for (const q of take(source('keys', { show: 'keySignatures', upTo: 3, keyTypes: 'both', modes: 'major' }, { seed: 2 }), 12)) {
            assert.deepEqual(T.KEY_BUTTONS.filter(n => !q.unused.includes(n)).sort(), ['A', 'Bb', 'C', 'D', 'Eb', 'F', 'G']);
            assert.ok(!q.unused.includes(q.correct));
        }
        // everything in play: nothing greyed out except notes that are no key at all
        const all = take(source('keys', { show: 'both', upTo: 7, keyTypes: 'both', modes: 'both' }, { seed: 2 }), 1)[0];
        assert.deepEqual(all.unused, T.KEY_BUTTONS.filter(n => !T.ALL_KEYS.some(k => k.tonic === n)));
    });
    test('a two-tap answer is allowed a second longer in a timed round', () => {
        const one = { questionId: 'scale:treble:C major', answerId: 'C', correct: true, ms: 3000 };
        assert.equal(T.parOfAnswer(one), 4);
        assert.equal(T.parOfAnswer({ ...one, answerId: 'C major', taps: 2 }), 5);
        const six = (a) => T.scoreRound('t30', Array.from({ length: 6 }, () => a)).score;
        assert.equal(six(one), 80);
        assert.equal(six({ ...one, taps: 2 }), 100);
    });
});

describe('symbols', () => {
    test('the sets and their sizes', () => {
        // The custom sets (ML-309's grade-only symbols aren't in them, so custom rounds are unchanged).
        const custom = T.SYMBOLS.filter(s => !s.gradeOnly);
        const count = (set) => custom.filter(s => s.set === set).length;
        assert.deepEqual(T.SET_IDS.map(count), [13, 9, 17, 11, 15, 0]); // speeds are T.SPEEDS, not symbols
        assert.equal(custom.length, 65);
    });
    test('unique, with a name and meaning, and every one draws', () => {
        const ids = T.SYMBOLS.map(s => s.id), names = T.SYMBOLS.map(s => s.name), meanings = T.SYMBOLS.map(s => s.meaning);
        for (const list of [ids, names, meanings]) assert.equal(new Set(list).size, list.length);
        for (const s of T.SYMBOLS) {
            const r = s.render;
            if (r.type === 'symbol') N.symbol(r.glyph);
            else if (r.type === 'staff') N.staff(r.staff);
            else if (r.type === 'hairpin') N.hairpin(r.dir);
            else if (r.type === 'text') N.textMark(r.text, { italic: r.italic, bold: r.bold });
            else assert.fail(`${s.id}: unknown render ${r.type}`);
        }
    });
    test('a staff scrap never shows a clef (except the alto and tenor clef questions, which are the clef)', () => {
        for (const s of T.SYMBOLS.filter(x => x.render.type === 'staff' && !['altoClef', 'tenorClef'].includes(x.id))) assert.equal(s.render.staff.hideClef, true, s.id);
    });
    test('ask names / meanings / both: 1 or 2 questions per symbol', () => {
        assert.equal(source('symbols', { set: 'basics', ask: 'names' }, { seed: 1 }).size, 13);
        assert.equal(source('symbols', { set: 'basics', ask: 'meanings' }, { seed: 1 }).size, 13);
        assert.equal(source('symbols', { set: 'basics' }, { seed: 1 }).size, 26);
        assert.equal(source('symbols', { set: 'everything' }, { seed: 1 }).size, 144); // 65 symbols x 2 + 7 speeds x 2
    });
    test('wrong answers come from the same set', () => {
        for (const q of take(source('symbols', { set: 'dynamics' }, { seed: 9 }), 30)) {
            assert.ok(q.answers.every(a => T.SYMBOLS.find(s => s.id === a.id).set === 'dynamics'));
        }
        for (const q of take(source('symbols', { set: 'everything' }, { seed: 4 }), 60).filter(q => !q.id.startsWith('speed'))) { // speeds: their own test (ML-297)
            const set = T.SYMBOLS.find(s => s.id === q.correct).set;
            assert.ok(q.answers.every(a => T.SYMBOLS.find(s => s.id === a.id).set === set), `${q.id} mixes sets`);
        }
    });
    test('terms: "what does this mean?" shows the word and offers meanings; the other way offers words', () => {
        const qs = take(source('symbols', { set: 'terms' }, { seed: 2 }), 30);
        const name = qs.find(q => typeOf(q.id) === 'symbolName');
        assert.equal(name.prompt.text, 'What does this mean?');
        assert.ok(name.answers.every(a => T.SYMBOLS.find(s => s.id === a.id).meaning === a.label));
        const meaning = qs.find(q => typeOf(q.id) === 'symbolMeaning');
        assert.equal(meaning.prompt.text, 'Which term means…');
        assert.ok(meaning.answers.every(a => a.render.type === 'text'));
    });
});

describe('scoring', () => {
    const ans = (type, right, wrong) => [...Array(right).fill({ questionId: `${type}:x`, correct: true }), ...Array(wrong).fill({ questionId: `${type}:x`, correct: false })];
    test('timed: right +1, wrong -1, each worth its par time - the same as the confirmed top paces', () => {
        assert.deepEqual(T.scoreRound('t30', ans('note', 17, 1)), { right: 17, wrong: 1, score: 80, grade: 4 });
        assert.equal(T.scoreRound('t30', ans('note', 20, 0)).score, 100);                                                // 40/min
        assert.equal(T.scoreRound('t30', ans('scale', 8, 0)).score, 100);                                                // 15/min
        assert.equal(T.scoreRound('t30', ans('keySignature', 12, 0)).score, 100);                                        // 24/min
        assert.equal(T.scoreRound('t30', ans('symbolName', 15, 0)).score, 100);                                          // 30/min
        assert.equal(T.scoreRound('t30', ans('symbolMeaning', 12, 0)).score, 100);                                       // 24/min
        assert.equal(T.scoreRound('t30', ans('scale', 2, 9)).score, 0);
    });
    test('timed, mixed types: the pars add up', () => {
        // 5 notes (7.5 s) + 2 scales (8 s) + 1 wrong key signature (-2.5 s) = 13 s of 30 -> 43
        const a = [...ans('note', 5, 0), ...ans('scale', 2, 0), ...ans('keySignature', 0, 1)];
        assert.deepEqual(T.scoreRound('t30', a), { right: 7, wrong: 1, score: 43, grade: 2 });
    });
    test('fixed: out of the number of questions', () => {
        assert.deepEqual(T.scoreRound('q10', ans('scale', 8, 2)), { right: 8, wrong: 2, score: 60, grade: 3 });
        assert.equal(T.scoreRound('q10', ans('note', 10, 0)).score, 100);
    });
    test('only the 30 s and 10-question rounds; repeat 1-5 times (ML-354)', () => {
        assert.deepEqual(T.ROUNDS.map(r => r.value), ['t30', 'q10']);
        assert.equal(T.round('t60').value, 't30'); // an old stored choice falls back to the default
        assert.deepEqual(T.REPEATS, [1, 2, 3, 4, 5]);
        assert.equal(T.repeatsOf(3), 3);
        assert.equal(T.repeatsOf(9), 1);
        assert.equal(T.repeatsOf(undefined), 1);
    });
    test('repeats: each block scored on its own, the best one counts (ML-354)', () => {
        const inBlock = (block, list) => list.map(a => ({ ...a, block }));
        // Block 1: 6 of 10, block 2: 9 of 10 (-1), block 3: 7 of 10
        const a = [...inBlock(1, ans('note', 8, 2)), ...inBlock(2, ans('note', 9, 1)), ...inBlock(3, ans('note', 7, 3))];
        const r = T.scoreBlocks('q10', a, 3, [40000, 38000, 45000]);
        assert.deepEqual(r, { right: 9, wrong: 1, score: 80, grade: 4, ms: 38000, bestBlock: 2, blockScores: [60, 80, 40] });
        // Equal scores: the quicker block, then the earlier one.
        const tie = [...inBlock(1, ans('note', 9, 1)), ...inBlock(2, ans('note', 9, 1))];
        assert.equal(T.scoreBlocks('q10', tie, 2, [50000, 42000]).bestBlock, 2);
        assert.equal(T.scoreBlocks('q10', tie, 2, [42000, 42000]).bestBlock, 1);
        // x1 is exactly the old single round.
        assert.deepEqual(T.scoreBlocks('t30', ans('note', 17, 1), 1, [30000]), { right: 17, wrong: 1, score: 80, grade: 4, ms: 30000, bestBlock: 1, blockScores: [80] });
        // A timed block with nothing answered scores 0.
        assert.deepEqual(T.scoreBlocks('t30', inBlock(1, ans('note', 10, 0)), 2, [30000, 30000]).blockScores, [50, 0]);
    });
    test('grade limits', () => {
        assert.deepEqual([100, 90, 89, 70, 69, 50, 49, 30, 29, 0].map(s => T.gradeFor(s)), [5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
    });
});

describe('smart learn (ML-269)', () => {
    test('weights: wrong +2, right -1, from 0 to 10 (5 wrongs to the top, 2 rights undo a wrong)', () => {
        let w = 0;
        for (let i = 0; i < 5; i++) w = T.nextWeight(w, false);
        assert.equal(w, 10);
        assert.equal(T.nextWeight(10, false), 10);
        assert.equal(T.nextWeight(T.nextWeight(4, true), true), 2);
        assert.equal(T.nextWeight(0, true), 0);
        assert.equal(T.nextWeight(undefined, false), 2);
    });
    test('without weights nothing changes: the same seed deals the same round as before', () => {
        const plain = take(source('noteNames', {}, { seed: 21 }), 22).map(q => q.id);
        const again = take(source('noteNames', {}, { seed: 21, weights: null }), 22).map(q => q.id);
        assert.deepEqual(plain, again);
    });
    test('still every question once per deal - weights change the order, not what is asked', () => {
        const src = source('symbols', { set: 'basics' }, { seed: 5, weights: { 'symbolName:fermata': 10, 'symbolMeaning:tie': 6 } });
        const ids = take(src, src.size).map(q => q.id);
        assert.equal(new Set(ids).size, src.size);
    });
    test('a weak question comes early: weight 10 among 11 known notes lands near the front', () => {
        let pos = 0, first = 0;
        const runs = 400;
        for (let seed = 1; seed <= runs; seed++) {
            const ids = take(source('noteNames', {}, { seed, weights: { 'note:treble:B4': 10 } }), 11).map(q => q.id);
            const p = ids.indexOf('note:treble:B4');
            pos += p + 1;
            if (p === 0) first++;
        }
        // 11 questions, one 6x as likely at each pick: first about 6/16 = 37% of the time, 2nd-3rd on average
        assert.ok(pos / runs < 3.5, `average position ${pos / runs}`);
        assert.ok(first / runs > 0.28 && first / runs < 0.47, `first ${first / runs}`);
    });
    test('record() updates the round\'s weights, so the next deal in the same round uses them', () => {
        const src = source('noteNames', {}, { seed: 3, weights: {} });
        assert.equal(src.smart, true);
        for (let i = 0; i < 5; i++) src.record('note:treble:E4', false);
        take(src, 11); // finish the first deal
        let early = 0;
        for (let d = 0; d < 20; d++) { const ids = take(src, 11).map(q => q.id); if (ids.indexOf('note:treble:E4') < 3) early++; }
        assert.ok(early >= 10, `E4 early in only ${early} of 20 deals`);
    });
    test('question ids are the weight keys, for every question type', () => {
        const src = source('mixed', { level: 'advanced', clefs: ['treble', 'bass'] }, { seed: 1 });
        for (const q of take(src, 30)) assert.match(q.id, /^(note|keySignature|scale|symbolName|symbolMeaning|speedName|speedBpm):/);
    });
});

describe('smart learn refinements (ML-269)', () => {
    test('a slow right answer (over 2x par) leaves the weight alone; a quick one lowers it', () => {
        assert.equal(T.nextWeight(4, true, { questionId: 'note:treble:B4', ms: 2000 }), 3);  // par 1.5 s: 2 s is fine
        assert.equal(T.nextWeight(4, true, { questionId: 'note:treble:B4', ms: 3500 }), 4);  // over 3 s: slow
        assert.equal(T.nextWeight(4, true, { questionId: 'scale:treble:D major', ms: 7000 }), 3); // par 4 s: 7 s is fine
        assert.equal(T.nextWeight(4, false, { questionId: 'note:treble:B4', ms: 9000 }), 6);
    });
    test('review: not asked for a week adds 1, then 1 more a week, up to 3, on top of the stored weight', () => {
        assert.deepEqual([0, 6, 7, 13, 14, 21, 100].map(d => T.reviewBoost(d)), [0, 0, 1, 1, 2, 3, 3]);
        assert.equal(T.effectiveWeight(0, 30), 3);
        assert.equal(T.effectiveWeight(9, 30), 10);
        assert.equal(T.effectiveWeight(4, 2), 4);
    });
    test('a missed question comes back 3 questions later in the same round (and again if missed again)', () => {
        const src = source('noteNames', { range: 6 }, { seed: 4, weights: {} });
        const q1 = clone(src.next());
        src.record(q1.id, false, 1000);
        const next3 = take(src, 3).map(q => q.id);
        assert.equal(next3.indexOf(q1.id), 2, `came back at ${next3.indexOf(q1.id) + 1}`);
        src.record(q1.id, false, 1000);
        assert.equal(take(src, 3).map(q => q.id).indexOf(q1.id), 2);
        // Right the second time round: no more retries.
        src.record(q1.id, true, 1000);
        assert.ok(!take(src, 4).map(q => q.id).includes(q1.id));
    });
    test('no retries without Smart learn', () => {
        const src = source('noteNames', { range: 6 }, { seed: 4 });
        const q1 = clone(src.next());
        src.record(q1.id, false, 1000);
        assert.ok(!take(src, 3).map(q => q.id).includes(q1.id));
    });
    test('every question can be rebuilt from its id (what weak spots relies on)', () => {
        const ids = new Set();
        for (const level of ['advanced']) for (const q of take(source('mixed', { level, clefs: ['treble', 'bass'] }, { seed: 2 }), 300)) ids.add(q.id);
        for (const q of take(source('noteNames', { range: 6, accidentals: 'flats', clefs: ['treble', 'bass'] }, { seed: 2 }), 120)) ids.add(q.id);
        for (const q of take(source('symbols', { set: 'everything' }, { seed: 2 }), 144)) ids.add(q.id);
        for (const id of ids) {
            const src = source('weakSpots', {}, { seed: 1, weights: { [id]: 4 } });
            assert.equal(src.size, 1, id);
            assert.equal(clone(src.next()).id, id);
            assert.ok(T.describeQuestion(id), id);
        }
        assert.equal(T.itemFromId('note:soprano:C4'), null);
        assert.equal(T.itemFromId('symbolName:noSuchSymbol'), null);
    });
    test('weak spots: only the weighted questions, weakest first more often, and nothing without weights', () => {
        const weights = { 'note:treble:B4': 10, 'keySignature:bass:D major': 2, 'symbolMeaning:fermata': 6, 'note:treble:C5': 0 };
        const src = source('weakSpots', {}, { seed: 3, weights });
        assert.equal(src.size, 3);
        assert.deepEqual(new Set(take(src, 3).map(q => q.id)), new Set(['note:treble:B4', 'keySignature:bass:D major', 'symbolMeaning:fermata']));
        assert.equal(source('weakSpots', {}, { seed: 3 }).size, 0);
        assert.equal(source('weakSpots', {}, { seed: 3 }).next(), null);
        assert.equal(T.describeQuestion('note:treble:Bb4'), 'B♭4 on the treble staff');
        assert.equal(T.describeQuestion('scale:bass:A minor:melodic'), 'A minor (melodic) scale, bass clef');
        assert.equal(T.describeQuestion('symbolName:allegro'), 'Allegro: what it means');
    });
});

describe('scales practice (ML-9)', () => {
    const b = (o) => T.buildScale(o);
    test('C major, 1 octave up: C4 to C5', () => {
        assert.deepEqual([...b({ keyId: 'C major', octaves: 1 }).pitches], ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
    });
    test('D major, 2 octaves up and down: 29 notes, spelled from the key, turning at D6', () => {
        const s = b({ keyId: 'D major', octaves: 2, direction: 'both' });
        assert.equal(s.pitches.length, 29);
        assert.equal(s.pitches[14], 'D6');
        assert.equal(s.pitches[2], 'F#4');
        assert.deepEqual({ ...s.keySignature }, { type: 'sharp', count: 2 });
        assert.equal(s.title, 'D major scale');
    });
    test('minor forms: harmonic raises the 7th both ways; melodic raises 6th and 7th going up, natural coming down', () => {
        const h = b({ keyId: 'A minor', form: 'harmonic', direction: 'both' }).pitches;
        assert.equal(h[6], 'G#5'); assert.equal(h[8], 'G#5');
        const m = b({ keyId: 'A minor', form: 'melodic', direction: 'both' }).pitches;
        assert.deepEqual([m[5], m[6]], ['F#5', 'G#5']);
        assert.deepEqual([m[8], m[9]], ['G5', 'F5']);
        const n = b({ keyId: 'A minor', form: 'natural' }).pitches;
        assert.ok(!n.some(p => p.includes('#')));
    });
    test('arpeggio: tonic, 3rd, 5th per octave, then the top tonic', () => {
        assert.deepEqual([...b({ keyId: 'G major', type: 'arpeggio', octaves: 2 }).pitches], ['G4', 'B4', 'D5', 'G5', 'B5', 'D6', 'G6']);
    });
    test('a major key ignores a minor form; an unknown key throws', () => {
        assert.equal(b({ keyId: 'F major', form: 'melodic' }).form, 'major');
        assert.throws(() => b({ keyId: 'H major' }));
    });
    test('bass clef starts low enough to sit on the staff', () => {
        const s = b({ keyId: 'C major', clef: 'bass' });
        assert.ok(N.staffStep(s.pitches[0], 'bass') >= -2 && N.staffStep(s.pitches[0], 'bass') <= 4);
    });
    test('writeScale: accidentals only where the key signature does not cover them, naturals back, lasting a bar', () => {
        const w = T.writeScale(b({ keyId: 'A minor', form: 'melodic', direction: 'both' }), 16);
        // A minor has no key signature: raised F#/G# get sharps; coming down (next bar) G and F get naturals
        assert.equal(w[5].accidental, true); assert.equal(w[6].accidental, true);
        assert.equal(w[0].accidental, false);
        assert.equal(w[8].pitch, 'Gn5'); assert.equal(w[8].accidental, true);
        // ...but in a new bar the G is plain again (accidentals last a bar)
        assert.equal(T.writeScale(b({ keyId: 'A minor', form: 'melodic', direction: 'both' }), 8)[8].accidental, false);
        const d = T.writeScale(b({ keyId: 'D major', octaves: 1 }), 8);
        assert.ok(d.every(n => !n.accidental)); // all covered by the key signature
        for (const n of T.writeScale(b({ keyId: 'E minor', form: 'harmonic', octaves: 2, direction: 'both' }), 4)) N.staff({ clef: 'treble', items: [{ type: 'note', ...n }] });
    });
    test('scalePool: separate sharp and flat limits, forms and types', () => {
        const p = T.scalePool({ maxSharps: 2, maxFlats: 3, forms: ['major'], types: ['scale', 'arpeggio'] });
        const keys = new Set(p.map(x => x.keyId));
        assert.deepEqual([...keys].sort(), ['Bb major', 'C major', 'D major', 'Eb major', 'F major', 'G major']);
        assert.equal(p.length, 12);
        assert.ok(T.scalePool({ maxSharps: 0, maxFlats: 0, forms: ['harmonic', 'natural'], types: ['scale'] }).every(x => x.keyId === 'A minor'));
    });
    test('every key in every form builds, and every note draws', () => {
        for (const k of T.ALL_KEYS) for (const form of ['major', 'harmonic', 'melodic', 'natural']) for (const octaves of [1, 3]) {
            const s = b({ keyId: k.id, form, octaves, direction: 'both' });
            N.staff({ clef: 'treble', keySignature: s.keySignature || undefined, items: T.writeScale(s, 8).map(n => ({ type: 'note', head: 'noteQuarterUp', ...n })) });
        }
    });
});

describe('speeds (ML-297)', () => {
    test('seven bands cover 15-200 bpm with no gaps, three with two names', () => {
        assert.equal(T.SPEEDS.length, 7);
        assert.equal(T.SPEEDS[0].min, 15);
        assert.equal(T.SPEEDS[6].max, 200);
        for (let i = 1; i < 7; i++) assert.equal(T.SPEEDS[i].min, T.SPEEDS[i - 1].max + 1);
        assert.deepEqual(T.SPEEDS.filter(s => s.names.length === 2).map(s => s.names.join('/')), ['Grave/Largo', 'Adagio/Lento', 'Presto/Prestissimo']);
    });
    test('speedLabel: what a tempo box shows, both names where there are two', () => {
        assert.equal(T.speedLabel(15), 'Grave / Largo');
        assert.equal(T.speedLabel(55), 'Grave / Largo');
        assert.equal(T.speedLabel(56), 'Adagio / Lento');
        assert.equal(T.speedLabel(108), 'Moderato');
        assert.equal(T.speedLabel(119), 'Moderato');
        assert.equal(T.speedLabel(120), 'Allegro');
        assert.equal(T.speedLabel(200), 'Presto / Prestissimo');
        assert.equal(T.speedLabel(240), 'Presto / Prestissimo'); // Play Flow can go over 200
    });
    test('names / meanings / both: 7 or 14 questions', () => {
        assert.equal(source('symbols', { set: 'speeds', ask: 'names' }, { seed: 1 }).size, 7);
        assert.equal(source('symbols', { set: 'speeds', ask: 'meanings' }, { seed: 1 }).size, 7);
        assert.equal(source('symbols', { set: 'speeds' }, { seed: 1 }).size, 14);
    });
    test('a metronome mark is a round bpm inside its band; one name per answer; neighbours, slow to fast', () => {
        for (const q of take(source('symbols', { set: 'speeds', ask: 'names' }, { seed: 4 }), 70)) {
            const band = T.SPEEDS.find(s => s.id === q.correct);
            assert.equal(q.prompt.render.type, 'tempo');
            assert.ok(q.prompt.render.bpm >= band.min && q.prompt.render.bpm <= band.max, q.id);
            assert.equal(q.prompt.render.bpm % 5, 0);
            assert.equal(q.answers.length, 4);
            const idx = q.answers.map(a => T.SPEEDS.findIndex(s => s.id === a.id));
            assert.deepEqual(idx, idx.slice().sort((a, b) => a - b));
            assert.ok(Math.max(...idx) - Math.min(...idx) <= 4, 'wrong answers are the nearby bands');
            for (const a of q.answers) assert.ok(T.SPEEDS.find(s => s.id === a.id).names.includes(a.label), a.label);
        }
    });
    test('a speed name -> its bpm band; either of two names is asked', () => {
        const asked = new Set();
        for (const q of take(source('symbols', { set: 'speeds', ask: 'meanings' }, { seed: 5 }), 140)) {
            assert.equal(q.prompt.render.type, 'text');
            asked.add(q.prompt.render.text);
            assert.match(q.answers.find(a => a.id === q.correct).label, /^\d+-\d+\+? bpm$/);
        }
        for (const n of ['Grave', 'Largo', 'Adagio', 'Lento', 'Presto', 'Prestissimo']) assert.ok(asked.has(n), n);
    });
    test('the metronome mark draws in Bravura', () => {
        const svg = N.tempoMark(108, { label: 'Crotchet equals 108' });
        assert.ok(svg.includes(N.glyphChar('noteQuarterUp')));
        assert.ok(svg.includes('= 108'));
        assert.ok(svg.includes('role="img"'));
    });
    test('Mixed Advanced (Everything) asks them; Beginner does not', () => {
        const ids = (level) => new Set(take(source('mixed', { level }, { seed: 3 }), 600).map(q => q.id.split(':')[0]));
        assert.ok(ids('advanced').has('speedName'));
        assert.ok(!ids('beginner').has('speedName'));
    });
});

describe('Theory grades (ML-309)', () => {
    test('cumulative: each grade has everything the one before had, and more', () => {
        for (let g = 2; g <= 5; g++) {
            const a = T.gradeContent(g - 1), b = T.gradeContent(g);
            for (const k of ['clefs', 'accidentals', 'keyIds', 'minorForms']) for (const x of a[k]) assert.ok(b[k].includes(x), `grade ${g} lost ${k} ${x}`);
            for (const sym of a.symbols) assert.ok(b.symbols.some(x => x.id === sym.id), `grade ${g} lost ${sym.id}`);
            assert.ok(b.range >= a.range);
            assert.ok(b.symbols.length > a.symbols.length);
        }
    });
    test('what each grade adds (draft from the ABRSM syllabus)', () => {
        assert.deepEqual(T.gradeContent(1).keyIds, ['C major', 'G major', 'D major', 'F major']);
        assert.deepEqual(T.gradeContent(1).clefs, ['treble', 'bass']);
        assert.deepEqual(T.gradeContent(2).keyIds.filter(k => k.endsWith('minor')), ['A minor', 'E minor', 'D minor']);
        assert.ok(T.gradeContent(2).keyIds.includes('Eb major') && !T.gradeContent(2).keyIds.includes('E major'));
        assert.equal(T.gradeContent(3).keyIds.length, 18); // up to 4 sharps/flats, major and minor
        assert.deepEqual(T.gradeContent(3).minorForms, ['harmonic', 'melodic']);
        assert.deepEqual(T.gradeContent(4).clefs, ['treble', 'bass', 'alto']);
        assert.deepEqual(T.gradeContent(5).clefs, ['treble', 'bass', 'alto', 'tenor']);
        assert.equal(T.gradeContent(5).keyIds.length, 26);
        assert.ok(!T.gradeContent(5).symbols.some(s => s.id === 'introBrackets'), 'intro brackets are not in the syllabus');
        assert.equal(T.gradeSummary().length, 5);
    });
    test('a grade replaces the options except clef / show / ask; clefs are the grade\'s', () => {
        const o = T.normaliseOptions('keys', { grade: 2, clefs: ['alto', 'bass'], upTo: 7 });
        assert.deepEqual(o.clefs, ['bass']);
        assert.equal(T.normaliseOptions('noteNames', { grade: 1, clefs: ['tenor'] }).clefs[0], 'treble');
        const keys = T.QUIZZES.find(q => q.id === 'keys');
        assert.deepEqual(keys.options.filter(d => T.optionVisible(d, o)).map(d => d.key), ['clefs', 'show']);
        assert.equal(T.settingsKey('keys', o, 't30'), 'keys|t30|grade=2;clefs=bass;show=both');
        assert.equal(T.describeOptions('keys', o, 't30'), 'Grade 2 · Bass · Both · 30 s');
        // custom settings keys are unchanged by the grade option
        assert.equal(T.settingsKey('keys', {}, 't30'), 'keys|t30|clefs=treble;show=both;upTo=3;keyTypes=both;modes=major');
        assert.equal(T.normaliseOptions('weakSpots', { grade: 3 }).grade, 0);
    });
    test('every quiz at every grade deals valid questions that draw, only from the grade', () => {
        for (const quizId of ['noteNames', 'keys', 'symbols', 'intervals', 'chords', 'mixed']) for (const grade of (T.QUIZZES.find(q => q.id === quizId).grades || T.GRADE_CHOICES)) {
            const G = T.gradeContent(grade);
            const src = source(quizId, { grade, clefs: ['treble', 'bass', 'alto', 'tenor'] }, { seed: grade });
            for (const q of take(src, 150)) {
                assert.equal(new Set(q.answers.map(a => a.id)).size, q.answers.length, q.id);
                assert.ok(hasRight(q), q.id);
                const [type, a, b] = q.id.split(':');
                if (type === 'keySignature' || type === 'scale') assert.ok(G.keyIds.includes(b), `${q.id} not in grade ${grade}`);
                if (!/^(symbol|speed)/.test(type)) assert.ok(G.clefs.includes(a), q.id);
                if (['degree', 'chord', 'inversion', 'cadence'].includes(type)) assert.ok(G.keyIds.includes(b), `${q.id} not in grade ${grade}`);
                if (type === 'intervalNumber') assert.equal(grade, 2, 'number-only intervals are grade 2 only');
                if (type === 'symbolName' || type === 'symbolMeaning') assert.ok(G.symbols.some(s => s.id === a), `${q.id} not in grade ${grade}`);
                if (q.prompt.staff) N.staff(q.prompt.staff);
            }
        }
    });
    test('alto and tenor key signatures: every one draws', () => {
        for (const clef of ['alto', 'tenor']) for (const type of ['sharp', 'flat']) for (let c = 1; c <= 7; c++) N.staff({ clef, keySignature: { type, count: c } });
        assert.equal(N.staffStep('C4', 'alto'), 4);
        assert.equal(N.staffStep('C4', 'tenor'), 6);
    });
});

describe('intervals, technical names, chromatic scale, chords, cadences (ML-309 C)', () => {
    const LETTERS = 'CDEFGAB';
    const letterSteps = (low, high) => { const a = N.parsePitch(low), b = N.parsePitch(high); return (b.octave * 7 + LETTERS.indexOf(b.letter)) - (a.octave * 7 + LETTERS.indexOf(a.letter)); };
    const key = (id) => T.ALL_KEYS.find(k => k.id === id);
    const all = (quizId, grade) => {
        const src = source(quizId, { grade, clefs: ['treble', 'bass', 'alto', 'tenor'] }, { seed: 11 });
        return take(src, src.size);
    };

    test('grade-only quizzes: always at one of their own grades', () => {
        assert.equal(T.normaliseOptions('intervals', {}).grade, 2);
        assert.equal(T.normaliseOptions('intervals', { grade: 1 }).grade, 2);
        assert.equal(T.normaliseOptions('chords', { grade: 3 }).grade, 4);
        assert.equal(T.normaliseOptions('chords', { grade: 5 }).grade, 5);
        assert.equal(T.settingsKey('intervals', { grade: 3 }, 't30'), 'intervals|t30|grade=3;clefs=treble');
        assert.equal(T.describeOptions('chords', { grade: 5, clefs: ['bass'] }, 'q10'), 'Grade 5 · Bass · 10 questions');
    });
    test('naming intervals', () => {
        const name = (a, b) => { const iv = T.intervalBetween(a, b); return T.intervalLabel(iv.quality, iv.number); };
        assert.equal(name('C4', 'E4'), 'Major 3rd');
        assert.equal(name('C4', 'Eb4'), 'Minor 3rd');
        assert.equal(name('F4', 'B4'), 'Augmented 4th');
        assert.equal(name('B4', 'F5'), 'Diminished 5th');
        assert.equal(name('C#4', 'Bb4'), 'Diminished 7th');
        assert.equal(name('C4', 'C5'), 'Perfect octave');
        assert.equal(name('C4', 'E5'), 'Compound major 3rd');
        assert.equal(name('A3', 'G5'), 'Compound minor 7th');
    });
    test('every interval question: the right answer is the notes\' real interval, in letters and semitones', () => {
        const SIZE = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };
        for (const grade of [2, 3, 4, 5]) for (const q of all('intervals', grade)) {
            const [type, , low, high] = q.id.split(':');
            const number = letterSteps(low, high) + 1;
            if (type === 'intervalNumber') { assert.equal(q.correct, String(number), q.id); continue; }
            const m = /^([a-z]+)(\d+)$/.exec(q.correct);
            assert.equal(Number(m[2]), number, q.id);
            const simple = ((number - 1) % 7) + 1, perfectType = [1, 4, 5].includes(simple);
            const shift = { perfect: 0, major: 0, minor: -1, aug: 1, dim: perfectType ? -1 : -2 }[m[1]];
            assert.equal(midi(high) - midi(low), SIZE[simple] + 12 * Math.floor((number - 1) / 7) + shift, q.id);
            if (grade === 3) assert.ok(!q.answers.some(a => /^(aug|dim)/.test(a.id)), `grade 3 offered augmented/diminished: ${q.id}`);
            if (grade <= 3) assert.ok(number <= 8);
        }
    });
    test('grade 2 intervals are above the tonic of the grade\'s major keys; compound only from grade 5', () => {
        const tonics = T.gradeContent(2).keyIds.filter(id => id.endsWith('major')).map(id => id.split(' ')[0]);
        for (const q of all('intervals', 2)) assert.ok(tonics.includes(q.id.split(':')[2].replace(/-?\d+$/, '')), q.id);
        assert.ok(!all('intervals', 4).some(q => Number(q.correct.replace(/\D/g, '')) > 8));
        assert.ok(all('intervals', 5).some(q => Number(q.correct.replace(/\D/g, '')) > 8));
    });
    test('technical names: the note is that degree of the key; a minor key\'s leading note is raised', () => {
        const qs = all('keys', 4).filter(x => typeOf(x.id) === 'degree');
        assert.ok(qs.length > 100);
        for (const q of qs) {
            const [, clef, keyId, deg] = q.id.split(':');
            const k = key(keyId), pitch = q.prompt.staff.items[0].pitch.replace(/n(?=-?\d)/, '');
            assert.equal(q.correct, `deg${deg}`);
            assert.equal(q.answers.find(a => a.id === q.correct).label, T.DEGREE_NAMES[deg - 1]);
            assert.equal((LETTERS.indexOf(pitch[0]) - LETTERS.indexOf(k.tonic[0]) + 7) % 7, deg - 1, q.id);
            if (k.mode === 'minor' && deg === '7') assert.equal((((midi(pitch) - midi(k.tonic + '4')) % 12) + 12) % 12, 11, `${q.id}: a semitone below the tonic`);
            assert.ok(T.gradeContent(4).clefs.includes(clef));
        }
    });
    test('chromatic scale: the right ones keep the rule, every wrong one breaks it with the same sounds', () => {
        for (const t of ['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb']) {
            const right = T.chromaticScale(t, 'treble');
            assert.equal(T.chromaticFault(right), null, t);
            assert.equal(steps(right), '1'.repeat(12), `${t}: a semitone at a time`);
            const wrongs = T.chromaticMistakes(right);
            assert.ok(wrongs.length > 0, t);
            for (const w of wrongs) {
                assert.ok(T.chromaticFault(w), `${t}: ${w.join(' ')}`);
                assert.equal(steps(w), steps(right), 'only respelled, never a different note');
            }
        }
        assert.equal(T.chromaticScale('Ab', 'treble'), null, 'needs a double flat: not asked');
        const qs = all('keys', 4).filter(x => typeOf(x.id) === 'chromatic');
        assert.ok(qs.some(q => q.correct === 'yes') && qs.some(q => q.correct === 'no'));
        for (const q of qs) assert.ok(q.feedback, 'says why');
        assert.ok(!all('keys', 3).some(x => typeOf(x.id) === 'chromatic' || typeOf(x.id) === 'degree'), 'grade 4 on');
        assert.ok(!take(source('keys', { grade: 5, show: 'keySignatures' }, { seed: 1 }), 80).some(x => /^(chromatic|degree)/.test(x.id)), 'not with key signatures only');
    });
    test('triads: major I/IV/V in a major key; a minor key\'s V is major and its II diminished', () => {
        assert.equal(steps(T.triad(key('C major'), 'treble', 1, 0)), '43');
        assert.equal(steps(T.triad(key('A minor'), 'treble', 5, 0)), '43', 'E G# B');
        assert.equal(steps(T.triad(key('A minor'), 'treble', 1, 0)), '34');
        assert.equal(steps(T.triad(key('A minor'), 'treble', 2, 0)), '33', 'B D F');
        assert.equal(steps(T.triad(key('D major'), 'bass', 4, 1)), '35', 'first inversion: 3rd in the bass');
        assert.equal(steps(T.triad(key('D major'), 'bass', 4, 2)), '54', 'second inversion: 5th in the bass');
        for (const q of all('chords', 5).filter(x => typeOf(x.id) === 'chord' || typeOf(x.id) === 'inversion')) {
            const [type, , , deg, inv] = q.id.split(':');
            assert.equal(q.correct, type === 'chord' ? { 1: 'I', 2: 'II', 4: 'IV', 5: 'V' }[deg] : 'abc'[inv], q.id);
            assert.equal(q.prompt.staff.items[0].notes.length, 3);
        }
        const g4 = all('chords', 4);
        assert.ok(g4.every(q => typeOf(q.id) === 'chord' && q.id.endsWith(':0') && q.id.split(':')[3] !== '2'), 'grade 4: I, IV, V in root position');
    });
    test('cadences: perfect ends V-I, plagal IV-I, imperfect on V', () => {
        const kinds = new Set();
        for (const q of all('chords', 5).filter(x => typeOf(x.id) === 'cadence')) {
            const [from, to] = q.id.split(':')[3].split('-');
            const want = to === '5' ? 'imperfect' : from === '5' ? 'perfect' : 'plagal';
            assert.equal(q.correct, want, q.id);
            kinds.add(want);
            assert.equal(q.prompt.staff.items.filter(i => i.type === 'chord').length, 2);
        }
        assert.equal(kinds.size, 3);
    });
    test('every new question rebuilds from its id (Smart learn weak spots) as the same question', () => {
        const qs = [...all('intervals', 5), ...all('chords', 5), ...all('keys', 5).filter(x => /^(degree|chromatic)/.test(x.id)), ...all('intervals', 2)];
        for (const q of qs) {
            assert.ok(T.itemFromId(q.id), q.id);
            const again = clone(sandbox.self.TheoryEngine.questionSource('weakSpots', {}, { seed: 1, weights: { [q.id]: 5 } }).next());
            assert.equal(again.id, q.id);
            assert.equal(again.correct, q.correct);
            assert.ok(T.describeQuestion(q.id, 'letters'), q.id);
        }
        assert.equal(T.itemFromId('interval:treble:C4:H4'), null);
        assert.equal(T.itemFromId('chord:treble:C major:3:0'), null);
        assert.equal(T.itemFromId('chromatic:treble:Ab:ok'), null);
        assert.equal(T.itemFromId('cadence:treble:C major:5-4'), null);
    });
    test('Mixed at a grade asks the grade\'s new types too; Admin lists them', () => {
        const types = (g) => new Set(take(source('mixed', { grade: g }, { seed: 2 }), 200).map(q => typeOf(q.id)));
        assert.ok(types(2).has('intervalNumber'));
        assert.ok(!types(3).has('degree'));
        for (const t of ['interval', 'degree', 'chord', 'inversion', 'cadence']) assert.ok(types(5).has(t), t);
        assert.deepEqual(T.gradeSummary().map(g => g.topics.map(t => t.label)), [[], ['Intervals'], ['Intervals'], ['Intervals', 'Technical names', 'Chromatic scale', 'Chords'], ['Intervals', 'Chords', 'Inversions', 'Cadences']]);
    });
});

// ML-396: a round's result is a Level 1-5; the options screen lists the sets you've played.
describe('one set of note buttons for the whole round (ML-396)', () => {
    const layouts = (quiz, options, weights) => {
        const src = source(quiz, options, { seed: 4, weights });
        return new Set(take(src, 60).filter(q => typeOf(q.id) === 'note').map(q => `${q.layout}:${q.answers.length}:${q.prompt.staff.stepRange.join()}`));
    };
    test('a grade that mixes naturals with sharps and flats shows the keyboard for every note', () => {
        assert.deepEqual([...layouts('noteNames', { grade: 2, clefs: ['treble'] })], ['keyboard:17:-5,13']);
        assert.deepEqual([...layouts('noteNames', { grade: 1, clefs: ['treble'] })], ['notes:7:-2,10']);
        assert.equal(layouts('mixed', { grade: 3, clefs: ['treble'] }).size, 1);
        // a natural is still answered with its natural button
        const src = source('noteNames', { grade: 2, clefs: ['treble'] }, { seed: 9 });
        const natural = take(src, 60).find(q => !/[#b]/.test(q.id.split(':')[2]));
        assert.equal(natural.correct, natural.id.split(':')[2][0]);
        assert.ok(natural.answers.some(a => a.id === natural.correct));
    });
    test('a weak spots round: its notes share the keyboard and the widest staff', () => {
        assert.deepEqual([...layouts('weakSpots', {}, { 'note:treble:C5': 4, 'note:treble:F#4': 2, 'note:treble:A3': 2 })], ['keyboard:17:-5,13']);
        assert.deepEqual([...layouts('weakSpots', {}, { 'note:treble:C5': 4, 'note:treble:E4': 2 })], ['notes:7:-2,10']);
    });
});

describe('Levels (ML-396)', () => {
    const note = (correct) => ({ questionId: 'note:treble:C5', correct });
    const answers = (right, wrong) => [...Array(right).fill(note(true)), ...Array(wrong).fill(note(false))];

    test('right answers each Level takes', () => {
        assert.deepEqual(T.levelTargets('noteNames', { grade: 1 }, 't30'), [{ level: 2, right: 6 }, { level: 3, right: 10 }, { level: 4, right: 14 }, { level: 5, right: 18 }]);
        assert.deepEqual(T.levelTargets('noteNames', {}, 'q10').map(t => t.right), [3, 5, 7, 9]);
        // each target really is the lowest count that reaches its Level
        for (const t of T.levelTargets('noteNames', {}, 't30')) {
            assert.equal(T.scoreRound('t30', answers(t.right, 0)).grade, t.level);
            assert.ok(T.scoreRound('t30', answers(t.right - 1, 0)).grade < t.level);
        }
        assert.equal(T.levelTargets('mixed', {}, 't30'), null, 'a timed round that mixes par times has no one count');
        assert.equal(T.levelTargets('mixed', {}, 'q10').length, 4);
        assert.equal(T.levelTargets('weakSpots', {}, 't30'), null);
    });

    test('how many more right answers reach the next Level', () => {
        assert.deepEqual(T.nextLevelGap('t30', answers(17, 1)), { level: 5, more: 2 });
        assert.deepEqual(T.nextLevelGap('t30', answers(5, 0)), { level: 2, more: 1 });
        assert.equal(T.nextLevelGap('t30', answers(18, 0)), null, 'nothing above Level 5');
        assert.equal(T.nextLevelGap('t30', []), null);
        // fixed: one more right is one fewer wrong
        assert.deepEqual(T.nextLevelGap('q10', answers(8, 2)), { level: 4, more: 1 });
        assert.deepEqual(T.nextLevelGap('q10', answers(5, 5)), { level: 2, more: 2 });
        for (const [r, w] of [[17, 1], [5, 0], [9, 4], [0, 3]]) {
            const gap = T.nextLevelGap('t30', answers(r, w));
            assert.equal(T.scoreRound('t30', answers(r + gap.more, w)).grade >= gap.level, true);
            assert.ok(T.scoreRound('t30', answers(r + gap.more - 1, w)).grade < gap.level);
        }
    });

    test('a set of options as a list row', () => {
        assert.deepEqual(T.describeSet('noteNames', { grade: 1, clefs: ['treble'] }, 't30'), { title: 'Grade 1 · Treble · 30 s', detail: '' });
        assert.deepEqual(T.describeSet('noteNames', { clefs: ['treble', 'bass'], range: 2, accidentals: 'both' }, 'q10'),
            { title: 'Custom · Treble, Bass · 10 questions', detail: '2 ledger lines · Sharps and flats' });
        assert.deepEqual(T.describeSet('symbols', {}, 't30'), { title: 'Custom · 30 s', detail: 'Basics · Ask: both' });
        assert.deepEqual(T.describeSet('noteNames', {}, 't30', { grades: false }), { title: 'Treble · On the staff · None · 30 s', detail: '' });
    });

    test('what a set includes', () => {
        const g1 = T.includedFor('noteNames', { grade: 1, clefs: ['treble'] }, 't30');
        assert.deepEqual(g1.staffs, [{ clef: 'treble', low: 'D4', high: 'G5', stepRange: [-2, 10] }]);
        assert.deepEqual(g1.lines, [
            { label: 'Clef', text: 'Treble' },
            { label: 'Notes', text: '11 different notes, all on the staff' },
            { label: 'Sharps and flats', text: 'none' },
            { label: 'Round', text: '30 seconds, as many as you can' },
        ]);
        const g2 = T.includedFor('noteNames', { grade: 2, clefs: ['treble', 'bass'] }, 'q10');
        assert.equal(g2.staffs.length, 2);
        assert.equal(g2.lines.find(l => l.label === 'Sharps and flats').text, 'both');
        assert.match(g2.lines.find(l => l.label === 'Notes').text, /up to 2 ledger lines/);
        assert.equal(g2.lines.at(-1).text, '10 questions, no time limit');
        // every quiz, grade and custom, has something to say and never mentions how you answer
        for (const q of T.QUIZZES) for (const grade of q.gradeOnly ? q.grades : [0, 1, 5]) {
            const inc = T.includedFor(q.id, { grade }, 't30');
            assert.ok(inc.lines.length >= 2, `${q.id} grade ${grade}`);
            assert.ok(inc.lines.every(l => l.label && l.text), `${q.id} grade ${grade}`);
        }
    });
});

// ML-399: SmartLearn also brings back what you got right but hesitated on.
describe('SmartLearn hesitation (ML-399)', () => {
    const a = (id, ms, correct = true, block = 1) => ({ questionId: `note:treble:${id}`, correct, ms, block });
    test('a right answer well over your own usual speed in the round is marked slow', () => {
        const round = [a('C5', 5000), a('D5', 800), a('E5', 900), a('F5', 2600), a('G5', 850), a('A4', 700), a('B4', 1500), a('E4', 900, false), a('F4', 950)];
        // usual speed: the median of the right answers after the first = 900 ms
        assert.deepEqual(T.hesitationMarks(round), [null, null, null, 'slow', null, null, null, null, null]);
        // the first question of the round is never marked, however slow; a wrong answer never is
        // 1.5x isn't enough on its own: it must also be a second longer (B4, 1500 ms, isn't)
    });
    test('compared with your own pace: a slow player is not marked on everything, a quick one still is', () => {
        const slowPlayer = ['C5', 'D5', 'E5', 'F5', 'G5', 'A4', 'B4'].map(n => a(n, 4000));
        assert.ok(T.hesitationMarks(slowPlayer).every(m => m === null));
        const quick = [a('C5', 400), a('D5', 400), a('E5', 420), a('F5', 380), a('G5', 1900), a('A4', 410), a('B4', 400)];
        assert.deepEqual(T.hesitationMarks(quick).filter(Boolean), ['slow']);
    });
    test('each round of a repeated test, and each question type, has its own usual speed', () => {
        const two = [...['C5', 'D5', 'E5', 'F5', 'G5', 'A4'].map(n => a(n, 500, true, 1)), ...['C5', 'D5', 'E5', 'F5', 'G5', 'A4'].map(n => a(n, 3000, true, 2))];
        assert.ok(T.hesitationMarks(two).every(m => m === null));
        const mixed = [a('C5', 500), a('D5', 500), a('E5', 500), a('F5', 500), a('G5', 500), a('A4', 500), { questionId: 'scale:treble:C major:major', correct: true, ms: 3500, block: 1 }];
        assert.equal(T.hesitationMarks(mixed)[6], null, 'one scale has nothing to be compared with, and is under 2x its par');
    });
    test('too few right answers to go by: the fixed rule - over 2x par holds the weight, never raises it', () => {
        assert.deepEqual(T.hesitationMarks([a('C5', 900), a('D5', 3500), a('E5', 900), a('F5', 900)]), [null, 'hold', null, null]);
    });
    test('the weights: wrong +2 to both, quick right -1 from both, hesitated +1 up to 4 and never a weak spot', () => {
        assert.deepEqual(T.applyAnswer({ weight: 0, miss: 0 }, false), { weight: 2, miss: 2 });
        assert.deepEqual(T.applyAnswer({ weight: 9, miss: 9 }, false), { weight: 10, miss: 10 });
        assert.deepEqual(T.applyAnswer({ weight: 2, miss: 2 }, true, null), { weight: 1, miss: 1 });
        assert.deepEqual(T.applyAnswer({ weight: 0, miss: 0 }, true, 'slow'), { weight: 1, miss: 0 });
        assert.deepEqual(T.applyAnswer({ weight: 3, miss: 2 }, true, 'hold'), { weight: 3, miss: 2 });
        let s = { weight: 0, miss: 0 };
        for (let i = 0; i < 8; i++) s = T.applyAnswer(s, true, 'slow');
        assert.deepEqual(s, { weight: 4, miss: 0 }, 'hesitations alone stop at 4');
        assert.deepEqual(T.applyAnswer({ weight: 6, miss: 6 }, true, 'slow'), { weight: 6, miss: 6 }, 'above 4 already: left where it is');
        assert.deepEqual(T.applyAnswer({ weight: 1, miss: 0 }, true, null), { weight: 0, miss: 0 }, 'one quick right answer clears a hesitation');
        assert.deepEqual(T.applyAnswer({ weight: 3, miss: 0 }, false), { weight: 5, miss: 2 });
        assert.deepEqual(T.applyAnswer({ weight: 3 }, true, null), { weight: 2, miss: 0 });
    });
});
