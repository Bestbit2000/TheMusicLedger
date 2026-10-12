// ML-528: the clef a player reads an instrument in (server/services/instrumentClef.js). Everything stored
// about an instrument's notes is written in the instrument's own clef; a player who reads another sees the
// same sounding notes written for theirs.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { clefChoices, clefView, toMine, toOwn, shiftPitch } from '../services/instrumentClef.js';

const euphonium = { theory_clef: 'treble', written_to_concert: -14, other_clefs: [{ clef: 'bass', writtenToConcert: 0 }] };
const trombone = { theory_clef: 'treble', written_to_concert: -14, other_clefs: [{ clef: 'bass', writtenToConcert: 0 }, { clef: 'tenor', writtenToConcert: 0 }] };
const cornet = { theory_clef: 'treble', written_to_concert: -2, other_clefs: [] };
const piano = { theory_clef: 'grand', written_to_concert: 0, other_clefs: [] };

describe('the clefs an instrument is read in (ML-528)', () => {
    test('its own first, then the others; one for most instruments; none for a grand staff', () => {
        assert.deepEqual(clefChoices(euphonium).map(c => c.clef), ['treble', 'bass']);
        assert.deepEqual(clefChoices(trombone).map(c => c.clef), ['treble', 'bass', 'tenor']);
        assert.deepEqual(clefChoices(cornet), [{ clef: 'treble', writtenToConcert: -2 }]);
        assert.deepEqual(clefChoices(piano), []);
    });
    test('rubbish in other_clefs is left out, and the own clef is never offered twice', () => {
        assert.deepEqual(clefChoices({ ...cornet, other_clefs: [{ clef: 'treble', writtenToConcert: 0 }, { clef: 'percussion' }, null] }).map(c => c.clef), ['treble']);
        assert.deepEqual(clefChoices({ ...cornet, other_clefs: null }).map(c => c.clef), ['treble']);
    });
});

describe('how a player reads it (ML-528)', () => {
    test('no choice made, or the instrument\'s own clef: nothing moves', () => {
        for (const chosen of [null, undefined, 'treble']) {
            const v = clefView(euphonium, chosen);
            assert.deepEqual([v.clef, v.writtenToConcert, v.shift, v.isOwn], ['treble', -14, 0, true]);
            assert.equal(toMine(v, 'F#3'), 'F#3'); // exactly as it was spelled
            assert.equal(toOwn(v, 'Gb3'), 'Gb3');
        }
    });
    test('a clef the instrument isn\'t read in falls back to its own', () => {
        assert.equal(clefView(cornet, 'bass').clef, 'treble');
        assert.equal(clefView(cornet, 'bass').shift, 0);
        assert.equal(clefView(piano, 'bass').clef, 'grand');
    });
    test('a bass-clef euphonium is at concert pitch: written C4 in treble is B♭2', () => {
        const v = clefView(euphonium, 'bass');
        assert.deepEqual([v.clef, v.writtenToConcert, v.shift, v.isOwn], ['bass', 0, -14, false]);
        assert.equal(toMine(v, 'C4'), 'Bb2');
        assert.equal(toMine(v, 'F#2'), 'E1');
        assert.equal(toMine(v, null), null);
    });
    test('there and back gives the same note', () => {
        const v = clefView(euphonium, 'bass');
        for (const p of ['C4', 'E3', 'Bb4', 'F#5', 'Ab2']) assert.equal(toMine(v, toOwn(v, p)), p);
        assert.equal(toOwn(v, 'Bb2'), 'C4');
    });
    test('the same sounding note either way: written + transposition is unchanged', () => {
        const midi = (p) => { const m = /^([A-G])(#|b)?(\d)$/.exec(p); return (Number(m[3]) + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
        for (const inst of [euphonium, trombone, { theory_clef: 'treble', written_to_concert: -26, other_clefs: [{ clef: 'bass', writtenToConcert: 0 }] }]) {
            const own = clefView(inst, null), mine = clefView(inst, 'bass');
            for (const p of ['C4', 'G4', 'F#3']) assert.equal(midi(p) + own.writtenToConcert, midi(toMine(mine, p)) + mine.writtenToConcert);
        }
    });
    test('a moved note is spelled the usual way a range is', () => {
        assert.equal(shiftPitch('C4', 1), 'C#4');
        assert.equal(shiftPitch('C4', 3), 'Eb4');
        assert.equal(shiftPitch('C4', -2), 'Bb3');
    });
});
