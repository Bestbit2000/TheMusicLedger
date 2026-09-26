// ML-294: the warm-ups engine (public/warmups.js) - bars, the bass-clef transposition, the playback
// timeline and drawing. Loaded with vm like theoryEngine.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
vm.createContext(sandbox);
for (const f of ['notation.js', 'warmups.js']) vm.runInContext(fs.readFileSync(new URL(`../../public/${f}`, import.meta.url), 'utf8'), sandbox);
const W = sandbox.self.Warmups;
const N = sandbox.self.Notation;
const ex = (text, beatsPerBar = 4) => ({ beatsPerBar, notes: W.parse(text) });
const plain = (x) => JSON.parse(JSON.stringify(x));

describe('warm-ups (ML-294)', () => {
    test('parse: pitches, lengths, dots and rests', () => {
        assert.deepEqual(plain(W.parse('G4w | rq C5q. D5e')), [{ p: 'G4', d: 'w' }, { p: null, d: 'q' }, { p: 'C5', d: 'q', dot: true }, { p: 'D5', d: 'e' }]);
        assert.throws(() => W.parse('H4q'));
    });
    test('check: bars from the lengths; a note over the bar line, a bad pitch or out of range is an error', () => {
        const c = W.check(ex('G4h G4h G4q G4q G4h C5w'));
        assert.ok(c.ok);
        assert.deepEqual(plain(c.bars), [[0, 1], [2, 3, 4], [5]]);
        assert.match(W.check(ex('G4q G4h G4h')).errors.join(), /runs over the bar line/);
        assert.match(W.check(ex('C2w')).errors.join(), /outside/);
        assert.match(W.check({ beatsPerBar: 4, notes: [{ p: 'X9', d: 'q' }] }).errors.join(), /isn't a pitch/);
        assert.match(W.check({ beatsPerBar: 9, notes: W.parse('C4w') }).errors.join(), /Beats in a bar/);
        assert.equal(W.check(ex('C4h E4h', 3)).ok, false); // 2 + 2 beats: the minim runs over a 3/4 bar line
        assert.equal(W.check(ex('C4h. E4q', 3)).ok, true); // a full bar, then a short last bar - allowed
    });
    test('bass clef is down a major 9th, spelled from the letter', () => {
        assert.equal(W.toBassClef('C4'), 'Bb2');
        assert.equal(W.toBassClef('G4'), 'F3');
        assert.equal(W.toBassClef('F#4'), 'E3');
        assert.equal(W.toBassClef('Bb4'), 'Ab3');
        assert.equal(W.toBassClef('C5'), 'Bb3');
        // the open harmonics C G C E G -> B♭ F B♭ D F, as a bass-clef euphonium/trombone reads them
        assert.deepEqual(['C4', 'G4', 'C5', 'E5', 'G5'].map(W.toBassClef), ['Bb2', 'F3', 'Bb3', 'D4', 'F4']);
    });
    test('timeline: crotchet clicks, or quaver clicks when there are quavers; the gold note follows the lengths', () => {
        const t = W.timeline(ex('G4h C5q C5q G4w'));
        assert.equal(t.unit, 1);
        assert.deepEqual(plain(t.events.map(e => [e.start, e.clicks])), [[0, 2], [2, 1], [3, 1], [4, 4]]);
        assert.equal(t.totalClicks, 8);
        assert.equal(W.noteAt(t, 1), 0);
        assert.equal(W.noteAt(t, 5), 3);
        const q = W.timeline(ex('G4q. G4e G4h'));
        assert.equal(q.unit, 0.5);
        assert.equal(q.notesPerBeat, 2);
        assert.equal(W.noteAt(q, 3), 1);
        const short = W.timeline(ex('G4h')); // a short last bar rounds up to a full bar
        assert.equal(short.totalClicks, 4);
        assert.equal(W.noteAt(short, 3), -1);
    });
    test('rows: whole bars, at most 8 notes and 4 bars a row; accidentals last a bar, naturals back', () => {
        const rows = W.rows(ex('G4q G#4q A4q G4q G4w G4q A4q B4q C5q C5w'));
        assert.equal(rows.length, 2);
        const notes = rows[0].items.filter(i => i.type === 'note');
        assert.equal(notes[1].accidental, true);   // G#
        assert.equal(notes[3].pitch, 'Gn4');       // back to G in the same bar: a natural
        assert.equal(notes[4].accidental, false);  // next bar: plain again
        assert.equal(rows[0].items[0].type, 'timeSig');
        assert.equal(rows[1].items[rows[1].items.length - 1].glyph, 'barlineFinal');
        assert.ok(rows.flatMap(r => r.items).filter(i => i.cls).every(i => /^warmup-note warmup-note-\d+$/.test(i.cls)));
    });
    test('every seeded exercise checks and draws in both clefs', () => {
        const sql = fs.readFileSync(new URL('../../db/migrations/055_warmups.sql', import.meta.url), 'utf8');
        const found = [...sql.matchAll(/'(\[\{.*?\}\])'::jsonb, (\d)/g)];
        assert.ok(found.length >= 60, 'expected the seeded exercises');
        for (const [, json, bpb] of found) {
            const e = { beatsPerBar: Number(bpb), notes: JSON.parse(json.replace(/''/g, "'")) };
            const c = W.check(e);
            assert.ok(c.ok, c.errors.join(' '));
            for (const clef of ['treble', 'bass']) for (const r of W.rows(e, clef)) N.staff({ clef, items: r.items, stepRange: W.stepRange(e, clef) });
        }
    });
});
