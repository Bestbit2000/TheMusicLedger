# Motion

Status: stable. Tokens: [token-reference.md#motion](../tokens/token-reference.md).

## Durations

| Token | ms | Use |
|---|---|---|
| `--duration-instant` | 80 | Press feedback; metronome dot lighting (must feel locked to the beat) |
| `--duration-fast` | 150 | Colour/border state changes (selected, tuner in/out of tune) |
| `--duration-base` | 250 | Slides, fades, toggles, expanding panels, card swipes |
| `--duration-slow` | 400 | Chart bars growing |
| `--duration-pulse` | 1000 | Looping attention animations (fermata glow) |

## Easing

`--ease-standard` (`ease`) by default. `--ease-linear` for anything tracking a live value (meters,
dots, colour that follows pitch). `--ease-in-out` for loops/pulses.

## Rules

- Write transitions as `transition: <property> var(--duration-*) var(--ease-*)`, naming the
  property. Never `transition: all`.
- Motion confirms a change the user caused. It isn't decoration. Nothing animates on page load.
- `0s` / `none` to deliberately disable a transition (e.g. while dragging) is fine and isn't flagged.
- JS-driven durations (toast countdown bar, `TOAST_DURATIONS_MS`) are behaviour, not style, and
  stay in JS.
- Respect reduced motion for any new animation. Write the rule under `:root[data-motion="reduce"]`, not
  `@media (prefers-reduced-motion)`: that attribute is on when the member's **Reduce motion** switch is on
  (Settings → Display and reading, ML-603) *or* the device asks for less motion (`display-prefs.js` sets it
  for both). In JS ask `prefersReducedMotion()`, and scroll with `behavior: scrollMotion()`, never a bare
  `'smooth'`.

## Reduce motion (ML-603)

The global rule (style.css, A7) cuts every transition and animation to almost nothing, so things appear and go
instead of sliding, fading, popping or pulsing. The owner's rules on what is left (24 Oct 2026):

- **Countdowns still count down, a step a second.** The timer ring and the rest ring already move once a second;
  the Theory countdown bar follows the clock's whole seconds; the toast's bar steps (`--countdown-steps`).
- **What shows the music keeps moving, with no extra bounce or glide:** the beat dots light without the scale
  pulse, the metronome's follow-the-beat pan keeps its steady beat-long glide (`.metro-display-content`), and
  the tuner needle and the lit bar jump to where they are instead of easing there.
- **Celebrations show still:** the Level-up stars appear without the pop and stay as long as they would have.
- Smooth scrolling from code becomes an ordinary jump (`scrollMotion()`).
