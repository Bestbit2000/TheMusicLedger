# Scales practice

## 1. Metadata
- **Name:** Scales practice (`.scales-pick-row`, `.scales-pick-mine`, `.scales-staff-heading`, `.scales-memory-toggle`, `.scales-memory`, `.scales-memory-name`, `.scales-memory-detail`, `.scales-memory-progress`, `.scales-staff-card`, `.scales-staff-head`, `.scales-staff-title`, `.scales-staff-sub`, `.scales-staff`, `.scales-staff-row-short`, `.scales-note`, `.scales-note-*`, `.is-now`, `.note-keyboard`, `.scales-pool-count`)
- **Category:** Tool screen
- **Status:** New (ML-9)

## 2. Overview
The Scales tool: pick a scale or arpeggio, see it written on the stave, and play it along to a
repeating metronome that lights the note to play. It's the base for practice sessions of several
scales ("My scales" is what you can play; Previous / Next go through it, Shuffle picks from it).

Top to bottom:
1. **Four setup tiles** (`.flow-tile`, value over label - the Flow editor's tiles), each opening its
   own small picker: key (key note + major / minor, and the minor form), type (scale / arpeggio),
   octaves (1-3, plus the clef) and direction (up / down / up & down).
2. **Previous / Next / Shuffle / My scales** (`.scales-pick-row`, four across - the same row as Warm-ups). The same icon-over-label buttons as the transport row (`.metro-play-grid-btn` grey); My scales opens a pop-up, so it is outlined (`.scales-pick-mine`, like `.btn-cancel`). Previous and Next go through My scales in order (majors round the circle of fifths, sharps then flats, then the minors), wrapping round; from a scale that isn't in My scales, Next starts at the first and Previous at the last. Shuffle picks any other one at random.
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

**Don't** show the metronome's beat dots here: the gold note is the visual (owner's call, ML-9).

## 3. Anatomy
`#scalesView` › `.flow-tile-grid.flow-tile-grid-4` · `.scales-pick-row` · `section.flow-card.scales-staff-card`
(`.scales-staff-head` › `h2.scales-staff-title` + `.scales-staff-sub`; `.scales-staff` › one
`svg.notation` per row) · `.metro-transport-grid` · `.metroBlk-bpm-box`.
Pickers: `.modal` › `.modal-content` with `.flow-picker-tile`s in `.flow-tile-grid`s, the key note in
`.note-keyboard` (7 columns - sharps above, naturals, flats below, the same placement as
`.theory-answers-keyboard`), radio / checkbox pills (`.radio-group`) for major/minor, the minor form
and My scales.

## 4. Tokens used
`--primary-action-strong` (the note to play), `--label-color` (sub line, pool count), `--font-md`,
`--font-sm`, `--font-weight-bold`, `--icon-md`, `--space-*`, `--touch-target` (key-note tiles),
plus the tokens of the components it reuses (flow tiles, buttons, metronome transport, slider).

## 5. Props / API
- Settings live on the device: localStorage `tml.scales` (`keyId`, `form`, `minorForm`, `type`,
  `octaves`, `direction`, `clef`, `npb`, `countIn`, `bpm`, `memory`, `volume`, `pool`).
- Scales come from `TheoryEngine.buildScale` (spelled from the key; melodic minor comes down
  natural) and `writeScale` (which notes still need an accidental against the key signature, lasting
  a bar); My scales from `TheoryEngine.scalePool` (separate sharp and flat limits). See
  `docs/theory-practice.md` ("Scales practice").
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

See [accessibility foundation](../foundations/accessibility.md).
