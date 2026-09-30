# Piece path, painting and focus bits

## 1. Metadata
- **Name:** Piece path (`.piece-path`, `.path-stage` with `.is-done` / `.is-now`, `.path-dot`, `.path-text`,
  `.path-steps`, `.path-step`, `.focus-summary`), painting (`.paint-page`, `.paint-section`, `.paint-section-head`,
  `.paint-bars`, `.paint-bar`, `.paint-bar-num`, `.paint-bar-level`, `.is-cut-before`, `.paint-toolbox`,
  `.paint-tools`, `.paint-tool`, `.paint-tool-label`, `.paint-pots`), focus bits (`.cut-bit`, `.is-too-long`)
- **Category:** Flow / input
- **Status:** New (ML-390; replaces ML-316's My Levels screen)

## 2. Overview
Every piece follows three stops, drawn like a game map: **Prepare** (a run-through, paint how each bar went, cut
into focus bits), **Practise** (five-minute blocks until every bar is at Level 4) and **Play-through** (the whole
piece, 4 up to 5). Done stops are gold with a tick, the one now is ringed.
- **Painting:** the bars sit in the piece's sections as big squares - the bar number small in the corner, the Level
  big in the middle, the Level colour behind it. The paint box stays pinned to the bottom: **Brush** (a bar),
  **Fill section** (its empty bars), **Fill all** (the whole piece - then Brush goes back on), **Rubber**, a row of
  Level "pots" (`.level-picker` + `.level-pick`), and Undo. Tap only - no drag, so scrolling is never fought.
- **Focus bits (the knife):** tap the bar where a new bit should start - a red edge marks it (`.is-cut-before`);
  tap again to join it back up. Each bit below Level 4 shows how long a go takes and whether it fits 5 goes in a
  block; one that doesn't is `.cut-bit.is-too-long` with **Split it for me**.
- **Don't use** `.paint-bar` for anything but a piece's bars.

## 3. Anatomy
- Path: `ol.piece-path` › `li.path-stage` › `.path-dot` (icon) + `.path-text` (title, line, `.path-steps` ›
  `.path-step` for Prepare's checklist, `.focus-summary` of Level chips).
- Paint: `.paint-page` › `.paint-section` › `.paint-section-head` + `.paint-bars` › `button.paint-bar.lv-N` ›
  `.paint-bar-num` + `.paint-bar-level`; `.paint-toolbox` › `.paint-tools` › `button.paint-tool` (icon +
  `.paint-tool-label`) › `.level-picker.paint-pots` › hint › Undo / Next.
- Cut: `.paint-section` › `.paint-bars` (bars with `.is-cut-before`) › `.cut-bit` rows (a `.level-chip`, the bars, the
  fit line, Split it for me).

## 4. Tokens used
`--level-1`…`--level-5` and their `-text` (via `.lv-N`), `--level-unset-border`, `--primary-action`,
`--primary-action-strong`, `--primary-action-text`, `--primary-action-tint`, `--input-border`, `--control-border`,
`--container-bg`, `--input-bg`, `--label-color`, `--text-color`, `--success-text`, `--danger-color` (the cut edge and
a too-long bit - 3:1 non-text), `--focus-ring`; `--touch-target` (every bar is at least 44px), `--icon-md`,
`--space-0-5`…`--space-4`, `--radius-md`, `--radius-circle`, `--font-xs`, `--font-sm`, `--font-md`,
`--font-weight-*`, `--line-height-tight`, `--z-sticky`.

## 5. Props / API
- Maths: `public/flowJourney.js` - `pieceSections`, `bitsFromBars`, `chunkFit` (5 goes), `suggestSplit`,
  `pieceRunSeconds` (the run-through), `playthroughParts`, `partBlockMinutes`.
- Screens: app.js "a piece's path" - `openPiecePath`, `renderPiecePath`, `openPrepareRun`, `openPaint` /
  `renderPaint` / `paintApply`, `openCut` / `renderCut`; saved with `PUT /api/flows/:id/levels` (an old chunk with
  the same bars keeps its id and history). The server makes the play-through parts once every bar is at 4.

## 6. States
| State | Treatment |
|---|---|
| Stop done / now / to come | `.path-stage.is-done` (gold dot, tick) / `.is-now` (ringed) / plain |
| Bar painted / not | `.paint-bar.lv-N` / `.lv-0` (dashed) |
| Tool / pot chosen | `.paint-tool[aria-pressed="true"]` / `.level-pick.selected` |
| Knife cut | `.paint-bar.is-cut-before` - a red inside edge on the left |
| Bit too long | `.cut-bit.is-too-long` - red border, the fit line in the warning colour |

## 7. Code example
```html
<section class="paint-section">
  <div class="paint-section-head"><strong>A</strong><span class="text-sm text-muted">Bars 9–16 · 8 of 8 painted</span></div>
  <div class="paint-bars">
    <button type="button" class="paint-bar lv-3" aria-label="Bar 9, Level 3"><span class="paint-bar-num">9</span><span class="paint-bar-level">3</span></button>
    <button type="button" class="paint-bar lv-1 is-cut-before" aria-label="Bar 10, Level 1 - a focus bit starts here"><span class="paint-bar-num">10</span><span class="paint-bar-level">1</span></button>
  </div>
</section>
```

## 8. Cross-references
[level-map](level-map.md) (the Level colours, chips and picker) · [practice-steps](practice-steps.md) ·
[modal](modal.md) (Type bars instead) · docs/practice-sessions.md ("Getting a piece ready") · docs/flow-journey.md
("Practice Levels").

## 9. Accessibility
- Every bar is a `<button>` of at least 44px with an `aria-label` ("Bar 12, Level 1 - tap to start a new focus bit
  here"); the Level is a number as well as a colour. After a tap, focus stays on that bar.
- Tools are toggle buttons (`aria-pressed`); the tool hint is `aria-live="polite"`.
- **Type bars instead** (a from-to form in a modal) is the non-visual way to paint or cut.
- The path is an `<ol>` with `aria-current="step"` on the stop you're at.
