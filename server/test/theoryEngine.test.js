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
    test('defaults fill in, and anything not on the list is thrown out', () => {
        assert.deepEqual(T.normaliseOptions('noteNames', {}), { clefs: ['treble'], range: 0, accidentals: 'none' });
        assert.deepEqual(T.normaliseOptions('noteNames', { clefs: ['bass', 'alto'], range: 3, accidentals: 'sharps' }), { clefs: ['bass'], range: 0, accidentals: 'sharps' });
        assert.deepEqual(T.normaliseOptions('noteNames', { clefs: [] }).clefs, ['treble']);
        assert.equal(T.normaliseOptions('keySignatures', { upTo: 2 }).upTo, 3);
        assert.throws(() => T.normaliseOptions('nope', {}));
    });
    test('settings key: same options = same key, whatever the order; hidden options ignored', () => {
        const a = T.settingsKey('noteNames', { clefs: ['treble', 'bass'], range: 2 }, 't60');
        const b = T.settingsKey('noteNames', { clefs: ['bass', 'treble'], range: 2 }, 't60');
        assert.equal(a, b);
        assert.notEqual(a, T.settingsKey('noteNames', { clefs: ['bass', 'treble'], range: 2 }, 't30'));
        assert.equal(T.settingsKey('scales', { modes: 'major', minorForm: 'melodic' }, 'q10'), T.settingsKey('scales', { modes: 'major', minorForm: 'harmonic' }, 'q10'));
        assert.notEqual(T.settingsKey('scales', { modes: 'both', minorForm: 'melodic' }, 'q10'), T.settingsKey('scales', { modes: 'both', minorForm: 'harmonic' }, 'q10'));
        assert.equal(T.settingsKey('noteNames', {}, 'bogus'), T.settingsKey('noteNames', {}, 't60'));
    });
    test('describes a set of options for the results screen', () => {
        assert.equal(T.describeOptions('noteNames', { clefs: ['treble', 'bass'], range: 2 }, 't60'), 'Treble, Bass · 2 ledger lines · None · 60 s');
        assert.equal(T.describeOptions('scales', { modes: 'both' }, 'q10'), 'Treble · Up to 3 ♯/♭ · Both · Major and minor · Harmonic · 10 questions');
    });
});

describe('every quiz, every option combination', () => {
    for (const q of T.QUIZZES) {
        test(q.id, () => {
            for (const opts of combos(q.id)) {
                const qs = take(source(q.id, opts, { seed: 42 }), 40);
                qs.forEach((qn, i) => {
                    const ids = qn.answers.map(a => a.id);
                    assert.equal(new Set(ids).size, ids.length, `duplicate answers ${JSON.stringify(opts)}`);
                    assert.ok(ids.includes(qn.correct), `right answer missing ${qn.id}`);
                    if (q.id === 'noteNames') assert.equal(ids.length, opts.accidentals === 'none' ? 7 : 12);
                    else assert.equal(ids.length, 4, `${q.id} ${JSON.stringify(opts)}`);
                    if (i) assert.notEqual(qn.id, qs[i - 1].id, 'same question twice in a row');
                    // Whatever the screen will draw must actually draw.
                    if (qn.prompt.staff) N.staff(qn.prompt.staff);
                });
            }
        });
    }
    test('the same seed gives the same round', () => {
        const a = take(source('noteNames', { range: 6, accidentals: 'flats' }, { seed: 7 }), 25).map(q => q.id);
        const b = take(source('noteNames', { range: 6, accidentals: 'flats' }, { seed: 7 }), 25).map(q => q.id);
        const c = take(source('noteNames', { range: 6, accidentals: 'flats' }, { seed: 8 }), 25).map(q => q.id);
        assert.deepEqual(a, b);
        assert.notDeepEqual(a, c);
    });
});

