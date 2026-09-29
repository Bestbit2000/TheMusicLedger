// ML-357: the ABRSM grade lists and the Scales tool's grade grid (public/scaleGrades.js), and the scale
// shapes the grades ask for that buildScale gained (chromatic, dominant 7th, a 12th, down to the dominant,
// down & up). Loads notation.js, theoryEngine.js and scaleGrades.js into one sandbox, as the browser does.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
for (const f of ['notation.js', 'theoryEngine.js', 'scaleGrades.js']) {
    vm.runInNewContext(fs.readFileSync(new URL(`../../public/${f}`, import.meta.url), 'utf8'), sandbox);
}
const clone = (v) => JSON.parse(JSON.stringify(v));
const T = sandbox.self.TheoryEngine;
const SG = sandbox.self.ScaleGrades;
const m = SG.midiOf;
const build = (o) => clone(T.buildScale({ form: 'major', type: 'scale', octaves: 1, direction: 'both', clef: 'treble', ...o }));

describe('buildScale: the shapes the grades ask for (ML-357)', () => {
    test('chromatic: sharps going up, flats coming down, no key signature', () => {
        const s = build({ keyId: 'C major', type: 'chromatic' });
        assert.equal(s.pitches.length, 25);
        assert.deepEqual(s.pitches.slice(0, 3), ['C4', 'C#4', 'D4']);
        assert.deepEqual(s.pitches.slice(13, 16), ['B4', 'Bb4', 'A4']);
        assert.equal(s.keySignature, null);
        assert.equal(s.title, 'Chromatic scale on C');
    });
    test('dominant 7th: up and down from the dominant, then up a 4th to the tonic', () => {
        assert.deepEqual(build({ keyId: 'C major', type: 'dom7' }).pitches, ['G4', 'B4', 'D5', 'F5', 'G5', 'F5', 'D5', 'B4', 'G4', 'C5']);
        const a = build({ keyId: 'A minor', form: 'harmonic', type: 'dom7' });
        assert.ok(a.pitches.includes('G#4')); // the raised 7th - it's the dominant chord of the harmonic minor
        assert.equal(a.title, 'Dominant 7th in A minor');
    });
    test('a 12th: an octave and a 5th, up and back', () => {
        const s = build({ keyId: 'C major', octaves: 1.5 });
        assert.equal(s.pitches.length, 23);
        assert.equal(s.pitches[11], 'G5');
    });
    test('1 octave, down to the dominant: up an octave, down to the dominant below, back up to the tonic', () => {
        const s = build({ keyId: 'C major', pattern: 'toDominant' });
        assert.deepEqual(s.pitches.slice(14), ['C4', 'B3', 'A3', 'G3', 'A3', 'B3', 'C4']);
        assert.equal(s.pitches[7], 'C5');
        const arp = build({ keyId: 'C major', type: 'arpeggio', pattern: 'toDominant' });
        assert.deepEqual(arp.pitches, ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'C4', 'G3', 'C4']);
    });
    test('down & up: starts at the top', () => {
        const s = build({ keyId: 'C major', direction: 'downUp' });
        assert.deepEqual([s.pitches[0], s.pitches[7], s.pitches[14]], ['C5', 'C4', 'C5']);
    });
    test('tonicOctave puts the scale where a grade list chose; a minor arpeggio is just "minor"', () => {
        assert.equal(build({ keyId: 'C major', tonicOctave: 3 }).pitches[0], 'C3');
        assert.equal(build({ keyId: 'D minor', form: 'melodic', type: 'arpeggio' }).title, 'D minor arpeggio');
        assert.equal(build({ keyId: 'D minor', form: 'melodic' }).title, 'D melodic minor scale');
    });
});

