# Radio group

## 1. Metadata
- **Name:** Radio group (`.radio-group`, `.radio-group.compact`, `.is-segmented`, `.is-tiles`, `.is-fit`, `.is-centred`)
- **Category:** Inputs
- **Status:** Stable

## 2. Overview
Segmented buttons for picking one of 2-8 short text options inside a form (session category,
duration). **Don't use** for options that need an icon/illustration or a second line. Use
[selectable-tile](selectable-tile.md) for those.

## 3. Anatomy
`.radio-group` (wrapping flex) › (`input[type=radio]` hidden + `label`) × n. `.compact` is four per row on a wide screen, three on a phone - so it suits exactly three options there; use the standard (two per row) for two or four options rather than wrapping 3 + 1.

**Variants (ML-359, Display and reading):**
- `.is-segmented` - two or three options in one inset bar (`--input-bg`, `--input-border`); the chosen one is a raised `--container-bg` button with the gold outline (Theme: Light / Dark).
- `.is-tiles` - colour tiles, three to a row, each filled with its colour (`.bg-swatch`, see [display-and-reading](display-and-reading.md)); the chosen one gets `--selected-ring-inset` and a tick, and keeps its own colour instead of the gold wash.
- `.is-fit` (with `.compact`) - each option as wide as its words; a long one takes its own row rather than breaking.
- `.is-centred` - words centred up and down, for options drawn at different sizes.

**Multi-select variant (ML-260):** the same markup with `input[type=checkbox]` - identical look, several can be on (Theory's Clef option). Keep at least one on when the choice needs one: re-check the last box if it's unticked.

## 4. Tokens used
`--control-border` (unselected edge), `--primary-action-strong` (selected outline + text), `--primary-action-tint` (selected wash),
`--radius-md`, `--space-2` (gap), `--space-3` (padding), `--font-base`, `--font-weight-bold`,
`--duration-base`.

## 5. Props / API
Standard radio `name`/`value`. Read with `querySelector('input[name=…]:checked')`.

## 6. States
Unselected (`--control-border` outline) · Selected (the shared gold pattern: `--primary-action-strong` outline + `--primary-action-tint` wash + `--primary-action-strong` text - same as [selectable-tile](selectable-tile.md); the old blue fill was removed in ML-218) · Focus-visible (`--focus-ring` on the label) · Disabled (`--opacity-disabled`).

## 7. Code example
```html
<div class="radio-group">
  <input type="radio" id="c1" name="cat" value="Practise" checked><label for="c1">Practice</label>
  <input type="radio" id="c2" name="cat" value="Lesson"><label for="c2">Lesson</label>
</div>
```

## 8. Cross-references
[selectable-tile](selectable-tile.md) · [filter-strip](filter-strip.md) · [form-field](form-field.md)

## 9. Accessibility
- Real `<input type="radio">` + `<label for>`; the input is visually hidden but still focusable - arrow keys move between options natively.
- Focus ring is drawn on the label. Selected = filled (not colour alone: text colour and border change too).

See [accessibility foundation](../foundations/accessibility.md).
