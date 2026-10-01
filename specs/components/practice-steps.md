# Practice steps (setting up a session)

## 1. Metadata
- **Name:** Practice steps (`.steps-progress`, `.steps-progress-step` with `.is-done` / `.is-now`, `.step-question`,
  `.time-blocks`, `.time-block` with `.is-new` / `.is-more`, `.open-ended-option`, `.open-ended-icon`, `.plan-card`,
  `.plan-card-head`, `.kind-strip`, `.kind-strip-more`, `.kind-key`, `.kind-block`, `.kind-block-label`, `.kind-block-icon`,
  `.is-empty`, `.kind-warmup`, `.kind-scales`, `.kind-skills`, `.kind-pieces`, `.build-slots`, `.build-slot`,
  `.build-slot-time`, `.build-palette`, `.build-add`, `.session-goal`, `.session-goal-card`, `.session-piece`,
  `.session-piece-head`, `.levelup`, `.levelup-stars`, `.levelup-pair`, `.is-celebrating`, `.warmup-loop`,
  `.warmup-loop-icon`)
- **Category:** Flow / input
- **Status:** New (ML-390)

## 2. Overview
Starting a practice session is three steps with one question each, for a ten-year-old who knows nothing about
music: **How long** (time as 5-minute blocks you can count), **Pick a plan** (each plan a row of coloured blocks,
or Build my plan), **What goes in** (warm-up list, skills list, where the pieces come from, Auto), then **Ready**.
- **The steps bar** (`.steps-progress`) sits at the top of each step - gold for done and now, grey for to come.
- **The kinds of block** (`.kind-block` + `.kind-warmup` / `.kind-scales` / `.kind-skills` / `.kind-pieces`)
  are orange, teal, violet and blue - kept away from the Levels' silver and gold - and **always carry their icon**
  (and, where there's room, their name), so the colour never works alone. A Pieces block's icon says its stage:
  music note (practice), construction (Prepare), play circle (Play-through).
- **Build my plan** is tap-to-add, not drag: tap a kind in `.build-palette` to drop it in the next empty
  `.build-slot`; tap a slot to empty it.
- **"Did you nail it?"** (`.levelup` in `#levelRateModal`): the Level pair (1 -> 2), one-tap Yes / Not yet, and a
  short star pop on a Yes (`.is-celebrating`, none with reduced motion).
- **The warm-up loop card** (`.warmup-loop`) tops the Warm-ups screen during a session's Warm-up block.
- **Don't use** the kind colours for anything but kinds of practice block.

## 3. Anatomy
- Step 1: `.steps-progress` › `.step-question` › the stepper (the number is tap-to-type, rounded to 5 minutes; under it
  just "minutes") and slider › "N blocks of 5 minutes" › `.time-blocks` › `.time-block` × blocks (+ a dashed `.is-more`
  when open-ended) › `.flow-choice-option.open-ended-option`. The blocks are **one strip across the width**, thinner
  as the minutes go up, with no numbers - display only, so nothing on it looks tappable (owner, 1 Oct 2026; the
  quick picks went too).
- Step 2: `.flow-choice-option.plan-card` › `.plan-card-head` (name, blurb) + `.kind-strip` › `.kind-block` × blocks;
  under the plans, **the key** (`.kind-key` › `span` › a small `.kind-block.kind-*` + its name): Warm-up, Scales, Skills,
  Pieces - the first screen the symbols appear on (owner, 1 Oct 2026). `aria-hidden`: each plan card already says its
  blocks in words.
- Build: `.build-slots` › `button.kind-block.build-slot` (`.build-slot-time` - in the kind's `-text` colour on a filled
  slot, `--label-color` on an empty one - icon, `.kind-block-label`) ›
  `.build-palette` › `button.kind-block.build-add` × 4.
- Step 3: `.history-item.settings-link` rows with a `.kind-block` in the icon slot; the Pieces `.flow-card` ›
  `.session-goal` ("Next goal: every 1 up to 2") › `.session-piece` rows with a `.level-strip`.
- Ready: `.kind-strip` › block rows (`.history-item` › `.level-row-body` › `.session-block-time` + `.kind-block`).

## 4. Tokens used
- **Kinds:** `--kind-warmup`, `--kind-scales`, `--kind-skills`, `--kind-pieces` (edges), their `-text` variants
  (icon and name, 4.5:1 on the tint in both themes) and `-tint` fills.
- **Steps and time blocks:** `--primary-action`, `--primary-action-tint`, `--primary-action-strong`, `--input-border`,
  `--control-border`, `--label-color`, `--text-color`.
- **Spacing, shape, type, motion:** `--space-0-5`…`--space-6`, `--radius-md`, `--radius-lg`, `--radius-pill`,
  `--touch-target`, `--icon-md`…`--icon-xl`, `--font-xs`…`--font-xl`, `--font-weight-*`, `--line-height-tight`,
  `--duration-base`, `--duration-slow`, `--opacity-muted`.

## 5. Props / API
- Rules: `public/practicePlan.js` - `blockKinds` (plans at any length; your own plan's row repeats from its first
  Skills or Pieces block), `openKindAt` (Keep going), `piecePool` / `fillBlocks` (Auto), `restBefore`, `playSeconds`.
- Screens: app.js, the "ML-390 (was ML-320's planner)" section - `openSessionSetup`, `renderSessLength`,
  `renderSessPick`, `openBuilder` / `renderBuild`, `renderSessContent`, `renderSessionPlan`; `kindBlockHtml` draws a block.
- Your own plans: `practice_templates.blocks` (migration 087), `POST/PUT /api/practice/templates` with `{ name, blocks }`.

## 6. States
| State | Treatment |
|---|---|
| Step done / now / to come | `.steps-progress-step.is-done` / `.is-now` (gold bar; now = text colour) / plain (grey) |
| New time block | `.time-block.is-new` pops in (`block-pop`); only the new ones animate |
| Open-ended | `.time-block.is-more` dashed, empty; `.open-ended-option.selected` |
| Plan picked | `.plan-card.selected` (the `.flow-choice-option` selected state) |
| Empty slot | `.kind-block.is-empty` - dashed, outline icon |
| Levelled up | `.levelup.is-celebrating` - the stars and the new Level pop once |

## 7. Code example
```html
<ol class="steps-progress" aria-label="Setting up your practice, step 2 of 3">
  <li class="steps-progress-step is-done">How long</li>
  <li class="steps-progress-step is-now" aria-current="step">Plan</li>
  <li class="steps-progress-step">What's in it</li>
</ol>
<button type="button" class="flow-choice-option level-answer plan-card selected" aria-pressed="true">
  <span class="plan-card-head"><strong>Standard</strong><span class="text-sm text-muted">A bit of everything</span></span>
  <span class="kind-strip">
    <span class="kind-block kind-warmup" aria-hidden="true"><span class="material-symbols-outlined">local_fire_department</span></span>
    <span class="kind-block kind-pieces" aria-hidden="true"><span class="material-symbols-outlined">music_note</span></span>
  </span>
</button>
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
