# Rest screen

## 1. Metadata
- **Name:** Rest screen (`.rest-screen`, `.rest-ring`, `.rest-ring-svg`, `.rest-ring-track`, `.rest-ring-left`,
  `.rest-ring-num`, `.rest-card`, `.rest-art`, `.rest-kind`, `.rest-title`, `.rest-body`, `.rest-breath`,
  `.rest-breath-word`, `.rest-next`)
- **Category:** Feedback / status
- **Status:** New (ML-390)

## 2. Overview
The 30-second rest between practice blocks - in music the rest is as important as the notes. It comes before
every playing block except the first (never before a Prepare or a Play-through). Between two **Theory** blocks
(ML-418) the same screen is a **10-second break** instead - one fixed line ("A ten-second break"), nothing drawn
from your message deck. The sound has stopped; a calm
panel in its own colours shows a countdown ring, one message with a picture, and Next up. **No Skip button** - the
next block starts by itself at 0.
- **The message** comes from the player's own shuffled deck (`GET /api/practice/rest-message`, Admin -> Rest
  messages): why we stop, a breath, loosening up, thinking like a musician, a fact, looking after yourself, kind words.
- **Breathing ones** show a circle that grows for 4 seconds and shrinks for 6 (`--duration-breath`), with "in" /
  "out" in it - three breaths fill the rest.
- **Don't use** these colours or this panel anywhere but the rest.

## 3. Anatomy
`.rest-screen` › `.rest-ring` (`svg.rest-ring-svg` › `circle.rest-ring-track` + `circle.rest-ring-left`
(`pathLength="100"`), `.rest-ring-num` › `strong` seconds + "seconds") › `section.rest-card` (`.rest-art` › an icon
or `.rest-breath` › `.rest-breath-word`, `.rest-kind`, `h2.rest-title`, `.rest-body`) › `.rest-next` (a
`.kind-block.kind-block-icon` + "Next up" and the block; when the next block is a piece, a `p.text-sm` under it -
"Get the music ready: Floral Dance, open at bar 33." - owner, 1 Oct 2026).

## 4. Tokens used
`--rest-bg` (the panel), `--rest-surface` (the card and Next up), `--rest-text` (the countdown, the kind, the icon),
`--rest-ring` (ring and breathing circle edge), `--rest-track`, `--text-color`, `--label-color`; `--radius-xl`,
`--radius-lg`, `--radius-circle`; `--space-2`…`--space-5`; `--touch-target`, `--icon-xl`; `--font-xs`, `--font-lg`,
`--font-2xl`; `--duration-pulse` (ring), `--duration-breath` (breathing). Run-time: `--rest-left` (0-1, the time
left - set by `renderRest`, read by `.rest-ring-left`).

## 5. Props / API
- Runner: app.js, "The 30-second rest (ML-390)" - `startRest`, `renderRestMessage`, `renderRest`, `endRest`.
  `PracticePlan.restBefore` / `playSeconds` decide where rests go.
- Messages: `rest_messages`, `account_rest_decks` (migration 087), `server/services/restMessages.js`,
  `PracticePlan.drawRest` (once each, never the same kind twice running, a breath at least every third rest).

## 6. States
| State | Treatment |
|---|---|
| Counting down | `.rest-ring-left` shrinks with `--rest-left`; the seconds count down |
| Breathing message | `.rest-breath` grows and shrinks; the word flips "in" / "out" |
| Reduced motion | the circle stays still at 1.6x; the ring doesn't animate |
| Offline | a built-in breathing message is shown |

## 7. Code example
```html
<div class="rest-screen">
  <div class="rest-ring" role="timer" aria-label="Rest">
    <svg class="rest-ring-svg" viewBox="0 0 120 120" aria-hidden="true"><circle class="rest-ring-track" cx="60" cy="60" r="52"></circle><circle class="rest-ring-left" cx="60" cy="60" r="52" pathLength="100"></circle></svg>
    <div class="rest-ring-num"><strong>30</strong><span>seconds</span></div>
  </div>
  <section class="rest-card"><div class="rest-art" aria-hidden="true"><span class="rest-breath"><span class="rest-breath-word">in</span></span></div>
    <p class="rest-kind">Breathe</p><h2 class="rest-title">Balloon tummy</h2><p class="rest-body">Breathe in and let your tummy fill up like a balloon.</p></section>
</div>
```

## 8. Cross-references
[practice-steps](practice-steps.md) · [practice-session](practice-session.md) · [timer-ring](timer-ring.md) (the ring
pattern) · docs/practice-sessions.md ("The rest").

## 9. Accessibility
- The message card is `aria-live="polite"` so a new message is read; the ring is `role="timer"` with
  `aria-live="off"` (a second-by-second countdown isn't announced).
- Text pairs are in contrast-pairs.json for both themes: `--rest-text` / `--text-color` / `--label-color` on
  `--rest-bg` and `--rest-surface`, and the ring at 3:1.
- The breathing circle and ring stop moving with `prefers-reduced-motion`.
