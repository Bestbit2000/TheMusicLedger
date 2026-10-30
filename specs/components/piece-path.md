# Piece path, setting the levels and focus sections

## 1. Metadata
- **Name:** Piece path (`.piece-path`, `.path-stage` with `.is-done` / `.is-now`, `.path-dot`, `.path-text`,
  `.path-steps`, `.path-step`, `.path-title`, `.prepare-lead`, `.prepare-example`, `.prepare-key`, `.prepare-key-line`), setting the levels - ML-536, was "painting"; the class names stay
  (`.paint-page`, `.paint-section`, `.paint-section-head`, `.paint-bars`, `.paint-bar`, `.paint-bar-num`,
  `.paint-bar-level`, `.joins-prev`, `.joins-next`, `.is-cut-before`, `.is-range-start`, `.paint-toolbox`,
  `.paint-tools`, `.paint-tool`, `.paint-tool-label`, `.paint-pots`, `.paint-actions`), focus sections (`.cut-bit`, `.is-too-long`),
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
- **The piece's name is on the page** (ML-669, `.path-title`), not in the top bar, which says **Prepare** from the Prepare
  tool and **My path** otherwise, so a long name no longer wraps up there.
- **From the Prepare tool** (ML-537) the page is Prepare alone: no stops, one line (`.prepare-lead`), an example of six
  bars joined up and two short rows (`.prepare-example`, `.prepare-key`), **More about levels** (`#levelsInfoModal`), the
  levels now as one bar chart (`.level-bar`) when the bars have them, then **Set the levels** (primary; **Edit levels** when
  they have levels) and **Play it through first** (secondary, `.btn-nav`).
- **Coming back to unfinished work** (ML-670): the page says "Your bars are kept on this device", the chart and how many
  bars have a level so far, then **Carry on**, **Play it through first** and **Start again** (`.btn-text`, it asks first, and
  only clears the draft - saved levels stay). On a piece's full path, Edit levels becomes Carry on.
- **Setting the levels and splitting are one page** (ML-670, `#levelsPaintView`; they were two). The top bar says **Set the
  levels** the first time and **Edit levels** after. The bars sit in the piece's sections as big squares, **6 across on a
  phone** (more from 700px) - the bar number small in the corner, the Level big in the middle, the Level colour behind
  it. **Bars in one focus section are joined up by a line** (`.joins-prev`, `.joins-next`; at the end of a row it runs into
  the gutter and picks up on the next). The toolbox stays pinned to the bottom: first the Level to set (`.level-picker` +
  `.level-pick`), then six tools, 6 across, in size order - **Fill bar** (a bar; always where it starts, ML-672), **Range** (tap
  the first bar - it's ringed, `.is-range-start` - then the last), **Fill part** (the empty bars in its part of the piece;
  "section" alone would be confused with a focus section), **Fill all** (every bar with no level yet - one already set keeps it,
  ML-662; then Fill bar goes back on), **Remove level** and **Split** - then the chosen tool's instruction right under
  them, then **Undo**, **Redo** and **Done** (`.paint-actions`), which cover levels and splits together. Tap only - no drag, so
  scrolling is never fought.
- **Split:** tap the bar where a new focus section should start: the line goes and the box gets a dark left edge
  (`.is-cut-before`: `border-left: 6px solid var(--text-color)`, the shape of a list row's edge, so it follows the corners and
  turns light in dark mode); tap again to join it back up. **Only within one Level**: a change of Level starts a focus
  section by itself, and the colour already says so, so it gets no edge.
