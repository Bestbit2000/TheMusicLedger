# Anchored popup

## 1. Metadata
- **Name:** Anchored popup (`.anchored-popup`)
- **Category:** Overlays
- **Status:** Stable (ML-75)

## 2. Overview
A small non-interactive label shown right next to the chart bar or heatmap square just tapped
("Mon 3 Sep · 45 min"). **Don't use** for anything with actions (use a
[dropdown-menu](dropdown-menu.md)) or for app-level messages (use a [toast](toast.md)).

## 3. Anatomy
Single `div.anchored-popup`, positioned `fixed` by `showAnchoredPopup(anchorEl, text)` via `getBoundingClientRect()`.

## 4. Tokens used
`--container-bg`, `--text-color`, `--input-border`, `--radius-sm`, `--shadow-xl`, `--z-toast`,
`--space-2`, `--space-3`, `--font-sm`, `--font-weight-bold`.

## 5. Props / API
`showAnchoredPopup(anchorEl, text)`. `pointer-events: none`, so it never blocks the chart underneath.

## 6. States
Hidden · Visible (auto-hides).

## 7. Code example
```js
showAnchoredPopup(cellEl, 'Tue 4 Sep · 2 sessions');
```

## 8. Cross-references
[charts](charts.md) · [toast](toast.md)

## 9. Accessibility
- Non-interactive supplementary text (`pointer-events: none`). The same value must be available another way (chart/list) - the popup is a convenience, not the only source.

See [accessibility foundation](../foundations/accessibility.md).
