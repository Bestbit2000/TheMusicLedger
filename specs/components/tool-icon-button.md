# Tool icon button

## 1. Metadata
- **Name:** Tool icon button (`.tool-icon-row`, `.tool-icon-btn`, `.tool-icon-label`, `.tool-icon-svg`)
- **Category:** Navigation
- **Status:** Stable

## 2. Overview
Square launcher tiles on the home screen for the practice tools (Timer, Metronome, Tuner, Quick
play, Flow…). **Don't use** for in-page actions. They always navigate to a tool.

## 3. Anatomy
`.tool-icon-row` (flex row) › `.tool-icon-btn` (1:1 square) › icon (Material Symbol or inline `.tool-icon-svg`) › `.tool-icon-label`

## 4. Tokens used
`--nav-action`, `--nav-action-text`, `--radius-md`, `--space-1` (icon↔label), `--space-2` (padding),
`--space-3` (row gap), `--space-4` (row margin), `--icon-xl`, `--font-sm`, `--font-weight-bold`.

## 5. Props / API
- Custom SVG glyphs are inlined (not `<img>`) so `fill: currentColor` follows the theme. JS adds the `viewBox`.
- Tiles share the row equally (`flex: 1 1 0`). Keep 3-4 per row.

## 6. States
Default / Active (native press) / Focus (`--focus-ring`). No disabled or error state: hide a tool rather than disable it.

## 7. Code example
```html
<div class="tool-icon-row">
  <button class="tool-icon-btn"><span class="material-symbols-outlined">timer</span><span class="tool-icon-label">Timer</span></button>
</div>
```

## 8. Cross-references
[button](button.md) · [icon-button](icon-button.md)

## 9. Accessibility
- A `<button>` whose visible label is its name - keep the label text, don't hide it.
- Icon is decorative (Material Symbol ligature text is ignored as a name).

See [accessibility foundation](../foundations/accessibility.md).
