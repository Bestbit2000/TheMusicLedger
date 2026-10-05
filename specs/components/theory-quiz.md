# Theory quiz

## 1. Metadata
- **Name:** Theory quiz (`.theory-intro`, `.theory-quiz-row`, `.theory-quiz-icon`, `.theory-grade`, `.theory-grade-dot`, `.theory-grade-dot-on`, `.theory-grade-lg`, `.theory-best-line`, `.theory-status`, `.theory-countdown`, `.theory-countdown-fill`, `.theory-question`, `.theory-prompt`, `.theory-meaning`, `.theory-feedback`, `.theory-answers`, `.theory-answers-notes`, `.theory-answers-symbols`, `.theory-answer`, `.theory-answer-right`, `.theory-answer-wrong`, `.theory-results-options`, `.theory-grade-block`, `.theory-trend`, `.theory-trend-bars`; ML-396 Levels: `.theory-steps`, `.theory-step` with `.is-got`, `.theory-lv-h1`, `.theory-lv-h2`, `.theory-lv-h3`, `.theory-lv-h4`, `.theory-lv-h5`, `.theory-level-trend`, `.theory-level-bars`, `.theory-level-slot`, `.theory-level-bar`, `.theory-level-when`, `.theory-exits`, `.theory-included-staffs`, `.theory-included`, `.theory-level-key`; SmartLearn: `.smartlearn-note` with `.is-on`, `.smartlearn-note-text`, `.smartlearn-more`)
- **Category:** System specific (the Theory tool)
- **Status:** New (ML-260 / ML-264; a round's result as a Level, ML-396)

## 2. Overview
The Theory tool's four screens: quiz list (Note names, Keys, Notation, Intervals and Chords - the last two only while Theory grades are on, ML-309 C - then Mixed - each with a subtitle so the rows match; one not tried yet has a "New" pill, `.flow-pill.flow-pill-accent`, where the last Level goes, ML-301) → options → question → results. Everything reuses the
shared components where one fits - list rows ([list-row](list-row.md)) for the quiz list, the
the metronome's value boxes and pop-ups for options ([metronome](metronome.md), [pick-list](pick-list.md)), primary/secondary
[buttons](button.md), [stat cards](stat-card.md) and the stats [bar chart](charts.md) pieces on the
results screen. A round's result is a **Level 1-5** in the practice Level colours (`.level-chip`, `.lv-N` - [practice-session](practice-session.md)); "grade" on screen only ever means the Theory grade picked (ML-396). Notation is always [notation](notation.md). The classes here only cover what's
particular to a timed quiz.

## 3. Anatomy
- **Quiz list:** `.theory-intro` › `.history-item.clickable.theory-quiz-row` × 4-6 (`.theory-quiz-icon` (a Bravura glyph) › `.history-details` (title, subtitle line) › `.level-chip.lv-N` the last Level - the chip alone, no "Level 4 · today" line).
- **Options (ML-396):** the boxes › `.btn-text` "What's included in Grade N?" (only until a round of that grade has been played; never for Custom) › the SmartLearn strip (`.smartlearn-note` › sparkle icon › `.smartlearn-note-text` › `.smartlearn-more` "Learn more"; `.is-on` = "SmartLearn applied" on the gold wash, without it "Learn faster with SmartLearn" in a quiet outline) › Start › `.section-title` "What I've played" › `.history-item.clickable.theory-quiz-row` per set of options played, newest first (`.history-details`: the set, a Custom set's inputs, "Today · played twice" › `.level-chip.lv-N` the last Level); the row matching the boxes is `.level-row-selected`; six rows, then a `.btn-text` "Show more".
- **Set pop-up (`#theorySetModal`, ML-396):** title (the set) › `.modal-intro` (played, last played) › `.section-title` "My last rounds" › `.theory-level-trend` › `.theory-level-bars` (a played row only) › "What's included" › `.theory-included-staffs` (Note names: a staff per clef with the lowest and highest note) › `.theory-included` (a line per thing asked - never how you answer) › "Levels for this round" › `.theory-level-key` (five `.level-chip`s, each over the right answers it takes - nothing about slips) › sticky footer: "Use these options" (`.btn-submit`), or Close (`.btn-nav`) from the "What's included" link.
- **Question:** `.theory-status` (clock left, tally right) › `.theory-countdown` › `.theory-countdown-fill` (timed rounds only) › `.theory-question` › `.theory-prompt` (a staff, a symbol, or `.theory-meaning` text) › `.theory-feedback` (always takes its line) › `.theory-answers` › `.theory-answer` × n.
- **Answer grids:** `.theory-answers` is 2 across (keys, symbol names, term meanings); `.theory-answers-notes` 7 across on the 8-column width, centred (the 7 naturals, ML-292); `.theory-answers-keyboard` the same 7 columns in three rows - sharps above, naturals, flats below, each placed in its black key's column by `data-id` (17 buttons, ML-292); `.theory-answers-symbols` 2 across, taller, each button drawing a symbol or term. The layout follows each question type, so a Mixed round changes it between a note and a key; but every note question in one round has the same buttons in the same places (ML-396) - the keyboard throughout if any note in the round has a sharp or flat.
- **SmartLearn pop-up (`#smartLearnModal`, ML-396):** title › `.modal-intro` (applied, or "an upgrade") › "What it does" and "Why it works", each a `.theory-included` list › sticky footer: Close (`.btn-nav`) where the account has it, "Upgrade now" (`.btn-submit`; "Upgrade requested", disabled, once sent) where it doesn't.
- **Results (ML-396):** `.theory-results-options` (one quiet line: what was played) › `.theory-grade-block` (`.theory-steps` › 5 `.theory-step.theory-lv-hN` + `.theory-best-line` "Level 4 · your best yet with these options" + `.theory-best-line` "2 more right answers for Level 5") › `.dashboard-grid` of 2 `.stat-card`s (Right "17 out of 18", Time - no score, wrong or accuracy) › `.section-title` "My last rounds" › `.theory-level-trend` › `.theory-level-bars` (8 fixed `.theory-level-slot`s: `.theory-level-bar.theory-lv-hN.lv-N` over `.theory-level-when`) › the SmartLearn strip (`.smartlearn-note`, plain outline - no gold wash next to the gold button: what it will bring back from this round, with Learn more; only with SmartLearn) › Again (`.btn-submit`) › `.theory-exits` (Change options / Another quiz / Home, three `.btn-nav`). The drill tools' results still use `.theory-grade` dots and `.theory-trend-bars`.

## 4. Tokens used
`--input-bg`, `--control-border`, `--text-color`, `--label-color`, `--success-text`, `--danger-text`,
`--primary-action-strong` (filled grade dots, countdown), `--input-border` (countdown track),
`--chart-hours` (the drills' trend bars), `--level-1`…`--level-5` and their `-text` (through `.lv-N`), `--level-unset-border`, `--focus-ring` (your Level, this round), `--radius-xs`, `--line-height-tight`, `--line-height-base`, `--font-xs`, `--radius-md`, `--radius-circle`, `--touch-target`, `--icon-md`,
`--icon-xl`, `--space-1`…`--space-5`, `--font-sm`, `--font-base`, `--font-md`, `--font-lg`,
`--font-weight-bold`, `--duration-fast`.

## 5. Props / API
- **One tap per answer**, always (ML-260): every answer is a button. Note names show one button per
  note: the 7 naturals, or with sharps or flats on the whole keyboard - 5 sharps, 7 naturals, 5 flats
  (no E♯, B♯, C♭ or F♭: they're white keys, and never asked). The written note says which spelling is right.
- A right answer marks green with a tick and moves on after 150 ms; a wrong one marks the tapped button
  red with a cross, the right one green with a tick, says "Not quite: it's X" (or the question's own
  `feedback`, which says why - the chromatic scale's Yes/No, ML-309 C), and moves on after 1.5 s.
- ML-309 C question types use the same `.theory-answers` grid with 2, 3 or 4 buttons (chromatic scale
  Yes/No; inversions and cadences 3; Grade 4 chords I/IV/V 3). An odd button sits alone on the last row. Taps in the first 0.3 s of a question are ignored (double taps).
- Level (ML-396): five steps rising in height and colour (`.theory-lv-hN` is N+1 units tall; the unit, `--theory-lv-unit`, is set by `.theory-steps` and, smaller, by `.theory-level-bars`). Steps up to yours are filled `.lv-N`, yours is ringed (`.is-got`), the ones above are dashed outlines (`.lv-0`). The same bars, one per round, are the last-rounds chart; the newest is ringed and labelled "Now" on the results screen (`.is-now`). The score is never shown - the Level is worked out from it.
- Wording stays positive: "17 out of 18" right (no wrong count), "2 more right answers for Level 5", and nothing about what a slip costs.
- The drill tools show Levels too (ML-406): the same steps, bars, chips, list rows and set pop-up - see [drills](drills.md).
- Timed rounds show the countdown bar (`transform: scaleX()` from JS); fixed rounds hide it and the
  clock counts up.
- Options (owner, 2026-10-01): two sections, each a `.tool-group` with a `.tool-group-title` - **Content**
  (Theory grade, Clef, and on Custom the quiz's own options) and **Length** (Round, Repeat) - of value
  boxes two to a row (`.metro-transport-grid.metro-transport-grid-2` › `.metroBlk-ctrl-value-btn`: the
  value over a lower-case caption). Each box opens a pop-up: the choice list (`#flowChoiceModal`, the one
  on now ticked; Theory grade lists Grade 1 first and Custom last), or for Clef - the one multi-select -
  a [pick list](pick-list.md) (`#theoryPickModal`, no Select all bar, at least one clef stays ticked).
  Note names' sharps and flats show the Bravura signs (♯, ♭, ♯ ♭ for Both) in the box and in the rows.
- Scoring, grades and every rule: `docs/theory-practice.md`.

## 6. States
| State | Treatment |
|---|---|
| Answer default | `--input-bg`, 2px `--control-border`, `--text-color` |
| Right | border + text `--success-text`, tick icon |
| Wrong (tapped) | border + text `--danger-text`, cross icon, plus the "Not quite" line |
| Grade dot on / off (drills) | filled `--primary-action-strong` / 2px `--control-border` outline |
| Level step reached / yours / still ahead | `.lv-N` fill / `.lv-N` + `--focus-ring` / 2px dashed `--level-unset-border`, `--label-color` number |
| SmartLearn strip with / without it | `--primary-action-tint` fill + `--primary-action-strong` border / no fill, `--control-border`; icon `--primary-action-strong`, text `--text-color`, Learn more `--link-color` underlined |
| Played row matching the boxes | `.level-row-selected` (`--primary-action-strong` border + `--focus-ring`), `aria-current="true"` |

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
- WCAG 2.2.1 (timing adjustable): the fixed 10-question round has no time limit at all.
- The staff prompt is labelled without giving the answer away ("A note on the treble staff").
- The Level steps are `role="img"` with "Level N of 5"; a Level chip says "Last Level N of 5"; the last-rounds bars are `role="img"` listing the Levels. Level is never colour alone: every bar and chip carries its number, and height follows it.
- The set pop-up is a dialog (`showModal`): focus moves in, Escape and the backdrop close it, focus returns to the row or link. The staff is labelled "The lowest and highest notes asked on the treble staff".
- Leaving a round part-way asks first (the standard confirm modal).

See [accessibility foundation](../foundations/accessibility.md).

## Between rounds (ML-439)

On a repeated test (×2 to ×5) the play screen swaps its question for a break between rounds, until **Next round**
is tapped. It is built only from what the results screen already has - nothing new to style:
`h2.step-question.text-center` ("Round 2 of 3 done") › `.theory-grade-block` (`.theory-steps`, that round's Level;
`.theory-best-line`, "Level 3 that round. Keep it up - one more round to go.") › `.section-title` ("This test so
far") › `.theory-level-trend` (`.theory-level-bars`: a bar per round of this test, labelled Round 1, Round 2,
the newest ringed and called Now) › `.btn-submit` (Next round / Last round). Focus goes to the heading. The
clock is stopped while it shows. Wording is positive only (ML-396): Levels, never a score or what was wrong.

## Keys answers (ML-438)

The Keys quiz (and Keys questions in Mixed and weak spots) answers on the note keyboard, `.theory-answers-keyboard`,
with an 18th button, C flat, in the free place under C (`[data-id="Cb"]`, grid row 3, column 1). A scale with major
and minor keys in play has a second row under it, `#theoryModes` (`.theory-answers.mt-2`: two `.theory-answer`
buttons, Major and Minor). The half of a two-tap answer picked so far has the app's selected look
(`.theory-answer[aria-pressed="true"]`: `--primary-action-strong` outline and text on `--primary-action-tint`);
once both are tapped each half is marked right or wrong like any answer (never colour alone: a tick or a cross).
