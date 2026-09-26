# Form field

## 1. Metadata
- **Name:** Form field (`.form-group`, `label`, `input`, `select`, `textarea`, `.hidden-group`, `.flow-help-text`, `.flow-required`, `.inset-panel`, `.inset-panel-row`, `.form-subheading`, `.divider-dashed`, `.challenge-filter-box`, `.check-sm`)
- **Category:** Inputs
- **Status:** Stable

## 2. Overview
A labelled text/number/date input, select or textarea. Global element styles give every input the
same look, so don't restyle an input per screen. **Don't use** a text input for choosing from a
short fixed list. Use [radio-group](radio-group.md) or [selectable-tile](selectable-tile.md).

## 3. Anatomy
`.form-group` › `label` › control › optional `.flow-help-text`. A required marker is `.flow-required` inside the label.

## 4. Tokens used
`--input-bg`, `--input-border`, `--text-color`, `--label-color` (help text), `--primary-action`
(focus border), `--danger-color` (error), `--radius-lg`, `--space-2` (label gap), `--space-3`
(padding), `--space-5` (group spacing), `--font-base`, `--font-xs`, `--font-weight-semibold` (labels).

## 5. Props / API
- `.inset-panel` is a tinted block grouping related fields inside a form (the challenge task generator); `.inset-panel.inset-panel-row` lays a label and its control out either side of one line.
- `.divider-dashed` then `.form-subheading` starts a new part of a long form (the challenge editor's Tasks).
- `.challenge-filter-box` holds Manage challenges' filter checkboxes in a bordered box; `.check-sm` is a small native checkbox inside a label row.
- `.hidden-group` hides a whole group conditionally (`display: none !important`). It's used app-wide for every conditional section.
- `color-scheme` is set per theme so native date/number pickers match.
- Number spinners are removed globally. Use steppers (`.metro-bpm-step`) where increments matter.

## 6. States
| State | Treatment |
|---|---|
| Default | 2px `--input-border` outline |
| Focus | Border `--primary-action` |
| Disabled | `opacity: var(--opacity-disabled)` |
| Error | Border `--danger-color`. Message goes in a warning toast or `.flow-help-text` in `--danger-color` |

## 7. Code example
```html
<div class="form-group">
  <label for="piece">Piece <span class="flow-required">*</span></label>
  <input id="piece" type="text">
  <span class="flow-help-text">As it appears on the score.</span>
</div>
```

## 8. Cross-references
[toggle-switch](toggle-switch.md) · [radio-group](radio-group.md) · [slider](slider.md) · [selectable-tile](selectable-tile.md)

## 9. Accessibility
- Every field has a visible `<label for="id">` (or wraps it). Placeholder is never the only label. A field whose heading is elsewhere uses `aria-labelledby`.
- Errors: set `aria-invalid="true"` and describe the problem in text (toast or help text), not by colour alone.

See [accessibility foundation](../foundations/accessibility.md).
