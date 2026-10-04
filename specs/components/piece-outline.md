# Quick piece entry (the outline)

## 1. Metadata
- **Name:** Piece outline (`#pieceOutlineView`, `#outlineExtraModal`: `.outline`, `.outline-pair`, `.outline-three`,
  `.outline-field`, `.outline-field-label`, `.outline-th`, `.outline-list`, `.outline-chips`, `.outline-chip`,
  `.outline-table`, `.outline-row` with `.outline-row-marks` / `.outline-row-speed`, `.outline-cell-fixed`,
  `.outline-cell-btn`, `.outline-section-btn`, `.outline-all`, `.outline-bar` with `.is-exception` / `.is-from`,
  `.outline-bar-sig`, `.outline-tool`, `.outline-shorts`, `.outline-short`, `.outline-sum`, `.outline-extra` with
  `.has-clash`, `.outline-extra-text`, `.outline-extra-clash`, `.outline-add`)
- **Category:** Form / stepped set-up
- **Status:** New (ML-424)

## 2. Overview
A new piece entered as an **outline**, by the bar numbers printed on the music, instead of block by block. Five
steps, one question each, with the [practice steps'](practice-steps.md) bar across the top (a done step is a way
back): **How long** (bars, count-in, the time and speed most of it is in), **Marks** (bar numbers, letters or
words, or none), **Time** (the bars that aren't the main time signature), **Speed** (the bars where it changes),
**Extras** (repeats, endings, pauses, speeding up, signs, intro). Save makes the same blocks "Create your own"
makes and opens the piece's details so it can be named. New pieces only. Rules: `public/pieceOutline.js`
(`docs/quick-piece-entry.md`). The way in is the **Quick entry** tile on [Add a piece](add-piece.md), shown when
`piece_quick_entry` is on for you.

## 3. Anatomy
- **Every step:** `.steps-progress` › `.step-question` › `.outline` (a column of rows, `--space-3` apart).
- **How long:** a number box (`.outline-field` › `input` + `.outline-field-label`) for the bars › a Yes / No pill
  pair (`.radio-group`) for the count-in › "Most of it is in..." › `.outline-three`: the time (a value box,
  `.metroBlk-ctrl-value-btn`, opening the shared time signature pop-up), the bpm (a value box too, with "bpm"
  inside it like its neighbours, opening the shared Tempo pop-up `#flowBpmModal` - owner, 4 Oct 2026), the beat note (a
  value box opening the shared beat note pop-up) › Next › "Start again" (`.btn-text`).
- **Marks:** one value box "the marks are" (opens `#flowChoiceModal`: Bar numbers / Letters or words / None) ›
  - *Bar numbers:* a `textarea.outline-list` - spaces, commas, semicolons and full stops all separate - › a line
    saying what was understood › `.outline-chips` › `.outline-chip` per mark.
  - *Letters or words:* `.outline-table` › `.outline-row.outline-row-marks` (bar, mark). Enter or Tab moves on; a
    new row appears when the last one is typed in.
  - *None:* one line; the step is otherwise empty.
- **Time:** `.outline-sum` (the exceptions so far) › one `.paint-section` per rehearsal mark: its heading is an
  `.outline-section-btn` (chevron, "Mark 21", its bars, how many are marked) that opens and closes it - a piece
  over 60 bars with marks starts with only the first open - and, when open, `.btn-text.outline-all` "All of this
  section" › `.paint-bars` › `.outline-bar` per bar (`.paint-bar-num` + `.outline-bar-sig`). With no marks there
  is one section with no heading. Pinned at the bottom (`.paint-toolbox`): `.outline-tool` (the value box "marking
  bars as", and "Used in this piece" `.outline-shorts` › `.outline-short`) › a pill pair "One bar at a time / From
  a bar to a bar" › a hint line › Next.
- **Speed:** a row for bar 1 changes the fixed Start row (it is the starting speed) and is never an error; the
  check line names the rows that can't be used ("Row 3 can't be used yet"); the blank last row is ignored.
- **Speed:** `.outline-table` › `.outline-row.outline-row-speed` (from bar, bpm, beat note). The first row is the
  start (`.outline-cell-fixed` × 3); the beat note of a row is an `.outline-cell-btn` ("same" until changed).
- **Extras:** an `.outline-extra` per extra (icon › `.outline-extra-text`: what it is in words › chevron; tap to
  change or remove) › `.outline-add` "+ Add an extra" (opens `#flowChoiceModal` with the six kinds) ›
  `.outline-sum` › Save the piece. The form is `#outlineExtraModal`: number boxes in `.outline-three` /
  `.outline-pair`, pill pairs for the either/or answers, a line in plain words, Add it, Remove this extra.

## 4. Tokens used
- Layout: `--space-0-5`...`--space-3`, `--touch-target`, `--radius-md`, `--radius-lg`, `--radius-pill`.
- Text: `--font-xs`, `--font-sm`, `--font-lg`, `--font-weight-bold`, `--font-weight-semibold`,
  `--line-height-relaxed`, `--label-color`, `--text-color`.
- Surfaces: `--input-bg`, `--control-border`.
- A bar or shortcut that's marked / picked: `--primary-action-strong` on `--primary-action-tint` (the
  `.flow-choice-option.selected` pair). The first bar of a run: `--focus-ring`.
- A clash: `--danger-text` on `--danger-tint`, with the bar editor's warning triangle (`flowWarningIconSvg`,
  `--icon-md`).

