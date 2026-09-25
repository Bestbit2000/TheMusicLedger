// ML-262: unit tests for the notation renderer (public/notation.js) - where every pitch, ledger line
// and key-signature accidental lands. Pure, no DOM. Loaded with vm, the exact file the app serves
// (same approach as flowJourney.test.js). How it LOOKS is covered by the screenshot baselines.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/notation.js', import.meta.url), 'utf8'), sandbox);
const N = new Proxy(sandbox.self.Notation, {
    get: (t, k) => (typeof t[k] === 'function' ? (...args) => JSON.parse(JSON.stringify(t[k](...args))) : t[k])
});

describe('pitches', () => {
    test('parses letters, accidentals and octaves', () => {
        assert.deepEqual(N.parsePitch('C4'), { letter: 'C', alter: 0, octave: 4, explicitNatural: false });
        assert.equal(N.parsePitch('F#5').alter, 1);
        assert.equal(N.parsePitch('F♯5').alter, 1);
        assert.equal(N.parsePitch('Bb3').alter, -1);
        assert.equal(N.parsePitch('B♭3').alter, -1);
        assert.equal(N.parsePitch('Fx4').alter, 2);
        assert.equal(N.parsePitch('Bbb4').alter, -2);
        assert.equal(N.parsePitch('En5').explicitNatural, true);
        assert.throws(() => N.parsePitch('H4'));
        assert.throws(() => N.parsePitch('C'));
    });
    test('staff steps count from the bottom line in each clef', () => {
        assert.equal(N.staffStep('E4', 'treble'), 0);
        assert.equal(N.staffStep('F5', 'treble'), 8);
        assert.equal(N.staffStep('C4', 'treble'), -2);   // middle C: first ledger line below
        assert.equal(N.staffStep('G2', 'bass'), 0);
        assert.equal(N.staffStep('A3', 'bass'), 8);
        assert.equal(N.staffStep('C4', 'bass'), 10);     // middle C: first ledger line above
        assert.equal(N.staffStep('F#5', 'treble'), 8);   // accidentals don't move the note
        assert.equal(N.pitchAtStep(4, 'treble'), 'B4');
        assert.equal(N.pitchAtStep(4, 'bass'), 'D3');
        assert.equal(N.pitchAtStep(-12, 'bass'), 'B0');
    });
});

describe('ledger lines', () => {
    test('only outside the staff, on every line position out to the note', () => {
        for (let s = -1; s <= 9; s++) assert.deepEqual(N.ledgerSteps(s), [], `step ${s}`);
        assert.deepEqual(N.ledgerSteps(-2), [-2]);
        assert.deepEqual(N.ledgerSteps(-3), [-2]);
        assert.deepEqual(N.ledgerSteps(-4), [-2, -4]);
        assert.deepEqual(N.ledgerSteps(10), [10]);
        assert.deepEqual(N.ledgerSteps(11), [10]);
        assert.deepEqual(N.ledgerSteps(12), [10, 12]);
    });
    // The Theory quiz's range choices (ML-260): the extreme notes of each need exactly that many lines.
    const RANGES = {
        treble: [['D4', 'G5', 0], ['A3', 'C6', 2], ['D3', 'G6', 4], ['G2', 'D7', 6]],
        bass: [['F2', 'B3', 0], ['C2', 'E4', 2], ['F1', 'B4', 4], ['B0', 'F5', 6]],
    };
    for (const [clef, ranges] of Object.entries(RANGES)) {
        test(`${clef} range limits have 0/2/4/6 ledger lines`, () => {
            for (const [low, high, lines] of ranges) {
                assert.equal(N.ledgerSteps(N.staffStep(low, clef)).length, lines, `${low} in ${clef}`);
                assert.equal(N.ledgerSteps(N.staffStep(high, clef)).length, lines, `${high} in ${clef}`);
            }
        });
    }
});

