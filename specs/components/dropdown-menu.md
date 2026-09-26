# Dropdown menu

## 1. Metadata
- **Name:** Dropdown menu (`.dropdown-menu`, `.dropdown-item`, `.dropdown-item-icon`, `.dropdown-item-text`, `.account-band-menu`, `.nav-menu-backdrop`) and the ☰ navigation menu (`.nav-menu`, `.nav-item`, `.nav-item-icon`, `.nav-item-text`, `.nav-item-meta`, `.nav-item-sub`, `.nav-divider`, `.nav-section-title`, `.nav-tools`, `.nav-tool`, `.nav-tool-label`, `.align-edge`)
- **Category:** Navigation / overlays
- **Status:** Stable

## 2. Overview
A floating list of actions. Used for the ☰ burger menu (anchored top-right under the top bar) and
per-row "more" menus (`.account-band-menu`, positioned by JS next to the ⋮ button that opened it).
**Don't use** for choosing a value. Use [selectable-tile](selectable-tile.md) or a `<select>`.

## 3. Anatomy
`.dropdown-menu` (add `.show` to open) › `.dropdown-item` × n (destructive item last)

**Navigation menu (☰, ML-259 / ML-222):** `.dropdown-menu.nav-menu` › groups, each after a `.nav-divider` line and most with a `.nav-section-title`:

1. Home, Notifications (with its `.notif-count`).
2. Tools: one labelled `.nav-tools` row per home tool group - Everyday, Practise, Learn, each a 4-column row of `.nav-tool` tiles (icon › `.nav-tool-label`). It is **built from the home screen's own tool tiles** each time the menu opens (`renderNavToolsRow`), so the icons, the order and any hidden tool (Theory behind its feature gate) always match home.
3. Progress: Stats, Streaks, Session history, Challenges.
4. You: My music (ML-299: create, import, library and edit pieces - the old Flow start screen, gated by `flow_manage`; the home tool that plays them is Rehearse, shown in Tools only once there is a piece), My account, Settings, Administration (super admins). No name by My account (ML-289) - the email under Log out already says who you are.
5. Send feedback, About (version as `.nav-item-meta`).
6. Log out on its own, last, with the signed-in email under it as a `.nav-item-sub` line.

Each row is a `.dropdown-item.nav-item`: `.nav-item-icon` (a Material Symbol) › `.nav-item-text` (the label, optionally with a `.nav-item-sub` line under it) › optional `.nav-item-meta` at the right. There's no line between rows, only between groups. No sub-screens: they replaced ML-135's Tools/Progress sub-screens, so every destination is one tap.

## 4. Tokens used
`--container-bg`, `--input-border` (outline + separators), `--input-bg` (hover), `--text-color`,
`--label-color` (icons, meta and sub text, section titles), `--danger-color` (delete item), `--radius-sm`, `--shadow-xl`, `--z-dropdown`,
`--space-1`…`--space-4`, `--space-6`, `--font-weight-bold`, `--font-weight-semibold`, `--font-weight-normal`.
Navigation menu: `--touch-target` (row and tile height), `--icon-md` (row icons), `--icon-lg` (tile icons), `--font-xs` (section titles, tile labels, sub line), `--font-sm` (meta), `--input-bg` (tiles), `--radius-md` (tiles), `--primary-action-tint` + `--primary-action-strong` (current screen).

## 5. Props / API
- `.dropdown-menu.align-edge` sits flush with its anchor's right edge instead of the default 20px in (Play Flow's 3-dot menu). A fixed menu opened next to a tapped button is positioned with `placeAt(menu, left, top)` (`.is-placed`, see [utilities-and-states](utilities-and-states.md)).
- **Icons (ML-285):** every ⋮ menu item is `<button class="dropdown-item">` + an icon (`.dropdown-item-icon`, aria-hidden) + its label (`<span class="dropdown-item-text">`). Standard actions use a Material Symbol: `edit`, `edit_note`, `delete`, `content_copy` (Duplicate), `arrow_upward` / `arrow_downward` (Move up / down), `add`, `drive_file_rename_outline` (Rename), `star` (favourite). App-specific actions use the custom SVGs in `public/icons/menu/`, inlined so they take `currentColor`: `edit-bars`, `load-from-library`, `export-musicxml`, `delete-lead-in`, `copy-to-end`, `copy-here`, `delete-all-reset`, `leave-band`. They're drawn on the Material 24px grid at the same line weight: a rounded box with beat dots means a bar. Reuse the same icon for the same action everywhere. Code that changes a label sets the `.dropdown-item-text`, never the button's own text, which would remove the icon.
- **The ☰ menu (ML-291)** opens flush with the ☰ button's right edge (`.nav-menu { right: 0 }`). While it's open, `.nav-menu-backdrop` (fixed, full screen, under the top bar) catches a tap outside it, so that tap closes the menu without pressing anything underneath. At 768px and below it also dims the page (`--menu-backdrop-bg`). CSS shows it from the menu's own `.show`, so it can't get out of step however the menu closes. Row ⋮ menus don't get a backdrop - they're short.
- Hide an inapplicable item with `.hidden-group`. Don't disable it. Separators are drawn only between *visible* items.
- Row menus: one shared `.dropdown-menu.account-band-menu` element, `position: fixed`, placed by JS.

## 6. States
Default · Hover (`--input-bg`) · Focus (`--focus-ring`) · Destructive item (`--danger-color` text, top border) · **Current screen** (navigation menu: `aria-current="page"`, the selected gold: `--primary-action-tint` wash, `--primary-action-strong` text and icon). A screen the menu doesn't list marks the item it belongs under (Flow's editor marks Flow; see `NAV_PARENT_VIEW`).

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
- Navigation menu: section titles and dividers aren't focusable (`role="separator"` on dividers); the tools row is a `role="group"` named by its title; the current screen is `aria-current="page"`, which is announced, and never colour alone (the icon and text change too). Tapping a title or divider leaves the menu open. It scrolls inside itself on a short screen.

See [accessibility foundation](../foundations/accessibility.md).
