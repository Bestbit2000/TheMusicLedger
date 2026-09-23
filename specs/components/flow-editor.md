# Flow editor

## 1. Metadata
- **Name:** Flow editor (`.flow-card`, `.flow-edit-tabs`, `.flow-block-box`, `.flow-tile-grid`, `.flow-tile-value`, `.flow-picker-tile`, `.flow-choice-option`, `.flow-multiselect-grid`, `.flow-volta-bracket`, `.flow-intro-bracket`, `.flow-fermata-box`, `.flow-ramp-box`, `.flow-pause-*`, `.flow-media-item`, `.flow-doc-item`, `.flow-upload-progress`, `.flow-from-file-banner`, `.flow-sign-svg`, `.flow-action-row`, `.flow-help-text`, `.flow-required`, `.flow-pill`, and every other `.flow-*` sub-part)
- **Category:** Feature area
- **Status:** Stable (ML-179, ML-204). Read [docs/flow-musicxml.md](../../docs/flow-musicxml.md) before touching import/export

## 2. Overview
Create/edit a Flow: metadata, recordings and documents, and the block editor (bars, time
signatures, tempo ramps, fermatas, voltas, jump signs). Built from the shared components.
Before adding a new `.flow-*` class, check whether a [selectable tile](selectable-tile.md),
[card](card.md), [pill](pill-badge.md) or [tab](tabs.md) already does the job.

## 3. Anatomy
Screen › `.flow-edit-tabs` › `.flow-card` sections › (block editor) `.flow-blocks-card` › `.flow-block-box` × n › `.flow-tile-grid` of tiles › modals with `.flow-picker-tile` / `.flow-choice-option` pickers › `.flow-action-row`.

## 4. Tokens used
All of: `--container-bg`, `--input-bg`, `--input-border`, `--primary-action`, `--primary-action-tint`,
`--label-color`, `--text-color`, `--warning-color`, `--danger-color`, `--radius-md`/`-lg`/`-xl`/`-pill`,
`--space-*`, `--font-xs`…`--font-lg`, `--font-music` (jump signs), `--duration-base` (block animations).

## 5. Props / API
`.flow-action-btn` (in a `.flow-action-row`, or full width with `.flow-action-btn-wide`) is the Flow editor's icon + label action tile: `--input-bg`, 2px `--input-border`, `--font-sm` bold. It's for secondary Flow actions (upload, export, edit details). Save/Cancel still use the standard [buttons](button.md).
The rehearsal-mark box in each block header (`.flow-block-mark-box` / `.flow-block-mark-empty`) grows with its text and is the part of the header that truncates ("…") if space runs out - the "Bars X" name never wraps. Empty, it reads "+ RM" (ML-219).
**Bar counts never include the lead-in** (it is a count-in, not part of the piece) - the library row, the Bars-tab summary, the Details summary and the admin Flows list/import preview all count only real blocks. The runtime estimate does include the lead-in, since it plays.
Block colours and volta/intro bracket geometry are computed in JS. Geometry may be inline, but colours must reference tokens.

## 6. States
Tiles: default / selected (see [selectable-tile](selectable-tile.md)). Blocks: default / animating (`.flow-block-animating`) / warning (`.flow-warning-icon`, `--warning-color`). Upload: idle / in progress / error.

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
- Every block/fermata/ramp gesture has a ⋮ menu alternative (Delete, Move up/down).
- Picker tiles and choice options follow selectable-tile; value boxes declare `aria-haspopup="dialog"`.

See [accessibility foundation](../foundations/accessibility.md).
