# Radius

Status: stable. Tokens: [token-reference.md#radius](../tokens/token-reference.md).

## Scale

| Token | px | Use |
|---|---|---|
| `--radius-2xs` | 2 | Heatmap cells, chart bar tops |
| `--radius-xs` | 4 | Inline `code`, tiny tags, buttons inside a toast |
| `--radius-sm` | 8 | Menus, toasts, popups, small inset boxes, count badges |
| `--radius-md` | 12 | **Every button and tile.** List rows, stat cards |
| `--radius-lg` | 16 | Inputs, choice options, picker tiles, tuner/play cards |
| `--radius-xl` | 20 | Modals, flow cards, block boxes |
| `--radius-pill` | 999px | Badges, chips, filter pills, toggle tracks, the timer pill |
| `--radius-circle` | 50% | Icon-only circular buttons, dots |

## Rules

- **One button radius: `--radius-md`.** The app used to mix fully rounded pill buttons with
  slightly rounded tiles on the same screen, and that inconsistency was drift, not a design
  decision. A pill-shaped `<button>` with a text label is always wrong.
- **Circle = icon-only.** `--radius-circle` is reserved for deliberately round icon buttons
  (edit/delete/copy, list "more" menu, tuner settings). Play/Reset transport buttons stay square.
- **Nesting.** An element inside a rounded container uses a radius one step smaller than its
  parent, so the corners look concentric (e.g. a `--radius-md` tile inside a `--radius-xl` card).
- A radius only applies to the corners that are actually exposed. Chart bars use
  `var(--radius-2xs) var(--radius-2xs) 0 0`.
