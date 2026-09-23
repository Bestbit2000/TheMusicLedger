# Selectable tile

## 1. Metadata
- **Name:** Selectable tile (`.flow-picker-tile`, `.flow-choice-option`, `.metroSeg-tap-btn`, `.metroSeg-row-tile`, `.metro-beats-option`, `.flow-tile-grid`, `.metroSeg-tile-grid`)
- **Category:** Inputs
- **Status:** Stable. Four class families share one visual pattern and should converge on it

## 2. Overview
A tappable option card for choosing a value that needs more than a word: a note value glyph, a
time signature, a block type, a repeat mode. Laid out in a grid (`.flow-tile-grid`) or as a list
(`.flow-choice-option`, `.metroSeg-row-tile`). **Don't use** for plain short text options in a form
(use [radio-group](radio-group.md)) or for actions ([button](button.md)).

## 3. Anatomy
Grid tile: container › glyph/icon › value (`strong`) › caption (`.flow-picker-tile-label`).
List option: container › text › trailing check icon (`material-symbols-outlined`, gold).

## 4. Tokens used
`--input-bg`, `--input-border`, `--text-color`, `--label-color`, `--primary-action`,
`--primary-action-tint`, `--radius-md` (tap tiles, row tiles) / `--radius-lg` (picker tiles, choice
options), `--space-1`…`--space-4`, `--font-sm`, `--font-md`, `--font-weight-bold`,
`--duration-fast`.

## 5. Props / API
Selection is a `.selected` class toggled by JS. Keep exactly one selected in a single-choice set.
The multi-select variant (`.flow-multiselect-grid`) allows many.

**Number/value first, label underneath (ML-203).** Every box that pairs a value with a label (tiles, value boxes, stat cards, admin stat tiles) shows the value on top and the caption below it.

**No dropdown carets (ML-205).** A control that opens one of these tile pickers is itself a tile (see the Flow block tiles and the metronome value boxes), not a dropdown, so it never shows a ▾ arrow. The same goes for the top-bar timer pill, which opens the timer popup. There are no dropdown carets anywhere in the app.

## 6. States
| State | Treatment |
|---|---|
| Default | 2px `--input-border` outline on `--input-bg` |
| Selected | Outline `--primary-action` + background `--primary-action-tint` + text `--primary-action` (all three, always) |
| Focus | `--focus-ring` |
| Disabled | `--opacity-disabled`, `cursor: not-allowed` |

## 7. Code example
```html
<div class="flow-tile-grid" style="grid-template-columns: repeat(4, 1fr)">
  <button class="flow-picker-tile selected"><strong>4/4</strong><span class="flow-picker-tile-label">Common</span></button>
  <button class="flow-picker-tile"><strong>3/4</strong><span class="flow-picker-tile-label">Waltz</span></button>
</div>
```

## 8. Cross-references
[radio-group](radio-group.md) · [flow-editor](flow-editor.md) · [color: the selected pattern](../foundations/color.md)

## 9. Accessibility
- Tiles are `<button>`s with a name that includes the value ("Crotchet", "4/4 time"); selected tiles set `aria-pressed="true"` (or are in a radio-like group).
- Selected = strong-gold outline + tint + strong-gold text (never colour alone). Tappable edge is `--control-border`.

See [accessibility foundation](../foundations/accessibility.md).
