# Range: your playing range and the Range tool (ML-322, ML-305)

Stretch your playing range a note at a time. Everything is behind the feature **`range_trainer`**
(migration `065`, off by default - switch it on per environment in Admin → Features). Read this
before changing a rule. Owner decisions: 2026-09-28 (this release's chat).

## Your range (ML-322)

- **What it is:** the notes **you** can play comfortably **now**, per instrument - not what the
  instrument can do. Stored as written pitch in `account_instruments.bottom_note` / `top_note`
  (`'Bb3'`, `'G5'`; NULL = not set).
- **Where it's set:** My instruments (☰ menu, ML-382) → an instrument's ⋮ → **My range…**, or the Range
  tool's **Set / Change your range**. Both open the range picker (`#rangePickerModal`):
  - **Tap the stave** near a note: it picks the natural note on that line or space.
  - **− / +** then move a semitone, spelled the usual way (C♯, E♭, F♯, A♭, B♭ - never A♯3 as a bottom note).
  - **Measure it with the tuner:** play slowly down to your lowest comfortable note and up to your
    highest. Each note held steady for **1 second** counts; the lowest and highest go into the picker
    (still to save). Notes outside the instrument's limit are ignored.
- **The instrument's typical range** (`instruments.range_low` / `range_high`, written, generous) is only the
  **outer limit**: the picker and the Range tool never go past it. It's never a player's starting point.
- **3 and 4 valves (ML-602, owner 24 Oct 2026).** A 3-valve brass instrument can't play the five written notes
  between its pedal notes and its low register (C♯3 to F3 in treble), and a range is one unbroken run, so
  **every 3-valve instrument's range stops at written F♯3** and leaves the pedal notes out (cornets, flugel,
  trumpets, tenor horn, and the 3-valve baritone, euphonium and basses). The euphonium, baritone horn and E♭ and
  B♭ basses each come as a **3-valve and a 4-valve version** ("B♭ Euphonium (4 valves)"); a 4-valve
  (compensating) one keeps its pedal notes. Migration 153; the catalogue file
  `band_instruments_master_catalog.json` is not kept in step - the `instruments` table is the list now.
  Players kept the row they had (euphonium and basses: 4 valves; baritone: 3 valves) and their own range.
  The scale lists still find these by name (`scaleGrades.js`), which ML-609 moves to keys.
- **The usual top is soft on brass and woodwind (ML-370).** `range_high` there is the *usual* top: an
  experienced player goes higher (altissimo on woodwind), so the outer limit is **a 4th (5 semitones)
  above it** - `PlayRange.outerLimit(low, high, family)` gives `{ low, high, usualHigh }`, and the server
  (`server/services/range.js`), the picker, the Range tool, Scales and Warm-ups all use it. The bottom
  stays a hard limit, and other families keep `range_high` as it is. A scale or warm-up above the usual
  top is **locked** until your range reaches it, not beyond the instrument - but only once your range is
  set (with no range, where everything the instrument plays counts as in your list, the usual top is
  still the limit). See your range draws it as one bar (`specs/components/range-bar.md`). Instruments where holding a note doesn't apply (keyboards, harp,
  percussion) have none, and Range isn't offered for them. Review the list on **Admin → Usage →
  Instruments** ("Typical ranges").
- **Written vs sounding:** `instruments.written_to_concert` is the transposition in semitones
  (concert = written + n) for the clef the app reads the instrument in (`theory_clef`: brass band
  treble where there is one - a treble-clef euphonium is −14). The tuner hears concert pitch;
  `PlayRange.heardWritten` turns it into the written note.
