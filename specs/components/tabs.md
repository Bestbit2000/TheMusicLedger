# Tabs

## 1. Metadata
- **Name:** Tabs (`.flow-edit-tabs` / `.flow-edit-tab` segmented; `.admin-subtabs` / `.admin-subtab-item` underline; `.admin-nav-item` sidebar)
- **Category:** Navigation
- **Status:** Stable

## 2. Overview
Switches between sibling views within one screen.
- **Segmented** (`.flow-edit-tabs`) in the app: a tray with the active tab raised on `--container-bg`.
- **Underline** (`.admin-subtabs`) in the admin panel: gold underline on the active tab.
- **Sidebar** (`.admin-nav-item`) for admin top-level sections: gold left border.

**Don't use** tabs for sequential steps (use screens + [buttons](button.md)) or more than ~5 options in the app.

## 3. Anatomy
Tray/row › tab button × n (label + optional `.flow-edit-tab-count`).

## 4. Tokens used
`--input-bg`, `--input-border`, `--container-bg`, `--secondary-color` (active sidebar item),
`--text-color`, `--label-color`, `--primary-action` (underline/left border), `--shadow-sm` (active
segment), `--radius-lg` (tray), `--radius-md` (segment), `--space-0-5`, `--space-1`…`--space-5`,
`--font-sm`, `--font-base`, `--font-weight-bold`, `--font-weight-semibold`.

## 5. Props / API
`.active` on the current tab. The tray padding uses `--space-0-5` so the segment's radius stays concentric.

## 6. States
Inactive (`--label-color`) · Active (raised segment / gold underline / gold left border + tint) · Disabled (sidebar: `--label-color`, `cursor: default`) · Focus (`--focus-ring`).

## 7. Code example
```html
<div class="flow-edit-tabs">
  <button class="flow-edit-tab active">Details</button>
  <button class="flow-edit-tab">Blocks <span class="flow-edit-tab-count">4</span></button>
</div>
```

## 8. Cross-references
[admin-shell](admin-shell.md) · [flow-editor](flow-editor.md)

## 9. Accessibility
- Tab buttons are `<button>`s; the active one is marked with `aria-pressed="true"` or `aria-current` and a non-colour indicator (raised segment / underline).

See [accessibility foundation](../foundations/accessibility.md).
