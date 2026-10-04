# Practice steps (setting up a session)

## 1. Metadata
- **Name:** Practice steps (`.steps-progress`, `.steps-progress-step` with `.is-done` / `.is-now`, `.steps-progress-back`, `.kind-key-label`, `.kind-key-items`, `.step-question`,
  `.time-blocks`, `.time-block` with `.is-new` / `.is-more`, `.plan-card`,
  `.plan-card-head`, `.plan-row` with `.has-menu`, `.kind-strip`, `.kind-strip-compact`, `.kind-strip-more`, `.kind-key`, `.kind-block`, `.kind-block-label`, `.kind-block-icon`,
  `.is-empty`, `.kind-warmup`, `.kind-scales`, `.kind-skills`, `.kind-pieces`, `.kind-theory`, `.build-slots`, `.build-slot`,
  `.build-slot-time`, `.build-palette`, `.build-add`, `.session-goal`, `.session-goal-card`, `.session-piece`,
  `.session-piece-head`, `.levelup`, `.levelup-stars`, `.levelup-pair`, `.is-celebrating`, `.warmup-loop`,
  `.warmup-loop-icon`)
- **Category:** Flow / input
- **Status:** New (ML-390)

## 2. Overview
Starting a practice session is three steps with one question each, for a ten-year-old who knows nothing about
music: **How long** (time as 5-minute blocks you can count), **What kind** (ML-418: one button naming the plan, which opens
the Pick a plan pop-up; the plan's blocks in colour underneath), **What's in it** (warm-up list, skills list, where the pieces come from, Auto), then **Ready**.
- **The steps bar** (`.steps-progress`) sits at the top of each step - gold for done and now, grey for to come.
  **A step already done is a way back** (ML-420): its label is a `<button class="steps-progress-back" data-step-back="<view>">`
  with a small tick (done) in the link colour (`--link-color`, the gold of its bar - no chevron or underline, which read as a stray link; the underline comes on hover and focus); tapping it goes back to that step and keeps what you chose since.
  The step you're on and the ones to come are plain text - you can't jump forwards.
- **The kinds of block** (`.kind-block` + `.kind-warmup` / `.kind-scales` / `.kind-skills` / `.kind-pieces` / `.kind-theory`)
  are orange, teal, violet, blue and (Theory, ML-418, a book) deep pink - kept away from the Levels' silver and gold - and **always carry their icon**
  (and, where there's room, their name), so the colour never works alone. A Pieces block's icon says its stage:
  music note (practice), construction (Prepare), play circle (Play-through).
- **Build my plan** is tap-to-add, not drag: tap a kind in `.build-palette` to drop it in the next empty
  `.build-slot`; tap a slot to empty it.
- **"Did you nail it?"** (`.levelup` in `#levelRateModal`): the Level pair (1 -> 2), one-tap Yes / Not yet, and a
  short star pop on a Yes (`.is-celebrating`, none with reduced motion).
- **The warm-up loop card** (`.warmup-loop`) tops the Warm-ups screen during a session's Warm-up block.
- **Don't use** the kind colours for anything but kinds of practice block.

## 3. Anatomy
- Step 1 (ML-413): **Same as last time** above everything - a `.history-item.settings-link` row (replay icon; "25 minutes · Lesson prep · skips the steps"), because it skips all three steps - then `.steps-progress` › `.step-question` › **Set a time / Open ended** (a two-pill `.radio-group`, the Timer's wording; it was a "Keep going" card under the blocks) › for a set time, the stepper (the number is tap-to-type, rounded to 5 minutes; under it
  just "minutes") and slider › "N blocks of 5 minutes" › `.time-blocks` › `.time-block` × blocks (+ a dashed `.is-more`
  when open ended, under "No end time. Starts with 4 blocks of 5 minutes and adds more as you play." - the stepper and slider are hidden then). The blocks are **thin grey bars** (ML-419: `--time-strip-height`, `--control-border`, pill ends - the look of the running session's strip; they were gold boxes that read as buttons above the gold Next button), **one strip across the width**, thinner
  as the minutes go up, with no numbers - display only, so nothing on it looks tappable (owner, 1 Oct 2026; the
  quick picks went too).
- Step 2 (ML-418, "one button, one pop-up"): `#sessPlanBtn` (`.metroBlk-ctrl-value-btn.w-full`: the plan's name over "plan") › a line saying what's in it (`.text-sm.text-muted`) › `.kind-strip` › `.kind-block` × blocks. The button
  opens **`#sessPlanModal`**: *Standard plans* and *My plans* (with **+ New plan** beside that heading), each plan a
  `.plan-row` › `.flow-choice-option.level-answer` (name, a few words - no blocks, so the list stays short); one of
  your own is `.plan-row.has-menu` with a `.list-item-menu-btn` ⋮ **inside the box, top right** (Change, Delete).
  Tapping a row only selects it; the pop-up's sticky footer shows the plan picked once, small
  (`.kind-strip.kind-strip-compact`), and **Use this plan**. + New plan and Change open Build my plan and come back
  with that plan picked. (`.plan-card` / `.plan-card-head` are still used by Add a piece's open row.)
  Under the blocks on the page, with space between, **the key** (ML-420: `.kind-key-label` "Key:" then the kinds on one line, `.kind-key-items`; it wraps only with all five) (`.kind-key` › `span` › a small `.kind-block.kind-*` + its name): the kinds this plan has, from Warm-up, Scales, Skills,
  Pieces and Theory - the first screen the symbols appear on (owner, 1 Oct 2026). `aria-hidden`: each plan card already says its
  blocks in words.
- Build: `.build-slots` › `button.kind-block.build-slot` (`.build-slot-time` - in the kind's `-text` colour on a filled
  slot, `--label-color` on an empty one - icon, `.kind-block-label`) ›
  `.build-palette` › `button.kind-block.build-add` × 4.
- Step 3: `.history-item.settings-link` rows with a `.kind-block` in the icon slot; the Pieces `.flow-card` ›
  `.session-goal` ("Next goal: every 1 up to 2") › `.session-piece` rows with a `.level-strip`.
- Ready: `.kind-strip` › block rows (`.history-item` › `.level-row-body` › `.session-block-time` + `.kind-block`).

## 4. Tokens used
- **Kinds:** `--kind-warmup`, `--kind-scales`, `--kind-skills`, `--kind-pieces`, `--kind-theory` (edges), their `-text` variants
  (icon and name, 4.5:1 on the tint in both themes) and `-tint` fills.
- **Steps and time blocks:** `--primary-action`, `--primary-action-tint`, `--primary-action-strong`, `--input-border`,
  `--control-border`, `--label-color`, `--text-color`.
- **Spacing, shape, type, motion:** `--space-0-5`…`--space-6`, `--radius-md`, `--radius-lg`, `--radius-pill`,
  `--touch-target`, `--icon-md`…`--icon-xl`, `--font-xs`…`--font-xl`, `--font-weight-*`, `--line-height-tight`,
  `--duration-base`, `--duration-slow`, `--opacity-muted`.

## 5. Props / API
- Rules: `public/practicePlan.js` - `blockKinds` (plans at any length; your own plan's row repeats from its first
  Skills or Pieces block), `openKindAt` (open ended), `piecePool` / `fillBlocks` (Auto), `restBefore`, `playSeconds`.
- Screens: app.js, the "ML-390 (was ML-320's planner)" section - `openSessionSetup`, `renderSessLength`,
  `renderSessPick`, `openBuilder` / `renderBuild`, `renderSessContent`, `renderSessionPlan`; `kindBlockHtml` draws a block.
- Your own plans: `practice_templates.blocks` (migration 087), `POST/PUT /api/practice/templates` with `{ name, blocks }`.

## 6. States
| State | Treatment |
|---|---|
| Step done / now / to come | `.steps-progress-step.is-done` (its label a `.steps-progress-back` button) / `.is-now` (gold bar; now = text colour) / plain (grey) |
| New time block | `.time-block.is-new` pops in (`block-pop`); only the new ones animate |
| Open ended | the Open ended pill checked; the stepper and slider hidden; four blocks and a dashed, empty `.time-block.is-more` |
| Plan picked (in the pop-up) | `.plan-row .flow-choice-option.selected` (`aria-pressed="true"`) |
| Empty slot | `.kind-block.is-empty` - dashed, outline icon |
| Levelled up | `.levelup.is-celebrating` - the stars and the new Level pop once |

## 7. Code example
```html
<ol class="steps-progress" aria-label="Setting up your practice, step 2 of 3">
  <li class="steps-progress-step is-done"><button type="button" class="steps-progress-back" data-step-back="sessionLengthView" aria-label="Back to How long"><span class="material-symbols-outlined" aria-hidden="true">check</span>How long</button></li>
  <li class="steps-progress-step is-now" aria-current="step">What kind</li>
  <li class="steps-progress-step">What's in it</li>
</ol>
<button type="button" class="metroBlk-ctrl-value-btn w-full" id="sessPlanBtn" aria-haspopup="dialog"><strong>Standard</strong><span class="metroBlk-ctrl-value-label">plan</span></button>
<div class="kind-strip">
  <span class="kind-block kind-warmup" aria-hidden="true"><span class="material-symbols-outlined">local_fire_department</span></span>
  <span class="kind-block kind-theory" aria-hidden="true"><span class="material-symbols-outlined">menu_book</span></span>
</div>
<!-- in the pop-up: one of your own plans, its ⋮ inside the box -->
<div class="plan-row has-menu">
  <button type="button" class="flow-choice-option level-answer" aria-pressed="false"><span><strong>Before band</strong><br><span class="text-sm text-muted">Warm-up, Pieces</span></span></button>
  <button type="button" class="list-item-menu-btn" aria-label="Options for Before band" aria-haspopup="menu" aria-expanded="false"><span class="material-symbols-outlined" aria-hidden="true">more_vert</span></button>
</div>
```

## 8. Cross-references
[practice-session](practice-session.md) (the bar and strip while it runs) · [rest-screen](rest-screen.md) ·
[piece-path](piece-path.md) · [level-map](level-map.md) · [list-row](list-row.md) · [pick-list](pick-list.md) ·
[modal](modal.md) · docs/practice-sessions.md.

## 9. Accessibility
- Every kind block pairs its colour with an icon; wherever the block says something on its own it has a
  `.kind-block-label` or the row's text next to it. Colour-only blocks in a strip are `aria-hidden` and the card or
  row has the words (a plan card's `aria-label` lists its blocks).
- Build slots and palette tiles are real buttons (44px+), each with an `aria-label` ("10 to 15 minutes: Skills. Tap to
  empty"); focus stays on the tile you tapped. The hint line is `aria-live="polite"`.
- The steps bar is an `<ol>` with `aria-current="step"`; the time readout is `aria-live="polite"`.
- Animations (`block-pop`, the stars) are off with `prefers-reduced-motion`.
