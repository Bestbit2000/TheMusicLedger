# Tool icon button

## 1. Metadata
- **Name:** Tool icon button (`.tool-group`, `.tool-group-title`, `.tool-icon-row`, `.tool-icon-btn`, `.tool-icon-label`, `.tool-icon-svg`)
- **Category:** Navigation
- **Status:** Stable

## 2. Overview
Square launcher tiles on the home screen for the practice tools (Timer, Metronome, Tuner, Quick
play, Flow…). **Don't use** for in-page actions. They always navigate to a tool.

**Tool groups (2026-09-26):** the home tools sit in three groups under the Tools heading, each a `.tool-group`
with a small label (`.tool-group-title`: `--font-sm` bold, `--label-color`) over its own 4-column `.tool-icon-row`:
**Everyday** (Metronome, Tuner, Timer - used alongside everything else), **Practise** (Rehearse, Warm-ups,
Scales) and **Learn** (Theory, Pitch, Tempo, Pulse). A group hides when none of its tools are on
(`renderToolGroups`), and the ☰ menu's tools are one labelled row per group (`renderNavToolsRow`).

## 3. Anatomy
`.tool-icon-row` (4-column grid) › `.tool-icon-btn` (1:1 square) › icon (Material Symbol, inline `.tool-icon-svg`, or a Bravura glyph from [notation](notation.md) given the `.tool-icon-svg` class, like Theory's treble clef) › `.tool-icon-label`

## 4. Tokens used
`--nav-action`, `--nav-action-text`, `--radius-md`, `--space-1` (icon↔label), `--space-2` / `--space-1` (padding, vertical / horizontal: narrow sides so "Metronome" fits and all tiles stay equal width on a phone),
`--space-3` (row gap), `--space-4` (row margin), `--icon-xl`, `--font-sm`, `--font-weight-bold`.

## 5. Props / API
- Custom SVG glyphs are inlined (not `<img>`) so `fill: currentColor` follows the theme. JS adds the `viewBox`.
- The row is a 4-column grid (`repeat(4, minmax(0, 1fr))`, ML-260): a 5th tool (Theory) starts a second row in the same columns, so every tile keeps lining up with the Progress grid. Never make a row of 5 narrower tiles.
- The `--space-3` row gap is the home screen's gutter. The Progress [stat-card](stat-card.md) grid
  below uses the same gap, so its middle gap lines up with this row's centre gap. Change both together or neither.

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
