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
- Respect `prefers-reduced-motion` for any new looping animation.