- **The clef you read (ML-528).** Some brass is read two ways: a euphonium, baritone, tenor or valve
  trombone, E♭ or B♭ tuba is a transposing treble-clef part in a brass band and a bass-clef part at concert
  pitch in a wind band (a tenor trombone also in tenor clef). `instruments.other_clefs` lists those other
  clefs with their own transposition (`[{"clef":"bass","writtenToConcert":0}]`), and each player chooses
  the one they read **once, on the account** - My instruments → an instrument's ⋮ → **My clef…**
  (`account_instruments.clef`, NULL = the instrument's own; `PUT /api/account/instruments/:id/clef`). It
  used to be chosen in each tool on each device.
  - **Nothing stored moves.** `range_low` / `range_high`, `bottom_note` / `top_note`, `range_note_levels`
    and `range_goes` stay written in the instrument's **own** clef. The server moves every written note
    into the player's clef on the way out and back on the way in
    (`server/services/instrumentClef.js`: `clefView` gives the clef, its transposition and the `shift` in
    semitones; `toMine` / `toOwn`). Written C4 on a treble-clef euphonium is B♭2 for a bass-clef reader:
    shift −14. A moved note is spelled the usual way a range is.
  - **So the app needs no clef logic of its own.** `GET /api/account/instruments` and `GET /api/range` hand
    each instrument back as the player reads it: `theoryClef` (`clef` in the range answer),
    `writtenToConcert`, the instrument's range and the player's, all in that clef; `ownClef` and
    `clefChoices` say what the instrument's own is and what can be chosen. Scales, Warm-ups, Theory, the
    range picker and the Range tool start from it. The Clef button in Scales and Warm-ups still changes
    the clef **for that visit** - it is no longer kept on the device.
  - A new place that sends or stores a written note for an instrument goes through `clefView` the same
    way. Tests: `server/test/instrumentClef.test.js`.
- **Changing the catalogue:** edit `written_to_concert_semitones` / `written_range` in
  `band_instruments_master_catalog.json`, then write a new migration with
  `node scripts/generate-instrument-ranges-migration.mjs band_instruments_master_catalog.json` (it
  prints the UPDATEs) - never hand-edit 065.

## The Range tool (ML-305)

Home screen, Learn group. Options: instrument (if you have more than one with a range), **Top notes /
Bottom notes**, speed **50 / 60 / 72 bpm** (per device, `tml.range`).

- **One go:** the metronome clicks; you play the major scale an octave up to your top note (or down to
  your bottom note), then hold **the note a semitone beyond it** (the gold note) as long as you can.
  - With the microphone, the tuner counts the beats: the hold starts once the note has been heard for
    150 ms, survives gaps of up to 250 ms, and ends 400 ms after it stops. Any pitch that rounds to
    the note counts - it doesn't have to be in tune. Capped at 16 beats; nothing heard = nothing saved.
  - Without it: **Held it** (= 8 beats) or **Not yet** (= 0).
- **A Level for each note beyond your range** (`range_note_levels`):

  | Level | Held |
  |---|---|
  | 1 | Sounded |
  | 2 | 2 beats |
  | 3 | 4 beats |
  | 4 | 6 beats |
  | 5 | 8 beats, **three goes in a row** |

  Levels never go down; a go under 8 beats starts the run of three again.
- **Level 5:** it **asks** "Move your range?" - **Move it** makes that note your new top (or bottom)
  note and the next note out becomes the one to work on. **Not yet** leaves it; it asks again after
  your next go on that note. The server only moves a note that really is at Level 5.
- **Every go** is logged in `range_goes` (note, beats, bpm, mic or self, Level after).

## Skills (ML-321)

"Range - top notes" and "Range - bottom notes" (`range:up` / `range:down`) are Skills entries on your
**main** instrument. Their step isn't a fixed ladder: it's always the note just beyond your range
(`rolling` in `SKILLS`), shown as "Now: Hold A♭5". Every go counts as practising it; moving your range
passes the step. At the instrument's limit it's "All done".

## Where it lives

| What | Where |
|---|---|
| Rules (pure, shared with the server) | `public/range.js` (`window.PlayRange` - not `Range`, that's the browser's DOM Range) |
| Screens | RANGE section of `public/app.js`; `#rangeView`, `#rangePickerModal` in `app.html` |
| Server | `server/services/range.js`, `/api/range*` in `server/routes/api.js` (re-scores each go with the same engine) |
| Tables | `db/migrations/065_range.sql` |
| Design | `specs/components/range.md`, Admin → Design → Range |
| Tests | `server/test/range.test.js`; back-test case "Range" in the registry |
