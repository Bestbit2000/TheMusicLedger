# Theory quiz

## 1. Metadata
- **Name:** Theory quiz (`.theory-intro`, `.theory-quiz-row`, `.theory-quiz-icon`, `.theory-grade`, `.theory-grade-dot`, `.theory-grade-dot-on`, `.theory-grade-lg`, `.theory-best-line`, `.theory-status`, `.theory-countdown`, `.theory-countdown-fill`, `.theory-question`, `.theory-prompt`, `.theory-meaning`, `.theory-feedback`, `.theory-answers`, `.theory-answers-notes`, `.theory-answers-symbols`, `.theory-answer`, `.theory-answer-right`, `.theory-answer-wrong`, `.theory-results-options`, `.theory-grade-block`, `.theory-trend`, `.theory-trend-bars`)
- **Category:** System specific (the Theory tool)
- **Status:** New (ML-260 / ML-264)

## 2. Overview
The Theory tool's four screens: quiz list (Note names, Keys, Notation, Mixed - each with a subtitle so the rows match; one not tried yet has a "New" pill, `.flow-pill.flow-pill-accent`, where the grade dots go, ML-301) → options → question → results. Everything reuses the
shared components where one fits - list rows ([list-row](list-row.md)) for the quiz list, the
[radio-group](radio-group.md) pills (and their multi-select variant) for options, primary/secondary
[buttons](button.md), [stat cards](stat-card.md) and the stats [bar chart](charts.md) pieces on the
results screen. Notation is always [notation](notation.md). The classes here only cover what's
particular to a timed quiz.

## 3. Anatomy
- **Quiz list:** `.theory-intro` › `.history-item.clickable.theory-quiz-row` × 4 (`.theory-quiz-icon` (a Bravura glyph) › `.history-details` (title, subtitle line, last grade) › `.theory-grade` last grade).
- **Question:** `.theory-status` (clock left, tally right) › `.theory-countdown` › `.theory-countdown-fill` (timed rounds only) › `.theory-question` › `.theory-prompt` (a staff, a symbol, or `.theory-meaning` text) › `.theory-feedback` (always takes its line) › `.theory-answers` › `.theory-answer` × n.
- **Answer grids:** `.theory-answers` is 2 across (keys, symbol names, term meanings); `.theory-answers-notes` 7 across on the 8-column width, centred (the 7 naturals, ML-292); `.theory-answers-keyboard` the same 7 columns in three rows - sharps above, naturals, flats below, each placed in its black key's column by `data-id` (17 buttons, ML-292); `.theory-answers-symbols` 2 across, taller, each button drawing a symbol or term. The layout follows each question, so a Mixed round changes it question by question.
- **Results:** `.theory-results-options` › `.theory-grade-block` (`.theory-grade.theory-grade-lg` + `.theory-best-line`) › `.dashboard-grid` of 4 `.stat-card`s › `.section-title` › `.theory-trend` › `.theory-trend-bars` (8 fixed slots of `.chart-bar-container`/`.chart-bar`) › Again (`.btn-submit`) / Change options (`.btn-nav`).

## 4. Tokens used
`--input-bg`, `--control-border`, `--text-color`, `--label-color`, `--success-text`, `--danger-text`,
`--primary-action-strong` (filled grade dots, countdown), `--input-border` (countdown track),
`--chart-hours` (trend bars), `--radius-md`, `--radius-circle`, `--touch-target`, `--icon-md`,
`--icon-xl`, `--space-1`…`--space-5`, `--font-sm`, `--font-base`, `--font-md`, `--font-lg`,
`--font-weight-bold`, `--duration-fast`.

## 5. Props / API
- **One tap per answer**, always (ML-260): every answer is a button. Note names show one button per
  note: the 7 naturals, or with sharps or flats on the whole keyboard - 5 sharps, 7 naturals, 5 flats
  (no E♯, B♯, C♭ or F♭: they're white keys, and never asked). The written note says which spelling is right.
- A right answer marks green with a tick and moves on after 150 ms; a wrong one marks the tapped button
  red with a cross, the right one green with a tick, says "Not quite: it's X", and moves on after
  1.5 s. Taps in the first 0.3 s of a question are ignored (double taps).
- Grade: 5 dots, filled = the grade (`.theory-grade-dot-on`). `.theory-grade-lg` on the results screen.
- Timed rounds show the countdown bar (`transform: scaleX()` from JS); fixed rounds hide it and the
  clock counts up.
- Options: single choices are radio pills; Clef is the checkbox variant. `.compact` only for exactly
  three options (it's three to a row on a phone); two or four go two to a row.
- Scoring, grades and every rule: `docs/theory-practice.md`.

## 6. States
| State | Treatment |
|---|---|
| Answer default | `--input-bg`, 2px `--control-border`, `--text-color` |
| Right | border + text `--success-text`, tick icon |
| Wrong (tapped) | border + text `--danger-text`, cross icon, plus the "Not quite" line |
| Grade dot on / off | filled `--primary-action-strong` / 2px `--control-border` outline |

## 7. Code example
```html
<div class="theory-answers theory-answers-notes">
  <button type="button" class="theory-answer" data-id="C">C</button>
  <button type="button" class="theory-answer theory-answer-right" data-id="D"><span class="material-symbols-outlined" aria-hidden="true">check</span>D</button>
</div>
```

## 8. Cross-references
[notation](notation.md) · [list-row](list-row.md) · [radio-group](radio-group.md) · [stat-card](stat-card.md) · [charts](charts.md) · [tool-icon-button](tool-icon-button.md)

## 9. Accessibility
- Every answer is a `<button>` of at least `--touch-target`. Symbol answers carry the symbol's name as
  `aria-label` (for a screen reader the question becomes meaning-to-name).
- Right/wrong is never colour alone: tick/cross icons plus the "Not quite: it's X" text, which is a
  polite live region (`role="status"`).
- WCAG 2.2.1 (timing adjustable): the fixed 10/20-question rounds have no time limit at all.
- The staff prompt is labelled without giving the answer away ("A note on the treble staff").
- Grade dots are `role="img"` with "Grade N of 5"; the trend is `role="img"` listing the scores.
- Leaving a round part-way asks first (the standard confirm modal).

See [accessibility foundation](../foundations/accessibility.md).
