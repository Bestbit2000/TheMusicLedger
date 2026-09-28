# Range: your playing range and the Range tool (ML-322, ML-305)

Stretch your playing range a note at a time. Everything is behind the feature **`range_trainer`**
(migration `065`, off by default - switch it on per environment in Admin → Features). Read this
before changing a rule. Owner decisions: 2026-09-28 (this release's chat).

## Your range (ML-322)

- **What it is:** the notes **you** can play comfortably **now**, per instrument - not what the
  instrument can do. Stored as written pitch in `account_instruments.bottom_note` / `top_note`
  (`'Bb3'`, `'G5'`; NULL = not set).
- **Where it's set:** My account → Your instruments → an instrument's ⋮ → **Your range…**, or the Range
  tool's **Set / Change your range**. Both open the range picker (`#rangePickerModal`):
  - **Tap the stave** near a note: it picks the natural note on that line or space.
  - **− / +** then move a semitone, spelled the usual way (C♯, E♭, F♯, A♭, B♭ - never A♯3 as a bottom note).
  - **Measure it with the tuner:** play slowly down to your lowest comfortable note and up to your
    highest. Each note held steady for **1 second** counts; the lowest and highest go into the picker
    (still to save). Notes outside the instrument's limit are ignored.
- **The instrument's typical range** (`instruments.range_low` / `range_high`, written, generous - brass
  pedal notes included) is only the **outer limit**: the picker and the Range tool never go past it. It's
  never a player's starting point. Instruments where holding a note doesn't apply (keyboards, harp,
  percussion) have none, and Range isn't offered for them. Review the list on **Admin → Usage →
  Instruments** ("Typical ranges").
- **Written vs sounding:** `instruments.written_to_concert` is the transposition in semitones
  (concert = written + n) for the clef the app reads the instrument in (`theory_clef`: brass band
  treble where there is one - a treble-clef euphonium is −14). The tuner hears concert pitch;
  `PlayRange.heardWritten` turns it into the written note.
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
| Screens | RANGE section of `public/app.js`; `#rangeView`, `#rangePickerModal` in `index.html` |
| Server | `server/services/range.js`, `/api/range*` in `server/routes/api.js` (re-scores each go with the same engine) |
| Tables | `db/migrations/065_range.sql` |
| Design | `specs/components/range.md`, Admin → Design → Range |
| Tests | `server/test/range.test.js`; back-test case "Range" in the registry |
