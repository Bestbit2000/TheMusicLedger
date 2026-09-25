# Flow editor

## 1. Metadata
- **Name:** Flow editor (`.flow-card`, `.flow-edit-tabs`, `.flow-block-box`, `.flow-tile-grid`, `.flow-tile-value`, `.flow-picker-tile`, `.flow-choice-option`, `.flow-multiselect-grid`, `.flow-volta-bracket`, `.flow-intro-bracket`, `.flow-fermata-box`, `.flow-ramp-box`, `.flow-pause-*`, `.flow-media-item`, `.flow-doc-item`, `.flow-upload-progress`, `.flow-from-file-banner`, `.flow-sign-svg`, `.flow-check-*`, `.flow-block-has-issue`, `.flow-bars-toolbar`, `.flow-play-layout-bar`, `.flow-layout-toggle`, `.flow-bar-grid-tile`, `.flow-bar-grid-2`, `.flow-bar-detail-*`, `.flow-bar-list-1`, `.flow-bar-full-*`, `.flow-bar-popup*`, `.flow-action-row`, `.flow-help-text`, `.flow-required`, `.flow-pill`, and every other `.flow-*` sub-part)
- **Category:** Feature area
- **Status:** Stable (ML-179, ML-204). Read [docs/flow-musicxml.md](../../docs/flow-musicxml.md) before touching import/export

## 2. Overview
Create/edit a Flow: metadata, recordings and documents, and the block editor (bars, time
signatures, tempo ramps, fermatas, voltas, jump signs). Built from the shared components.
Before adding a new `.flow-*` class, check whether a [selectable tile](selectable-tile.md),
[card](card.md), [pill](pill-badge.md) or [tab](tabs.md) already does the job.

## 3. Anatomy
Screen › `.flow-edit-tabs` › `.flow-card` sections › (block editor) `.flow-blocks-card` › `.flow-block-box` × n › `.flow-tile-grid` of tiles › modals with `.flow-picker-tile` / `.flow-choice-option` pickers › `.flow-action-row`.

Bars tab (ML-206, ML-208): `.flow-bars-toolbar` (summary › `.flow-layout-toggle`) › one of:
- 1 column: the `.flow-block-box` cards.
- 2 columns: `#flowBlocksList.flow-bar-grid-2` › `button.flow-bar-grid-tile.flow-bar-detail-tile` × n › `.flow-bar-detail-head` / `.flow-bar-detail-mid` / `.flow-bar-detail-strip`.
- 4 columns: `#flowBlocksList.metroBlk-tile-strip` › `button.metroBlk-tile.flow-bar-grid-tile` × n.

In either grid, tapping a tile opens `#flowBarPopupModal`: `.flow-bar-popup-header` (‹ · rehearsal mark · `.flow-bar-popup-title` with `.flow-bar-popup-pos` · › · ✕) › the card's 12 setting tiles › `.flow-bar-popup-actions` (3 × `.flow-bar-popup-action`) › `.flow-bar-popup-delete`.

## 4. Tokens used
All of: `--container-bg`, `--input-bg`, `--input-border`, `--primary-action`, `--primary-action-tint`,
`--label-color`, `--text-color`, `--warning-color`, `--danger-color`, `--radius-md`/`-lg`/`-xl`/`-pill`,
`--space-*`, `--font-xs`…`--font-lg`, `--font-music` (jump signs), `--duration-base` (block animations).

## 5. Props / API
`.flow-action-btn` (in a `.flow-action-row`, or full width with `.flow-action-btn-wide`) is the Flow editor's icon + label action tile: `--input-bg`, 2px `--input-border`, `--font-sm` bold. It's for secondary Flow actions (upload, export, edit details). Save/Cancel still use the standard [buttons](button.md).
The rehearsal-mark box in each block header (`.flow-block-mark-box` / `.flow-block-mark-empty`) grows with its text and is the part of the header that truncates ("…") if space runs out - the "Bars X" name never wraps. Empty, it reads "+ RM" (ML-219).
**Bar counts never include the lead-in** (it is a count-in, not part of the piece) - the library row, the Bars-tab summary, the Details summary and the admin Flows list/import preview all count only real blocks. The runtime estimate does include the lead-in, since it plays.
**Bars tab layouts (ML-206, ML-208).** The toolbar switch (`.flow-layout-toggle`) picks 1 column (full cards), 2 columns or 4 columns. Its icons come from `public/icons/layout-1-col.svg`, `layout-2-col.svg` and `layout-4-col.svg`, inlined so they follow the theme. The choice is remembered per device (`localStorage` key `flowBarLayout`, `'1'`/`'2'`/`'4'`). Both grid layouts share everything but the tile: the same popup, press-and-hold drag and click guard (`.flow-bar-grid-tile`).
- **2 columns** (ML-208) shows each bar as a detail tile that reads like the bar itself (`flowBarDetailTileHtml`), in three bands:
  - **Header**, a fixed `--icon-lg` line: segno/coda sign, rehearsal mark box, "Bars 1–8".
  - **Middle**: the start barline, the time signature over its bpm, and the end barline. A repeat-end shows its count, never "2x" (the default, as everywhere else). A Fine shows "Fine". Bars with no repeat get thin muted barlines. No "start"/"end" labels, and no beat note.
  - **Strip**: alternate ending (volta bracket), intro (cue bracket), fermata/caesura counts, "rit. ↘" / "accel. ↗" ramps, then the jump.

  **Alignment rule:** the header is fixed height and the middle never stretches. The strip is always rendered, even when empty, and takes any spare height in the row. So across a row the headers, the time signatures and the dividing lines always line up, whatever each tile holds. Rows are only as tall as their tallest tile.

  **Play Flow (ML-209)** uses the very same tile, from `flowBarDetailTileHtml(..., { play: true, active })`. Its own switch, `.flow-bars-toolbar.flow-play-layout-bar` (right-aligned under the title), picks 1, 2 or 4 columns. That choice is remembered separately (`flowPlayLayout`, **default `'4'`**), because the two screens show different things. On Play Flow, tapping a tile jumps playback to that bar, exactly as a 4-column Play tile does. There's no popup and no drag. The bar that's sounding gets the Play tiles' gold edge (`.metroBlk-tile-active`) and `aria-current`, and its accessible name is "Jump to [mark,] Bars 1–8".