## 5. Props / API
- `openPieceOutline(target)` (app.js) - `target` is Add a piece's answers (who it's for, which practice list).
- State: `outline = { step, o, marksText, markRows, speedRows, brush, mode, from, openSecs, stats }`; `o` is the
  outline `PieceOutline.buildBlocks` reads.
- `PUT /api/flows/:id/blocks/all` saves the blocks in one request.

## 6. States
| State | How |
|---|---|
| A bar that isn't the main time signature | `.outline-bar.is-exception` + its time signature in `.outline-bar-sig`, `aria-pressed="true"` |
| The first bar of a run, waiting for the last | `.outline-bar.is-from` |
| The time signature being marked with | `.outline-short.selected`, and the value box's text |
| A section closed / open | `.outline-section-btn[aria-expanded]`; closed shows no bars |
| An extra that can't be made as asked | `.outline-extra.has-clash` + `.outline-extra-clash`; Save is `disabled` |
| A table row that can't be used yet | a `.text-danger` line under the table; Next is refused |

## 7. Code example
```html
<div class="outline">
  <label class="outline-field"><input type="number" inputmode="numeric" id="outlineBars" value="145"><span class="outline-field-label">bars in the piece</span></label>
  <div class="paint-section">
    <div class="paint-section-head">
      <button type="button" class="outline-section-btn" aria-expanded="true"><span class="material-symbols-outlined" aria-hidden="true">expand_more</span><strong>Mark 67</strong><span class="text-sm text-muted">bars 67-77 · 1 marked</span></button>
      <button type="button" class="btn-text outline-all">All of this section</button>
    </div>
    <div class="paint-bars">
      <button type="button" class="outline-bar" aria-pressed="false" aria-label="Bar 75, 4/4"><span class="paint-bar-num" aria-hidden="true">75</span><span class="outline-bar-sig" aria-hidden="true"></span></button>
      <button type="button" class="outline-bar is-exception" aria-pressed="true" aria-label="Bar 76, 2/4"><span class="paint-bar-num" aria-hidden="true">76</span><span class="outline-bar-sig" aria-hidden="true">2/4</span></button>
    </div>
  </div>
</div>
```

## 8. Cross-references
[practice-steps](practice-steps.md) (the steps bar and the question) · [add-piece](add-piece.md) (the way in) ·
`docs/quick-piece-entry.md` · `docs/flow-journey.md` (what the blocks mean when played).

## 9. Accessibility
- Every bar is a real `<button>` of at least 44px with a name that says its number and time signature
  ("Bar 76, 2/4") and `aria-pressed` for marked; the time signature is written on a marked bar, never colour alone.
- Marking a run needs no drag: a pill switches to "From a bar to a bar" and two taps do it. A redraw puts focus
  back on the control that was used.
- Section headings are buttons with `aria-expanded`. The value boxes have `aria-haspopup="dialog"` and a name
  that reads the answer.
- Number boxes have visible labels (`.outline-field-label`) or an `aria-label` in the tables ("Row 2: bpm");
  Enter moves to the next box. What was understood, and what's wrong, is in `aria-live="polite"` lines; the
  "needs fixing" line before Save is `role="alert"`.
- A clash is red **and** carries the warning triangle and the reason in words.
