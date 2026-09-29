# Scales practice

## 1. Metadata
- **Name:** Scales practice (`.scales-setting-row`, `.scales-setting-btn`, `.scales-dir-flip`, `.scales-choice-grid`, `.scales-pick-row`, `.scales-pick-mine`, `.scales-staff-heading`, `.scales-memory`, `.scales-memory-name`, `.scales-memory-detail`, `.scales-memory-progress`, `.scales-staff-card`, `.scales-staff-head`, `.scales-staff-title`, `.scales-staff-sub`, `.scales-staff`, `.scales-staff-row-short`, `.scales-note`, `.scales-note-*`, `.is-now`, `.scales-metronome-card`, `.scales-choose-group`, `.scales-choose-label`, `.scales-choose-keys`, `.scales-pool-line`, `.scales-pool-count`, `.scales-range-link`, `.scale-grid`, `.scale-grid-head`, `.scale-grid-acc`, `.scale-grid-row`, `.scale-grid-label`, `.scale-grid-sub`, `.scale-grid-cell`, `.is-ready`, `.is-other`, `.is-locked`, `.is-beyond`, `.is-no`, `.scale-grid-legend`, `.scales-range-staff`, `.scales-grade-options`)
- **Category:** Tool screen
- **Status:** New (ML-9); grade lists, the grade grid and this layout ML-357

## 2. Overview
The Scales tool: work through a list of scales and arpeggios, see each written on the stave, and play
it along to a repeating metronome that lights the note to play. The list is the ABRSM grade lists for
your instrument, and Everything else (ML-357, see `docs/scales-grades.md`).

