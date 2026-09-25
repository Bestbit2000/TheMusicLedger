# Button

## 1. Metadata
- **Name:** Button (`.btn-large`, `.btn-submit`, `.btn-nav`, `.btn-cancel`, `.btn-text`, `.btn-text-danger`, `.btn-edit`, `.btn-delete`)
- **Category:** Actions
- **Status:** Stable

## 2. Overview
Full-width, text-labelled buttons. The app has **three levels** and one corner radius:

| Level | Class | Use |
|---|---|---|
| Primary | `.btn-submit`, `.btn-large` (hero start/save action) | The one thing this screen is for. Max one per view |
| Navigation | `.btn-nav` | Moves to another screen (silver). Optional trailing `.btn-nav-arrow` "›" |
| Secondary | `.btn-cancel` (combine with `.btn-nav` for sizing) | The alternative next to a primary. Hollow gold outline |
| Tertiary | `.btn-text`, `.btn-text-danger` | Low-emphasis or destructive actions kept *away* from the primary (e.g. Delete under an "Other actions" heading) |
| Inline row actions | `.btn-edit`, `.btn-delete` | Compact coloured actions inside a list row |

**Don't use** for icon-only actions ([icon-button.md](icon-button.md)), home-screen tools
([tool-icon-button.md](tool-icon-button.md)), or choosing between options ([selectable-tile.md](selectable-tile.md), [radio-group.md](radio-group.md)).

## 3. Anatomy
`<button>` › label text › optional trailing `.btn-nav-arrow` or Material Symbol.

## 4. Tokens used
`--primary-action`, `--primary-action-text`, `--nav-action`, `--nav-action-text`, `--selection-color`,
`--danger-color`, `--text-on-accent`, `--radius-md`, `--space-3`, `--space-4`, `--font-md`, `--font-lg`,
`--font-base`, `--font-weight-bold`, `--touch-target`, `--opacity-disabled`.

## 5. Props / API
- Full width by default. Put side-by-side pairs in `.flex-row.gap-md` (`--space-3` gap).
- `.flow-action-btn` is **not** one of these levels. It's the Flow editor's own icon + label action tile (see [flow-editor](flow-editor.md)). Never mix it into a Cancel/Save pair.
- Cancel + Save pair: `<button class="btn-nav btn-cancel">Cancel</button><button class="btn-submit">Save</button>`.
- Destructive confirmation goes through `showConfirmModal(title, msg, cb, isDanger)` (app.js). Don't build ad-hoc confirm buttons.

## 6. States
| State | Treatment |
|---|---|
| Default | As above |
| Hover | No change (touch-first app). Don't add hover-only affordances. The one exception is the cursor: every enabled `<button>` / `[role=button]` shows the hand (a global rule at the top of style.css), and a disabled one keeps its own `not-allowed`. A component only sets `cursor` when it needs something else (grab, default) |
| Active | Native press |
| Focus | Browser focus ring. If restyled, use `box-shadow: var(--focus-ring)` |
| Disabled | `opacity: var(--opacity-disabled); cursor: not-allowed` |
| Error | Not a button state. Report errors with a warning toast |

## 7. Code example
```html
<button class="btn-submit">Save session</button>
<div class="flex-row gap-md">
  <button class="btn-nav btn-cancel">Cancel</button>
  <button class="btn-submit">Save</button>
</div>
<button class="btn-text btn-text-danger">Delete this flow</button>
```

## 8. Cross-references
[icon-button](icon-button.md) · [tool-icon-button](tool-icon-button.md) · [modal](modal.md) · [radius foundation](../foundations/radius.md)

## 9. Accessibility
- Always a real `<button type="button">`. Text is its name; an icon-only variant needs `aria-label`.
- Focus: global `--focus-ring`. Disabled uses the `disabled` attribute (not just a class) so it leaves the Tab order.
- Coloured fills (edit/delete) carry `--text-on-accent` (dark) - never white on a hue.
- Destructive actions confirm via `showConfirmModal` (a proper dialog).

See [accessibility foundation](../foundations/accessibility.md).
