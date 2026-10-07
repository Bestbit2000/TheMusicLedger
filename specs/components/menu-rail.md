# Menu rail

## 1. Metadata
- **Name:** Menu rail (`style.css`: `.nav-rail-head`, `.nav-rail-name`, `.nav-rail-fold`, `.rail-folded` on `body`, `.app-shell` on the app page's `body`; `.rail-demo` and `.is-folded` for the Admin → Design examples; it restyles `.nav-menu`)
- **Category:** Navigation
- **Status:** New (ML-239)

## 2. Overview
From 700px up the ☰ menu is not a button that opens a menu: it is a rail down the left of the screen, always
there. It is **the same menu** (`#burgerDropdown`) - the same items, feature gates, Tools panel and "you are
here" mark - restyled, so nothing has to be kept in step. The ☰ button is hidden while the rail shows.

The rail **starts open** (icons and names) and folds to icons with the button at its top; folding is
remembered on the device (`localStorage`, `tml.railFolded`). Owner's decision, 7 Oct 2026.

**Use** it for the app's main places only. **Don't** add a second rail or put page-level actions in it.
The admin panel has its own side menu ([admin-shell](admin-shell.md)).

## 3. Anatomy
- **The head** - `div.nav-rail-head`, first thing in `.nav-menu`: the [brand mark](brand-mark.md) (ML-484), the app's name (`span.nav-rail-name` - the name on screen, `Brand.name()`) and the
  fold button (`button.nav-rail-fold#navRailFoldBtn`, icon `menu_open` open / `menu` folded). Hidden on a phone.
- **The items** - the menu's own `.nav-item` buttons, `.nav-section-title`s and `.nav-divider`s, unchanged
  ([dropdown-menu](dropdown-menu.md)). The row lines between items go; each item is a rounded row.
- **Log out** sits at the bottom of the rail (the divider before it takes the spare height).
- **Tools** still swaps the rail to its panel of tool icons, and Back swaps it again. In the rail the tools are **two to a row** with
  the larger icon (`--icon-xl`) and name (`--font-sm`) - four to a row, as in the phone's menu, was too small to read
  (owner, 7 Oct 2026).

## 4. Tokens used
`--rail-width`, `--rail-width-folded`, `--rail-head-height`, `--container-bg`, `--input-border`, `--input-bg`,
`--label-color`, `--text-color`, `--primary-action-tint` and `--primary-action-strong` (the current item, from
the menu), `--touch-target`, `--radius-md`, `--space-1`, `--space-2`, `--space-3`, `--font-base`,
`--font-weight-bold`.

## 5. Props / API
- `.app-shell` on `<body>` in `index.html` marks the app page. Every wide-layout rule hangs off it, because
  `style.css` is also loaded by the admin panel and the styleguide, where a fixed rail would be wrong.
- `.rail-demo` (with `.is-folded`) gives a box the rail's look without fixing it to the screen - only for the
  examples on Admin → Design.
- `setRailFolded(folded, remember)` (`app.js`) - sets `body.rail-folded`, the button's label and
  `aria-pressed`, and a `title` on each item while folded.
- `--rail-w` on `body` is the rail's current width; anything that must keep clear of it reads that.
- While the rail shows, `renderNavMenu()` runs on every screen change, so the rail is as fresh as a menu that
  has just been opened.
- The top bar's title on Home is "Home" while the rail shows (the rail carries the app's name).

- Folded, the head is the mark above the fold button (the name is hidden).

## 6. States
Open / folded. Item: default / hover / current (`aria-current="page"`) / focus. Panel: main / Tools. Folded,
Tools opens the rail first (its panel needs the room).

## 7. Code example
```html
<div id="burgerDropdown" class="dropdown-menu nav-menu">
  <div class="nav-rail-head">
    <span class="nav-rail-name">The Music Ledger</span>
    <button type="button" class="nav-rail-fold" id="navRailFoldBtn" aria-label="Fold the menu to icons" aria-pressed="false">
      <span class="material-symbols-outlined" aria-hidden="true">menu_open</span>
    </button>
  </div>
  <div class="nav-panel" id="navMainPanel">…the menu's items…</div>
</div>
```

## 8. Cross-references
[layout foundation](../foundations/layout.md) · [dropdown-menu](dropdown-menu.md) · [top-bar](top-bar.md) · [two-pane](two-pane.md)

## 9. Accessibility
- Folded, an item's name is still in the page (clipped, not `display: none`), so a screen reader reads
  "My music", not an unnamed icon; a mouse gets the name as a tip.
- The fold button is a real `<button>` with `aria-pressed` and a label that says what it will do
  ("Fold the menu to icons" / "Open the menu"), 44px square.
- Every item keeps its 44px height open or folded. Colours are the menu's existing checked pairs.
- Keyboard: Tab runs through the rail's items in order; it is not a menu that traps focus.

See [accessibility foundation](../foundations/accessibility.md).
