# Warm-ups

## 1. Metadata
- **Name:** Warm-ups (`.warmups-tip`, `.warmup-note`, `.warmup-note-*`; the Admin → Warm-ups editor: `.admin-warmup-kind`, `.admin-warmup-row-preview`, `.admin-warmup-off`, `.admin-modal-wide`, `.admin-warmup-fields`, `.admin-warmup-preview-head`, `.admin-warmup-preview`, `.admin-warmup-status`, `.admin-warmup-inline`, `.admin-warmup-tools`, `.is-selected`)
- **Category:** Tool screen · admin editor
- **Status:** New (ML-294)

## 2. Overview
Brass warm-up exercises, one at a time, with a metronome that lights the note to play. A building
block of practice sessions (like Scales). The layout **is Scales'** - it shares `.scales-pick-row`,
`.scales-staff-card`, `.scales-staff-head` / `-heading` / `-title` / `-sub`, `.scales-staff`,
`.scales-staff-row-short` and `.is-now` (see [scales](scales.md)):

1. **Previous / Next / Shuffle / My warm-ups** (`.scales-pick-row`, four across, icon over label, My warm-ups outlined - the same row as [scales](scales.md)).
   Previous and Next go through the chosen kinds in order (the admin order), wrapping round. Shuffle
   jumps to any other exercise of the chosen kinds at random. My warm-ups: which kinds (long tones, lip slurs,
   flexibility, articulation, finger patterns, easy melodies) and treble or bass clef.
2. **The exercise card**: title, "Lip slurs · 3 of 12", volume button, the tip (`.warmups-tip`),
   then the stave - rows of whole bars (up to 8 notes / 4 bars a row), justified to one width, a
   whole-bar rest centred in its bar. The note to play lights gold, following each note's length.
3. **Transport**: Play (hold to go back to the start), Reset, Repeat (1×, 2×, loop) and Count-in, then
   the tempo box, which starts at each exercise's own tempo.

**Treble and bass clef:** exercises are written for treble-clef brass (brass band parts - cornet,
horn, baritone, euphonium and bass read the same written notes). Bass clef (trombone, euphonium) is
the same exercise down a major 9th - how a treble-clef B♭ part and its bass-clef part relate - so a
lip slur stays on the same harmonics.

**Admin → Warm-ups** (super admins): the list in play order, grouped by kind, each with its first
row drawn; move up/down, Edit, Switch off/on, Delete. The editor builds notes by tapping: choose a
length (semibreve / minim / crotchet / quaver, dotted), an octave, then a key on the keyboard grid
(`.note-keyboard`) or Rest. Nothing selected adds at the end; tap a note on the stave to select it
(gold, `.is-selected`) and the next tap replaces it; ← → move the selection, Delete note, Add at end,
Undo. Problems (a note over a bar line, out of range) show under the stave and Save is off until
there are none. The stave can be previewed in bass clef.

## 3. Anatomy
Tool: `#warmupsView` › `.scales-pick-row` · `section.flow-card.scales-staff-card` (`.scales-staff-head`,
`.warmups-tip`, `.scales-staff`) · `.metro-transport-grid` · `.metroBlk-bpm-box`.
Admin: `#warmups-section` › `.admin-warmup-kind` headings › `.admin-feature` rows (`.admin-warmup-row-preview`)
· `#warmupFormModal` › `.modal-content.admin-modal-wide` › `.admin-warmup-fields` grid, the tip,
switch, `.admin-warmup-preview-head` (Notes + clef pills), `.admin-warmup-preview`, `.admin-warmup-status`,
length / octave pills, `.note-keyboard`, `.admin-warmup-tools`.

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
  the exercise has quavers), `toBassClef`, `parse` (the authoring shorthand `G4w | E4h G4h`).
- Settings on the device: localStorage `tml.warmups` (`kinds`, `clef`, `repeat`, `countIn`,
  `volume`, `currentId`).
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
[scales](scales.md) · [notation](notation.md) · [metronome](metronome.md) · [admin-shell](admin-shell.md) · [modal](modal.md)

## 9. Accessibility
- Each stave row is an image named for its notes; the title, "3 of 12" and the tip are text.
- Previous / Next / Shuffle are buttons; value boxes have `aria-haspopup="dialog"`; Play has `aria-pressed`.
- Editor: every control is a button or a labelled input; a note on the stave can also be selected
  with ← / → (so selecting doesn't depend on tapping the drawing); problems are read out
  (`aria-live`), not only coloured.

See [accessibility foundation](../foundations/accessibility.md).
