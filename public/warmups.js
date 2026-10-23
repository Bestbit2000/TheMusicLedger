// ML-294: warm-up exercises - shared by the Warm-ups tool (app.js), the admin editor (admin.js), the
// server (server/services/warmups.js validates every save with it) and the tests. Browser script,
// loaded after notation.js; Node loads it with vm, like theoryEngine.js.
//
// An exercise is written for treble-clef brass (brass band parts: cornet, horn, baritone, euphonium
// and bass all read the same written notes), as a list of notes:
//   { p: 'G4', d: 'q' }             pitch (scientific, 'F#4', 'Bb3') and length: w h q e (semibreve,
//   { p: 'G4', d: 'q', dot: true }  minim, crotchet, quaver) - dot for dotted
//   { p: 'G4', d: 'q', sl: true }   slurred to the next note (ML-361) - a run of them is one slur
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
    // ML-539: the beats in a bar a warm-up can be saved with (the count-in is one bar - 3 or 4 clicks). check()
    // still reads 2-6, so nothing old fails to draw.
    const SAVE_BEATS = [3, 4];

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
            // A slur leads to the next note: not from a rest, not off the end, not into a rest.
            if (n.sl && n.p === null) errors.push(`Note ${i + 1}: a rest can't start a slur.`);
            else if (n.sl && (i === notes.length - 1 || !notes[i + 1] || notes[i + 1].p === null)) errors.push(`Note ${i + 1}: the slur doesn't lead to a note.`);
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

    // Rests after the last note are dropped (owner, 1 Oct 2026): a rest bar at the end only adds a silent bar
    // before the next go or the next warm-up. Saving trims them; migration 088 trimmed the seeded long tones.
    function trimEndRests(notes) {
        const out = Array.isArray(notes) ? notes.slice() : [];
        while (out.length && (!out[out.length - 1] || out[out.length - 1].p == null)) out.pop();
        return out;
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
    // ML-373: tenor clef reads the same pitches as bass clef (trombone and euphonium up high), so it takes
    // the same 9th down - only the clef it's drawn in differs.
    const pitchFor = (p, clef) => (p === null ? null : clef === 'bass' || clef === 'tenor' ? toBassClef(p) : p);

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
    // Each row also has its slurs (Notation spans, ML-361): a run of notes marked `sl` and the note
    // after it; a slur that runs past the end of a row runs on to the row's end (openEnd) and comes in
    // from the start of the next (openStart), as printed.
    // repeat (ML-538): it's played more than once in a row - the end is a repeat sign (back to the start), not
    // the final barline.
    // groups (ML-586): how many bars go on each row, worked out by fitRows from the width there is - in place of
    // perRow / barsPerRow (the admin editor's rows).
    function rows(ex, clef = 'treble', { perRow = 8, barsPerRow = 4, groups = null, cls = 'warmup-note', repeat = false } = {}) {
        const { bars } = check(ex);
        const notes = ex.notes || [];
        const out = [];
        if (groups) {
            let at = 0;
            groups.forEach((n) => { if (at < bars.length) out.push(bars.slice(at, at + n)); at += n; });
            if (at < bars.length) out.push(bars.slice(at));
        } else {
            let row = [], count = 0;
            bars.forEach((bar) => {
                if (row.length && (count + bar.length > perRow || row.length >= barsPerRow)) { out.push(row); row = []; count = 0; }
                row.push(bar); count += bar.length;
            });
            if (row.length) out.push(row);
        }
        let carried = false; // a slur still open at the end of the row before
        return out.map((rowBars, r) => {
            const items = [];
            const itemOf = {}; // note index -> item index in this row
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
                    itemOf[i] = items.length;
                    items.push({ type: 'note', pitch: p, accidental: show, head, dots: n.dot ? 1 : 0, cls: c });
                });
                const lastBar = r === out.length - 1 && b === rowBars.length - 1;
                items.push({ type: 'barline', glyph: lastBar ? (repeat ? 'repeatRight' : 'barlineFinal') : 'barlineSingle' });
            });
            const spans = [];
            let start = null;
            const firstItem = itemOf[rowBars.flat().find(i => i in itemOf)];
            rowBars.flat().forEach((i, k) => {
                if (!(i in itemOf)) return;
                const comesIn = k === 0 && carried;
                if (start === null && (notes[i].sl || comesIn)) start = itemOf[i];
                if (start !== null && !notes[i].sl) { spans.push({ kind: 'slur', from: start, to: itemOf[i], ...(comesIn || (carried && start === firstItem) ? { openStart: true } : {}) }); start = null; }
            });
            const lastNote = rowBars.flat().filter(i => i in itemOf).pop();
            carried = start !== null;
            if (carried) spans.push({ kind: 'slur', from: start, to: itemOf[lastNote], openEnd: true, ...(r > 0 && start === firstItem && out[r - 1] && notes[out[r - 1].flat().filter(i => notes[i].p !== null).pop()].sl ? { openStart: true } : {}) });
            return { items, spans, from: rowBars[0][0], to: rowBars[rowBars.length - 1][rowBars[rowBars.length - 1].length - 1] };
        });
    }
    // ML-586: rows that fit a width - as many whole bars on a row as fit, so every warm-up is drawn at the same
    // size (the music size) instead of each being stretched to fill the screen. measure(row) is the row's
    // natural width (Notation.staff's), in the same units as width. A bar wider than the width on its own still
    // gets a row of its own (the tool draws it a little narrower). Returns rows() with { groups }.
    // The lines are then evened out: the narrowest width that still needs no more lines is used, so seven bars are
    // 3 + 4 (the first line has the time signature too), not 6 + 1.
    function fitRows(ex, clef, width, measure, opts = {}) {
        const nBars = check(ex).bars.length;
        const pack = (w) => {
            const groups = [];
            let done = 0;
            while (done < nBars) {
                let n = 1;
                while (done + n < nBars) {
                    const tryRow = rows(ex, clef, { ...opts, groups: [...groups, n + 1] })[groups.length];
                    if (measure(tryRow) > w) break;
                    n++;
                }
                groups.push(n);
                done += n;
            }
            return groups;
        };
        let best = pack(width);
        let lo = width / 2, hi = width;
        for (let k = 0; k < 8 && best.length > 1; k++) {
            const mid = (lo + hi) / 2, g = pack(mid);
            if (g.length <= best.length) { best = g; hi = mid; } else lo = mid;
        }
        return rows(ex, clef, { ...opts, groups: best });
    }

    // ML-586: the tool's settings, saved on the account (server/services/warmups.js checks them with this; the app
    // reads them back with it). Only these keys and values are kept - anything else is dropped, a bad value refused.
    //   metronome  own pace (false) or with the metronome, carrying on to the next warm-up (true)
    //   speed      a percentage of each warm-up's own speed - offered from the app's one list of play speeds
    //              (Admin -> Playback speeds, ML-596), so any whole percentage up to SPEED_MAX is kept
    //   times      plays each warm-up once or twice
    //   countIn    a bar before each (1) or none (0)              volume   the click, 0-100
    //   size       the music size                                 shuffle  a mixed-up order
    //   kinds      the topics                                     instrumentId  whose range and clef count
    //   light      the note being played lights gold (off for a player who doesn't need it - owner, 23 Oct 2026)
    const SPEED_MAX = 400;
    const TIMES = [1, 2];
    const SIZES = ['small', 'medium', 'large'];
    const PREF_DEFAULTS = { metronome: false, speed: 100, times: 2, countIn: 1, volume: 80, size: 'medium', shuffle: false, light: true, kinds: KIND_IDS.slice(), instrumentId: null };
    function cleanPrefs(prefs) {
        const out = {};
        if (!prefs || typeof prefs !== 'object') return out;
        const bad = (key) => { const e = new Error(`Unknown ${key} setting.`); e.status = 400; throw e; };
        const one = (key, allowed) => { if (key in prefs) { if (!allowed.includes(prefs[key])) bad(key); out[key] = prefs[key]; } };
        one('metronome', [true, false]);
        if ('speed' in prefs) { if (!Number.isInteger(prefs.speed) || prefs.speed < 1 || prefs.speed > SPEED_MAX) bad('speed'); out.speed = prefs.speed; }
        one('times', TIMES);
        one('countIn', [0, 1]);
        one('size', SIZES);
        one('shuffle', [true, false]);
        one('light', [true, false]);
        if ('volume' in prefs) { if (!Number.isInteger(prefs.volume) || prefs.volume < 0 || prefs.volume > 100) bad('volume'); out.volume = prefs.volume; }
        if ('kinds' in prefs) { if (!Array.isArray(prefs.kinds) || prefs.kinds.some(k => !KIND_IDS.includes(k))) bad('kinds'); out.kinds = KIND_IDS.filter(k => prefs.kinds.includes(k)); }
        if ('instrumentId' in prefs) { const v = prefs.instrumentId; if (v !== null && !(Number.isInteger(v) && v > 0)) bad('instrumentId'); out.instrumentId = v; }
        return out;
    }

    // The lowest and highest note (MIDI) as written in a clef - for "is it in your range" (ML-361).
    function span(ex, clef = 'treble') {
        const ms = (ex.notes || []).filter(n => n.p !== null).map(n => midi(pitchFor(n.p, clef)));
        return ms.length ? [Math.min(...ms), Math.max(...ms)] : null;
    }
    // One shared height for every row of an exercise, so the rows don't jump about.
    function stepRange(ex, clef = 'treble') {
        const steps = (ex.notes || []).filter(n => n.p !== null).map(n => Notation.staffStep(pitchFor(n.p, clef), clef));
        return [Math.min(-3, ...steps) - 1, Math.max(10, ...steps) + 1];
    }

    // Authoring shorthand (seed data and tests): "G4w | E4h G4h | rq C5q. D5e" - pitch or r, then the
    // length, a dot for dotted, ^ for slurred to the next note ("C4q^ G4q^ C5w"). Bar lines are optional
    // (check() works bars out from the lengths).
    function parse(text) {
        return String(text).trim().split(/\s+/).filter(t => t !== '|').map((t) => {
            const m = /^(r|[A-G](?:bb|b|#|x)?[0-8])([whqe])(\.)?(\^)?$/.exec(t);
            if (!m) throw new Error('Bad note: ' + t);
            const n = { p: m[1] === 'r' ? null : m[1], d: m[2] };
            if (m[3]) n.dot = true;
            if (m[4]) n.sl = true;
            return n;
        });
    }
    // The other way round (tests, and the migration that added the seed exercises' slurs).
    const format = (notes) => notes.map(n => `${n.p === null ? 'r' : n.p}${n.d}${n.dot ? '.' : ''}${n.sl ? '^' : ''}`).join(' ');

    const api = { KINDS, KIND_IDS, LENGTHS, LENGTH_NAMES, RANGE, SAVE_BEATS, beatsOf, midi, check, trimEndRests, toBassClef, pitchFor, timeline, noteAt, rows, fitRows, span, stepRange, parse, format, SPEED_MAX, TIMES, SIZES, PREF_DEFAULTS, cleanPrefs };
    root.Warmups = api;
})(typeof self !== 'undefined' ? self : globalThis);
