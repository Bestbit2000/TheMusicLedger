# Timer countdown ring

## 1. Metadata
- **Name:** Timer countdown ring (`.timer-ring`, `.timer-ring-*`, states `.has-lap`, `.is-long`, `.is-running`)
- **Category:** Data display
- **Status:** New (ML-293)

## 2. Overview
The Timer screen's countdown, drawn as a ring round the big time readout. The gold arc is the time
left in the session: it starts full and unwinds clockwise-to-anticlockwise back to 12 o'clock as
the session runs down, moving smoothly each second. A dot at the arc's tip pulses once a second
while the timer runs, and holds still when it's paused.

Sessions over an hour add a thin outer ring for the part over the hour, which unwinds first. Below
60 minutes it's gone and the main ring counts down the last hour. A small badge inside says which
hour you're in, counting down ("Hour 2 of 2", then "Hour 1 of 2").

**Don't use** for anything that isn't counting down to a known end. An open-ended session (no
target) hides the ring - "This session" below shows the time done instead.

## 3. Anatomy
`.timer-ring` (`#timerRemainingCard`) › `svg.timer-ring-svg` (`.timer-ring-track`, `.timer-ring-arc`,
`.timer-ring-lap-track`, `.timer-ring-lap`, `g.timer-ring-tip`) + `.timer-ring-readout` ›
`.timer-ring-time`, `.timer-ring-label`, `.timer-ring-hour` (badge, only over an hour).

## 4. Tokens used
`--primary-action` (arc), `--primary-action-strong` (outer hour ring, tip dot, badge text),
`--primary-action-tint` (badge), `--input-border` (tracks), `--text-color` / `--label-color`
(readout), `--font-3xl` (time) / `--font-2xl` (time with hours), `--font-sm`, `--font-xs`,
`--font-weight-bold`, `--radius-pill`, `--space-*`, `--duration-pulse` (the once-a-second sweep and
pulse), `--duration-base` (the outer ring fading out).

## 5. Props / API
- Run-time values (see [utilities-and-states](utilities-and-states.md) "Run-time values"):
  `--ring-left` and `--lap-left`, 0-1, the fraction left on the main ring and on the outer hour ring.
  Set by `renderTimerRing` (app.js) on every tick.
- `.has-lap` shows the outer ring; `.is-running` makes the tip pulse; `.is-long` drops the time to
  `--font-2xl` when it has hours in it (1:29:57), so it stays inside the ring.
- Up to an hour the full ring is the whole session. Over an hour the main ring is the last hour and
  the outer ring the part over it, up to a second hour.

## 6. States
Running (tip pulses) · Paused (tip still) · Over an hour (outer ring + badge) · Last hour (outer ring faded out).

## 7. Code example
```html
<div class="timer-ring has-lap is-running" style="--ring-left:1; --lap-left:0.5"> … </div>
```

## 8. Cross-references
[stat-card](stat-card.md) (the This session / Today cards under it) · [top-bar](top-bar.md) (the timer pill)

## 9. Accessibility
- The ring is decorative (`aria-hidden`): the time is always there as text in `.timer-ring-time`,
  and the hour as text in the badge - never colour or arc length alone.
- The pulse and the sweep stop under "reduce motion" (the global `prefers-reduced-motion` rule).
- The readout isn't a live region: it changes every second, which would be read out non-stop.

See [accessibility foundation](../foundations/accessibility.md).
