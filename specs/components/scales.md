# Scales practice

## 1. Metadata
- **Name:** Scales practice (`.scales-dir-flip`, `.scales-choice-grid`, `.scales-staff-card`, `.scales-staff-title`, `.scales-memory`, `.scales-memory-name`, `.scales-memory-detail`, `.scales-memory-progress`, `.scales-note`, `.scales-note-*`, `.scales-rest`, `.is-now`, `.scales-choose-group`, `.scales-choose-label`, `.scales-choose-keys`, `.scales-pool-line`, `.scales-pool-count`, `.scales-range-link`, `.scale-grid`, `.scale-grid-head`, `.scale-grid-acc`, `.scale-grid-row`, `.scale-grid-label`, `.scale-grid-sub`, `.scale-grid-cell`, `.is-ready`, `.is-other`, `.is-locked`, `.is-beyond`, `.is-no`, `.scale-grid-legend`, `.scales-range-staff`, `.scales-grade-options`, `.is-level`; ML-589: the screen is laid out with [Warm-ups](warmups.md)' classes - `.warmups-head`, `.warmups-heading`, `.warmups-title-btn`, `.warmups-sub`, `.warmups-settings-btn`, `.warmups-staff`, `.warmups-row`, `.warmups-dock` and its parts, `.warmups-countin` and its parts, `.warmups-settings-head`, `.warmups-settings-grid`, `.warmups-settings-row`. The old `.scales-setting-row`, `.scales-setting-btn`, `.scales-pick-row`, `.scales-staff-head`, `.scales-staff-heading`, `.scales-staff-sub`, `.scales-staff`, `.scales-staff-row-short` and `.scales-metronome-card` are no longer on this screen)
- **Category:** Tool screen
- **Status:** New (ML-9); grade lists, the grade grid ML-357; laid out as Warm-ups ML-589

## 2. Overview
The Scales tool: work through a list of scales and arpeggios, see each written on the stave, and play
it along to a metronome that lights the note to play. The list is the ABRSM grade lists for your instrument, and
Everything else (ML-357, see `docs/scales-grades.md`).

ML-589 (owner, 23 Oct 2026): the same simpler layout as Warm-ups (ML-586), so the two tools work the same way. Two
ways to use it - **at your own pace** (Previous / Next scale) or **with the metronome** (each scale played once or
twice, then straight on to the next - or Keep repeating the one scale) - and everything else under **one Settings
button**, saved on the account.

1. **The scale's box** (`.flow-card.scales-staff-card`):
   - **The title is a button** (`.warmups-title-btn` in the `h2`): "C major scale" over "1 octave · treble · 3 of 14 ⌄"
     (`.warmups-sub` - the length, the clef, the place in your list). It opens **Choose a scale**. In a Scales block
     (below) it's just the name, with how the Level is played in place of the place in the list, and opens nothing.
   - **Settings** (`.warmups-settings-btn`) beside it - and in a Scales block the **Level** box before it.
   - The scale as Detail says, **at the music size** (`.warmups-staff`, a `.warmups-row` per line - Warm-ups'
     setting, shared): cut into lines at the old rows' beat groups (4 notes, 3 at 3 a beat), as many groups on a line
     as fit, the lines evened out; every line but the last spread to the full width when it's over half way there.
     The key signature on every line, 4/4 on the first when it's one note a beat, bar lines every 4 beats, rests to
     fill the last bar (ML-386) and a final bar line. The line being played is kept in view.
   - **Level 1 - change** (`#scalesLevelLink`, `.btn-text`) under the music for a scale in your list, with Scales
     Levels on (owner: it stays here).
2. **The bar at the bottom** (`.warmups-dock`, as Warm-ups'): how far through the list, a status line, the buttons:
   - **At your own pace**: **Previous** and **Next scale**. "Next up: D major scale". The list goes round.
   - **With the metronome**: **Previous**, **Play / Pause** (hold to go back to the start), **Next**. "72 bpm · 1st
     time of 2 · Next: D major scale". Each scale is a passage of one metronome sequence (its count-in bar, then its
     notes once or twice) and it carries straight on to the next; after the last: "That's the whole list - well
     done!". **Keep repeating** goes round the one scale (the count-in only at the start), as before ML-589. Previous
     goes back to the start of the scale first (it took Reset's place). The count-in shows in Play's place.
   - **In a Scales block**: **Not yet**, **Play**, **Got it** (a gold side button); "60 bpm · set by the Level" and
     "Scale 2 of 3".
3. **Settings** (`#scalesSettingsModal`), three headed groups (`.warmups-settings-head`) of value boxes two across
   (`.warmups-settings-grid`), each opening its own pop-up (placed after Settings in the page, so they open over it):
   - **My scales**: **Instrument** (`#scalesInstrumentModal` - your instruments as a choice list), **Clef** (Treble,
     Bass, Tenor - it picks the ABRSM list for instruments read in more than one; the clef you read your instrument in
     until chosen here, for the visit, ML-528), **Grades** (the Grades pop-up, below - "1-3"), **Music size** (Small /
     Medium / Large - shared with Warm-ups); a **Shuffle** switch (a mixed-up order once a visit); "18 scales in your
     list" and **See your range**.
   - **How they're shown**: **Direction** (Up, Down, Up & down, Down & up - the arrows read in the order you play,
     `.scales-dir-flip`; a dominant 7th, a scale in thirds and the ABRSM patterns keep their own shape) and **Detail**
     (**Notes** - the name, key and notes; **Key** - the name and a blank stave with the clef and key signature;
     **Name** - no stave, `.scales-memory`).
   - **Metronome**: the **Play with the metronome** switch, then - when it's on - **Speed** (`#scalesSpeedModal`: the
     tempo box, −/+, slider, tap the number to type - scales have no speed of their own), **Notes / beat**, **Play
     each one** (Once, Twice, Keep repeating - twice to start with), **Count-in** (none or a bar before each scale),
     **Volume**, and a **Light the note being played** switch.
   - "Kept on your account - the same on every device." In a Scales block the instrument, grades, shuffle, detail and
     the metronome's speed, notes and repeat are the Level's - those boxes are off.
   Clef, direction, detail, notes a beat, count-in, music size and play each one are pick-one pop-ups
   (`.flow-tile-grid` of `.flow-picker-tile`s - clef, direction and detail as `.scales-choice-grid`, 84px tiles whose
   values line up across a row) that close when you choose.