describe('ABRSM grade lists (ML-357)', () => {
    test('every entry is a real key and shape, and builds in its list\'s clef', () => {
        for (const [id, g] of Object.entries(SG.DATA)) {
            assert.ok(['treble', 'bass'].includes(g.clef), id);
            for (const [grade, entries] of Object.entries(g.grades)) {
                assert.ok(['1', '2', '3', '4'].includes(grade), `${id} grade ${grade}`);
                for (const item of SG.requirements(id, [Number(grade)])) {
                    const where = `${id} G${grade} ${item.id}`;
                    assert.ok(T.ALL_KEYS.some(k => k.id === item.keyId), where);
                    assert.ok(['scale', 'arpeggio', 'chromatic', 'dom7'].includes(item.kind), where);
                    assert.ok([1, 1.5, 2].includes(item.octaves), where);
                    const minor = item.keyId.endsWith(' minor');
                    if (!minor) assert.equal(item.form, 'major', where);
                    // Grades 1-2 may play natural minors; from Grade 3 it's harmonic or melodic
                    else assert.ok((Number(grade) <= 2 ? ['natural', 'harmonic', 'melodic'] : ['harmonic', 'melodic']).includes(item.form), where);
                    const s = T.buildScale({ keyId: item.keyId, form: item.form, type: item.kind, octaves: item.octaves, pattern: item.pattern, direction: 'both', clef: g.clef });
                    assert.ok(s.pitches.length > 4, where);
                }
                assert.equal(new Set(entries).size, entries.length, `${id} grade ${grade} has a duplicate`);
            }
        }
    });
    test('chromatic scales start at Grade 3 and dominant 7ths at Grade 4', () => {
        for (const id of Object.keys(SG.DATA)) {
            for (const item of SG.requirements(id, [1, 2])) assert.ok(!['chromatic', 'dom7'].includes(item.kind), `${id} ${item.id}`);
            for (const item of SG.requirements(id, [3])) assert.notEqual(item.kind, 'dom7', `${id} ${item.id}`);
        }
    });
    test('requirements: each scale once, with every ticked grade that asks for it', () => {
        const both = SG.requirements('trumpet-cornet-flugel', [1, 2]);
        assert.equal(new Set(both.map(i => i.id)).size, both.length);
        assert.ok(both.every(i => i.grades.length >= 1 && i.grades.every(g => g === 1 || g === 2)));
        assert.deepEqual(clone(SG.requirements('trumpet-cornet-flugel', [])), []);
        assert.deepEqual(clone(SG.requirements('no-such-list', [1])), []);
    });
    test('the 15 columns are in chromatic order, with both spellings where a key has two', () => {
        assert.deepEqual(clone(SG.MAJOR_COLUMNS), ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'Cb']);
        assert.deepEqual(clone(SG.MINOR_COLUMNS), ['C', 'C#', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']);
        for (const id of Object.keys(SG.DATA)) {
            for (const item of SG.requirements(id, [1, 2, 3, 4])) {
                const [tonic, mode] = item.keyId.split(' ');
                assert.ok((mode === 'major' ? SG.MAJOR_COLUMNS : SG.MINOR_COLUMNS).includes(tonic), `${id}: ${item.keyId} has no column`);
            }
        }
    });
});

describe('which list an instrument uses (ML-357)', () => {
    const g = (name, clef) => (SG.groupFor(name, clef) || {}).id || null;
    test('brass by the clef it\'s read in; bass trombone uses the tenor trombone lists', () => {
        assert.equal(g('B♭ Cornet', 'treble'), 'trumpet-cornet-flugel');
        assert.equal(g('Flugelhorn', 'treble'), 'trumpet-cornet-flugel');
        assert.equal(g('E♭ Tenor Horn', 'treble'), 'eb-tenor-horn');
        assert.equal(g('French Horn', 'treble'), 'horn-f');
        assert.equal(g('Tenor Trombone', 'treble'), 'trombone-treble-clef');
        assert.equal(g('Tenor Trombone', 'bass'), 'trombone-bass-clef');
        assert.equal(g('Bass Trombone', 'bass'), 'trombone-bass-clef');
        assert.equal(g('B♭ Baritone Horn', 'treble'), 'baritone-euphonium-treble');
        assert.equal(g('B♭ Euphonium', 'bass'), 'baritone-euphonium-bass');
        assert.equal(g('E♭ Tuba', 'bass'), 'tuba-eb-bass-clef');
        assert.equal(g('B♭ Tuba', 'treble'), 'tuba-treble');
        assert.equal(g('Piccolo Trumpet', 'treble'), 'trumpet-cornet-flugel');
    });
    test('woodwind has one list whatever the clef; no list for strings or percussion', () => {
        assert.equal(g('Flute', 'bass'), 'flute');
        assert.equal(g('Piccolo', 'treble'), 'flute');
        assert.equal(g('B♭ Clarinet', 'treble'), 'clarinet');
        assert.equal(g('Alto Saxophone', 'treble'), 'saxophone');
        assert.equal(g('Bassoon', 'bass'), 'bassoon');
        assert.equal(g('Violin', 'treble'), null);
        assert.equal(g('Snare Drum', 'treble'), null);
        assert.equal(g('French Horn', 'bass'), null); // the horn list is treble clef only
    });
});

describe('the grade grid (ML-357)', () => {
    const baritone = (bottom, top) => ({ clef: 'treble', low: m('F#2'), high: m('E6'), bottom: bottom ? m(bottom) : null, top: top ? m(top) : null });
    test('no range set: every scale the grades need is in the list, in grid order', () => {
        const r = clone(SG.grid('baritone-euphonium-treble', [1], baritone()));
        assert.equal(r.needed, 6);
        assert.deepEqual(r.pool.map(p => `${p.keyId} ${p.form} ${p.type}`), [
            'C major major scale', 'C major major arpeggio', 'A minor natural scale', 'A minor harmonic scale', 'A minor melodic scale', 'A minor harmonic arpeggio']);
        assert.ok(r.pool.every(p => Number.isInteger(p.tonicOctave)));
    });
    test('a range: ready, another octave, or locked until it grows', () => {
        const r = clone(SG.grid('baritone-euphonium-treble', [1], baritone('C4', 'C5')));
        const states = Object.fromEntries([...r.sections.major, ...r.sections.minor].map(row => [`${row.label} ${row.form}`, row.cells.filter(c => c.state !== 'no').map(c => `${c.tonic}:${c.state}`).join(' ')]));
        assert.equal(states['Scales major'], 'C:ready');
        assert.equal(states['Harmonic minor harmonic'], 'A:locked');
        assert.equal(r.pool.length, 2);
        // A range reaching A3 lets A minor start an octave down
        const lower = clone(SG.grid('baritone-euphonium-treble', [1], baritone('A3', 'C5')));
        const a = [...lower.sections.minor].find(row => row.form === 'harmonic' && row.label === 'Harmonic minor').cells.find(c => c.tonic === 'A');
        assert.equal(a.state, 'other');
        assert.equal(a.tonicOctave, 3);
    });
    test('whatever octave the list picks, the scale fits your range', () => {
        const ctx = baritone('Bb3', 'F5');
        for (const p of SG.grid('baritone-euphonium-treble', [1, 2, 3, 4], ctx).pool) {
            const ms = T.buildScale({ keyId: p.keyId, form: p.form, type: p.type, octaves: p.octaves, pattern: p.pattern, direction: 'both', clef: 'treble', tonicOctave: p.tonicOctave }).pitches.map(m);
            assert.ok(Math.min(...ms) >= ctx.bottom && Math.max(...ms) <= ctx.top, `${p.keyId} ${p.type}`);
        }
    });
    test('beyond the instrument, and "not needed" wins over it', () => {
        // An instrument that can only play a 5th: everything the grade needs is beyond it...
        const tiny = { clef: 'treble', low: m('C4'), high: m('G4'), bottom: null, top: null };
        const r = clone(SG.grid('trumpet-cornet-flugel', [1], tiny));
        const cells = [...r.sections.major, ...r.sections.minor].flatMap(row => row.cells);
        assert.ok(cells.filter(c => c.state !== 'no').every(c => c.state === 'beyond'));
        assert.equal(r.pool.length, 0);
        // ...but a key the grade doesn't ask for is still "not needed", not "beyond"
        assert.ok(cells.some(c => c.state === 'no'));
    });
    test('rows only where needed, one per length', () => {
        const r = clone(SG.grid('trumpet-cornet-flugel', [1], baritone()));
        assert.ok(r.sections.major.every(row => row.cells.some(c => c.state !== 'no')));
        assert.ok(r.sections.minor.every(row => row.cells.some(c => c.state !== 'no')));
        assert.equal(SG.lengthLabel(1.5, null), 'a 12th');
        assert.equal(SG.lengthLabel(1, 'toDominant'), '1 octave, down to the dominant');
        assert.equal(SG.lengthLabel(2), '2 octaves');
    });
});