describe('note names', () => {
    test('ranges: on the staff is D4-G5 treble / F2-B3 bass, and 6 lines reaches G2-D7 / B0-F5', () => {
        const pitches = (o) => T.noteNamePool(T.normaliseOptions('noteNames', o)).map(p => p.pitch);
        const t0 = pitches({ clefs: ['treble'], range: 0 });
        assert.equal(t0[0], 'D4'); assert.equal(t0[t0.length - 1], 'G5'); assert.equal(t0.length, 11);
        const b0 = pitches({ clefs: ['bass'], range: 0 });
        assert.equal(b0[0], 'F2'); assert.equal(b0[b0.length - 1], 'B3');
        const t6 = pitches({ clefs: ['treble'], range: 6 });
        assert.equal(t6[0], 'G2'); assert.equal(t6[t6.length - 1], 'D7');
        const b6 = pitches({ clefs: ['bass'], range: 6 });
        assert.equal(b6[0], 'B0'); assert.equal(b6[b6.length - 1], 'F5');
    });
    test('every note needs no more ledger lines than the range allows', () => {
        for (const range of [0, 2, 4, 6]) for (const clef of ['treble', 'bass']) {
            for (const p of T.noteNamePool(T.normaliseOptions('noteNames', { clefs: [clef], range, accidentals: 'sharps' }))) {
                assert.ok(N.ledgerSteps(N.staffStep(p.pitch, clef)).length <= range, `${p.pitch} ${clef} range ${range}`);
            }
        }
    });
    test('sharps/flats: only the 12 one-spelling notes, matching the buttons', () => {
        const names = (acc) => new Set(T.noteNamePool(T.normaliseOptions('noteNames', { range: 6, accidentals: acc })).map(p => p.name));
        assert.deepEqual([...names('sharps')].sort(), T.NOTE_BUTTONS.sharps.slice().sort());
        assert.deepEqual([...names('flats')].sort(), T.NOTE_BUTTONS.flats.slice().sort());
        assert.ok(!names('sharps').has('E#') && !names('flats').has('Cb'));
    });
    test('solfège labels are spelled syllables', () => {
        const q = clone(source('noteNames', { accidentals: 'flats' }, { seed: 1, naming: 'solfege' }).next());
        assert.deepEqual(q.answers.map(a => a.label), ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Ti♭', 'Ti']);
    });
});

describe('keys', () => {
    test('the 30 keys, with the right number of sharps or flats', () => {
        assert.equal(T.ALL_KEYS.length, 30);
        const k = (id) => T.ALL_KEYS.find(x => x.id === id);
        assert.deepEqual([k('D major').type, k('D major').count], ['sharp', 2]);
        assert.deepEqual([k('Eb major').type, k('Eb major').count], ['flat', 3]);
        assert.deepEqual([k('F# minor').type, k('F# minor').count], ['sharp', 3]);
        assert.deepEqual([k('Cb major').type, k('Cb major').count], ['flat', 7]);
        assert.deepEqual(T.keyAlters(k('Eb major')), { C: 0, D: 0, E: -1, F: 0, G: 0, A: -1, B: -1 });
    });
    test('pool follows "up to", sharp/flat keys and major/minor', () => {
        const ids = (o) => T.keyPool(T.normaliseOptions('keySignatures', o)).map(k => k.id).sort();
        assert.deepEqual(ids({ upTo: 1, keyTypes: 'sharp' }), ['C major', 'G major']);
        assert.deepEqual(ids({ upTo: 1, keyTypes: 'both' }), ['C major', 'F major', 'G major']);
        assert.equal(ids({ upTo: 7, keyTypes: 'both', modes: 'both' }).length, 30);
        assert.ok(ids({ upTo: 3, modes: 'both' }).includes('F# minor'));
    });
    test('key signature questions say major or minor, and every choice is that mode', () => {
        for (const q of take(source('keySignatures', { upTo: 7, modes: 'both' }, { seed: 3 }), 60)) {
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
        for (const q of take(source('scales', { upTo: 7, modes: 'both' }, { seed: 5 }), 40)) {
            const key = T.ALL_KEYS.find(x => x.id === q.correct);
            const rel = T.ALL_KEYS.find(x => x.mode !== key.mode && x.type === key.type && x.count === key.count);
            assert.ok(q.answers.some(a => a.id === rel.id), `${q.correct} without ${rel.id}`);
        }
    });
});

describe('symbols', () => {
    test('unique, with a name and meaning, and every one draws', () => {
        const ids = T.SYMBOLS.map(s => s.id), names = T.SYMBOLS.map(s => s.name), meanings = T.SYMBOLS.map(s => s.meaning);
        for (const list of [ids, names, meanings]) assert.equal(new Set(list).size, list.length);
        for (const s of T.SYMBOLS) {
            const r = s.render;
            if (r.type === 'symbol') N.symbol(r.glyph);
            else if (r.type === 'staff') N.staff(r.staff);
            else if (r.type === 'hairpin') N.hairpin(r.dir);
            else if (r.type === 'text') N.textMark(r.text, { italic: r.italic });
            else assert.fail(`${s.id}: unknown render ${r.type}`);
        }
    });
    test('each set has at least 4 symbols, and a staff scrap never shows a clef', () => {
        for (const set of ['basics', 'dynamics', 'structure']) assert.ok(T.SYMBOLS.filter(s => s.set === set).length >= 4, set);
        for (const s of T.SYMBOLS.filter(x => x.render.type === 'staff')) assert.equal(s.render.staff.hideClef, true, s.id);
    });
    test('wrong answers come from the chosen set', () => {
        for (const q of take(source('symbolNames', { set: 'dynamics' }, { seed: 9 }), 30)) {
            assert.ok(q.answers.every(a => T.SYMBOLS.find(s => s.id === a.id).set === 'dynamics'));
        }
        const m = source('symbolMeanings', { set: 'structure' }, { seed: 2 }).next();
        assert.ok(m.prompt.meaning && m.answers.every(a => a.render && a.label));
    });
});

describe('scoring', () => {
    test('timed: right +1, wrong -1, out of the quiz top pace, 0-100', () => {
        assert.deepEqual(T.scoreRound('noteNames', 't60', { right: 34, wrong: 2 }), { score: 80, grade: 4 });
        assert.deepEqual(T.scoreRound('noteNames', 't30', { right: 17, wrong: 1 }), { score: 80, grade: 4 });
        assert.equal(T.scoreRound('noteNames', 't60', { right: 60, wrong: 0 }).score, 100);
        assert.equal(T.scoreRound('scales', 't60', { right: 2, wrong: 9 }).score, 0);
        assert.equal(T.scoreRound('scales', 't60', { right: 15, wrong: 0 }).score, 100);
    });
    test('fixed: out of the number of questions', () => {
        assert.deepEqual(T.scoreRound('keySignatures', 'q10', { right: 8, wrong: 2 }), { score: 60, grade: 3 });
        assert.deepEqual(T.scoreRound('keySignatures', 'q20', { right: 20, wrong: 0 }), { score: 100, grade: 5 });
    });
    test('grade limits', () => {
        assert.deepEqual([100, 90, 89, 70, 69, 50, 49, 30, 29, 0].map(s => T.gradeFor(s)), [5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
    });
});