- **Too long** (ML-670): a focus section that can't fit 5 goes in a block gets a **red border and red lines** on its bars
  (`.paint-bar.is-too-long`, so it shows as a shape, not only a colour), a `.cut-bit.is-too-long` row under its part saying how
  many parts it needs, with **Split** (the toolbox's own `.paint-tool` tile, as it does the same thing: picks the tool and goes to the section), and a count on Done. **Done asks** (`#paintTooLongModal`):
  **Split them** or **Done anyway** - it never stops anyone, as the section still plays, with fewer goes. Sections that fit
  say nothing. At the end, **My focus sections**: the Levels bar chart, counting bars (ML-668 - it was a square a focus section),
  and the line about blocks.
- **Nothing is lost on the way** (ML-670): every change is kept on the device as a draft until Done - `docs/offline.md`.
- **Don't use** `.paint-bar` for anything but a piece's bars.

## 3. Anatomy
- Path: `ol.piece-path` › `li.path-stage` › `.path-dot` (icon) + `.path-text` (title, line, `.path-steps` ›
  `.path-step` for Prepare's checklist).
- Paint: `.paint-page` › `.paint-section` › `.paint-section-head` + `.paint-bars` › `button.paint-bar.lv-N` ›
  `.paint-bar-num` + `.paint-bar-level`; `.paint-toolbox` › `.level-picker.paint-pots` › `.paint-tools` ›
  `button.paint-tool` (icon + `.paint-tool-label`) › hint › `.paint-actions` (Undo, Redo, Done).
- Under a part's bars: a `.cut-bit.is-too-long` row for each focus section too long (the words, the Split tile).

## 4. Tokens used
`--level-1`…`--level-5` and their `-text` (via `.lv-N`), `--level-unset-border`, `--primary-action`,
`--primary-action-strong`, `--primary-action-text`, `--primary-action-tint`, `--input-border`, `--control-border`,
`--container-bg`, `--input-bg`, `--label-color`, `--text-color` (also the split edge), `--success-text`, `--danger-color` (a too-long focus
section - 3:1 non-text), `--focus-ring` (also the Range tool's first bar), `--opacity-disabled` (Undo); `--touch-target` (every bar is at least 44px), `--icon-md`,
`--space-0-5`…`--space-4`, `--radius-md`, `--radius-circle`, `--font-xs`, `--font-sm`, `--font-md`,
`--font-weight-*`, `--line-height-tight`, `--z-sticky`.

## 5. Props / API
- Maths: `public/flowJourney.js` - `pieceSections`, `bitsFromBars`, `chunkFit` (5 goes), `suggestSplit`,
  `pieceRunSeconds` (the run-through), `playthroughParts`, `partBlockMinutes`.
- Screens: app.js "a piece's path" - `openPiecePath`, `renderPiecePath`, `openPrepareRun`, `openPaint` /
  `renderPaint` / `paintApply` / `paintChange`, `FlowJourney.barJoins` (the lines and the split edge), `paintSave`; saved with `PUT /api/flows/:id/levels` (an old chunk with
  the same bars keeps its id and history). The server makes the play-through parts once every bar is at 4.

## 6. States
| State | Treatment |
|---|---|
| Stop done / now / to come | `.path-stage.is-done` (gold dot, tick) / `.is-now` (ringed) / plain |
| Bar painted / not | `.paint-bar.lv-N` / `.lv-0` (dashed) |
| Tool / pot chosen | `.paint-tool[aria-pressed="true"]` / `.level-pick.selected` |
| Range waiting for its last bar | `.paint-bar.is-range-start` - the focus ring round the first bar; the hint says "From bar N: now tap the last bar" |
| Nothing to undo or redo | `.paint-actions .paint-tool:disabled` - faded |
| Bars joined | `.joins-prev`, `.joins-next` - a `--control-border` line through the gap |
| Split | `.paint-bar.is-cut-before` - the box's left edge, 6px `--text-color` |
| Too long | `.paint-bar.is-too-long` - red border and lines; `.cut-bit.is-too-long` - a red-edged row with Split |

## 7. Code example
```html
<section class="paint-section">
  <div class="paint-section-head"><strong>A</strong><span class="text-sm text-muted">Bars 9–16 · 8 of 8 set</span></div>
  <div class="paint-bars">
    <button type="button" class="paint-bar lv-3" aria-label="Bar 9, Level 3"><span class="paint-bar-num">9</span><span class="paint-bar-level">3</span></button>
    <button type="button" class="paint-bar lv-3 is-cut-before" aria-label="Bar 10, Level 3 - a focus section starts here"><span class="paint-bar-num">10</span><span class="paint-bar-level">3</span></button>
  </div>
</section>
```

## 8. Cross-references
[level-map](level-map.md) (the Level colours, chips and picker) · [practice-steps](practice-steps.md) ·
[modal](modal.md) (Type bars instead) · docs/practice-sessions.md ("Getting a piece ready") · docs/flow-journey.md
("Practice Levels").

## 9. Accessibility
- Every bar is a `<button>` of at least 44px with an `aria-label` ("Bar 12, Level 1 - in a focus section that is too long"); the Level is a number as well as a colour. After a tap, focus stays on that bar.
- Tools are toggle buttons (`aria-pressed`); the tool hint is `aria-live="polite"`. Undo and Redo are named by `aria-label`.
- A line or a split is never the only sign: every bar's label says where a focus section starts, and a too-long section is
  said in words in its row and on Done.
- **Type bars instead** (a from-to form in a modal) is the non-visual way to set the levels or cut.
- The Range tool's first bar says so in its label ("Bar 13, Level 2 - the first bar of the range"), and the hint
  under the tools (`aria-live`) says what to tap next.
- The path is an `<ol>` with `aria-current="step"` on the stop you're at.
