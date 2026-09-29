# Scales practice

## 1. Metadata
- **Name:** Scales practice (`.scales-pick-row`, `.scales-pick-mine`, `.scales-staff-heading`, `.scales-memory-toggle`, `.scales-memory`, `.scales-memory-name`, `.scales-memory-detail`, `.scales-memory-progress`, `.scales-staff-card`, `.scales-staff-head`, `.scales-staff-title`, `.scales-staff-sub`, `.scales-staff`, `.scales-staff-row-short`, `.scales-note`, `.scales-note-*`, `.is-now`, `.note-keyboard`, `.scales-pool-count`, `.scale-grid`, `.scale-grid-head`, `.scale-grid-acc`, `.scale-grid-row`, `.scale-grid-label`, `.scale-grid-sub`, `.scale-grid-cell`, `.is-ready`, `.is-other`, `.is-locked`, `.is-beyond`, `.is-no`, `.scale-grid-legend`, `.scales-range-staff`, `.scales-grade-options`)
- **Category:** Tool screen
- **Status:** New (ML-9); grade lists and the grade grid ML-357

## 2. Overview
The Scales tool: pick a scale or arpeggio, see it written on the stave, and play it along to a
repeating metronome that lights the note to play. It's the base for practice sessions of several
scales ("My scales" is the ABRSM grade list for your instrument; Previous / Next go through it, Shuffle
picks from it - ML-357, see `docs/scales-grades.md`).

Top to bottom:
1. **Four setup tiles** (`.flow-tile`, value over label - the Flow editor's tiles), each opening its
   own small picker: key (key note + major / minor, and the minor form), type (scale / arpeggio /
   chromatic / dominant 7th), length (1 octave, a 12th, 2, 3, or "1+" - one octave, then down to the
   dominant - plus the clef: treble, bass, tenor) and direction (up / down / up & down / down & up).
   The clef also picks the ABRSM list for instruments read in more than one (trombone, baritone,
   euphonium, tuba).
2. **Previous / Next / Shuffle / My scales** (`.scales-pick-row`, four across - the same row as Warm-ups). The same icon-over-label buttons as the transport row (`.metro-play-grid-btn` grey); My scales opens a pop-up, so it is outlined (`.scales-pick-mine`, like `.btn-cancel`). Previous and Next go through your grade list in grid order (the major-key rows, then the minor-key rows, each row's keys in chromatic order), wrapping round; from a scale that isn't in the list, Next starts at the first and Previous at the last. Shuffle picks any other one at random.
3. **The stave** (`.flow-card.scales-staff-card`): the scale's title and "2 octaves · treble" (or
   "Get ready… 3" during the count-in), the metronome's volume button (`.metroBlk-row-volume-btn`, the Metronome tool's volume pop-up) and the **From memory** switch, then the scale in rows of 8 notes (6 at 3 a beat, so a bar
   splits evenly), with the key signature on every row, 4/4 on the first when it's one note a beat,
   bar lines every 4 beats and a final bar line. Rows are all the same height and spread to one width
   (`Notation.staff` `justify`) so the notes line up down the card; the short last row keeps that
   spacing at its own share of the width (`.scales-staff-row-short`, `--row-frac`).
4. **The Metronome tool's transport** (`.metro-transport-grid`): Play (hold to go back to the
   start), Reset, notes / beat, count-in - then its tempo box (`.metroBlk-bpm-box`: −/+, slider, tap
   the number to type).

**From memory** (`.scales-memory`): the scale's name in place of the notes - "B♭ minor" with "harmonic · scale · 2 octaves · up & down" under it - so it's played from memory (harder). While it plays, "Note 5 of 29" keeps your place.

**My scales** (ML-357, `#scalesPoolModal`, a sticky-footer pop-up): Grades 1-4 (`.radio-group.compact.scales-grade-options`
checkboxes, one row of four, more than one allowed), the instrument (your instruments from My instruments), the name of
the ABRSM list it uses, **See your range**, the count ("23 scales in your list (of 30 needed)"), then the
**grade grid** (`.scale-grid`): a "Major keys" section and a "Minor keys" section, each a heading row of
15 keys in chromatic order (`.scale-grid-head`; a key's sharp or flat sits under its letter,
`.scale-grid-acc`, as 15 columns are too narrow for "C♯ D♭" side by side) and one row per kind and
length the grades need (`.scale-grid-row`: "Harmonic minor / a 12th" - `.scale-grid-label` with the
length in `.scale-grid-sub`). Each cell (`.scale-grid-cell`) is one of:
- `.is-ready` solid green - in your list, where it's usually written;
- `.is-other` pale green with "8" - in your list, an octave up or down (where your range is);
- `.is-locked` amber with a lock - the grade needs it, but it's outside your range for now;
- `.is-beyond` grey with a cross - the grade needs it, but the instrument can't play it;
- dashed, no fill (`.is-no` in the legend) - not needed at these grades. This wins over everything.
A key (`.scale-grid-legend`) sits under the grid. The grid isn't tappable: it shows what the list is.
Rows only appear where the ticked grades need one; natural minor rows only for Grades 1-2.