- **Play Flow, 1 column** (ML-207, `#flowPlayTiles.flow-bar-list-1` › `button.flow-bar-full-tile`, `flowBarFullTileHtml`) is read-only and shows **all 12 settings**, each roughly where it sits on a score:
  - **Header:** rehearsal mark and "Bars 1–8", with the bar count ("8 bars") on the right.
  - **Top of the bar**, in three zones: sign on the **left**, pauses (fermata/caesura counts) in the **centre**, then alternate ending and jump on the **right**.
  - **The bar:** start barline, time signature, then beat unit = bpm (e.g. "♩ = 100 bpm"), then end barline with its count or "Fine".
  - **Under the bar:** intro, then ramps, as type and count only ("rit. ↘", "accel. ↗ ×2").

  Both outer rows are **always present**, even when empty, so every bar is the same height and the time signatures fall in the same place down the list. There's **no needs-updating state**, because Play only reads the bar. Tapping a bar jumps playback there, and the sounding bar gets the gold edge and `aria-current`, as in the other Play views. The 1- and 2-column tiles build their barlines, brackets, pauses, ramps and jump from one helper (`flowBarReadingParts`), so they always agree.

  **Needs updating:** a bar that fails any of the checks that turn a card tile red (`flowRepeatBarInvalid`, `flowIntroInvalid`, `flowPauseInvalid`, `flowRampInvalid`) shows only what identifies it: the mark and range, with no sign. The middle becomes a large `--icon-xl` ⚠ "Update" at the normal middle height, and the strip is blank. The tile is `.flow-bar-detail-tile-warning`, the same red as `.flow-tile-warning`.
- **4 columns** shows each bar as the Play Flow tile. Both come from `flowBarSummaryTile`, so they can't drift apart. Tap opens the bar popup. Press and hold (350ms) picks the tile up to drag it to any slot, and the other tiles slide along and up to make room (the same FLIP animation as every reorder). There's no swipe-to-delete in this layout.
- **The bar popup** reuses the 1-column card's tiles (`flowBlockTileSectionsHtml`) and rehearsal-mark box (`flowBlockMarkBoxHtml`), so any change to a card tile shows up in both. The header is one row: ‹, mark, name ("Bars 9–14", an en dash to save width) with "n of N" underneath, ›, ✕. The title takes the spare width so **› never moves** between bars. ✕ sits `--space-4` further out so it isn't hit instead of ›. There's no Cancel: edits apply straight away, as they do on the card.
- **Popup actions** (Move earlier / Duplicate / Move later) are each one 4-column tile wide and centred as a group (`.flow-tile-grid-3-centered`). Never stretch them across the row or left-align them. They're text only, `--touch-target` tall and use `--radius-md`, so they read as actions rather than three more settings. They sit on the standard tappable surface (`--input-bg`, `--control-border`). Delete is a `.btn-text-danger` link underneath, hidden when there's only one bar.
- **Disabled** controls (‹ and Move earlier on the first bar, › and Move later on the last) lose the tappable cues instead of fading: no fill, `--input-border`, `--label-color` text. That keeps the text above 4.5:1 in both themes (8.7:1 dark, 5.3:1 light). Fading with `--opacity-disabled` took it to 2:1 in light mode.

