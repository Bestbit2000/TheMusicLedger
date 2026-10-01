# Level map (practice Levels)

## 1. Metadata
- **Name:** Level map (`.level-map`, `.level-map-bars`, `.level-map-bars-to`, `.level-cell`, `.lv-0`, `.lv-1`, `.lv-2`, `.lv-3`, `.lv-4`, `.lv-5`, `.is-marked`, `.level-strip`, `.level-bar`, `.level-bar-part`, `.level-bar-num`, `.level-legend`, `.level-chip`, `.level-picker`, `.level-pick`, `.level-row-body`, `.level-row-selected`, `.level-answer`, `.level-fit-warn`, `.level-notice`)
- **Category:** Data display / inputs
- **Status:** New (ML-316, epic ML-314)

## 2. Overview
A piece's practice **Levels 1-5**, bar by bar. Level 1 is the slowest speed and Level 5 is full speed.
The colours run from silver to gold: the brighter the square, the better you can play those bars.
Used on a piece's **path** (`#piecePathView` - ML-390; it was the My Levels screen, opened from Play Flow's ⋮
menu), on practice lists, a session's step 3 and "Did you nail it?" (the Level bar). Painting the bars uses
the same colours on bigger squares ([piece-path](piece-path.md)).

- **Use** it only for the practice Levels 1-5, and the same scale for Skills steps later (ML-321).
- **Don't use** it for the Stats practice heatmap. That counts time, not how well you play, and
  uses `--heat-*`. See [charts](charts.md).

## 3. Anatomy
- **Map:** `.level-map` › `.level-cell.lv-N` × bars, **10 bars a row** (ML-336), as bars are counted in
  music. Each row starts with `.level-map-bars`, the row's bars ("1 - 10", "11 - 20"...); when the map
  is too narrow (a container query at 300px) `.level-map-bars-to` hides and it reads just "1", "11".
  The Level number is inside each square, and an unset bar is empty with a dashed outline.
  - `.is-marked` rings the bars being edited: the hard passage being added, or the chunk selected.
- **Level bar (list rows):** `.level-bar` › `.level-bar-part.lv-N` (› `.level-bar-num`) - one bar chart of the
  piece: how many of its bars are at each Level, 1 to 5 left to right, then the bars not painted (`lv-0`, dashed).
  At most six parts, so a 243-bar piece reads as easily as a 16-bar one (a square a bar turned a long piece
  into a row of lines - owner, 1 Oct 2026). Each part's width is its share of the bars (`--bars`, set by
  `sizeLevelBars`), never less than `--space-1`; the Level number shows inside when the part is at least 14px
  wide (a container query on the part). **The key** (`.level-legend`) goes under it - once under a list of pieces.
  Used on a session's step 3, a practice list's pieces and the next-goal card in "Did you nail it?".
- **Strip:** `.level-strip` › `.level-cell.lv-N` × items. One thin row with no numbers - now only the Range
  tool's notes past your range. In a strip an unset item is a plain `--level-unset-border` fill, not a dashed
  outline (ML-334). The strip never overflows its row.
- **Legend (the key):** `.level-legend` › `span` › `.level-cell` + label: Not painted, 1 2 Silver, 3 4 Gold, 5 Full speed.
  Under a piece's map and under Level bars (`levelLegendHtml`). No bottom margin when it's the last thing in its box.
- **Chip:** `.level-chip.lv-N`, the Level at the start of a chunk / hard-passage row. The row is a
  `.history-item` with a `.level-row-body` button (the chip plus text) and any action buttons.
- **Picker:** `.level-picker` › `.level-pick.lv-N` × 5. Each button shows the number and, under it
  (`small`), that Level's speed as a % of the piece's tempo.
- **Selected row:** `.history-item.level-row-selected` (gold border and focus ring). The Level picker opens straight under it.
- **Choice rows:** `.flow-choice-option.level-answer` buttons (full width, left-aligned title and caption) - e.g. "Too fast - back to Level 1" in "Did you nail it?". (ML-390 replaced the three "How well can you play it?" answers with painting.)
- **Fit line:** "0:32 a go · fits 8 goes". It turns amber (`.level-fit-warn`) when the bit plays fewer than
  5 times in a block (ML-390; it was 3).
- **Notice:** `.level-notice`, the amber "bars have changed" message.

## 4. Tokens used
- **Colours:**
  - fills `--level-1`…`--level-5`, with text `--level-1-text`…`--level-5-text`
  - `--level-unset-border` for unset bars
  - `--status-amber-bg` and `--status-amber-fg` for the notice and fit warning
  - `--label-color`
  - `--primary-action-strong` and `--focus-ring` for the selected state
- **Sizes:** `--level-cell-size`, `--level-bar-height`, `--level-strip-height`, `--icon-md` (legend squares),
  `--icon-xl` (chip), `--touch-target`
- **Spacing and shape:** `--space-0-5`…`--space-4`, `--radius-2xs` (squares), `--radius-xs` (chip),
  `--radius-md` (picker buttons, notice)
- **Type:** `--font-xs`, `--font-sm`, `--font-md`, `--font-weight-*`, `--line-height-tight`

Dark mode remaps the Level fills in `tokens.css`. Levels 1 and 3 switch to white numbers, and gold
stays the brightest.

## 5. Props / API
- `lv-0` means not set. `lv-1`…`lv-5` is the Level.
- The Level bar is `levelBarHtml(map, { label, cls })` then `sizeLevelBars(container)` (app.js); the key is
  `levelLegendHtml()`.
- The map is built by `renderLevelMapInto` (app.js) from `FlowJourney.barLevels(totalBars, chunks)`.
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
  A Level bar is `role="img"` with "Levels: 8 bars at Level 1, 60 bars at Level 3, ..." - or `aria-hidden` inside a
  row button that already says the piece's state. Its parts carry their Level number when they're wide enough;
  the key under it pairs every colour with its number.
- **Map squares are display only, not tap targets.** On a long piece they'd be far below 44px.
  Bars are chosen with the From bar / To bar number fields, and the squares ring to show the choice.
- **Picker buttons** are 44px tall. Each has `aria-label="Level N, P% speed"` and `aria-pressed`.
  The group is labelled by its heading.
- **Contrast:** every `--level-N-text` on `--level-N` passes 4.5:1 in both themes. The unset outline
  passes 3:1. Both are in `specs/accessibility/contrast-pairs.json`.
- **Rows:** the row body is a real `<button>` (select / edit). Remove and Split are separate buttons,
  each with its own label.
