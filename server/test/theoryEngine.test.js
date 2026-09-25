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
    test('the four quizzes', () => {
        assert.deepEqual(T.QUIZZES.map(q => q.id), ['noteNames', 'keys', 'symbols', 'mixed']);
    });
    test('defaults fill in, and anything not on the list is thrown out', () => {
        assert.deepEqual(T.normaliseOptions('noteNames', {}), { clefs: ['treble'], range: 0, accidentals: 'none' });
        assert.deepEqual(T.normaliseOptions('noteNames', { clefs: ['bass', 'alto'], range: 3, accidentals: 'sharps' }), { clefs: ['bass'], range: 0, accidentals: 'sharps' });
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
        const a = T.settingsKey('noteNames', { clefs: ['treble', 'bass'], range: 2 }, 't60');
        assert.equal(a, T.settingsKey('noteNames', { clefs: ['bass', 'treble'], range: 2 }, 't60'));
        assert.notEqual(a, T.settingsKey('noteNames', { clefs: ['bass', 'treble'], range: 2 }, 't30'));
        assert.equal(T.settingsKey('keys', { modes: 'major', minorForm: 'melodic' }, 'q10'), T.settingsKey('keys', { modes: 'major', minorForm: 'harmonic' }, 'q10'));
        assert.notEqual(T.settingsKey('keys', { modes: 'both', minorForm: 'melodic' }, 'q10'), T.settingsKey('keys', { modes: 'both', minorForm: 'harmonic' }, 'q10'));
        assert.equal(T.settingsKey('noteNames', {}, 'bogus'), T.settingsKey('noteNames', {}, 't60'));
    });
    test('describes a set of options for the results screen', () => {
        assert.equal(T.describeOptions('noteNames', { clefs: ['treble', 'bass'], range: 2 }, 't60'), 'Treble, Bass · 2 ledger lines · None · 60 s');
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
                    assert.ok(ids.includes(qn.correct), `right answer missing ${qn.id}`);
                    if (typeOf(qn.id) === 'note') assert.ok(ids.length === 7 || ids.length === 12);
                    else assert.equal(ids.length, 4, `${qn.id} ${JSON.stringify(opts)}`);
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
        assert.deepEqual(q.answers.map(a => a.label), ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Ti♭', 'Ti']);
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
    test('key signature questions say major or minor, and every choice is that mode', () => {
        for (const q of take(source('keys', { show: 'keySignatures', upTo: 7, modes: 'both' }, { seed: 3 }), 60)) {
            const mode = q.correct.split(' ')[1];
            assert.equal(q.prompt.text, `Which ${mode} key?`);
            assert.ok(q.answers.every(a => a.id.endsWith(mode)));
        }
    });
});

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
    test('with minor on, the relative key is one of the wrong answers', () => {
        for (const q of take(source('keys', { show: 'scales', upTo: 7, modes: 'both' }, { seed: 5 }), 40)) {
            const key = T.ALL_KEYS.find(x => x.id === q.correct);
            const rel = T.ALL_KEYS.find(x => x.mode !== key.mode && x.type === key.type && x.count === key.count);
            assert.ok(q.answers.some(a => a.id === rel.id), `${q.correct} without ${rel.id}`);
        }
    });
});

describe('symbols', () => {
    test('the sets and their sizes', () => {
        const count = (set) => T.SYMBOLS.filter(s => s.set === set).length;
        assert.deepEqual(T.SET_IDS.map(count), [13, 9, 17, 11, 15]);
        assert.equal(T.SYMBOLS.length, 65);
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
    test('a staff scrap never shows a clef', () => {
        for (const s of T.SYMBOLS.filter(x => x.render.type === 'staff')) assert.equal(s.render.staff.hideClef, true, s.id);
    });
    test('ask names / meanings / both: 1 or 2 questions per symbol', () => {
        assert.equal(source('symbols', { set: 'basics', ask: 'names' }, { seed: 1 }).size, 13);
        assert.equal(source('symbols', { set: 'basics', ask: 'meanings' }, { seed: 1 }).size, 13);
        assert.equal(source('symbols', { set: 'basics' }, { seed: 1 }).size, 26);
        assert.equal(source('symbols', { set: 'everything' }, { seed: 1 }).size, 130);
    });
    test('wrong answers come from the same set', () => {
        for (const q of take(source('symbols', { set: 'dynamics' }, { seed: 9 }), 30)) {
            assert.ok(q.answers.every(a => T.SYMBOLS.find(s => s.id === a.id).set === 'dynamics'));
        }
        for (const q of take(source('symbols', { set: 'everything' }, { seed: 4 }), 60)) {
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
        assert.deepEqual(T.scoreRound('t60', ans('note', 34, 2)), { right: 34, wrong: 2, score: 80, grade: 4 });       // 40/min
        assert.equal(T.scoreRound('t30', ans('note', 17, 1)).score, 80);
        assert.equal(T.scoreRound('t60', ans('note', 60, 0)).score, 100);
        assert.equal(T.scoreRound('t60', ans('scale', 15, 0)).score, 100);                                               // 15/min
        assert.equal(T.scoreRound('t60', ans('keySignature', 24, 0)).score, 100);                                        // 24/min
        assert.equal(T.scoreRound('t60', ans('symbolName', 30, 0)).score, 100);                                         // 30/min
        assert.equal(T.scoreRound('t60', ans('symbolMeaning', 24, 0)).score, 100);                                       // 24/min
        assert.equal(T.scoreRound('t60', ans('scale', 2, 9)).score, 0);
    });
    test('timed, mixed types: the pars add up', () => {
        // 10 notes (15 s) + 5 scales (20 s) + 1 wrong key signature (-2.5 s) = 32.5 s of 60 -> 54
        const a = [...ans('note', 10, 0), ...ans('scale', 5, 0), ...ans('keySignature', 0, 1)];
        assert.deepEqual(T.scoreRound('t60', a), { right: 15, wrong: 1, score: 54, grade: 3 });
    });
    test('fixed: out of the number of questions', () => {
        assert.deepEqual(T.scoreRound('q10', ans('scale', 8, 2)), { right: 8, wrong: 2, score: 60, grade: 3 });
        assert.equal(T.scoreRound('q20', ans('note', 20, 0)).score, 100);
    });
    test('grade limits', () => {
        assert.deepEqual([100, 90, 89, 70, 69, 50, 49, 30, 29, 0].map(s => T.gradeFor(s)), [5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
    });
});