**Consistency review (ML-248).** When a Flow is finished (Save in Edit mode, Open player in Create mode), `FlowJourney.checkFlow` (`public/flowJourney.js`) checks the bar settings against each other: a start repeat with no end, an alternate ending with no repeat or for a pass that never comes, D.S. with no segno, al Coda with no To Coda or coda, a Fine or To Coda that's never reached, two segnos/codas/jumps, an intro end with no start, overlapping or backwards ramps, stale settings, and bars that never play.
- With nothing to report, it carries straight on.
- Otherwise `#flowCheckModal` lists the problems in two groups, `.flow-check-group-title` "Won't play as written" (errors) then "Worth checking" (warnings). Each problem is a `.flow-check-item` row in a `.flow-check-list`: `--input-bg` surface, with a 4px `--danger-text` left edge. Tapping a row goes to that bar in the Bars tab.
- The buttons are "Go back and fix" (`.btn-submit`) and a `.btn-text` "Save anyway" / "Open player anyway". ✕ just closes the review.
- The bars involved get `.flow-block-has-issue`, a 3px `--danger-text` outline, in whichever layout is showing. The 1-column card draws it inside its clipping box (negative `outline-offset`). The outlines update live as problems are fixed, for the rest of that editing session.

**Play Flow playback (ML-193, ML-249 to ML-256).** What plays and when comes from the journey engine, `public/flowJourney.js`; see [docs/flow-journey.md](../../docs/flow-journey.md) for the rules. The screen reads its position from every click, so "Bar X of Y", the highlighted bar and the fermata/caesura glyphs move on at the next bar's first beat, never early. The label reads e.g. "Intro · A · 2 of 8 bars · 2nd time · 3/4 · 96 bpm". During a ramp the bpm updates beat by beat. Reaching the end of the piece stops playback and resets to the start.

Block colours and volta/intro bracket geometry are computed in JS. Geometry may be inline, but colours must reference tokens.

**Edit Flow pop-ups (ML-281):** the same rule in every pop-up - a box that only *contains* something tappable is a display surface; only the tappable thing is lighter. The switch rows (`.flow-volta-toggle-row`: Alternate ending, Start intro / End intro early) are `--container-bg` with an `--input-border` outline - only the switch is tappable; the bar-range badge in pop-up titles (`.flow-modal-bar-pill`) is a label, so transparent with an outline. A chip made entirely of buttons (the saved time signature: pick it, or × to remove it) stays `--input-bg`, because all of it is tappable.

**Pauses and Ramps pop-ups (ML-281):** each field is a `.flow-pause-field-card` - a display box, so `--container-bg` with an `--input-border` outline. Only what you tap is lighter: the − / + circles (`.metro-bpm-step`) and the choice buttons (`.flow-pause-kind-btn`: `--input-bg` with a 2px `--control-border` edge, gold when selected). Never give the card itself `--input-bg` - that's the "you can tap this" surface ([color](../foundations/color.md)).

## 6. States
Tiles: default / selected (see [selectable-tile](selectable-tile.md)). Blocks: default / animating (`.flow-block-animating`). 2- and 4-column tiles: default / held (`.flow-bar-grid-tile-held`: gold edge and `--shadow-lg`) / shuffling (`.flow-bar-grid-tile-shuffling`). 2-column tiles also have needs-updating (`.flow-bar-detail-tile-warning`). Any Bars-tab bar: has a review issue (`.flow-block-has-issue`). Popup buttons: default / disabled (see above) / warning (`.flow-warning-icon`, `--warning-color`). Upload: idle / in progress / error.

## 7. Code example
```html
<div class="flow-card">
  <label>Title <span class="flow-required">*</span></label>
  <input type="text">
  <span class="flow-help-text">Shown in your Flow list.</span>
  <div class="flow-action-row"><button class="flow-action-btn"><span class="material-symbols-outlined">edit</span> Edit details</button><button class="flow-action-btn"><span class="material-symbols-outlined">ios_share</span> Export</button></div>
</div>
```

## 8. Cross-references
[selectable-tile](selectable-tile.md) · [card](card.md) · [tabs](tabs.md) · [metronome](metronome.md) · [modal](modal.md)

## 9. Accessibility
- Every block/fermata/ramp gesture has a ⋮ menu alternative (Delete, Move up/down). In 2 and 4 columns, the alternative to press-and-hold drag is the bar popup's Move earlier / Move later. A 2-column tile's accessible name is "Edit [mark,] Bars 1–8", with " - needs updating" added when it's red.
- The layout switch is two `aria-pressed` buttons in a labelled group. The popup is a `role="dialog"` labelled by the bar name. Its ✕ carries `data-modal-close`, so Escape closes it. When the popup re-renders, focus returns to the ‹, › or Move button you used.
- Picker tiles and choice options follow selectable-tile; value boxes declare `aria-haspopup="dialog"`.
- The consistency review is a `role="dialog"`. Its ✕ is the `.modal-close-x` that Escape uses, so Escape just closes it and doesn't navigate. Each problem is a real `<button>` with its full sentence as its name. Problems are told apart by their words, not only by the outline colour.

See [accessibility foundation](../foundations/accessibility.md).
