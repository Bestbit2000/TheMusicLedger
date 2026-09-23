# Elevation (shadow + z-index)

Status: stable. Tokens: [token-reference.md#elevation](../tokens/token-reference.md), [#z-index](../tokens/token-reference.md).

## Shadows

The app is mostly flat. Most surfaces are separated by `--input-border` and background colour,
not by shadow. A shadow means the element **floats above the page**.

| Token | Use |
|---|---|
| `--shadow-sm` | Small raised controls: toggle knob, floating scroll buttons |
| `--shadow-md` | The sticky top bar, slider thumb |
| `--shadow-lg` | An item while it's being dragged |
| `--shadow-xl` | Menus, modals, anchored popups |
| `--shadow-2xl` | Splash artwork only |
| `--shadow-top` | Bars docked to the bottom edge (shadow cast upward) |
| `--shadow-info` | Info toast (coloured glow) |
| `--focus-ring` | Keyboard focus / selected-swatch ring (`0 0 0 2px`) |

Cards (`.flow-card`, `.stat-card`, `.history-item`) have **no** shadow.

Coloured glows (`--primary-action-glow`, `--primary-action-glow-soft`) are for live/animated
emphasis (fermata hold), not static elevation.

## Z-index ladder

Never write a raw z-index number. Pick the rung:

| Token | Value | What lives there |
|---|---|---|
| `--z-base` | 1 | Lift above a sibling inside the same component |
| `--z-raised` | 2 | Second layer inside the same component |
| `--z-sticky` | 10 | Sticky axis/column inside a scroller (chart y-axis) |
| `--z-float` | 30 | Floating scroll buttons over content |
| `--z-header` | 50 | The sticky top-bar group |
| `--z-header-overlay` | 60 | Something that must sit over the header |
| `--z-dropdown` / `--z-modal` | 100 | Menus; modal scrim + dialog |
| `--z-modal-stacked` | 200 | A modal opened from inside another modal |
| `--z-toast` | 1000 | Toasts, anchored popups (always above modals) |
| `--z-splash` | 9999 | Login splash (covers everything) |

If a new layer doesn't fit a rung, add a rung to `tokens.css` and this table. Don't squeeze in a
number between two rungs inside a component.