describe('key signatures', () => {
    const names = (clef, type) => N.keySignatureSteps(clef, type, 7).map(s => N.pitchAtStep(s, clef));
    test('the standard order and octave placement', () => {
        assert.deepEqual(names('treble', 'sharp'), ['F5', 'C5', 'G5', 'D5', 'A4', 'E5', 'B4']);
        assert.deepEqual(names('treble', 'flat'), ['B4', 'E5', 'A4', 'D5', 'G4', 'C5', 'F4']);
        assert.deepEqual(names('bass', 'sharp'), ['F3', 'C3', 'G3', 'D3', 'A2', 'E3', 'B2']);
        assert.deepEqual(names('bass', 'flat'), ['B2', 'E3', 'A2', 'D3', 'G2', 'C3', 'F2']);
    });
    test('takes the first N', () => {
        assert.deepEqual(N.keySignatureSteps('treble', 'sharp', 3), [8, 5, 9]);
        assert.deepEqual(N.keySignatureSteps('treble', 'flat', 0), []);
        assert.throws(() => N.keySignatureSteps('treble', 'sharp', 8));
    });
});

describe('SVG output', () => {
    const lines = (svg) => (svg.match(/<line /g) || []).length;
    const glyphs = (svg) => (svg.match(/class="notation-glyph"/g) || []).length;
    test('a staff is 5 lines plus the clef, and each ledger line is drawn', () => {
        assert.equal(lines(N.staff({ clef: 'treble' })), 5);
        assert.equal(glyphs(N.staff({ clef: 'treble' })), 1);
        assert.equal(lines(N.staff({ clef: 'treble', items: [{ type: 'note', pitch: 'D7' }] })), 5 + 6);
        assert.equal(lines(N.staff({ clef: 'bass', items: [{ type: 'note', pitch: 'C4' }] })), 5 + 1);
        assert.equal(glyphs(N.staff({ clef: 'treble', hideClef: true, items: [{ type: 'note', pitch: 'G4' }] })), 1);
    });
    test('accidentals: shown when the pitch has one, key signature counted', () => {
        assert.equal(glyphs(N.staff({ items: [{ type: 'note', pitch: 'F#4' }] })), 3);
        assert.equal(glyphs(N.staff({ items: [{ type: 'note', pitch: 'F4' }] })), 2);
        assert.equal(glyphs(N.staff({ items: [{ type: 'note', pitch: 'Fx4' }] })), 3);
        assert.equal(glyphs(N.staff({ keySignature: { type: 'flat', count: 5 } })), 6);
    });
    test('taller when notes go further from the staff; stepRange keeps a run the same height', () => {
        const h = (svg) => Number(/height="([\d.]+)"/.exec(svg)[1]);
        const plain = N.staff({ items: [{ type: 'note', pitch: 'B4' }] });
        const high = N.staff({ items: [{ type: 'note', pitch: 'D7' }] });
        assert.ok(h(high) > h(plain));
        const fixedA = N.staff({ items: [{ type: 'note', pitch: 'B4' }], stepRange: [-13, 21] }); // a notehead reaches a step past its own position
        const fixedB = N.staff({ items: [{ type: 'note', pitch: 'G2' }], stepRange: [-13, 21] }); // a notehead reaches a step past its own position
        assert.equal(h(fixedA), h(fixedB));
    });
    test('labelled for screen readers only when a label is given', () => {
        assert.match(N.staff({ label: 'A note on the treble staff' }), /role="img" aria-label="A note on the treble staff"/);
        assert.match(N.symbol('segno'), /aria-hidden="true"/);
    });
    test('drawn marks and spans', () => {
        assert.equal(lines(N.hairpin('cresc')), 2);
        assert.match(N.textMark('Fine', { italic: true }), /notation-text-italic/);
        const volta = N.staff({ items: [{ type: 'note', pitch: 'G4' }, { type: 'note', pitch: 'A4' }], spans: [{ kind: 'volta', from: 0, to: 1, text: '1.' }] });
        assert.equal(lines(volta), 5 + 2);
        const intro = N.staff({ items: [{ type: 'note', pitch: 'G4' }, { type: 'note', pitch: 'A4' }], spans: [{ kind: 'intro', from: 0, to: 1 }] });
        assert.equal(lines(intro), 5 + 4);
        assert.throws(() => N.staff({ items: [], spans: [{ kind: 'volta', from: 0, to: 1 }] }));
        assert.throws(() => N.symbol('notAGlyph'));
    });
});
