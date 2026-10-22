# The band leader's summary

## 1. Metadata
- **Name:** The band leader's summary (`#bandSummaryView`; `.band-summary-cell`, `.is-empty`, `.band-summary-range`,
  `.band-summary-avg` inside the Level map's grid, `.level-map`)
- **Category:** Data display
- **Status:** New (ML-581)

## 2. Overview
What a band's **band leader** sees for one of the band's own pieces: how the players who chose to share their Levels
are getting on - **never anyone by name or on their own** (product value 2, the owner's decisions of 22 Oct 2026;
rules in `docs/practice-sessions.md`, "The band leader's summary").
- Opened from a band piece's ⋮ menu in My music, **Band summary** - only for the band's band leader, with
  `band_levels_summary` on.
- **The piece:** "Average Level 2.6, from Level 1.5 to Level 4."
- **Needs the most work:** up to three runs of bars, lowest first - "**Bars 32-40** - average Level 1.4". Words
  about the music, never about players. "Every bar is at full speed." when none is below Level 5.
- **Bar by bar:** a column per bar in the Level map's rows of 10, with the row's bar numbers on the left
  (`.level-map-bars`). Levels 1 to 5 run bottom to top, a fifth each: the column is shaded from the lowest Level to
  the highest, in the colour of the average Level (`.lv-N`), with a line at the average. A bar without 3 players'
  Levels is a dashed empty column. The Level key (`.level-legend`) is under it.
- **Not enough yet:** below 3 players nothing is drawn - "Not enough players have shared their Levels on this piece
  yet. It shows once 3 have." No count of how many have.
- **Don't use** it for a player's own Levels (their heat map, `level-map.md`), or for anything that names a player.

## 3. Anatomy
`#bandSummaryView` › `p.metro-help-text` (whose Levels it is made from) › `#bandSummaryNotYet` (when too few) ›
`#bandSummaryBody`: `h2.section-title` "The piece" › `p` › `h2.section-title` "Needs the most work" › a `p` per run ›
`h2.section-title` "Bar by bar" › help line › `.level-map[role=img]` › per row `.level-map-bars` + 10 ×
`.band-summary-cell` (› `.band-summary-range.lv-N` + `.band-summary-avg`, or `.is-empty`) › `.level-legend`.

## 4. Tokens used
| Token | Use |
|---|---|
| `--band-summary-cell-height` | one bar's column (40px) |
| `--band-summary-line` | the average's line (2px) |
| `--input-bg` | the column's empty part |
| `--level-unset-border` | the column's outline, the shading's top and bottom edge, an empty bar's dashes |
| `--level-1` ... `--level-5` (`.lv-N`) | the shading, in the colour of the bar's average Level |
| `--text-color` | the average's line |
| `--radius-2xs` | the column's corners |

## 5. Props / API
- app.js: `openBandSummary(id)`, `renderBandSummary()`, `bandSummaryOn()`; the menu item `#flowLibraryItemMenuBandSummary`
  (`flowLibraryMenuItemsFor`: a band piece, `isBandLeader`, the feature on).
- `GET /api/flows/:id/band-summary` → `{ title, totalBars, minimum, enough, piece: { avg, lo, hi } | null,
  bars: [{ avg, lo, hi } | null], mostWork: [{ from, to, avg }] }` - numbers only; nothing about who
  (`server/services/bandLevelsSummary.js`). 403 for anyone but the band leader.
- Run-time positions are custom properties set from `data-*` after the markup is drawn: `--lo`, `--hi` (whole Levels)
  on `.band-summary-range`, `--avg` on `.band-summary-avg`.

## 6. States
- **Enough players:** the piece, the bars needing most work, the map and its key.
- **Not enough players:** only `#bandSummaryNotYet`.
- **A bar with fewer than 3 players' Levels:** `.band-summary-cell.is-empty` (dashed, nothing in it).
- **Every bar at full speed:** "Every bar is at full speed." under Needs the most work.
- **Loading:** the help line says "Loading..."; an error is a toast.

## 7. Code example
```html
<div class="level-map" role="img" aria-label="Bar by bar: 8 of 10 bars have a summary; the most work is in bars 3-4 (average Level 1.4).">
  <span class="level-map-bars" aria-hidden="true">1<span class="level-map-bars-to"> - 10</span></span>
  <span class="band-summary-cell"><span class="band-summary-range lv-3" data-lo="2" data-hi="4"></span><span class="band-summary-avg" data-avg="2.7"></span></span>
  <span class="band-summary-cell is-empty"></span>
</div>
```

## 8. Cross-references
[level-map](level-map.md) (the grid, the colours and the key), [band-members](band-members.md) (the band leader and
the player's switch), `docs/practice-sessions.md`, `docs/product-values.md` value 2.

## 9. Accessibility
- **Never colour alone.** Where a column's shading sits says the Levels (bottom to top, 1 to 5), and the help line
  says how to read it; the colour only repeats the average. Everything the picture shows is also in words above it:
  the piece's average and range, and the bars needing the most work with their averages.
- The map is `role="img"` with an `aria-label` that says how many bars have a summary and where the most work is, so
  a screen reader doesn't read out a column per bar. The row numbers are `aria-hidden`.
- **Display only, not tap targets** - a column is far below 44px on a long piece.
- **Contrast:** the column outline, the shading's edges and an empty bar's dashes are `--level-unset-border` (3:1 on
  the page, as the Level map's unset bar); the average's line is `--text-color` (no new colour pairs). No gestures.
