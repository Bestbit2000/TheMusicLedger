# Practice session (bar and block strip)

## 1. Metadata
- **Name:** Practice session (`.session-bar`, `.session-bar-row`, `.session-strip`, `.session-seg`, `.session-block-time`; states `.is-done`, `.is-now` on `.session-seg`)
- **Category:** Navigation / status
- **Status:** New (ML-320, epic ML-314)

## 2. Overview
The practice session builder plans a session of 5-minute blocks (Warm-up, Scales, Skills, Pieces) and
runs it: the sound stops at 4:30 when a rest follows, then the 30-second rest (ML-390, [rest-screen](rest-screen.md)).
Setting it up is three steps since ML-390 ([practice-steps](practice-steps.md)). These classes are the bar and strip
while it runs. Everything else reuses existing components:
- the stepper: `.metro-speed-row` / `.metro-bpm-step` / `.metro-speed-readout`
- the choices: `.filter-pill`
- the block rows: `.history-item` + `.level-row-body`
- the choice pop-ups: `.flow-choice-option.level-answer` in a `.modal`
- the rest: its own screen, `#sessionRestView` ([rest-screen](rest-screen.md))

**Session bar.** While a session runs it sits under the top bar, inside `.top-bar-sticky-group`, so it
stays put on every screen except the session's own. It shows which block, the time left in it and the
strip of blocks. Tap it to open the session screen.

**Block strip.** One segment per 5-minute block: done blocks are gold, the block you're on is dark gold,
and the rest are grey. It's used on the planner, the session screen and the bar.

- **Don't use** these for anything that isn't a practice session.

## 3. Anatomy
- **Bar:** `button.session-bar` › `.session-bar-row` (text + `strong` time) › `.session-strip`.
- **Strip:** `.session-strip` › `.session-seg` (+ `.is-done` / `.is-now`) × blocks.
- **Block row (planner):** `.history-item` › `.level-row-body` › `.session-block-time` ("10–15") + kind
  and detail.

## 4. Tokens used
- **Colours:** `--container-bg`, `--text-color`, `--primary-action-strong` (the bar's bottom rule and the
  current segment), `--primary-action` (done segments), `--control-border` (blocks still to come)
- **Spacing and shape:** `--space-0-5`…`--space-8`, `--radius-2xs`, `--app-max-width`
- **Size and type:** `--touch-target`, `--font-sm`, `--font-weight-semibold`

## 5. Props / API
- Rules: `public/practicePlan.js` (PracticePlan.blockKinds / fillBlocks / blockState).
- Runner: app.js, the "ML-390 (was ML-320's planner)" section: `practiceRun`, `renderPracticeRun` (keeps the bar
  and strips in step every second and on every `switchView`), `sessionTimeUp`, `sessionAfterBlock`, `startRest`,
  `finishPracticeRun`.
- Home: `#startPracticeSessionBtn` replaces `#startChallengeBtn` when `practice_levels` is on.

## 6. States
| State | Treatment |
|---|---|
| Block done | `.session-seg.is-done` - `--primary-action` |
| Block now | `.session-seg.is-now` - `--primary-action-strong` |
| Block to come | `.session-seg` - `--control-border` |
| Bar hidden | No session, the session has ended, or you're on the session screen itself |
| Focus | The global `--focus-ring` on the bar |

## 7. Code example
```html
<button type="button" class="session-bar" aria-label="Practice session - open">
  <span class="session-bar-row"><span>Block 3 of 9 · Skills</span><strong>2:10</strong></span>
  <span class="session-strip" aria-hidden="true"><span class="session-seg is-done"></span><span class="session-seg is-now"></span><span class="session-seg"></span></span>
</button>
```

## 8. Cross-references
[level-map](level-map.md) (Rehearsal blocks practise at a Level) · [top-bar](top-bar.md) ·
[list-row](list-row.md) · [modal](modal.md) · [filter-strip](filter-strip.md) · docs/flow-journey.md
("Practising at a Level").

## 9. Accessibility
- **The bar** is a real `<button>` with a label and a 44px minimum height. Its text says the block and
  the time, so nothing depends on the strip's colours. The strip is `aria-hidden`.
- **The rest** (ML-390) is its own screen - see [rest-screen](rest-screen.md). There's no Skip: the rest is the point.
- **The minutes readout** on the planner is `aria-live="polite"`.
