# Icon button

## 1. Metadata
- **Name:** Icon button (`.btn-icon-edit`, `.btn-icon-delete`, `.btn-icon-copy`, `.list-item-menu-btn`, `.modal-close-x`, `.top-btn`, `.top-tuner-toggle`, `.metro-transport-btn`)
- **Category:** Actions
- **Status:** Stable

## 2. Overview
An action represented by a Material Symbol with no text label.

- **Circular** (`--radius-circle`) for row-level actions: edit, delete, copy, the "more" (⋮) menu
  button, modal close.
- **Square** (`--radius-md`) for transport controls (`.metro-transport-btn` play/stop/reset). These
  are deliberately not circles.
- **Bare** (`.top-btn`, no fill) in the top bar.

**Don't use** when the action isn't universally recognisable from its icon. Use a labelled [button](button.md) instead.

## 3. Anatomy
`<button aria-label="…">` › `<span class="material-symbols-outlined">icon_name</span>`

## 4. Tokens used
`--touch-target` (48×48 minimum), `--radius-circle`, `--radius-md`, `--selection-color` (edit),
`--danger-color` + `--text-on-accent` (delete), `--input-border`/`--text-color` (copy),
`--input-bg`/`--label-color` (more menu), `--primary-action`/`--primary-action-text` (play),
`--nav-action`/`--nav-action-text` (stop), `--icon-md`, `--icon-lg`.

## 5. Props / API
- Always set `aria-label`.
- Low-emphasis context (e.g. `.metroBlk-setup-row-actions`): drop the fill/border but keep the 48px target. Delete keeps `--danger-color` on the icon.
- Keep a `--space-3` gap between a harmless and a destructive icon button.

## 6. States
| State | Treatment |
|---|---|
| Default | As above |
| Active | Native press |
| Focus | `box-shadow: var(--focus-ring)` |
| Disabled | `opacity: var(--opacity-disabled); cursor: not-allowed` |

## 7. Code example
```html
<button class="btn-icon-edit" aria-label="Edit"><span class="material-symbols-outlined">edit</span></button>
<button class="list-item-menu-btn" aria-label="More"><span class="material-symbols-outlined">more_vert</span></button>
```

## 8. Cross-references
[button](button.md) · [list-row](list-row.md) · [dropdown-menu](dropdown-menu.md) · [metronome](metronome.md)

## 9. Accessibility
- `aria-label` is mandatory - describe the action and its object ("Delete Bar 2", "Options for Scales").
- Visible size may be under 44px; it must be listed in the 44px hit-area block (A6) at the end of style.css.
- Menu triggers: `aria-haspopup="menu" aria-expanded="false"` (a11y.js keeps it in sync). Toggles (play, mute): `aria-pressed`, mirrored from the icon by a11y.js.

See [accessibility foundation](../foundations/accessibility.md).
