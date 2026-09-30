# Warm-ups (ML-294, ML-361)

The Warm-ups tool: brass warm-up exercises one at a time, with a metronome that lights the note to
play. A building block of practice sessions, alongside Scales (ML-9).

| Piece | What it does |
|---|---|
| [`public/warmups.js`](../public/warmups.js) | The engine, shared by the tool, the admin editor, the server and the tests: checks an exercise (bars add up, pitches in range), turns it into stave rows, the bass-clef transposition, and the playback timeline. |
| [`db/migrations/055_warmups.sql`](../db/migrations/055_warmups.sql) | `warmup_exercises` and the 66 seeded exercises, plus the `warmups` feature. |
| [`db/migrations/078_warmup_slurs.sql`](../db/migrations/078_warmup_slurs.sql) | ML-361: the slurs on the seeded Lip slurs and Flexibility exercises. |
| [`server/services/warmups.js`](../server/services/warmups.js) | Reads them (`GET /api/warmups`, switched-on only) and saves them for super admins (`/api/admin/warmups`). Every save goes through the engine's `check`. |
| `app.js` "WARM-UPS" / `admin.js` "Warm-ups" | The tool and the Admin → Warm-ups editor. |
| [`specs/components/warmups.md`](../specs/components/warmups.md) | The design spec. |
| `server/test/warmups.test.js` | Engine tests, including every seeded exercise in all three clefs. Back-test case 21. |

## Exercises

- **Written for treble-clef brass**, as brass band parts are: cornet, horn, baritone, euphonium and
  bass all read the same written notes, so one exercise serves them all. The editor allows written F♯3
  to C6; the 66 seeded ones use F♯3 to G5 (most sit between C4 and C5).
- **Bass clef** (trombone, euphonium) is the same exercise **down a major 9th**
  (`Warmups.toBassClef`). That's how a treble-clef B♭ part and its bass-clef part relate, so a lip slur
  stays on the same harmonics (written C-G-C-E-G is B♭-F-B♭-D-F in bass clef).
- **Tenor clef** (ML-373: trombone and euphonium up high) reads the same pitches as bass clef, so it takes
  the same 9th down - only the clef it's drawn in differs. The Clef pop-up offers Treble, Bass and Tenor, as
  Scales does; an instrument whose own clef is tenor starts on it.
- **Stored** as `notes`: `[{ p: 'G4' | null (rest), d: 'w'|'h'|'q'|'e', dot?: true, sl?: true }]` and
  `beats_per_bar` (2-6). Bars come from the lengths; a note can't run over a bar line; the last bar
  may be short.
- **Six kinds**, in this order: long tones, lip slurs, flexibility, articulation, finger patterns,
  easy melodies. `sort_order` sets the order the tool plays them in (Previous / Next); Shuffle jumps to a random
  one of the chosen kinds.
- **The 66 seeded exercises are original to this app.** They're built from common teaching patterns
  (long tones, harmonic-series slurs, intervals, repeated-note tonguing, five-note scales, short
  tunes) that nobody owns - no copied material. About 19 minutes of playing at their own tempos, so
  about 5 × a 4-5 minute warm-up, and the day's warm-up can vary.
- **Slurs (ML-361).** `sl: true` slurs a note to the next one; a run of them is one slur. The check
  rejects a slur from a rest, off the end, or into a rest. The stave draws them with standard engraving
  (`Notation.staff` spans): under stem-up notes, over the top as soon as a stem points down; a slur that
  runs past the end of a row carries on to the next (`openEnd` / `openStart`). Migration 078 slurred the
  seeded **Lip slurs and Flexibility** exercises by rule (owner's): each bar's notes, carried on to the
  next bar when that bar is a single held note - but only where the notes were still as seeded. Long
  tones, articulation (the tonguing kind), finger patterns and easy melodies have none; phrasing those
  is for the editor.

## The tool (ML-361: the Scales layout)

- **Warm-ups** (top left) picks the **instrument** and the **topics** (the kinds, as the standard pick list, headed "Topics"); **Clef**
  (top right) is the instrument's own clef (its `theoryClef`) until you choose one - a euphonium can
  read any of them. **Select** (under the stave) opens Choose a warm-up. **Use metronome** switches the
  transport, tempo and volume on or off. It starts **off** (ML-368, to keep the screen simple on
  arrival) and whatever you last chose is remembered on the device (`tml.warmups`). Settings saved
  before ML-368 were switched off once (`metronomeOffOnce`), since the old default had it on.
- **Range locking.** A warm-up whose notes go outside your comfortable range (the Range tool's
  `bottomNote` / `topNote`) is **locked**, and one outside the instrument's own range (`rangeLow` /
  `rangeHigh`) is **beyond** - both checked in the instrument's own clef, where those ranges are written.
  On brass and woodwind the top of that is a 4th above `rangeHigh` once your range is set (the usual top
  is soft, ML-370, docs/range.md), so a warm-up up there is locked until your range reaches it.
  They're left out of Previous / Next / Shuffle (and a practice session's warm-up list), counted in the
  Warm-ups pop-up ("12 warm-ups · 9 locked"), and shown in Choose a warm-up with a lock and why. With no
  range set nothing is locked. The seeded warm-ups (F♯3 to G5) are never beyond a baritone or euphonium;
  a beginner's range of C4 to C5 locks 25 of the 66.

## Editing (Admin → Warm-ups, super admins only)

Tap-to-build: choose a length, an octave, then a key or Rest. Nothing selected adds at the end;
tap a note on the stave (or use ← / →) to select it, and the next key replaces it. Changing the
length with a note selected re-lengthens it. Undo, Delete note, and **Slur to next note** / **Remove slur**
on the selected note (ML-361). Problems show under the stave and
Save stays off until there are none - the server checks again on save. Switch an exercise off to
hide it from the tool without losing it.

## Playing

`Warmups.timeline`: the metronome clicks every crotchet, or every quaver when the exercise has quavers
or dotted crotchets (`setNotesPerBeat(2)`), and each note lights for its own length (a semibreve for
four clicks). A count-in bar first (optional), then once, twice or looped, at the exercise's own
tempo unless you change it.