**See your range** (`#scalesMyRangeModal`): your lowest and highest comfortable notes as two whole
notes on a stave in the clef the scales are in (`.scales-range-staff`, centred), named under it
("Lowest B♭3, highest F5. The instrument goes from F♯2 to E6."). For brass read in treble but
playing from a bass- or tenor-clef list, that's at concert pitch, and it says so. With no range set it
says so and offers **Set your range** (the Range tool's picker, over My scales) or My instruments.

**Don't** show the metronome's beat dots here: the gold note is the visual (owner's call, ML-9).

## 3. Anatomy
`#scalesView` › `.flow-tile-grid.flow-tile-grid-4` · `.scales-pick-row` · `section.flow-card.scales-staff-card`
(`.scales-staff-head` › `h2.scales-staff-title` + `.scales-staff-sub`; `.scales-staff` › one
`svg.notation` per row) · `.metro-transport-grid` · `.metroBlk-bpm-box`.
Pickers: `.modal` › `.modal-content` with `.flow-picker-tile`s in `.flow-tile-grid`s, the key note in
`.note-keyboard` (7 columns - sharps above, naturals, flats below, the same placement as
`.theory-answers-keyboard`), radio / checkbox pills (`.radio-group`) for major/minor, the minor form
and the grades.

## 4. Tokens used
`--primary-action-strong` (the note to play), `--label-color` (sub line, pool count, grid headings and lengths), `--success-text` / `--status-green-*` / `--status-amber-*` / `--control-off-bg` / `--control-border` (grid cells), `--scale-grid-label-width` (the grid's label column), `--radius-xs`, `--font-2xs`, `--font-xs`, `--font-md`,
`--font-sm`, `--font-weight-bold`, `--icon-md`, `--space-*`, `--touch-target` (key-note tiles),
plus the tokens of the components it reuses (flow tiles, buttons, metronome transport, slider).

## 5. Props / API
- Settings live on the device: localStorage `tml.scales` (`keyId`, `form`, `minorForm`, `type`,
  `octaves`, `direction`, `clef`, `npb`, `countIn`, `bpm`, `memory`, `volume`, `pattern`,
  `tonicOctave`, `grades`, `gradeInstrumentId`; `pool` is the old My scales, no longer shown).
- Scales come from `TheoryEngine.buildScale` (spelled from the key; melodic minor comes down
  natural) and `writeScale` (which notes still need an accidental against the key signature, lasting
  a bar); My scales from `ScaleGrades.grid(listId, grades, ctx)` (`public/scaleGrades.js`: the ABRSM
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
Stopped · Count-in ("Get ready… 3") · Playing (one note gold) · Paused (the gold note stays).

## 7. Code example
```js
const scale = TheoryEngine.buildScale({ keyId: 'D major', type: 'scale', octaves: 2, direction: 'both', clef: 'treble' });
const notes = TheoryEngine.writeScale(scale, 4); // [{ pitch, accidental }]
// ML-357: the grade grid for a baritone read in treble, Grades 1-2, a range of B♭3 to F5 (MIDI, written pitch)
const list = ScaleGrades.groupFor('B♭ Baritone Horn', 'treble'); // { id: 'baritone-euphonium-treble', ... }
const { sections, pool } = ScaleGrades.grid(list.id, [1, 2], { clef: 'treble', low: 42, high: 88, bottom: 58, top: 77 });
```

## 8. Cross-references
[notation](notation.md) · [metronome](metronome.md) · [selectable-tile](selectable-tile.md) · [theory-quiz](theory-quiz.md) · [modal](modal.md)

## 9. Accessibility
- Each stave row is an image named for its notes ("D major scale, notes 1 to 8"); the gold note is
  never the only information - the title says the scale and Play/Pause says the state.
- Setup tiles and value boxes are buttons with `aria-haspopup="dialog"` and a name that says what
  they change; Play has `aria-pressed`.
- Pickers are the app's dialogs (focus in, Escape closes, focus back). Key-note tiles are 44px high.
- The count-in is in the sub line text, not only sound.
- The grade grid is read row by row: each row is a `role="img"` named for what's in it ("Harmonic
  minor, a 12th. in your list: G; in your list, another octave: A"), and the cells and headings are
  `aria-hidden`. The cell states differ by symbol (8, lock, cross, dashed) as well as colour; the legend
  says what each means. The count is `aria-live`.
- The range stave is an image named "Your range: B♭3 to F5", and the same notes are in the text under it.

See [accessibility foundation](../foundations/accessibility.md).
