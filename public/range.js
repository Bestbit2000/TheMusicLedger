// ML-305 / ML-322: the engine behind the Range tool and the range picker - your comfortable range, the
// note just beyond it, the run up (or down) to it, how long you held it, the Level each note beyond
// your range has reached, and measuring a range with the tuner. Pure logic with no DOM, audio or
// storage: loaded in the browser (window.PlayRange, after notation.js), by the server to re-score a go
// (server/services/range.js) and by server/test/range.test.js. Read docs/range.md before changing a rule.
//
// Every note here is a WRITTEN pitch in the clef the player reads ('F#3'), as the instrument's music is
// printed; the tuner hears concert pitch, so heardWritten() turns a frequency into the written note
// using the instrument's transposition (concert = written + writtenToConcert semitones).
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./notation.js'));
    else root.PlayRange = factory(root.Notation); // not "Range": that's the browser's own DOM Range
}(typeof self !== 'undefined' ? self : this, function (Notation) {
    'use strict';

    // ---------------------------------------------------------------- notes

    const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const LETTERS = 'CDEFGAB';
    const ACC = { '-1': 'b', 0: '', 1: '#' };
    // MIDI number of a written pitch (60 = middle C, C4).
    function midiOf(pitch) {
        const p = Notation.parsePitch(pitch);
        return (p.octave + 1) * 12 + SEMI[p.letter] + p.alter;
    }
    // A MIDI number as a pitch: white keys natural, black keys as sharps ('sharp'), flats ('flat') or the
    // usual way a range is written ('usual': C♯, E♭, F♯, A♭, B♭ - every note of your range and beyond).
    const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    // 'usual': how a range is written - C♯, E♭, F♯, A♭, B♭ (not A♯3 as a bottom note).
    const USUAL_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    function pitchOf(midi, spelling = 'sharp') {
        const pc = ((midi % 12) + 12) % 12;
        return ({ flat: FLAT_NAMES, usual: USUAL_NAMES }[spelling] || SHARP_NAMES)[pc] + (Math.floor(midi / 12) - 1);
    }
    // "F♯3" for the screen.
    const label = (pitch) => { const p = Notation.parsePitch(pitch); return p.letter + ({ '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' })[p.alter] + p.octave; };

    // ---------------------------------------------------------------- your range

    // range: { bottom, top } written pitches (either may be null = not set); outer: { low, high } the
    // instrument's typical range (the outer limit), or null when holding a note doesn't apply.
    // direction 'up' works on the top note, 'down' on the bottom one.
    const DIRECTIONS = ['up', 'down'];
    function edgeOf(range, direction) { return direction === 'down' ? range.bottom : range.top; }
    // The note to work on: a semitone beyond your comfortable note (spelled the usual way, so it can
    // become your new top or bottom note as it is), or null when there isn't one (no range set, or
    // already at the instrument's limit).
    function target(range, outer, direction) {
        const edge = edgeOf(range || {}, direction);
        if (!edge) return null;
        const midi = midiOf(edge) + (direction === 'down' ? -1 : 1);
        if (outer && (midi < midiOf(outer.low) || midi > midiOf(outer.high))) return null;
        return { midi, pitch: pitchOf(midi, 'usual') };
    }
    // Every note beyond your comfortable note, out to the instrument's limit, nearest first.
    function notesBeyond(range, outer, direction) {
        const edge = edgeOf(range || {}, direction);
        if (!edge || !outer) return [];
        const out = [];
        const step = direction === 'down' ? -1 : 1, stop = midiOf(direction === 'down' ? outer.low : outer.high);
        for (let m = midiOf(edge) + step; direction === 'down' ? m >= stop : m <= stop; m += step) out.push({ midi: m, pitch: pitchOf(m, 'usual') });
        return out;
    }
    // ML-370: the outer limit from the instrument's typical written range (the catalogue's range_low /
    // range_high). The bottom is a hard limit; on brass and woodwind the top is only the usual top - an
    // experienced player goes higher (altissimo on woodwind) - so the limit is a 4th above it there.
    // { low, high, usualHigh }, or null when the range doesn't apply.
    const STRETCH_ABOVE = 5;
    const STRETCH_FAMILIES = ['Brass', 'Woodwind'];
    function outerLimit(low, high, family) {
        if (!low || !high) return null;
        const stretch = STRETCH_FAMILIES.includes(family) ? STRETCH_ABOVE : 0;
        return { low, high: stretch ? pitchOf(midiOf(high) + stretch, 'usual') : high, usualHigh: high };
    }
    // Is this a usable range? Both notes set, bottom below top, both inside the outer limit.
    function checkRange(range, outer) {
        if (!range || !range.bottom || !range.top) return 'Set both your bottom and top notes.';
        const b = midiOf(range.bottom), t = midiOf(range.top);
        if (b >= t) return 'Your bottom note has to be lower than your top note.';
        if (outer && (b < midiOf(outer.low) || t > midiOf(outer.high))) {
            const usual = outer.usualHigh || outer.high;
            return `This instrument's range is ${label(outer.low)} to ${label(usual)}${usual !== outer.high ? ` (up to ${label(outer.high)} with experience)` : ''}.`;
        }
        return null;
    }

    // ---------------------------------------------------------------- the run up (or down)

    // The major key a comfortable note is the tonic of, spelled the usual way (fewest sharps or flats).
    const TONIC_FOR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
    // Going up: the major scale an octave up to your top note, then the target. Going down: the major
    // scale an octave down to your bottom note, then the target. Written as one bar (see writeRun).
    function run(range, outer, direction) {
        const t = target(range, outer, direction);
        if (!t) return null;
        const edge = midiOf(edgeOf(range, direction));
        const tonic = TONIC_FOR[((edge % 12) + 12) % 12];
        const start = direction === 'down' ? edge : edge - 12;
        const startOctave = Math.floor(start / 12) - 1;
        const letter0 = LETTERS.indexOf(tonic[0]);
        const scale = MAJOR.map((semis, i) => {
            const d = letter0 + i, letter = LETTERS[d % 7], octave = startOctave + Math.floor(d / 7);
            const alter = start + semis - ((octave + 1) * 12 + SEMI[letter]);
            return letter + ACC[alter] + octave;
        });
        const notes = direction === 'down' ? scale.slice().reverse() : scale;
        return { notes: [...notes, t.pitch], target: t, direction };
    }
    // Which notes need an accidental written: the whole run is one bar, so an accidental lasts to the
    // end and a note going back to plain gets a natural. [{ pitch ('n' for a natural), accidental }].
    function writeRun(pitches) {
        const inBar = {};
        return pitches.map((pitch) => {
            const p = Notation.parsePitch(pitch);
            const slot = p.letter + p.octave;
            const show = p.alter !== (inBar[slot] || 0);
            inBar[slot] = p.alter;
            return { pitch: show && p.alter === 0 ? `${p.letter}n${p.octave}` : pitch, accidental: show };
        });
    }

    // ---------------------------------------------------------------- Levels

    // Beats held -> Level: 1 sounded, 2 held 2 beats, 3 held 4, 4 held 6; Level 5 is 8 beats three goes
    // in a row. Levels never go down; a go under 8 beats starts the run of three again.
    const LEVEL_BEATS = [0, 0, 2, 4, 6];      // index = Level, value = beats needed (Level 1: any sound)
    const HOLD_BEATS = 8, IN_A_ROW = 3, MAX_BEATS = 16;
    function levelForBeats(beats) {
        if (!(beats > 0)) return 0;
        for (let l = 4; l >= 1; l--) if (beats >= LEVEL_BEATS[l]) return l;
        return 1;
    }
    // state: { level, streak, bestBeats, goes } (a note never tried = all 0). Returns the new state and
    // whether this go took it to Level 5 (then the app asks before moving your range).
    function applyGo(state, beats) {
        const s = { level: 0, streak: 0, bestBeats: 0, goes: 0, ...(state || {}) };
        const b = Math.max(0, Math.min(MAX_BEATS, Number(beats) || 0));
        const streak = b >= HOLD_BEATS ? s.streak + 1 : 0;
        let level = Math.max(s.level, levelForBeats(b));
        if (streak >= IN_A_ROW) level = 5;
        return { level, streak, bestBeats: Math.max(s.bestBeats, Math.round(b * 100) / 100), goes: s.goes + 1, reachedFive: level === 5 && s.level < 5 };
    }
    // "Held it" / "Not yet" when there's no microphone.
    const SELF_BEATS = { held: HOLD_BEATS, notYet: 0 };

    // ---------------------------------------------------------------- listening

    // A frequency (Hz, concert pitch) -> the written note heard, and how far off it is (cents). null for
    // no pitch.
    function heardWritten(freq, writtenToConcert, a4 = 440) {
        if (!(freq > 0)) return null;
        const exact = 69 + 12 * Math.log2(freq / a4);
        const concert = Math.round(exact);
        return { midi: concert - (Number(writtenToConcert) || 0), cents: Math.round((exact - concert) * 100) };
    }
    // Counts how long the target note is held, from a stream of what the tuner hears. Feed it
    // (timeMs, writtenMidi or null) about 60 times a second. The hold starts once the target has been
    // heard for START_MS, survives gaps of up to GAP_MS (a breath of noise, a wobble onto the next note),
    // and ends when it's been gone for END_MS. "Even if not in tune": any pitch that rounds to the target
    // counts. beats = held time / one beat.
    const HOLD = { START_MS: 150, GAP_MS: 250, END_MS: 400 };
    function holdTracker(targetMidi, bpm) {
        const beatMs = 60000 / bpm;
        let firstSeen = null, started = null, lastSeen = null, ended = null;
        return {
            feed(t, midi) {
                if (ended !== null) return this.state(t);
                const on = midi === targetMidi;
                if (on) {
                    if (started === null) {
                        if (firstSeen === null || (lastSeen !== null && t - lastSeen > HOLD.GAP_MS)) firstSeen = t;
                        if (t - firstSeen >= HOLD.START_MS) started = firstSeen;
                    }
                    lastSeen = t;
                } else if (started !== null && t - lastSeen > HOLD.END_MS) {
                    ended = lastSeen;
                } else if (started === null && lastSeen !== null && t - lastSeen > HOLD.GAP_MS) {
                    firstSeen = null;
                }
                return this.state(t);
            },
            state(t) {
                const end = ended !== null ? ended : (started !== null ? Math.max(lastSeen, started) : null);
                const heldMs = started === null ? 0 : end - started;
                return { holding: started !== null && ended === null, done: ended !== null, beats: Math.min(MAX_BEATS, heldMs / beatMs) };
            },
        };
    }
    // Measure it with the tuner: the lowest and highest written notes held steady for STEADY_MS. Feed it
    // (timeMs, writtenMidi or null); notes outside the instrument's outer limit are ignored (a squeak, a
    // pedal note the instrument can't really make, the room).
    const MEASURE = { STEADY_MS: 1000 };
    function rangeMeasurer(outer) {
        const lo = outer ? midiOf(outer.low) : -Infinity, hi = outer ? midiOf(outer.high) : Infinity;
        let cur = null, since = null, low = null, high = null;
        return {
            feed(t, midi) {
                if (midi === null || midi === undefined || midi < lo || midi > hi) { cur = null; since = null; return this.result(); }
                if (midi !== cur) { cur = midi; since = t; }
                if (t - since >= MEASURE.STEADY_MS) {
                    if (low === null || midi < low) low = midi;
                    if (high === null || midi > high) high = midi;
                }
                return this.result();
            },
            result() {
                return {
                    now: cur, low, high,
                    bottom: low === null ? null : pitchOf(low, 'usual'),
                    top: high === null ? null : pitchOf(high, 'usual'),
                };
            },
        };
    }

    // ---------------------------------------------------------------- the range picker's stave

    // Tapping the picker's stave: the natural note at the staff step tapped (0 = bottom line), kept inside
    // the outer limit. −/+ then move a semitone, spelled the usual way (C♯, E♭, F♯, A♭, B♭).
    function pitchAtStep(step, clef, outer) {
        let p = Notation.pitchAtStep(Math.round(step), clef);
        if (outer) {
            const m = midiOf(p);
            if (m < midiOf(outer.low)) p = outer.low;
            if (m > midiOf(outer.high)) p = outer.high;
        }
        return p;
    }
    function stepSemitone(pitch, dir, outer) {
        const m = midiOf(pitch) + dir;
        if (outer && (m < midiOf(outer.low) || m > midiOf(outer.high))) return pitch;
        return pitchOf(m, 'usual');
    }

    return {
        DIRECTIONS, LEVEL_BEATS, HOLD_BEATS, IN_A_ROW, MAX_BEATS, SELF_BEATS, HOLD, MEASURE, STRETCH_ABOVE, STRETCH_FAMILIES,
        midiOf, pitchOf, label, outerLimit, target, notesBeyond, checkRange, run, writeRun,
        levelForBeats, applyGo, heardWritten, holdTracker, rangeMeasurer, pitchAtStep, stepSemitone,
    };
}));
