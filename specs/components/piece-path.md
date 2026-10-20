# Piece path, setting the levels and focus sections

## 1. Metadata
- **Name:** Piece path (`.piece-path`, `.path-stage` with `.is-done` / `.is-now`, `.path-dot`, `.path-text`,
  `.path-steps`, `.path-step`, `.focus-summary`), setting the levels - ML-536, was "painting"; the class names stay
  (`.paint-page`, `.paint-section`, `.paint-section-head`, `.paint-bars`, `.paint-bar`, `.paint-bar-num`,
  `.paint-bar-level`, `.is-cut-before`, `.is-range-start`, `.paint-toolbox`,
  `.paint-tools`, `.paint-tool`, `.paint-tool-label`, `.paint-pots`), focus sections (`.cut-bit`, `.is-too-long`),
  how far it has come (ML-557: `.level-change` on Bar by bar; `.plan-track`, `.plan-track-fill` for a practice list's weekly plan)
- **Category:** Flow / input
- **Status:** New (ML-390; replaces ML-316's My Levels screen)

## 2. Overview
Every piece follows three stops, drawn like a game map: **Prepare** (a run-through, set the level of each bar, cut
into focus sections), **Practise** (five-minute blocks until every bar is at Level 4) and **Play-through** (the whole
piece, 4 up to 5). Done stops are gold with a tick, the one now is ringed. Above them, once a bar has a level
(ML-537), **how many bars are at each Level as one bar chart** (`.level-bar` and its key - ML-557, owner 20 Oct 2026:
it was one square a bar), a line saying how far it has come - "8 bars have gone up since you prepared it - 16 Levels
in all. 3 practice sessions and 15 minutes on it so far." (positive only; nothing said until there is something) -
and **Bar by bar**.
- **Bar by bar** (ML-557, `#levelsProgressView`, a narrow page): the bars, sessions and minutes; a `.level-notice`
  when where the bars started was worked out afterwards (a piece prepared before ML-557) or wasn't kept; the heat map
  (`.level-map`, one square a bar, as it is now) and its key; then **each run of bars that reads the same** as a
  `.history-item` row - the bars ("Bars 1–8"), "4 practice sessions · 20 minutes" (or "Not in a practice session
  yet"), and on the right `.level-change`: the Level it started at, an arrow, the Level now (one chip when they're
  the same; "Start not known" before a chip when it isn't known). A movement's heading comes before its first bars.
- **A practice list's weekly plan** (ML-557): three value boxes beside the target date - **a week** (sessions), **minutes**
  (a session) and **warm-up** - each a pop-up with None first. The member's own, on a band's list too. With the first
  two set, the readiness card says about how many weeks it takes ("3 sessions a week of 30 minutes (5 of them warming
  up) is 5 blocks on the pieces a session: about 8 weeks to be ready."), then how far you've come since making it - a
  `.plan-track` (`--input-bg` track, `--control-border` edge, a gold `.plan-track-fill` as wide as `--pct`: the
  blocks done out of done and still to do) over "Since you made the plan on 20 October: 6 practice sessions and 27
  blocks on these pieces." Never "behind" or "on track" (no pressure, ML-471). With SmartLearn, a line says whether the
  forecast uses your own pace yet.
- **From the Prepare tool** (ML-537) the page is Prepare alone: no stops, a short explanation of what's about to
  happen (the lower the number, the sooner those bars get practised), the levels now as one bar chart
  (`.level-bar`) when the bars have them, **Play it through** and **Skip play through and set the level directly**.
- **Setting the levels** (ML-536): the bars sit in the piece's sections as big squares, **6 across on a phone** (more
  from 700px) - the bar number small in the corner, the Level big in the middle, the Level colour behind it. The
  toolbox stays pinned to the bottom: first the Level to set (`.level-picker` + `.level-pick`), then six tools, 6
  across - **Fill bar** (a bar), **Fill section** (its empty bars), **Fill all** (the whole piece - then Fill bar goes
  back on), **Range** (tap the first bar - it's ringed, `.is-range-start` - then the last), **Remove level** and
  **Undo** (a tool, faded while there's nothing to undo) - then the chosen tool's instruction right under them, then
  Next. Tap only - no drag, so scrolling is never fought.
- **Focus sections (the knife):** tap the bar where a new bit should start - a red edge marks it (`.is-cut-before`);
  tap again to join it back up. Each bit below Level 4 shows how long a go takes and whether it fits 5 goes in a
  block; one that doesn't is `.cut-bit.is-too-long` with **Split it for me**.
- **Don't use** `.paint-bar` for anything but a piece's bars.

## 3. Anatomy
- Path: `ol.piece-path` › `li.path-stage` › `.path-dot` (icon) + `.path-text` (title, line, `.path-steps` ›
  `.path-step` for Prepare's checklist, `.focus-summary` of Level chips).
- Paint: `.paint-page` › `.paint-section` › `.paint-section-head` + `.paint-bars` › `button.paint-bar.lv-N` ›
  `.paint-bar-num` + `.paint-bar-level`; `.paint-toolbox` › `.level-picker.paint-pots` › `.paint-tools` ›
  `button.paint-tool` (icon + `.paint-tool-label`; the last is Undo) › hint › Next.
- Cut: `.paint-section` › `.paint-bars` (bars with `.is-cut-before`) › `.cut-bit` rows (a `.level-chip`, the bars, the
  fit line, Split it for me).

## 4. Tokens used
`--level-1`…`--level-5` and their `-text` (via `.lv-N`), `--level-unset-border`, `--primary-action`,
`--primary-action-strong`, `--primary-action-text`, `--primary-action-tint`, `--input-border`, `--control-border`,
`--container-bg`, `--input-bg`, `--label-color`, `--text-color`, `--success-text`, `--danger-color` (the cut edge and
a too-long bit - 3:1 non-text), `--focus-ring` (also the Range tool's first bar), `--opacity-disabled` (Undo); `--touch-target` (every bar is at least 44px), `--icon-md`,
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
| Range waiting for its last bar | `.paint-bar.is-range-start` - the focus ring round the first bar; the hint says "From bar N: now tap the last bar" |
| Nothing to undo | `.paint-tool:disabled` (Undo) - faded |
| Knife cut | `.paint-bar.is-cut-before` - a red inside edge on the left (`--shadow-cut-line`) |
| Bit too long | `.cut-bit.is-too-long` - red border, the fit line in the warning colour |

## 7. Code example
```html
<section class="paint-section">
  <div class="paint-section-head"><strong>A</strong><span class="text-sm text-muted">Bars 9–16 · 8 of 8 set</span></div>
  <div class="paint-bars">
    <button type="button" class="paint-bar lv-3" aria-label="Bar 9, Level 3"><span class="paint-bar-num">9</span><span class="paint-bar-level">3</span></button>
    <button type="button" class="paint-bar lv-1 is-cut-before" aria-label="Bar 10, Level 1 - a focus section starts here"><span class="paint-bar-num">10</span><span class="paint-bar-level">1</span></button>
  </div>
</section>
```

## 8. Cross-references
[level-map](level-map.md) (the Level colours, chips and picker) · [practice-steps](practice-steps.md) ·
[modal](modal.md) (Type bars instead) · docs/practice-sessions.md ("Getting a piece ready") · docs/flow-journey.md
("Practice Levels").

## 9. Accessibility
- Every bar is a `<button>` of at least 44px with an `aria-label` ("Bar 12, Level 1 - tap to start a new focus section
  here"); the Level is a number as well as a colour. After a tap, focus stays on that bar.
- Tools are toggle buttons (`aria-pressed`); the tool hint is `aria-live="polite"`.
- **Type bars instead** (a from-to form in a modal) is the non-visual way to set the levels or cut.
- The Range tool's first bar says so in its label ("Bar 13, Level 2 - the first bar of the range"), and the hint
  under the tools (`aria-live`) says what to tap next.
- The path is an `<ol>` with `aria-current="step"` on the stop you're at.
