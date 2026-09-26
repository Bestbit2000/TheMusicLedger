# Warm-ups (ML-294)

The Warm-ups tool: brass warm-up exercises one at a time, with a metronome that lights the note to
play. A building block of practice sessions, alongside Scales (ML-9).

| Piece | What it does |
|---|---|
| [`public/warmups.js`](../public/warmups.js) | The engine, shared by the tool, the admin editor, the server and the tests: checks an exercise (bars add up, pitches in range), turns it into stave rows, the bass-clef transposition, and the playback timeline. |
| [`db/migrations/055_warmups.sql`](../db/migrations/055_warmups.sql) | `warmup_exercises` and the 66 seeded exercises, plus the `warmups` feature. |
| [`server/services/warmups.js`](../server/services/warmups.js) | Reads them (`GET /api/warmups`, switched-on only) and saves them for super admins (`/api/admin/warmups`). Every save goes through the engine's `check`. |
| `app.js` "WARM-UPS" / `admin.js` "Warm-ups" | The tool and the Admin → Warm-ups editor. |
| [`specs/components/warmups.md`](../specs/components/warmups.md) | The design spec. |
| `server/test/warmups.test.js` | Engine tests, including every seeded exercise in both clefs. Back-test case 21. |

## Exercises

- **Written for treble-clef brass**, as brass band parts are: cornet, horn, baritone, euphonium and
  bass all read the same written notes, so one exercise serves them all. Middle range, written F♯3 to C6
  (most sit between C4 and C5).
- **Bass clef** (trombone, euphonium) is the same exercise **down a major 9th**
  (`Warmups.toBassClef`). That's how a treble-clef B♭ part and its bass-clef part relate, so a lip slur
  stays on the same harmonics (written C-G-C-E-G is B♭-F-B♭-D-F in bass clef).
- **Stored** as `notes`: `[{ p: 'G4' | null (rest), d: 'w'|'h'|'q'|'e', dot?: true }]` and
  `beats_per_bar` (2-6). Bars come from the lengths; a note can't run over a bar line; the last bar
  may be short.
- **Six kinds**, in this order: long tones, lip slurs, flexibility, articulation, finger patterns,
  easy melodies. `sort_order` sets the order the tool plays them in (Previous / Next); Shuffle jumps to a random
  one of the chosen kinds.
- **The 66 seeded exercises are original to this app.** They're built from common teaching patterns
  (long tones, harmonic-series slurs, intervals, repeated-note tonguing, five-note scales, short
  tunes) that nobody owns - no copied material. About 19 minutes of playing at their own tempos, so
  about 5 × a 4-5 minute warm-up, and the day's warm-up can vary.

## Editing (Admin → Warm-ups, super admins only)

Tap-to-build: choose a length, an octave, then a key or Rest. Nothing selected adds at the end;
tap a note on the stave (or use ← / →) to select it, and the next key replaces it. Changing the
length with a note selected re-lengthens it. Undo, Delete note. Problems show under the stave and
Save stays off until there are none - the server checks again on save. Switch an exercise off to
hide it from the tool without losing it.

## Playing

`Warmups.timeline`: the metronome clicks every crotchet, or every quaver when the exercise has quavers
or dotted crotchets (`setNotesPerBeat(2)`), and each note lights for its own length (a semibreve for
four clicks). A count-in bar first (optional), then once, twice or looped, at the exercise's own
tempo unless you change it.
