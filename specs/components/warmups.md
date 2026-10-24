# Warm-ups

## 1. Metadata
- **Name:** Warm-ups (`.warmups-tip`, `.warmup-note`, `.warmup-note-*`, `.warmups-choose-row` (+ `.is-locked`); ML-586: `.warmups-head`, `.warmups-heading`, `.warmups-title-btn`, `.warmups-sub`, `.warmups-settings-btn`, `.warmups-staff`, `.warmups-row`, `.warmups-dock`, `.warmups-progress`, `.warmups-progress-fill`, `.warmups-status`, `.warmups-dock-row`, `.warmups-dock-side`, `.warmups-dock-main`, `.warmups-countin`, `.warmups-countin-words`, `.warmups-countin-dots`, `.warmups-countin-dot` (+ `.is-done`), `.warmups-settings-head`, `.warmups-settings-grid`, `.warmups-settings-row`; the Admin → Warm-ups editor: `.admin-warmup-kind`, `.admin-warmup-row-preview`, `.admin-warmup-off`, `.admin-modal-wide`, `.admin-warmup-fields`, `.admin-warmup-preview-head`, `.admin-warmup-preview`, `.admin-warmup-status`, `.admin-warmup-inline`, `.admin-warmup-tools`, `.is-selected`, `.note-keyboard` - the note picker: sharps above, naturals, flats below, the same placement as `.theory-answers-keyboard`; the Scales key picker used it until ML-357)
- **Category:** Tool screen · admin editor
- **Status:** New (ML-294); the Scales layout, range locking and slurs ML-361; simplified ML-586 (one Settings button, the bar at the bottom, one music size)

