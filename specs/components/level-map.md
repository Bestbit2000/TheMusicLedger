# Level map (practice Levels)

## 1. Metadata
- **Name:** Level map (`.level-map`, `.level-map-bars`, `.level-map-bars-to`, `.level-cell`, `.lv-0`, `.lv-1`, `.lv-2`, `.lv-3`, `.lv-4`, `.lv-5`, `.is-marked`, `.level-strip`, `.level-legend`, `.level-chip`, `.level-picker`, `.level-pick`, `.level-row-body`, `.level-row-selected`, `.level-answer`, `.level-fit-warn`, `.level-notice`)
- **Category:** Data display / inputs
- **Status:** New (ML-316, epic ML-314)

## 2. Overview
A piece's practice **Levels 1-5**, bar by bar. Level 1 is the slowest speed and Level 5 is full speed.
The colours run from silver to gold: the brighter the square, the better you can play those bars.
Used on the **My Levels** screen (`#pieceLevelsView`, opened from Play Flow's ⋮ menu). Later it will
also appear on practice lists (the strip) and in a practice session.

- **Use** it only for the practice Levels 1-5, and the same scale for Skills steps later (ML-321).
- **Don't use** it for the Stats practice heatmap. That counts time, not how well you play, and
  uses `--heat-*`. See [charts](charts.md).

## 3. Anatomy
- **Map:** `.level-map` › `.level-cell.lv-N` × bars, **10 bars a row** (ML-336), as bars are counted in
  music. Each row starts with `.level-map-bars`, the row's bars ("1 - 10", "11 - 20"...); when the map
  is too narrow (a container query at 300px) `.level-map-bars-to` hides and it reads just "1", "11".
  The Level number is inside each square, and an unset bar is empty with a dashed outline.
  - `.is-marked` rings the bars being edited: the hard passage being added, or the chunk selected.
- **Strip:** `.level-strip` › `.level-cell.lv-N` × bars. One thin row with no numbers, for list rows.
  In a strip an unset bar is a plain `--level-unset-border` fill, not a dashed outline - a long piece's
  outlines pushed the strip off the page (ML-334). The strip never overflows its row.
- **Legend:** `.level-legend` › `span` › `.level-cell` + label.
- **Chip:** `.level-chip.lv-N`, the Level at the start of a chunk / hard-passage row. The row is a
  `.history-item` with a `.level-row-body` button (the chip plus text) and any action buttons.
- **Picker:** `.level-picker` › `.level-pick.lv-N` × 5. Each button shows the number and, under it
  (`small`), that Level's speed as a % of the piece's tempo.
- **Selected row:** `.history-item.level-row-selected` (gold border and focus ring). The Level picker opens straight under it.
- **Setup answers:** the three "How well can you play it?" answers are `.flow-choice-option.level-answer` buttons: full width, left-aligned title and caption.
- **Fit line:** "0:32 a run · 8× in a 5-minute block". It turns amber (`.level-fit-warn`) when the
  chunk plays fewer than 3 times.
- **Notice:** `.level-notice`, the amber "bars have changed" message.

## 4. Tokens used
- **Colours:**
  - fills `--level-1`…`--level-5`, with text `--level-1-text`…`--level-5-text`
  - `--level-unset-border` for unset bars
  - `--status-amber-bg` and `--status-amber-fg` for the notice and fit warning
  - `--label-color`
  - `--primary-action-strong` and `--focus-ring` for the selected state
- **Sizes:** `--level-cell-size`, `--level-strip-height`, `--icon-md` (legend squares),
  `--icon-xl` (chip), `--touch-target`
- **Spacing and shape:** `--space-0-5`…`--space-4`, `--radius-2xs` (squares), `--radius-xs` (chip),
  `--radius-md` (picker buttons, notice)
- **Type:** `--font-xs`, `--font-sm`, `--font-md`, `--font-weight-*`, `--line-height-tight`

Dark mode remaps the Level fills in `tokens.css`. Levels 1 and 3 switch to white numbers, and gold
stays the brightest.

## 5. Props / API
- `lv-0` means not set. `lv-1`…`lv-5` is the Level.
- The map is built by `renderPieceLevels` (app.js) from `FlowJourney.barLevels(totalBars, chunks)`.
  Where chunks overlap, the narrowest wins.
- The picker's %s come from `FlowJourney.levelPercents(slowestTempo)`.
- Fit comes from `FlowJourney.chunkFit`, and the split from `suggestSplit`.
- The rules are in docs/flow-journey.md, "Practice Levels".
- The picker marks its choice with `.selected` plus `aria-pressed`.

## 6. States
| State | Treatment |
|---|---|
| Not set | Transparent square with a 1px dashed `--level-unset-border` |
| Level 1-5 | Fill `--level-N`, number `--level-N-text` |
| Marked (being edited) | `--focus-ring` around the squares |
| Picker chosen | 2px `--primary-action-strong` border and `--focus-ring` |
| Too long for a block | Fit line in `--status-amber-fg`, bold, with a "Split into N" button on the row |
| Focus | The global `--focus-ring` |

## 7. Code example
```html
<div class="level-map" role="img" aria-label="Levels by bar: 4 bars at Level 1, 8 bars at Level 2, 2 not set">
  <span class="level-cell lv-1">1</span><span class="level-cell lv-2 is-marked">2</span><span class="level-cell lv-0"></span>
</div>
<div class="level-picker" role="group" aria-labelledby="levelsWholeLabel">
  <button type="button" class="level-pick lv-1" aria-pressed="false" aria-label="Level 1, 35% speed">1<small>35%</small></button>
  …
</div>
```

## 8. Cross-references
[charts](charts.md) (the Stats heatmap, a different scale) · [list-row](list-row.md) ·
[selectable-tile](selectable-tile.md) (the three setup answers use `.flow-choice-option`) ·
docs/flow-journey.md · docs/database-schema.md ("Practice Levels").

## 9. Accessibility
- **Never colour alone.** Every map square carries its Level number. The map is `role="img"` with a
  summary `aria-label` ("12 bars at Level 2, 4 not set"), so a screen reader doesn't read out 770 squares.
- **Map squares are display only, not tap targets.** On a long piece they'd be far below 44px.
  Bars are chosen with the From bar / To bar number fields, and the squares ring to show the choice.
- **Picker buttons** are 44px tall. Each has `aria-label="Level N, P% speed"` and `aria-pressed`.
  The group is labelled by its heading.
- **Contrast:** every `--level-N-text` on `--level-N` passes 4.5:1 in both themes. The unset outline
  passes 3:1. Both are in `specs/accessibility/contrast-pairs.json`.
- **Rows:** the row body is a real `<button>` (select / edit). Remove and Split are separate buttons,
  each with its own label.
