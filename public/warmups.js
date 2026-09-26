// ML-294: warm-up exercises - shared by the Warm-ups tool (app.js), the admin editor (admin.js), the
// server (server/services/warmups.js validates every save with it) and the tests. Browser script,
// loaded after notation.js; Node loads it with vm, like theoryEngine.js.
//
// An exercise is written for treble-clef brass (brass band parts: cornet, horn, baritone, euphonium
// and bass all read the same written notes), as a list of notes:
//   { p: 'G4', d: 'q' }             pitch (scientific, 'F#4', 'Bb3') and length: w h q e (semibreve,
//   { p: 'G4', d: 'q', dot: true }  minim, crotchet, quaver) - dot for dotted
//   { p: null, d: 'w' }             a rest
// plus beatsPerBar (crotchet beats, 2-6). Bars are worked out from the lengths; a note may not cross a
// bar line. Bass clef (trombone, euphonium) is the same exercise down a major 9th - how a treble-clef
// B♭ part and its bass-clef part relate - so lip slurs stay on the same partials.
(function (root) {
    'use strict';
    const Notation = root.Notation;

    const KINDS = [
        { id: 'long-tones', label: 'Long tones', tip: 'Breath, tone and a steady sound' },
        { id: 'lip-slurs', label: 'Lip slurs', tip: 'Flexibility over the harmonics' },
        { id: 'flexibility', label: 'Flexibility', tip: 'Intervals and leaps' },
        { id: 'articulation', label: 'Articulation', tip: 'Tonguing, clean starts' },
        { id: 'fingers', label: 'Finger patterns', tip: 'Fingers and tongue together' },
        { id: 'melodic', label: 'Easy melodies', tip: 'A gentle tune to finish' },
    ];
    const KIND_IDS = KINDS.map(k => k.id);
    const LENGTHS = { w: 4, h: 2, q: 1, e: 0.5 };
    const LENGTH_NAMES = { w: 'semibreve', h: 'minim', q: 'crotchet', e: 'quaver' };
    const PITCH_RE = /^([A-G])(bb|b|#|x)?([0-8])$/;
    // The written range an exercise may use (treble clef): a low F# (lowest brass valve note) to high C.
    const RANGE = ['F#3', 'C6'];

    const beatsOf = (n) => LENGTHS[n.d] * (n.dot ? 1.5 : 1);
    function midi(p) {
        const m = PITCH_RE.exec(p);
        if (!m) return null;
        const alter = { bb: -2, b: -1, '#': 1, x: 2 }[m[2]] || 0;
        return (Number(m[3]) + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + alter;
    }

    // Bars (lists of note indexes) and any problems. A note that runs over a bar line, an unknown
    // pitch or length, or a pitch out of range is an error; a short last bar is allowed (a phrase can
    // end on the beat) but reported as a note.
    function check(ex) {
        const errors = [];
        const notes = Array.isArray(ex && ex.notes) ? ex.notes : [];
        const bpb = Number(ex && ex.beatsPerBar);
        if (!(bpb >= 2 && bpb <= 6)) errors.push('Beats in a bar must be 2 to 6.');
        if (!notes.length) errors.push('Add at least one note.');
        const lo = midi(RANGE[0]), hi = midi(RANGE[1]);
        const bars = [];
        let bar = [], filled = 0;
        notes.forEach((n, i) => {
            if (!n || !LENGTHS[n.d]) { errors.push(`Note ${i + 1}: unknown length.`); return; }
            if (n.p !== null) {
                const m = midi(n.p);
                if (m === null) errors.push(`Note ${i + 1}: "${n.p}" isn't a pitch.`);
                else if (m < lo || m > hi) errors.push(`Note ${i + 1}: ${n.p} is outside ${RANGE[0]}-${RANGE[1]}.`);
            }
            const b = beatsOf(n);
            if (bpb && filled + b > bpb + 1e-9) errors.push(`Note ${i + 1} runs over the bar line (bar ${bars.length + 1}).`);
            bar.push(i);
            filled += b;
            if (bpb && filled >= bpb - 1e-9) { bars.push(bar); bar = []; filled = 0; }
        });
        if (bar.length) bars.push(bar);
        const shortLast = bar.length > 0 && errors.length === 0;
        return { ok: errors.length === 0, errors, bars, shortLast };
    }

    // Down a major 9th (14 semitones, 8 letter-steps): treble-clef B♭ brass written pitch to the same
    // sound written for a bass-clef instrument. Spelled from the letter, so C -> B♭, G -> F, F# -> E.
    const LETTERS = 'CDEFGAB';
    const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    function toBassClef(p) {
        const m = PITCH_RE.exec(p);
        const idx = LETTERS.indexOf(m[1]) + Number(m[3]) * 7 - 8;
        const letter = LETTERS[((idx % 7) + 7) % 7], octave = Math.floor(idx / 7);
        const alter = midi(p) - 14 - ((octave + 1) * 12 + NATURAL[letter]);
        return letter + ({ '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: 'x' })[alter] + octave;
    }
    const pitchFor = (p, clef) => (p === null ? null : clef === 'bass' ? toBassClef(p) : p);

    // When each note starts and how long it lasts, in clicks: the metronome clicks every crotchet, or
    // every quaver when the exercise has quavers or dotted crotchets. The gold note follows this.
    function timeline(ex) {
        const notes = ex.notes || [];
        const unit = notes.some(n => n.d === 'e' || (n.d === 'q' && n.dot)) ? 0.5 : 1;
        let at = 0;
        const events = notes.map((n, i) => { const e = { i, start: at, clicks: beatsOf(n) / unit, rest: n.p === null }; at += e.clicks; return e; });
        const clicksPerBar = (ex.beatsPerBar || 4) / unit;
        return { unit, notesPerBeat: 1 / unit, events, totalClicks: Math.ceil(at / clicksPerBar) * clicksPerBar, clicksPerBar };
    }
    // Which note sounds at click k of a pass (-1 once the last note has finished, into the last bar's rest).
    function noteAt(tl, k) {
        for (const e of tl.events) if (k >= e.start && k < e.start + e.clicks) return e.i;
        return -1;
    }

    // Rows for the stave: whole bars, up to 8 notes and 4 bars a row, so a phone never scrolls sideways.
    // Each row is Notation.staff items; every note/rest carries `cls` (warmup-note warmup-note-<i>) so the
    // tool can light the one playing and the admin editor can tap one to select it. Accidentals are
    // written as they're needed and last to the end of the bar (a natural where one goes back).
    function rows(ex, clef = 'treble', { perRow = 8, barsPerRow = 4, cls = 'warmup-note' } = {}) {
        const { bars } = check(ex);
        const notes = ex.notes || [];
        const out = [];
        let row = [], count = 0;
        bars.forEach((bar) => {
            if (row.length && (count + bar.length > perRow || row.length >= barsPerRow)) { out.push(row); row = []; count = 0; }
            row.push(bar); count += bar.length;
        });
        if (row.length) out.push(row);
        return out.map((rowBars, r) => {
            const items = [];
            if (r === 0) items.push({ type: 'timeSig', top: ex.beatsPerBar || 4, bottom: 4 });
            rowBars.forEach((bar, b) => {
                const inBar = {};
                bar.forEach((i) => {
                    const n = notes[i];
                    const c = `${cls} ${cls}-${i}`;
                    if (n.p === null) {
                        // A bar that's one whole rest: the rest sits in the middle of the bar, as printed.
                        if (bar.length === 1) items.push({ type: 'space', width: 0, grow: true });
                        const glyph = { w: 'restWhole', h: 'restHalf', q: 'restQuarter', e: 'rest8th' }[n.d];
                        items.push({ type: 'mark', glyph, step: n.d === 'w' ? 6 : 4, cls: c });
                        return;
                    }
                    let p = pitchFor(n.p, clef);
                    const m = PITCH_RE.exec(p);
                    const alter = { bb: -2, b: -1, '#': 1, x: 2 }[m[2]] || 0;
                    const slot = m[1] + m[3];
                    const show = alter !== (slot in inBar ? inBar[slot] : 0);
                    inBar[slot] = alter;
                    if (show && alter === 0) p = m[1] + 'n' + m[3];
                    const down = Notation.staffStep(p, clef) >= 4;
                    const head = n.d === 'w' ? 'noteheadWhole' : { h: 'noteHalf', q: 'noteQuarter', e: 'note8th' }[n.d] + (down ? 'Down' : 'Up');
                    items.push({ type: 'note', pitch: p, accidental: show, head, dots: n.dot ? 1 : 0, cls: c });
                });
                const lastBar = r === out.length - 1 && b === rowBars.length - 1;
                items.push({ type: 'barline', glyph: lastBar ? 'barlineFinal' : 'barlineSingle' });
            });
            return { items, from: rowBars[0][0], to: rowBars[rowBars.length - 1][rowBars[rowBars.length - 1].length - 1] };
        });
    }
    // One shared height for every row of an exercise, so the rows don't jump about.
    function stepRange(ex, clef = 'treble') {
        const steps = (ex.notes || []).filter(n => n.p !== null).map(n => Notation.staffStep(pitchFor(n.p, clef), clef));
        return [Math.min(-3, ...steps) - 1, Math.max(10, ...steps) + 1];
    }

    // Authoring shorthand (seed data and tests): "G4w | E4h G4h | rq C5q. D5e" - pitch or r, then the
    // length, a dot for dotted. Bar lines are optional (check() works bars out from the lengths).
    function parse(text) {
        return String(text).trim().split(/\s+/).filter(t => t !== '|').map((t) => {
            const m = /^(r|[A-G](?:bb|b|#|x)?[0-8])([whqe])(\.)?$/.exec(t);
            if (!m) throw new Error('Bad note: ' + t);
            const n = { p: m[1] === 'r' ? null : m[1], d: m[2] };
            if (m[3]) n.dot = true;
            return n;
        });
    }

    const api = { KINDS, KIND_IDS, LENGTHS, LENGTH_NAMES, RANGE, beatsOf, midi, check, toBassClef, pitchFor, timeline, noteAt, rows, stepRange, parse };
    root.Warmups = api;
})(typeof self !== 'undefined' ? self : globalThis);
