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

**Grid alignment.** Put a set of related cards in **one** `.dashboard-grid` and let it wrap onto
new rows. Don't stack one grid per row. The grid has:
- `grid-auto-rows: 1fr`, so every row is as tall as the tallest card and the rows always match.
- one `--space-3` gap for both rows and columns, the same gutter as the [tool icon row](tool-icon-button.md).
  On the home screen this lines the middle Progress gap up with the Flow/Tuner gap above it, and the
  gap between rows matches.

Stacked grids get a `--space-4` gap between rows (the grid margin) and size each row separately, so they drift
out of line. Only start a new grid for a different kind of stat (e.g. Streaks' "Longest" row, whose
cards carry a date line). The gap stays `--space-3` at every breakpoint, with no smaller gap on mobile.
The markup stays label-first (`.label`, `.value`, `.sess-count`) for screen readers; CSS `order` puts the number on top. Admin `.admin-stat-tile` follows the same order: value › sub › label.

## 4. Tokens used
`--container-bg` (display card), `--input-bg` (`.clickable` card only), `--input-border`, `--text-color`, `--label-color`, `--radius-md`, `--space-1`,
`--space-2`, `--space-3` (grid gap, rows and columns: matches `.tool-icon-row`), `--space-4` (grid margin), `--font-sm`, `--font-md`, `--font-weight-bold`,
`--font-weight-normal`, `--duration-fast`.

## 5. Props / API
- **Display by default.** A plain `.stat-card` sits on `--container-bg` (the same surface as the page) with a 1px `--input-border` outline, so it never looks tappable (ML-200).
- `.clickable` for cards that drill into detail. It switches to the tappable `--input-bg` surface and adds the press scale. Never give a card `.clickable` unless it actually has a click handler.
- Labels are written in sentence case in HTML. `::first-letter` can't be used inside the flex label.

## 6. States
Display (`--container-bg`) · Clickable (`--input-bg`) · Clickable active (`transform: scale(0.98)`) · Focus (`--focus-ring`).

## 7. Code example
```html
<!-- One grid for all four cards: two equal-height rows, with a --space-3 gap in both directions -->
<div class="dashboard-grid">
  <button type="button" class="stat-card clickable"><span class="label">Total time</span><span class="value">12h 30m</span></button>
  <button type="button" class="stat-card clickable"><span class="label">Total sessions</span><span class="value">128</span></button>
  <button type="button" class="stat-card clickable"><span class="label">Current practise streak</span><span class="value">5 days</span></button>
  <button type="button" class="stat-card clickable"><span class="label">Current playing streak</span><span class="value">9 days</span></button>
</div>
```

## 8. Cross-references
[card](card.md) · [charts](charts.md) · [admin-shell](admin-shell.md)

## 9. Accessibility
- Display cards are plain divs. Clickable ones (home screen) are `<button class="stat-card clickable">` with `<span>` children.
- DOM order stays label-then-value (read "Total time, 12h 30m"); CSS order shows the number first (ML-203).

See [accessibility foundation](../foundations/accessibility.md).
