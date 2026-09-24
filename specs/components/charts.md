# Charts (heatmap + bar chart)

## 1. Metadata
- **Name:** Charts (`.heatmap-*`, `.heat-col`, `.heat-cell`, `.h-time-0..4`, `.h-sess-0..4`, `.chart-wrapper`, `.chart-bar*`, `.chart-y-axis*`, `.chart-x-label`, `.grid-line`, `.scroll-wrapper`, `.scroll-btn`, `.month-nav`, `.section-title`, `.h-time-*`, `.h-sess-*`, `.month-*`, `.year-spacer`, `.chart-*`)
- **Category:** Data visualisation
- **Status:** Stable

## 2. Overview
The GitHub-style practice heatmap (time or session count) and the horizontally scrolling bar
charts on the stats screens. **Don't** introduce a chart library, and don't use these colours outside charts.

## 3. Anatomy
Heatmap: `.heatmap-scroll-wrapper` › `.heatmap-daylabels` + `.heatmap-wrapper` › `.heatmap-container` › `.heat-col` × weeks › `.heat-cell.h-time-N` × 7 · `.heatmap-legend`.
Bar chart: `.chart-wrapper` › `.chart-y-axis` (sticky) + `.chart-grid-lines` + `.chart-scroll-area` › `.chart-bar-container` › `.chart-bar` + `.chart-x-label`.
Section header: `.section-title` (title + optional action, bottom rule).

## 4. Tokens used
`--heat-time-0..4`, `--heat-sess-0..4`, `--cat-*`, `--chart-hours`, `--chart-days`, `--chart-sessions`, `--chart-streak`,
`--label-color` (axes, legends), `--input-border` (grid lines, section rule), `--container-bg`
(scroll buttons), `--secondary-color` (month nav), `--radius-2xs` (cells, bar tops), `--radius-md`,
`--radius-circle`, `--shadow-sm`, `--z-base`, `--z-raised`, `--z-sticky`, `--z-float`,
`--space-0-5`, `--space-1`, `--space-2`, `--space-4`, `--space-6`, `--space-7`, `--font-2xs`,
`--font-xs`, `--font-sm`, `--font-md`, `--duration-slow`, `--duration-base`.

## 5. Props / API
- Bar heights/widths and cell positions are data-driven geometry set by JS. Those are fine as raw values.
- **Colour rule (ML-235):** a chart that counts every session type (both heatmaps, the Hours/Days/Sessions bar charts, both streak histograms) uses the brand gold - the `--heat-*` gold ramp or `--chart-*` gold - never a `--cat-*` hue, since those mean "this session type only" everywhere else (filter pills, history rows). `--cat-*` is only for a chart split by type.
- Bar colours come from tokens: set `bar.style.background = 'var(--chart-hours)'`, never a hex.
- Tapping a bar/cell calls `showAnchoredPopup`.
- Scroll buttons appear on hover-capable devices only.

## 6. States
Cell/bar default · Tapped (popup shown) · Blank cell (`.blank`, transparent).

## 7. Code example
```js
bar.style.background = 'var(--chart-days)';
```

## 8. Cross-references
[anchored-popup](anchored-popup.md) · [stat-card](stat-card.md) · [filter-strip](filter-strip.md) · [color](../foundations/color.md)

## 9. Accessibility
- Charts are visual summaries - every value must also be reachable as text (stat cards, history list, tap popup).
- Heatmap/bar colours are data-viz tokens; the legend explains the scale in words ("Less … More").

See [accessibility foundation](../foundations/accessibility.md).
