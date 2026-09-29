# Warm-ups

## 1. Metadata
- **Name:** Warm-ups (`.warmups-tip`, `.warmup-note`, `.warmup-note-*`, `.warmups-choose-row` (+ `.is-locked`); the Admin → Warm-ups editor: `.admin-warmup-kind`, `.admin-warmup-row-preview`, `.admin-warmup-off`, `.admin-modal-wide`, `.admin-warmup-fields`, `.admin-warmup-preview-head`, `.admin-warmup-preview`, `.admin-warmup-status`, `.admin-warmup-inline`, `.admin-warmup-tools`, `.is-selected`, `.note-keyboard` - the note picker: sharps above, naturals, flats below, the same placement as `.theory-answers-keyboard`; the Scales key picker used it until ML-357)
- **Category:** Tool screen · admin editor
- **Status:** New (ML-294); the Scales layout, range locking and slurs ML-361

## 2. Overview
Brass warm-up exercises, one at a time, with a metronome that lights the note to play. A building
block of practice sessions (like Scales). The layout **is Scales'** (ML-361) - it shares its classes
(`.scales-setting-row`, `.scales-setting-btn`, `.scales-pick-row`, `.scales-staff-card` and its head,
`.scales-staff`, `.scales-staff-row-short`, `.is-now`, `.scales-metronome-card`, `.scales-choose-*`,
`.scales-pool-line`, `.scales-range-link`; see [scales](scales.md)):

