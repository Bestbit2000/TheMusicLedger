# Charts (heatmap + bar chart)

## 1. Metadata
- **Name:** Charts (`.heatmap-*`, `.heat-col`, `.heat-cell`, `.h-time-0..4`, `.h-sess-0..4`, `.chart-wrapper`, `.chart-bar*`, `.chart-y-axis*`, `.chart-x-label`, `.grid-line`, `.scroll-wrapper`, `.scroll-btn`, `.month-nav`, `.section-title`, `.h-time-*`, `.h-sess-*`, `.month-*`, `.year-spacer`, `.chart-*`, `.series-*` (`.series-hours`, `.series-days`, `.series-sessions`, `.series-streak`))
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
- **Colour and geometry (ML-288):** a chart's colour is a `.series-*` class on the bar, projection or legend swatch (it sets `--series`). Heights and positions are custom properties set by the renderer: `--bar-h` on `.chart-bar` / `.chart-bar-projection`, `--line-pos` on `.grid-line` / `.chart-y-label`. `.grid-line.is-baseline` hides the 0 line. The year under a January label is `.chart-x-year`.
- Bar heights/widths and cell positions are data-driven geometry set by JS. Those are fine as raw values.
- **Colour rule (ML-235):** a chart that counts every session type (both heatmaps, the Hours/Days/Sessions bar charts, both streak histograms) uses the brand gold - the `--heat-*` gold ramp or `--chart-*` gold - never a `--cat-*` hue, since those mean "this session type only" everywhere else (filter pills, history rows). `--cat-*` is only for a chart split by type.
- Bar colours come from tokens: set `bar.style.background = 'var(--chart-hours)'`, never a hex.
- Tapping a bar/cell calls `showAnchoredPopup`.
- **Projected month (ML-186):** on the detailed stats page's Hours, Days of activity and Monthly session count charts, the **current month** also gets a "carry on at this rate" projection: the figure so far × days in the month ÷ days gone so far (today counts as gone).
  - It's drawn as `.chart-bar-projection`, a **hollow, outline-only** bar in the chart's own `--chart-*` colour (set as `borderColor` from JS). It's stacked directly on top of the real bar, with no bottom edge. The real bar takes `.chart-bar-under-projection`, which squares off its top so the two read as one bar.
  - It's shown only while the projection is higher than the figure so far, so on the last day of the month, or with nothing logged yet, there's no outline.
  - It counts towards the chart's scale, so it never runs off the top.
  - The tap popup reads e.g. "Sep 2026: 14.8 hours so far, on track for 18.4 hours".
  - It's not used on any other chart.
  - **Key:** while a chart draws a projection, a `.chart-legend` sits under it, right-aligned like `.heatmap-legend`. It has a solid swatch labelled "Actual" and an outline swatch (`.chart-legend-swatch-projected`, a full border) labelled "Projected", both in that chart's `--chart-*` colour. `renderBarChart` hides it (`hidden-group`) whenever there's no projection: setting off, last day of the month, or nothing logged yet.
  - People can turn it off at **Settings → Stats → "Show this month's projection on charts"**. It's on by default and saved on that device only (`localStorage` key `statsShowProjection`, checked by `statsShowProjection()`), like dark mode and the tuner's display options. Changing it redraws the charts straight away.
- Scroll buttons appear on hover-capable devices only.

## 6. States
Cell/bar default · Tapped (popup shown) · Blank cell (`.blank`, transparent) · Current month with projection (`.chart-bar-projection` over `.chart-bar-under-projection`).

## 7. Code example
```js
bar.style.background = 'var(--chart-days)';
```

## 8. Cross-references
[anchored-popup](anchored-popup.md) · [stat-card](stat-card.md) · [filter-strip](filter-strip.md) · [color](../foundations/color.md)

## 9. Accessibility
- Charts are visual summaries - every value must also be reachable as text (stat cards, history list, tap popup). The projected figure is in the current month's tap popup.
- Heatmap/bar colours are data-viz tokens; the legend explains the scale in words ("Less … More").

See [accessibility foundation](../foundations/accessibility.md).
