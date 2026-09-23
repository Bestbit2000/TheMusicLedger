# Stat card

## 1. Metadata
- **Name:** Stat card (`.dashboard-grid`, `.stat-card`, `.stat-card.clickable`, `.label`, `.value`, `.sess-count`; admin: `.admin-stat-tiles`, `.admin-stat-tile*`)
- **Category:** Data display
- **Status:** Stable

## 2. Overview
A compact labelled number (total time, current streak, sessions this month) in a two-column
grid on the home and stats screens. **Don't use** for anything that needs more than a value and a
short caption. Use a [card](card.md).

## 3. Anatomy
`.dashboard-grid` (2 cols) › `.stat-card`, displayed **number first** (ML-203): `.value` (tabular numbers) › optional `.sess-count` detail › `.label` (fixed two-line height so rows align, ML-134).
The markup stays label-first (`.label`, `.value`, `.sess-count`) for screen readers; CSS `order` puts the number on top. Admin `.admin-stat-tile` follows the same order: value › sub › label.

## 4. Tokens used
`--container-bg` (display card), `--input-bg` (`.clickable` card only), `--input-border`, `--text-color`, `--label-color`, `--radius-md`, `--space-1`,
`--space-2`, `--space-3`, `--space-4`, `--font-sm`, `--font-md`, `--font-weight-bold`,
`--font-weight-normal`, `--duration-fast`.

## 5. Props / API
- **Display by default.** A plain `.stat-card` sits on `--container-bg` (the same surface as the page) with a 1px `--input-border` outline, so it never looks tappable (ML-200).
- `.clickable` for cards that drill into detail. It switches to the tappable `--input-bg` surface and adds the press scale. Never give a card `.clickable` unless it actually has a click handler.
- Labels are written in sentence case in HTML. `::first-letter` can't be used inside the flex label.

## 6. States
Display (`--container-bg`) · Clickable (`--input-bg`) · Clickable active (`transform: scale(0.98)`) · Focus (`--focus-ring`).

## 7. Code example
```html
<div class="dashboard-grid">
  <div class="stat-card clickable"><div class="label">Total time</div><div class="value">12h 30m</div></div>
</div>
```

## 8. Cross-references
[card](card.md) · [charts](charts.md) · [admin-shell](admin-shell.md)

## 9. Accessibility
- Display cards are plain divs. Clickable ones (home screen) are `<button class="stat-card clickable">` with `<span>` children.
- DOM order stays label-then-value (read "Total time, 12h 30m"); CSS order shows the number first (ML-203).

See [accessibility foundation](../foundations/accessibility.md).