**Name** (`.scales-memory`): "B♭ minor" with "harmonic · scale · 2 octaves · up & down" under it. While
it plays, "Note 5 of 29" keeps your place.

**Grades** (`#scalesPoolModal`, from Settings, a sticky-footer pop-up), top to bottom: the **grades** - "Grades ·
1-3 & 5" over 1-8 and Everything else (`.radio-group.compact.scales-grade-options` checkboxes, four to a row,
Everything else a row of its own); the name of the ABRSM list; the count and **See your range** on one line
(`.scales-pool-line`); then the **grade grid** (`.scale-grid`), live as you tick: a "Major keys" section and a "Minor
keys" section, each a heading row of 15 keys in chromatic order (`.scale-grid-head`; a key's sharp or flat sits under
its letter, `.scale-grid-acc`) and one row per kind and length the grades need (`.scale-grid-row`: "Harmonic minor / a
12th" - `.scale-grid-label` with the length in `.scale-grid-sub`). Each cell (`.scale-grid-cell`) is one of:
- `.is-ready` solid green - in your list, where it's usually written;
- `.is-other` pale green with "8" - in your list, an octave up or down (where your range is);
- `.is-locked` amber with a lock - the grade needs it, but it's outside your range for now;
- `.is-beyond` grey with a cross - the grade needs it, but the instrument can't play it;
- dashed, no fill (`.is-no` in the legend) - not needed at these grades. This wins over everything.
A key (`.scale-grid-legend`) sits under the grid. The grid isn't tappable: it shows what the list is.
Rows only appear where the ticked grades need one; natural minor rows only for Grades 1-2. (The instrument moved to
Settings with ML-589.)

**Choose a scale** (`#scalesChooseModal`, from the title): the list, row by row as in the grid
("Major · Scales / 1 octave", `.scales-choose-group` › `h3.scales-choose-label` + `.scales-choose-keys`), each key
in it a button (`.flow-picker-tile`, five across) - the one playing selected, "8" under a key that's played in
another octave. Tap one to play it (and close). **Change your scales** at the bottom opens Settings.

**See your range** (`#scalesMyRangeModal`): your lowest and highest comfortable notes as two whole
notes on a stave in the clef the scales are in (`.scales-range-staff`, centred), named under it
("Lowest B♭3, highest F5. The instrument goes from F♯2 to E6."). For brass read in treble but
playing from a bass- or tenor-clef list, that's at concert pitch, and it says so. With no range set it
says so and offers **Set your range** (the Range tool's picker) or My instruments.

**Don't** show the metronome's beat dots here: the gold note is the visual (owner's call, ML-9).

## 3. Anatomy
`#scalesView` › `section.flow-card.scales-staff-card` (`.warmups-head` › `h2.warmups-heading` ›
`#scalesChooseBtn.warmups-title-btn`, `#scalesLadderLevelBtn` (a block), `#scalesSettingsBtn`; `#scalesStaff.warmups-staff` ›
`.warmups-row`s, or `.scales-memory`; `#scalesLevelLink`) · `#scalesDock.warmups-dock` (`.warmups-progress`, `#scalesStatus`,
`.warmups-dock-row` › `#scalesPrevBtn`, `#scalesNotYetBtn`, `#scalesNextMainBtn`, `#scalesPlayBtn`, `#scalesCountIn`,
`#scalesNextBtn`, `#scalesGotItBtn`).
Pop-ups: `#scalesSettingsModal`, then `#scalesInstrumentModal`, `#scalesSizeModal`, `#scalesSpeedModal`, `#scalesRepeatModal`,
`#scalesClefModal`, `#scalesDirModal`, `#scalesDetailModal`, `#scalesNpbModal`, `#scalesCountInModal`, `#scalesVolumeModal`,
`#scalesPoolModal` (Grades), `#scalesChooseModal`, `#scalesMyRangeModal`.

## 4. Tokens used
`--primary-action-strong` (the note to play), `--label-color` (sub line, pool count, grid headings and lengths), `--link-color` (See your range), `--success-text` / `--status-green-*` / `--status-amber-*` / `--control-off-bg` / `--control-border` (grid cells), `--scale-grid-label-width` (the grid's label column), `--radius-xs`, `--font-2xs`, `--font-xs`, `--line-height-snug`, `--font-md`,
`--font-sm`, `--font-weight-bold`, `--icon-md`, `--space-*`, `--touch-target` (key tiles, See your range),
plus the tokens of the components it reuses (Warm-ups' layout, flow tiles, buttons, metronome transport, slider, toggle switch).

## 5. Props / API
- Settings (ML-589): `accounts.scale_prefs` (db/migrations/149_scale_prefs.sql), `GET/PUT /api/account/scales` (merged,
  so one setting can be saved alone), checked by `ScaleGrades.cleanPrefs` (public/scaleGrades.js, loaded by
  server/services/scalePrefs.js) - `metronome`, `bpm`, `npb`, `times` (1, 2, 0 = keep repeating), `countIn`, `volume`,
  `detail`, `direction`, `shuffle`, `light`, `grades`, `gradeInstrumentId`; defaults `ScaleGrades.PREF_DEFAULTS`. The
  music size is Warm-ups' (`warmup_prefs.size`). A copy stays on the device, localStorage `tml.scales`, with the scale
  you were on (`keyId`, `form`, `minorForm`, `type`, `octaves`, `pattern`, `extended`, `tonicOctave`; `pool` is the old
  My scales, no longer shown); the first time the account has none, the device's is saved to it. The clef is the
  visit's (ML-528).
- Scales come from `TheoryEngine.buildScale` (spelled from the key; melodic minor comes down
  natural) and `writeScale` (which notes still need an accidental against the key signature, lasting
  a bar); the list from `ScaleGrades.grid(listId, grades, ctx)` (`public/scaleGrades.js`: the ABRSM
  lists and the placement rules - `docs/scales-grades.md`). See `docs/theory-practice.md` ("Scales practice").
- **Rests to fill the last bar (ML-386):** when the last bar is short (15 notes in 4/4), rests make it up - one `restQuarter` per missing note, or a `restHalf` for a missing 3rd and 4th beat in 4/4 (as engraved), drawn by Notation as `mark`s on the middle line before the final bar line. Each is `.scales-note.scales-rest` with the `scales-note-<i>` of the slots it covers, so it lights up (`.is-now`) as the metronome plays through the bar; Name mode says "Rest".
- The note to play: each note's glyphs carry `scales-note scales-note-<i>` (Notation `note.cls`);
  `scalesLight(i)` adds `.is-now` (unless Light the note is off); each line's `data-from` / `data-to` say which note
  slots it holds, for keeping it in view.
- Playing: its own metronome player, one click per note (`setNotesPerBeat(npb)`). With the metronome on its own, one
  sequence (the player's ML-193 sequence mode) - a passage per scale, `scalesLoopBoundary` hands over the next on the
  beat; Keep repeating, a Scales block and a Skills step (`scalesKeepsOne`) go round the one scale. The sound line is
  kept awake while the screen is open with the metronome on (`keepAwake`, ML-586).
- Changing anything about the scale starts it again from the top (and keeps playing if it was). Leaving the screen pauses it.
- Counted (anonymous, PostHog): a `scales setting` event with the setting and its new value.
- Top-bar tuner toggle, like the other metronome tools (`MINI_TUNER_VIEWS`).
- Behind the `scales_practice` feature (Admin → Features); the home tile and the ☰ menu's tools
  row show it only when it's on.

### In a practice session's Scales block (ML-391, Scales Levels)

With the `scales_levels` switch on, a session's Scales block shows the same screen with:

- **The Level box** (`#scalesLadderLevelBtn`: a `.level-chip.lv-N` over "level"; a star once learnt) beside Settings.
  It opens what each Level means for this scale and sets one by hand (the session's choice pop-up, each row a
  `.level-chip` beside its words).
- The sub-line says how the Level is played: "1 octave · treble · with the notes, slowly"; the title opens nothing.
- **Not yet | Play | Got it** in the bar at the bottom (ML-589 - owner), with "60 bpm · set by the Level" and "Scale
  2 of 3"; the progress bar is the block's three scales.
- The Level sets Detail, the speed and notes a beat; those Settings boxes are off for the block, and the scale goes
  round until you answer.
- **Outside a block**, a scale that's in your list has **Level 2 - change** (`#scalesLevelLink`) under the music.
- **The grade grid** (Grades pop-up): a box in your list is `.scale-grid-cell.is-level.lv-N` - the Level colour
  (the [level map](level-map.md)'s `.lv-1` to `.lv-5`), a solid edge, its number in bold, a star once learnt. The
  next goal (`.session-goal`) sits above the grid and the key becomes the Levels key (`#scalesLevelLegend`).
  Each row's label for screen readers says the Level of every scale in it.
- **The stars** (`#scaleUpModal`): the piece Level-up's `.levelup` (three stars, the from → to chips), a line of
  text, Carry on, and the next goal with the Level bar (`.session-goal-card`). Reduced motion: no animation.

Rules and wording: `docs/practice-sessions.md`, "Scales Levels".

## 6. States
Own pace (Previous / Next scale) · With the metronome: stopped · count-in (in Play's place) · playing (one note gold;
"1st time of 2") · paused · the list played to the end · keep repeating · A Scales block (Not yet / Play / Got it).
Detail: Notes · Key · Name.

## 7. Code example
```js
const scale = TheoryEngine.buildScale({ keyId: 'D major', type: 'scale', octaves: 2, direction: 'both', clef: 'treble' });
const notes = TheoryEngine.writeScale(scale, 4); // [{ pitch, accidental }]
// Detail Key: the stave with the key signature only
Notation.staff({ clef: 'treble', keySignature: scale.keySignature, items: [], minWidth: 48, label: 'D major scale: the key signature only' });
// ML-357: the grade grid for a baritone read in treble, Grades 1-2, a range of B♭3 to F5 (MIDI, written pitch)
const list = ScaleGrades.groupFor('B♭ Baritone Horn', 'treble'); // { id: 'baritone-euphonium-treble', ... }
const { sections, pool } = ScaleGrades.grid(list.id, [1, 2], { clef: 'treble', low: 42, high: 88, bottom: 58, top: 77 });
// ML-589: the settings as the account keeps them
ScaleGrades.cleanPrefs({ times: 0, bpm: 80, grades: [2, 1] }); // { bpm: 80, times: 0, grades: [1, 2] }
```

## 8. Cross-references
[warmups](warmups.md) (the layout) · [notation](notation.md) · [metronome](metronome.md) · [selectable-tile](selectable-tile.md) · [theory-quiz](theory-quiz.md) · [modal](modal.md)

## 9. Accessibility
- Each stave line is an image named for its notes ("D major scale, notes 1 to 8"); the Key stave is named
  "D major scale: the key signature only". The gold note is never the only information - the title says
  the scale and Play/Pause says the state.
- The title is a real button in the heading (its name is the scale and the sub line); in a Scales block it's
  `aria-disabled`. Settings and the value boxes are buttons with `aria-haspopup="dialog"`; Play has `aria-pressed`;
  the switches are labelled by their row's words.
- The status line is `aria-live="polite"` - the count-in, which time through, what's next, "Scale 2 of 3"; the
  count-in button is named "Get ready - 3 - tap to stop".
- Pickers are the app's dialogs (focus in, Escape closes, focus back). Key tiles are 44px high; every button in the
  bar at the bottom is at least 44px.
- The grade grid is read row by row: each row is a `role="img"` named for what's in it ("Harmonic
  minor, a 12th. in your list: G; in your list, another octave: A"), and the cells and headings are
  `aria-hidden`. The cell states differ by symbol (8, lock, cross, dashed) as well as colour; the legend
  says what each means. The count is `aria-live`.
- Choose a scale: each key is a real button named in full ("D major, scales, 1 octave", "..., another octave"),
  at least 44px high; the one playing has `aria-pressed="true"`.
- See your range is a button (underlined, link colour, 44px high). The range stave is an image named
  "Your range: B♭3 to F5", and the same notes are in the text under it.
- The page scrolls to the line being played with `behavior: 'auto'` when reduced motion is asked for.

See [accessibility foundation](../foundations/accessibility.md).