1. **The setting row** (`.scales-setting-row.is-centred`: two value boxes, each a quarter wide, centred):
   - **Warm-ups** - a pop-up with the **instrument** (whose range and clef count; your main one to start
     with), the **kinds** as the standard [pick list](pick-list.md) (tick boxes, Select all / Unselect all;
     each "Lip slurs / 12 warm-ups · 9 locked"; "Kinds · long tones & lip slurs" over them), then "10
     warm-ups in your list (of 22), about 5 minutes" with **See your range** (the Scales pop-up), and a
     line on how many are locked - outside your range for now - or beyond the instrument.
   - **Clef** - Treble / Bass, a pick-one pop-up (`.scales-choice-grid`). It's the instrument's own clef
     until one is chosen here (a euphonium can read either); changing the instrument goes back to it.
   No Detail: Warm-ups always shows the notes (owner's call).
2. **The exercise card**: title with the volume button on its line (hidden while the metronome is off),
   "Lip slurs · 3 of 12" (of the ones you can play), the tip, then the stave - rows of whole bars (up to 8
   notes / 4 bars a row), justified to one width, a whole-bar rest centred in its bar, **slurs** drawn
   (standard engraving - see [notation](notation.md)). The note to play lights gold, following each
   note's length. Under it **Previous / Next / Shuffle / Select** (`.scales-pick-row`): Previous and Next
   go through the chosen kinds in order (the admin order), wrapping round, skipping locked ones; Shuffle
   jumps to any other; Select opens **Choose a warm-up** - the chosen kinds, each warm-up a row
   (`.flow-choice-option.level-answer.warmups-choose-row`, the title in the body weight, the one playing
   selected), a locked one in place and not playable (`.is-locked`: muted, a lock, "goes down to B3 - outside
   your range"), and **Change your warm-ups** at the bottom.
3. **Use metronome** (`.scales-metronome-card`, on / off, remembered): Play (hold to go back to the start),
   Reset, Repeat (1×, 2×, loop) and Count-in, then the tempo box, which starts at each exercise's own
   tempo. Off hides them and the volume, and stops it.

**Range locking (ML-361):** each warm-up's lowest and highest note (`Warmups.span`), in the instrument's own
clef, against the instrument's range (`rangeLow`-`rangeHigh`: beyond) and your comfortable range from the
Range tool (`bottomNote`-`topNote`: locked). Locked and beyond ones are left out of Previous / Next /
Shuffle (and a session's warm-up list) until your range grows. No range set: nothing is locked.

**Treble and bass clef:** exercises are written for treble-clef brass (brass band parts - cornet,
horn, baritone, euphonium and bass read the same written notes). Bass clef (trombone, euphonium) is
the same exercise down a major 9th - how a treble-clef B♭ part and its bass-clef part relate - so a
lip slur stays on the same harmonics.

**Admin → Warm-ups** (super admins): the list in play order, grouped by kind, each with its first
row drawn; move up/down, Edit, Switch off/on, Delete. The editor builds notes by tapping: choose a
length (semibreve / minim / crotchet / quaver, dotted), an octave, then a key on the keyboard grid
(`.note-keyboard`) or Rest. Nothing selected adds at the end; tap a note on the stave to select it
(gold, `.is-selected`) and the next tap replaces it; ← → move the selection, Delete note, Add at end,
Undo, and **Slur to next note** / **Remove slur** on the selected note (ML-361 - off for a rest or the last
note). Problems (a note over a bar line, out of range, a slur that doesn't lead to a note) show under the stave and Save is off until
there are none. The stave can be previewed in bass clef.

## 3. Anatomy
Tool: `#warmupsView` › `.scales-setting-row.is-centred` · `section.flow-card.scales-staff-card` (`.scales-staff-head`,
`.warmups-tip`, `.scales-staff`, `.scales-pick-row`) · `section.scales-metronome-card` (`#warmupsMetronomeControls` ›
`.metro-transport-grid` · `.metroBlk-bpm-box`). Pop-ups: `#warmupsSettingsModal` (instrument, `.pick-bar` + `.pick-row`s,
`.scales-pool-line`), `#warmupsClefModal`, `#warmupsChooseModal` (`.scales-choose-group` › `.warmups-choose-row`s).
Admin: `#warmups-section` › `.admin-warmup-kind` headings › `.admin-feature` rows (`.admin-warmup-row-preview`)
· `#warmupFormModal` › `.modal-content.admin-modal-wide` › `.admin-warmup-fields` grid, the tip,
switch, `.admin-warmup-preview-head` (Notes + clef pills), `.admin-warmup-preview`, `.admin-warmup-status`,
length / octave pills, `.note-keyboard`, `.admin-warmup-tools` (with **Slur to next note**).

## 4. Tokens used
`--label-color` (tip, status), `--danger-text` (status with problems), `--primary-action-strong`
(playing / selected note), `--container-bg`, `--input-border`, `--radius-md`, `--opacity-muted`
(a switched-off exercise), `--touch-target`, `--font-sm`, `--font-md`, `--space-*`.

## 5. Props / API
- Data: `warmup_exercises` (db/migrations/055_warmups.sql); the app reads `GET /api/warmups`
  (switched-on, feature `warmups`), admins `GET/POST/PUT/DELETE /api/admin/warmups` (+ `/:id/active`,
  `/:id/move`). Every save is checked with `public/warmups.js` on the server.
- `public/warmups.js`: `check` (bars, range), `rows` (stave items with `warmup-note-<i>` classes),
  `timeline` / `noteAt` (which note sounds at each click - a crotchet click, or a quaver click when
  the exercise has quavers), `toBassClef`, `span` (lowest / highest note, for the range check), `parse` /
  `format` (the authoring shorthand `G4w | E4h^ G4h` - `^` slurred to the next note). A note's `sl: true` is
  slurred to the next note; `rows` gives each row its slur `spans` (carried over a row break with
  `openEnd` / `openStart`).
- Settings on the device: localStorage `tml.warmups` (`kinds`, `instrumentId`, `clef` + `clefSet` (chosen with
  the Clef button; a bass clef chosen before ML-361 stays chosen), `metronome`, `repeat`, `countIn`, `volume`,
  `currentId`).
- Behind the `warmups` feature (Admin → Features); top-bar tuner toggle; leaving the screen pauses it.

## 6. States
Stopped · Count-in ("Get ready… 3") · Playing (gold note) · Paused · Finished (stops after 1× / 2×).
Editor: nothing selected (adds at the end) · a note selected (replaces) · has problems (Save off).

## 7. Code example
```js
const ex = { beatsPerBar: 4, notes: Warmups.parse('G4h C5h G4w') };
Warmups.rows(ex, 'bass').map(r => Notation.staff({ clef: 'bass', items: r.items }));
```

## 8. Cross-references
[scales](scales.md) · [pick-list](pick-list.md) · [notation](notation.md) · [metronome](metronome.md) · [admin-shell](admin-shell.md) · [modal](modal.md)

## 9. Accessibility
- Each stave row is an image named for its notes; the title, "3 of 12" and the tip are text.
- Choose a warm-up: each row a button; a locked one is `aria-disabled` (still read out, with why), not
  hidden. The kinds pick list is the standard one (buttons with `aria-pressed`).
- Previous / Next / Shuffle are buttons; value boxes have `aria-haspopup="dialog"`; Play has `aria-pressed`.
- Editor: every control is a button or a labelled input; a note on the stave can also be selected
  with ← / → (so selecting doesn't depend on tapping the drawing); problems are read out
  (`aria-live`), not only coloured.

See [accessibility foundation](../foundations/accessibility.md).
