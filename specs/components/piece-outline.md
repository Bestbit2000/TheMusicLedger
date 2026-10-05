# Quick piece entry (the outline)

## 1. Metadata
- **Name:** Piece outline (`#pieceOutlineView`, `#outlineExtraModal`: `.step-bar`, `.step-bar-piece` with `.is-done` / `.is-now` / `.ends-stage`, `.step-foot`, `.outline`, `.outline-pair`, `.outline-three`,
  `.outline-field`, `.outline-field-label`, `.outline-th`, `.outline-list`, `.outline-chips`, `.outline-chip`,
  `.outline-table`, `.outline-row` with `.outline-row-marks` / `.outline-row-time` / `.outline-row-speed` / `.outline-row-repeat` / `.outline-row-pause`, `.outline-sig-cell`, `.outline-cell-fixed`,
  `.outline-cell-btn`, `.outline-sum`, `.outline-extra` with
  `.has-clash`, `.outline-extra-text`, `.outline-extra-clash`, `.outline-add`)
- **Category:** Form / stepped set-up
- **Status:** New (ML-424)

## 2. Overview
A new piece entered as an **outline**, by the bar numbers printed on the music, instead of block by block. Five
steps, one question each, with the [practice steps'](practice-steps.md) bar across the top (a done step is a way
back): **How long** (bars, count-in, the time and speed most of it is in), **Marks** (bar numbers, letters or
words, or none), **Time** (the bars that aren't the main time signature), **Speed** (the bars where it changes),
**Extras** (repeats, endings, pauses, speeding up, signs, intro). Since ML-428 it is five stages across the top - About, Structure, Tempo, Extras, Media - with steps
inside each, and it makes the whole piece: Save makes the same blocks "Create your own" makes, with the details
and media, and goes back to where Add a piece was opened from (never the edit screen). New pieces only. Rules: `public/pieceOutline.js`
(`docs/quick-piece-entry.md`). The way in is the **Quick entry** tile on [Add a piece](add-piece.md), shown when
`piece_quick_entry` is on for you.

## 3. Anatomy
- **Every step (ML-449):** `.step-bar` - one bar for the whole journey, a `.step-bar-piece` per step (13): gold
  when done (`.is-done`, `--primary-action`), strong gold for the one you are on (`.is-now`,
  `--primary-action-strong`), grey to come (`--input-border`); the last step of a stage has a wider gap after it
  (`.ends-stage`). It is a picture (`role="img"`, named "Step 4 of 13: Tempo") › one line saying where you are,
  the stage in bold: "**Tempo** · step 4 of 13" (`.text-sm.text-muted`) › `.step-question` › `.outline` (a column
  of rows, `--space-3` apart) › pinned to the bottom of the screen, the edit screen's bar
  (`.flow-edit-sticky-bar-wrap` › `.flow-edit-sticky-bar` › `.flow-edit-sticky-bar-actions.step-foot`): **Back**
  (`.btn-cancel.btn-nav`, a third of the width; not on the first step) and **Next** (`.btn-submit`, the rest; "Save
  the piece" on the last step). The steps themselves have no Next button. A toast sits above the bar
  (`--toast-above-bottom-bar`). It replaced five labelled stage bars plus "Tempo: 1 of 2" and a row of dots
  (owner, 5 Oct 2026: too busy) - getting about is Back and Next only. Under every step: **Cancel** (`.btn-text`) - it asks first, throws the piece away and
  goes back to where Add a piece was opened from (it replaced "Start again", which was only on the first step).
- **About:** `.form-group` × 5 (label over the box, as everywhere): name of the piece (required, `.flow-required`),
  composer, arranger, publisher, notes (a `textarea`).
- **How long:** a number box (`.outline-field` › `input` + `.outline-field-label`) for the bars › the count-in as a switch
  (`.display-toggle-row`: "A count-in bar" over "A bar of clicks before bar 1", `.toggle-switch`, off to start with) › "Most of it is in..." › `.outline-three`: the time (a value box,
  `.metroBlk-ctrl-value-btn`, opening the shared time signature pop-up), the bpm (a value box too, with "bpm"
  inside it like its neighbours, opening the shared Tempo pop-up `#flowBpmModal` - owner, 4 Oct 2026), the beat note (a
  value box opening the shared beat note pop-up) › Next.
- **Marks:** one value box "the marks are" (opens `#flowChoiceModal`: Bar numbers / Letters or words / None) ›
  - *Bar numbers:* a `textarea.outline-list` - spaces, commas, semicolons and full stops all separate - › a line
    saying what was understood › `.outline-chips` › `.outline-chip` per mark.
  - *Letters or words:* `.outline-table` › `.outline-row.outline-row-marks` (bar, mark). Enter or Tab moves on; a
    new row appears when the last one is typed in.
  - *None:* one line; the step is otherwise empty.
- **Time (ML-425, a table like Speed):** a line saying what most of the piece is in (the main time signature is the commonest one, not the opening one, so a
  row for bar 1 is ordinary) › `.outline-table` ›
  `.outline-row.outline-row-time` (from bar, the time, bars, to bar - ML-442). The first row shows the main time, "Most of it"
  (`.outline-cell-fixed` × 4). In a row the time is `.outline-sig-cell`: a text box you type the time signature into
  ("3/4"; "3 4" is read too) with an `.outline-cell-btn` (the list icon) that opens the shared time signature pop-up
  - on a phone, tapping the empty box opens the pop-up, since the number keyboard has no slash. "Bars" and "to bar" say the
  same thing - typing either fills in the other, and one is needed; after the row the piece is back in the main time. A
  time signature that isn't in the list is added to the player's own as it is typed (ML-440). A new
  row appears when the last one is typed in › a check line saying, per row, what stops it ("Row 2: 4/5 isn't a time
  signature ..."), and the box it is about is outlined red (`.outline-row input[aria-invalid="true"]`, `--danger-text`) ›
  `.outline-sum` (what it comes to: "So far: 2/4 1 bar · everything else is 4/4") › Next. It replaced tapping every
  bar (0.39-0.41): on production no piece had more than five changes, but that step took up to 41 taps.
- **Speed:** a row for bar 1 changes the fixed Start row (it is the starting speed) and is never an error; the
  check line names the rows that can't be used ("Row 3 can't be used yet"); the blank last row is ignored.
- **Speed:** `.outline-table` › `.outline-row.outline-row-speed` (from bar, bpm, beat note). The first row is the
  start (`.outline-cell-fixed` × 3); the beat note of a row is an `.outline-cell-btn` ("same" until changed).
- **Repeats and Pauses (ML-435) are tables:** after Yes, `.outline-table` › `.outline-row.outline-row-repeat` (from
  bar, to bar, times, 1st ending, 2nd ending - five narrow number boxes; the two ending boxes filled in make it a
  repeat with endings) or `.outline-row.outline-row-pause` (in bar, on beat, beats held, and an `.outline-cell-btn`
  that switches Pause / Break). Empty boxes take the usual answer (twice; beat 1; 2 beats). A new row appears as the
  last is typed in; a row that can't be used is named with its reason ("Row 2: Its bar isn't in the piece."). They
  replaced a pop-up per repeat or pause (about four taps each).
- **The other Extras (intro, speeding up, signs - one question each; ML-448: no Yes / No - the answer is "no" until
  something is added, so Next carries on):** "If not, go straight on." (`.text-sm.text-muted`, until one is added) ›
  an `.outline-extra` per extra of that kind (icon › `.outline-extra-text`: what it is in words › chevron; tap
  to change or remove) › `.outline-add` "+ Add a repeat" / "+ Add another repeat" (repeats open `#flowChoiceModal`
  to pick plain or with endings; the others open the form directly) › `.outline-sum`. The repeats and pauses tables are on their steps from the start too.
- **Media (three steps, one question each, no Yes / No either):** an `.outline-extra` per file or
  link (icon › name over its size or address › a close icon; tapping the row takes it out) › `.outline-add`
  "+ Choose a recording" (opens the file picker) or, for YouTube, two `.form-group` boxes (the link, what to call
  it) and `.outline-add` "+ Add the link" › on the last step `.outline-sum` (Save the piece is the bottom bar's button). The form is `#outlineExtraModal`: number boxes in `.outline-three` /
  `.outline-pair`, pill pairs for the either/or answers, a line in plain words, Add it, Remove this extra.

## 4. Tokens used
- Layout: `--space-0-5`...`--space-3`, `--touch-target`, `--radius-md`, `--radius-lg`, `--radius-pill`.
- Text: `--font-xs`, `--font-sm`, `--font-lg`, `--font-weight-bold`, `--font-weight-semibold`,
  `--line-height-relaxed`, `--label-color`, `--text-color`.
- Surfaces: `--input-bg`, `--control-border`.
- A bar or shortcut that's marked / picked: `--primary-action-strong` on `--primary-action-tint` (the
  `.flow-choice-option.selected` pair). The first bar of a run: `--focus-ring`.
- Step dots: `--touch-target` (the button), `--space-3` (a dot), `--space-5` (this step's dot), `--radius-pill`,
  `--primary-action-strong` (been to / this step), `--control-border` (not reached yet).
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
- Each step dot is a real `<button>` with a full 44px target round the small dot, named after its step ("Pauses and
  breaks"); this step's has `aria-current="step"` and ", this step"; one not reached yet is `disabled` and says so.
  Size and name carry the meaning, not colour alone; the words "Extras: 4 of 5" say the same beside them. Going on
  to a later step by its dot runs the same checks as Next. Top-bar Back still goes back one step.