Top to bottom (owner's layout, ML-357):
1. **The setting row** (`.metro-transport-grid.scales-setting-row`, four across): the transport's value
   boxes (`.metroBlk-ctrl-value-btn.scales-setting-btn` - a one-line value, so "Treble" fits a quarter of a
   phone), each opening its own pop-up:
   - **Scales** (icon + "scales", `#scalesPoolBtn`) - the instrument and grades, below;
   - **Clef** ("Treble / clef") - Treble, Bass, Tenor: the stave's clef, and it picks the ABRSM list for
     instruments read in more than one (trombone, baritone, euphonium, tuba);
   - **Direction** (its arrow icon over "up & down") - Up, Down, Up & down, Down & up: how every scale in
     the list is played (the arrows read in the order you play: "down & up" is the up & down icon flipped,
     `.scales-dir-flip`) (a dominant 7th, a scale in thirds and the ABRSM patterns keep their own shape);
   - **Detail** ("Notes / detail") - how much of the scale to show: **Notes** (the name, key and notes),
     **Key** (the name and a blank stave with the clef and key signature - you find the notes), **Name** (no
     stave: the name and what to play, `.scales-memory` - it was the "From memory" switch). 
   Clef, direction and detail are pick-one pop-ups (`.flow-tile-grid.scales-choice-grid` of
   `.flow-picker-tile`s) that close when you choose; each value sits at the top of its tile, so they line up
   even when a caption wraps on a phone.
2. **The scale's box** (`.flow-card.scales-staff-card`): the scale's name (`h2.scales-staff-title`) with
   "2 octaves · treble" under it (or "Get ready… 3" during the count-in) and the metronome's volume button
   (`.metroBlk-row-volume-btn`) at the right of that line - hidden while the metronome is off. Then the
   scale as Detail says: in rows of 8 notes (6 at 3 a beat, so a bar splits evenly), with the key signature
   on every row, 4/4 on the first when it's one note a beat, bar lines every 4 beats and a final bar line.
   Rows are all the same height and spread to one width (`Notation.staff` `justify`) so the notes line up
   down the card; the short last row keeps that spacing at its own share of the width
   (`.scales-staff-row-short`, `--row-frac`). Under it, **Previous / Next / Shuffle / Select**
   (`.scales-pick-row`, grey `.metro-play-grid-btn`s - the same row as Warm-ups'): Previous and Next go
   through your list in grid order (the major-key rows, then the minor-key rows, each row's keys in
   chromatic order), wrapping round; from a scale that isn't in the list (a Skills step, or the list
   changed), Next starts at the first and Previous at the last. Shuffle picks any other one at random.
   Select opens Choose a scale.
3. **Use metronome** (`.flow-card.scales-staff-card.scales-metronome-card`): the title and an on/off switch
   (`.toggle-switch`, the one in Settings) on one line; on, the Metronome tool's transport under it
   (`.metro-transport-grid`: Play - hold to go back to the start -, Reset, notes / beat, count-in) and its
   tempo box (`.metroBlk-bpm-box`: −/+, slider, tap the number to type). Off hides them and the volume, and
   stops it. Remembered.

**Name** (`.scales-memory`): "B♭ minor" with "harmonic · scale · 2 octaves · up & down" under it. While
it plays, "Note 5 of 29" keeps your place.

**Scales** (`#scalesPoolModal`, a sticky-footer pop-up), top to bottom: the **instrument** (a dropdown of
your instruments from My instruments); the **grades** - "Grades · 1-3 & 5" (the ticked ones in a few words:
"1-7", "1, 3, 5 & 7", "... & everything else") over 1-8 and Everything else (`.radio-group.compact.scales-grade-options`
checkboxes, four to a row, Everything else a row of its own); the name of the ABRSM list; the count and
**See your range** on one line (`.scales-pool-line`: "40 scales in your list (of 50 needed)" and a text-link
button, `.scales-range-link`); then the **grade grid** (`.scale-grid`), live as you tick: a "Major keys"
section and a "Minor keys" section, each a heading row of 15 keys in chromatic order (`.scale-grid-head`; a
key's sharp or flat sits under its letter, `.scale-grid-acc`, as 15 columns are too narrow for "C♯ D♭" side
by side) and one row per kind and length the grades need (`.scale-grid-row`: "Harmonic minor / a 12th" -
`.scale-grid-label` with the length in `.scale-grid-sub`). Each cell (`.scale-grid-cell`) is one of:
- `.is-ready` solid green - in your list, where it's usually written;
- `.is-other` pale green with "8" - in your list, an octave up or down (where your range is);
- `.is-locked` amber with a lock - the grade needs it, but it's outside your range for now;
- `.is-beyond` grey with a cross - the grade needs it, but the instrument can't play it;
- dashed, no fill (`.is-no` in the legend) - not needed at these grades. This wins over everything.
A key (`.scale-grid-legend`) sits under the grid. The grid isn't tappable: it shows what the list is.
Rows only appear where the ticked grades need one; natural minor rows only for Grades 1-2. No pop-up
opens over another (owner's call): clef, direction and detail are on the main screen for that reason.

**Choose a scale** (`#scalesChooseModal`, from Select): the list, row by row as in the grid
("Major · Scales / 1 octave", `.scales-choose-group` › `h3.scales-choose-label` + `.scales-choose-keys`), each key
in it a button (`.flow-picker-tile`, five across) - the one playing selected, "8" under a key that's played in
another octave. Tap one to play it (and close). The grid's own boxes are too small to be buttons (44px
targets), which is why the list is drawn again here. **Change your scales** at the bottom opens Scales.

**See your range** (`#scalesMyRangeModal`): your lowest and highest comfortable notes as two whole
notes on a stave in the clef the scales are in (`.scales-range-staff`, centred), named under it
("Lowest B♭3, highest F5. The instrument goes from F♯2 to E6."). For brass read in treble but
playing from a bass- or tenor-clef list, that's at concert pitch, and it says so. With no range set it
says so and offers **Set your range** (the Range tool's picker, over Scales) or My instruments.

**Don't** show the metronome's beat dots here: the gold note is the visual (owner's call, ML-9).

## 3. Anatomy
`#scalesView` › `.scales-setting-row` · `section.flow-card.scales-staff-card` (`.scales-staff-head` ›
`.scales-staff-heading` › `h2.scales-staff-title` + `.scales-staff-sub`, then the volume button;
`.scales-staff` › one `svg.notation` per row, or `.scales-memory`; `.scales-pick-row`) ·
`section.scales-metronome-card` (`.scales-staff-head` › title + `.toggle-switch`; `#scalesMetronomeControls`
› `.metro-transport-grid` · `.metroBlk-bpm-box`).
Pickers (clef, direction, detail, notes / beat, count-in): `.modal` › `.modal-content` with
`.flow-picker-tile`s in `.flow-tile-grid`s; Scales and Choose a scale as above.

## 4. Tokens used
`--primary-action-strong` (the note to play), `--label-color` (sub line, pool count, grid headings and lengths), `--link-color` (See your range), `--success-text` / `--status-green-*` / `--status-amber-*` / `--control-off-bg` / `--control-border` (grid cells), `--scale-grid-label-width` (the grid's label column), `--radius-xs`, `--font-2xs`, `--font-xs`, `--font-base` (the setting row's values), `--line-height-snug`, `--font-md`,
`--font-sm`, `--font-weight-bold`, `--icon-md`, `--space-*`, `--touch-target` (key tiles, See your range),
plus the tokens of the components it reuses (flow tiles, buttons, metronome transport, slider, toggle switch).

## 5. Props / API
- Settings live on the device: localStorage `tml.scales` (`keyId`, `form`, `minorForm`, `type`,
  `octaves`, `direction`, `clef`, `npb`, `countIn`, `bpm`, `detail` (`notes` | `key` | `name` - a saved
  `memory: true` from before becomes `name`), `metronome` (on / off), `volume`, `pattern`, `extended`,
  `tonicOctave`, `grades`, `gradeInstrumentId`; `pool` is the old My scales, no longer shown).
- Scales come from `TheoryEngine.buildScale` (spelled from the key; melodic minor comes down
  natural) and `writeScale` (which notes still need an accidental against the key signature, lasting
  a bar); the list from `ScaleGrades.grid(listId, grades, ctx)` (`public/scaleGrades.js`: the ABRSM
  lists and the placement rules - `docs/scales-grades.md`). See `docs/theory-practice.md` ("Scales practice").
- The note to play: each note's glyphs carry `scales-note scales-note-<i>` (Notation `note.cls`);
  `scalesLight(i)` adds `.is-now`.
- Playing: its own metronome player, one click per note (`setNotesPerBeat(npb)`), a count-in bar at
  the start only; the last note holds to the end of its bar, then it goes round again.
- Changing anything about the scale starts it again from the top. Leaving the screen pauses it.
- Top-bar tuner toggle, like the other metronome tools (`MINI_TUNER_VIEWS`).
- Behind the `scales_practice` feature (Admin → Features); the home tile and the ☰ menu's tools
  row show it only when it's on.

## 6. States
Stopped · Count-in ("Get ready… 3") · Playing (one note gold) · Paused (the gold note stays) ·
Metronome off (no transport, tempo or volume). Detail: Notes · Key · Name.

## 7. Code example
```js
const scale = TheoryEngine.buildScale({ keyId: 'D major', type: 'scale', octaves: 2, direction: 'both', clef: 'treble' });
const notes = TheoryEngine.writeScale(scale, 4); // [{ pitch, accidental }]
// Detail Key: the stave with the key signature only
Notation.staff({ clef: 'treble', keySignature: scale.keySignature, items: [], minWidth: 48, label: 'D major scale: the key signature only' });
// ML-357: the grade grid for a baritone read in treble, Grades 1-2, a range of B♭3 to F5 (MIDI, written pitch)
const list = ScaleGrades.groupFor('B♭ Baritone Horn', 'treble'); // { id: 'baritone-euphonium-treble', ... }
const { sections, pool } = ScaleGrades.grid(list.id, [1, 2], { clef: 'treble', low: 42, high: 88, bottom: 58, top: 77 });
```

## 8. Cross-references
[notation](notation.md) · [metronome](metronome.md) · [selectable-tile](selectable-tile.md) · [theory-quiz](theory-quiz.md) · [modal](modal.md) · [warmups](warmups.md)

## 9. Accessibility
- Each stave row is an image named for its notes ("D major scale, notes 1 to 8"); the Key stave is named
  "D major scale: the key signature only". The gold note is never the only information - the title says
  the scale and Play/Pause says the state.
- The setting row's boxes, Select and the value boxes are buttons with `aria-haspopup="dialog"` and a name
  that says what they change ("Clef - tap to change"); Play has `aria-pressed`. Use metronome is a real
  checkbox named by its title.
- Pickers are the app's dialogs (focus in, Escape closes, focus back). Key tiles are 44px high.
- The count-in is in the sub line text, not only sound.
- The grade grid is read row by row: each row is a `role="img"` named for what's in it ("Harmonic
  minor, a 12th. in your list: G; in your list, another octave: A"), and the cells and headings are
  `aria-hidden`. The cell states differ by symbol (8, lock, cross, dashed) as well as colour; the legend
  says what each means. The count is `aria-live`.
- Choose a scale: each key is a real button named in full ("D major, scales, 1 octave", "..., another octave"),
  at least 44px high; the one playing has `aria-pressed="true"`.
- See your range is a button (underlined, link colour, 44px high). The range stave is an image named
  "Your range: B♭3 to F5", and the same notes are in the text under it.

See [accessibility foundation](../foundations/accessibility.md).
