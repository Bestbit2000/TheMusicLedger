# Dropdown menu

## 1. Metadata
- **Name:** Dropdown menu (`.dropdown-menu`, `.dropdown-item`, `.burger-submenu-back`, `.account-band-menu`)
- **Category:** Navigation / overlays
- **Status:** Stable

## 2. Overview
A floating list of actions. Used for the ☰ burger menu (anchored top-right under the top bar) and
per-row "more" menus (`.account-band-menu`, positioned by JS next to the ⋮ button that opened it).
**Don't use** for choosing a value. Use [selectable-tile](selectable-tile.md) or a `<select>`.

## 3. Anatomy
`.dropdown-menu` (add `.show` to open) › `.dropdown-item` × n (optionally `.burger-submenu-back` first, destructive item last)

## 4. Tokens used
`--container-bg`, `--input-border` (outline + separators), `--input-bg` (hover), `--text-color`,
`--label-color` (back row), `--danger-color` (delete item), `--radius-sm`, `--shadow-xl`, `--z-dropdown`,
`--space-3`, `--space-4`, `--font-weight-bold`, `--font-weight-normal`.

## 5. Props / API
- Hide an inapplicable item with `.hidden-group`. Don't disable it. Separators are drawn only between *visible* items.
- Row menus: one shared `.dropdown-menu.account-band-menu` element, `position: fixed`, placed by JS.

## 6. States
Default · Hover (`--input-bg`) · Focus (`--focus-ring`) · Destructive item (`--danger-color` text, top border).

## 7. Code example
```html
<div class="dropdown-menu show">
  <a class="dropdown-item">Settings</a>
  <a class="dropdown-item">Notifications <span class="notif-count">2</span></a>
</div>
```

## 8. Cross-references
[top-bar](top-bar.md) · [icon-button](icon-button.md) · [notification-centre](notification-centre.md)

## 9. Accessibility
- Items are `<button type="button" class="dropdown-item">` (or `<a href>` for real links).
- a11y.js: Escape closes and returns focus to the opener; ↑/↓ move between items; opened from the keyboard, focus lands on the first item.
- Hide inapplicable items with `.hidden-group` (removes them from the Tab order too).

See [accessibility foundation](../foundations/accessibility.md).
