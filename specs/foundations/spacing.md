# Spacing

Status: stable. Tokens: [token-reference.md#spacing](../tokens/token-reference.md).

## Scale

A 4px grid. Every `padding`, `margin` and `gap` uses one of these:

| Token | px | Typical use |
|---|---|---|
| `--space-0-5` | 2 | Hairline gaps: heatmap cells, a caption tucked under its title |
| `--space-1` | 4 | Icon ↔ label, tight vertical stacks |
| `--space-2` | 8 | Default gap between related items; label → input |
| `--space-3` | 12 | Inner padding of compact controls, list rows, chips |
| `--space-4` | 16 | Button padding; gap between stacked blocks |
| `--space-5` | 20 | Container padding; between form groups |
| `--space-6` | 24 | Card/modal padding; before a new group |
| `--space-7` | 32 | Between sections |
| `--space-8` | 40 | Large section breaks |
| `--space-9` | 48 | Touch-target-sized offsets |
| `--space-10` | 64 | Page-level whitespace (empty and logged-out states) |

## Rules

- **Related things are closer than unrelated things.** Inside a group use `--space-2`/`--space-3`.
  Between groups use `--space-5`+. If two gaps on a screen are "almost the same", they should *be*
  the same token.
- **Grids share a gutter.** Tile grids that sit on the same screen use the same gap, `--space-3`
  (`.tool-icon-row`, `.dashboard-grid`), so their columns line up. Use one gap for rows and columns.
  A multi-row set of tiles is a single grid with equal-height rows, never several grids stacked
  (see [stat-card](../components/stat-card.md)).
- **Negative margins** use `calc(-1 * var(--space-N))`.
- **Component geometry isn't spacing.** Fixed widths/heights (a 48px button, a 10px heatmap cell)
  aren't in scope of the spacing scale. Use `--touch-target` where the size is a tap target.
- **The app column** is always `--app-max-width` (500px) wide, and the container padding is
  `--space-5` on every screen.
- 1px optical nudges (e.g. `margin-bottom: -1px` to overlap a tab border) are the one allowed
  exception. Mark them with `/* token-audit-ignore: border overlap */`.

## Snapping legacy values

Values found in the ML-198 audit were snapped to the nearest step. On a tie, **padding rounds up**
(controls never get cramped) and **margin/gap round down**: 10px → `--space-3` as padding,
`--space-2` as margin/gap; 6px → `--space-2` / `--space-1`; 14px → `--space-4` / `--space-3`;
15px → `--space-4`, 25px → `--space-6`, 30px → `--space-7`.

**Clearance isn't spacing.** Room reserved for a fixed/docked element uses a layout token
(`--bottom-bar-clearance`, `--bottom-bar-clearance-lg`) or is derived from the element's size
(`calc(var(--touch-target) + var(--space-2))` beside a close button). Never snap it to the spacing scale.