## 2. Overview
Brass warm-up exercises, one at a time, with a metronome that lights the note to play. A building
block of practice sessions (like Scales). ML-586 (owner, 23 Oct 2026) took it from 14 controls to 4 or 5: there
are **two ways to use it** - **at your own pace** (a list; Next when you're ready) or **with the metronome**
(each warm-up at its own speed, twice by default, carrying straight on to the next) - and everything else is
under **one Settings button**, saved on the account so it's the same on every device.

1. **The exercise card** (`section.flow-card.scales-staff-card`):
   - **The title is a button** (`.warmups-title-btn` inside the `h2`): the warm-up's name over "Lip slurs · 5 of 22 ⌄"
     (`.warmups-sub` - the topic, and where it is in your list). It opens **My warm-ups** - the chosen topics, each
     warm-up a row (`.flow-choice-option.level-answer.warmups-choose-row`, its speed beside it, the one on screen
     selected), a locked one in place and not playable (`.is-locked`: muted, a lock, "goes down to B3 - outside your
     range"), and **Change my warm-ups** at the bottom (opens Settings).
   - **Settings** (`.warmups-settings-btn`, the value box with an icon) beside it.
   - The tip, then **the stave at the music size** (`.warmups-staff`, a `.warmups-row` per line): every warm-up is
     drawn at the same size - Small, Medium or Large in Settings - with as many whole bars on a line as fit the width
     (`Warmups.fitRows`). The lines are evened out (seven bars are 3 + 4, not 6 + 1) and every line but the last is spread to the full width when it is over half way there;
     a held note alone on a line stays as it is; a single bar too wide for the screen shrinks to fit. It used to be
     stretched to fill the card, so a warm-up with few notes was drawn big and one with many small. **Slurs** are drawn
     (standard engraving - see [notation](notation.md)). The note to play lights gold, following each note's length.
     While it plays, **the line being played is kept in view** - when it or the line after it would be hidden, the
     page scrolls it up under the top bar (`scroll-margin-top` from `--header-h`).
2. **The bar at the bottom** (`.warmups-dock`, sticky at the bottom of the screen - on a short warm-up it sits under
   the music): the status line (`.warmups-status`: what's playing - the speed and which time through - shown only
   with the metronome on), then the buttons (`.warmups-dock-row`). ML-607 (owner, 24 Oct 2026): no bar of how far through
   the list and nothing about what comes next - you only ever play some of the list, so "5 of 65" meant nothing; the title's
   line says the kind only. (Scales still has its `.warmups-progress` and "Next", which in a Scales block counts its three.)
   - **At your own pace**: **Previous** (`.warmups-dock-side`, grey) and **Next warm-up** (`.warmups-dock-main`,
     gold). The list goes round.
   - **With the metronome**: **Previous**, **Play / Pause** (gold; hold to go back to the start), **Next**.
     "66 bpm · 1st time of 2 · Next: Harmonic ladder". It carries on to the next warm-up in time, at that warm-up's
     own speed, with a count-in bar before each; after the last one: "That's the whole list - well done!". Previous
     goes back to the start of the warm-up you're on first (it took Reset's place), then to the one before; with it
     playing, Previous and Next keep playing.
   - **The count-in** (`.warmups-countin`) takes Play's place while it counts: the beats left, big, and a dot per beat
     (`.warmups-countin-dot`, filled `.is-done` as each is heard). It's in the bar at the bottom, so it is always on
     the screen, however long the warm-up (it used to cover the metronome card, off the bottom on a long one). Tap it
     to stop.
3. **Settings** (`#warmupsSettingsModal`), two headed groups (`.warmups-settings-head`) of value boxes two across
   (`.metro-transport-grid-2.warmups-settings-grid`) - each opens its own pop-up (One button, one pop-up):
   - **My warm-ups**: **Instrument** (whose range and clef count; your main one to start with), **Clef** (Treble /
     Bass / Tenor - the one you read your instrument in until chosen here; for this visit only, ML-528), **Topics**
     (the kinds, as the standard [pick list](pick-list.md)), **Music size** (Small / Medium / Large); a **Shuffle**
     switch (`.warmups-settings-row` - a mixed-up order, once a visit, so Previous goes back); "22 warm-ups in your
     list, about 8 minutes" with **See your range**, and a line on how many are locked or beyond the instrument.
   - **Metronome**: a **Play with the metronome** switch (own pace when off), then - when it's on - **Speed** (80%,
     90%, their own, 110% of each warm-up's own speed; the pop-up explains that every warm-up has its own speed),
     **Play each one** (once or twice - twice to start with), **Count-in** (none or 1 bar) and **Volume**, and a **Light the note being played** switch (on to start with; off for a player who doesn't need the gold note - the lines still move up as it plays; owner, 23 Oct 2026).
   - "Kept on your account - the same on every device." and **Done**.
   In a practice session's Warm-up block the topics and the order are the session's (Topics and Shuffle are off), and
   the metronome switch is for that block only.

**Range locking (ML-361):** each warm-up's lowest and highest note (`Warmups.span`), in the instrument's own
clef, against the instrument's range (`rangeLow`-`rangeHigh`: beyond) and your comfortable range from the
Range tool (`bottomNote`-`topNote`: locked). Locked and beyond ones are left out of Previous / Next (and a
session's warm-up list) until your range grows. No range set: nothing is locked.

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
there are none. The stave can be previewed in bass or tenor clef.

## 3. Anatomy
Tool: `#warmupsView` › `section.flow-card.scales-staff-card` (`.warmups-head` › `h2.warmups-heading` › `#warmupsChooseBtn.warmups-title-btn`
· `#warmupsSettingsBtn.warmups-settings-btn`; `.warmups-tip`; `#warmupsStaff.warmups-staff` › `.warmups-row`s) · `#warmupsDock.warmups-dock`
(`#warmupsStatus.warmups-status`, metronome only; `.warmups-dock-row` › `#warmupsPrevBtn`, `#warmupsNextMainBtn`,
`#warmupsPlayBtn`, `#warmupsCountIn.warmups-countin`, `#warmupsNextBtn`). Pop-ups: `#warmupsSettingsModal` (`.warmups-settings-head`,
`.warmups-settings-grid` value boxes, `.warmups-settings-row` switches, `.scales-pool-line`), then - after it, so they open over it -
`#warmupsInstrumentModal`, `#warmupsTopicsModal` (`.pick-bar` + `.pick-row`s), `#warmupsClefModal`, `#warmupsSizeModal`,
`#warmupsSpeedModal`, `#warmupsChooseModal` (`.scales-choose-group` › `.warmups-choose-row`s), `#warmupsRepeatModal` (play each one),
`#warmupsCountInModal`, `#warmupsVolumeModal`.
Admin: `#warmups-section` › `.admin-warmup-kind` headings › `.admin-feature` rows (`.admin-warmup-row-preview`)
· `#warmupFormModal` › `.modal-content.admin-modal-wide` › `.admin-warmup-fields` grid, the tip,
switch, `.admin-warmup-preview-head` (Notes + clef pills), `.admin-warmup-preview`, `.admin-warmup-status`,
length / octave pills, `.note-keyboard`, `.admin-warmup-tools` (with **Slur to next note**).

## 4. Tokens used
`--label-color` (tip, status, sub), `--text-color`, `--danger-text` (status with problems), `--primary-action-strong`
(playing / selected note, count-in dots), `--primary-action` (progress fill, count-in border), `--primary-action-tint`
(count-in), `--container-bg`, `--input-border`, `--shadow-top` (the bar at the bottom), `--z-sticky`, `--header-h`,
`--radius-md`, `--radius-pill`, `--radius-circle`, `--opacity-muted` (a switched-off exercise), `--touch-target`,
`--font-sm`, `--font-base`, `--font-md`, `--font-3xl`, `--font-weight-*`, `--line-height-tight`, `--space-*`.

## 5. Props / API
- Data: `warmup_exercises` (db/migrations/055_warmups.sql); the app reads `GET /api/warmups`
  (switched-on, feature `warmups`), admins `GET/POST/PUT/DELETE /api/admin/warmups` (+ `/:id/active`,
  `/:id/move`). Every save is checked with `public/warmups.js` on the server.
- Settings (ML-586): `accounts.warmup_prefs` (db/migrations/148_warmup_prefs.sql), `GET/PUT /api/account/warmups`
  (merged, so one setting can be saved alone), checked by `Warmups.cleanPrefs` - `metronome`, `speed`
  (a whole % up to `Warmups.SPEED_MAX`, offered from the one list of play speeds - ML-596), `light`, `times` (`Warmups.TIMES`), `countIn`, `volume`, `size` (`Warmups.SIZES`), `shuffle`, `kinds`,
  `instrumentId`; defaults `Warmups.PREF_DEFAULTS` (own pace, their own speed, twice, a bar's count-in, Medium). A copy
  stays on the device (localStorage `tml.warmups`, with `currentId` - where you were) for offline; the first time the
  account has none, the device's is saved to it. The clef chosen in Settings is for the visit only (ML-528).
- `public/warmups.js`: `check` (bars, range), `rows` (stave items with `warmup-note-<i>` classes; `groups` - bars
  per line), `fitRows` (as many bars on a line as fit a width), `timeline` / `noteAt` (which note sounds at each click
  - a crotchet click, or a quaver click when the exercise has quavers), `toBassClef`, `span` (lowest / highest note,
  for the range check), `parse` / `format` (the authoring shorthand `G4w | E4h^ G4h` - `^` slurred to the next note),
  `cleanPrefs`. A note's `sl: true` is slurred to the next note; `rows` gives each row its slur `spans` (carried over a
  row break with `openEnd` / `openStart`).
- Music size, in app.js: staff units to pixels `WARMUPS_SIZE_SCALE` (Small 0.72, Medium 0.85, Large 1.1); a line's
  svg `width` / `height` are scaled - attributes, not a style.
- Counted (anonymous, PostHog): a `warm-ups setting` event with the setting and its new value; button taps are counted
  by autocapture as everywhere.
- Behind the `warmups` feature (Admin → Features); top-bar tuner toggle; leaving the screen pauses it.

## 6. States
Own pace (Previous / Next warm-up) · With the metronome: stopped · count-in (the count-in in Play's place) · playing
(gold note; "1st time of 2") · paused · the list played to the end ("That's the whole list - well done!").
Editor: nothing selected (adds at the end) · a note selected (replaces) · has problems (Save off).

## 7. Code example
```js
const ex = { beatsPerBar: 4, notes: Warmups.parse('G4h C5h G4w') };
const width = (r) => parseFloat(/width="([\d.]+)"/.exec(Notation.staff({ clef: 'treble', items: r.items }))[1]);
Warmups.fitRows(ex, 'treble', 320, width).map(r => Notation.staff({ clef: 'treble', items: r.items, spans: r.spans }));
```

## 8. Cross-references
[scales](scales.md) · [pick-list](pick-list.md) · [notation](notation.md) · [metronome](metronome.md) · [admin-shell](admin-shell.md) · [modal](modal.md)

## 9. Accessibility
- Each stave line is an image named for its notes; the title, the sub line and the tip are text.
- The title is a real button in the heading (`aria-haspopup="dialog"`; its name is the title and the sub line, "5 of 22"); Settings is a
  button with `aria-label="Settings"`.
- The status line is `aria-live="polite"`, so the count-in, which time through and what's next are read out; the
  count-in button is named "Get ready - 3 - tap to stop".
- My warm-ups: each row a button; a locked one is `aria-disabled` (still read out, with why), not hidden. The topics
  pick list is the standard one (buttons with `aria-pressed`). The switches are labelled by their row's words.
- Previous / Next / Next warm-up are buttons with words; Play has `aria-pressed`. Every button in the bar at the
  bottom is at least 44px.
- The page scrolls to the line being played with `behavior: 'auto'` when reduced motion is asked for.
- Editor: every control is a button or a labelled input; a note on the stave can also be selected
  with ← / → (so selecting doesn't depend on tapping the drawing); problems are read out
  (`aria-live`), not only coloured.

See [accessibility foundation](../foundations/accessibility.md).
