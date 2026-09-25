# List row

## 1. Metadata
- **Name:** List row (`.history-item`, `.history-details`, `.qp-loaded-history-row`, `.metroSeg-list-row`, `.metroBlk-setup-row-actions`, `.draggable-item`, `.drag-handle`)
- **Category:** Data display
- **Status:** Stable

## 2. Overview
One item in a vertical list: a session in history, a saved metronome setup, a practice-list
entry. Optionally tappable (`button.history-item`), with trailing actions and a drag handle.
**Don't use** for a set of options to pick from. Use [selectable-tile](selectable-tile.md).

## 3. Anatomy
Container (left accent stripe) › optional `.drag-handle` › `.history-details` (`strong` title + muted meta) › trailing actions ([icon buttons](icon-button.md) or `.list-item-menu-btn`)

## 4. Tokens used
`--container-bg` (display row), `--input-bg` (tappable row only), `--input-border` (outline), `--text-color`, `--label-color`, `--control-off-bg` (default stripe), `--cat-*`
(category stripe), `--radius-md`, `--space-1`, `--space-2`, `--space-3`, `--font-base`,
`--shadow-lg` (while dragging), `--opacity-disabled`, `--duration-fast`.

## 5. Props / API
- **Display by default (ML-200).** A `div.history-item` whose only interactive parts are the buttons inside it (⋮ menu, edit, delete) sits on `--container-bg` with a 1px `--input-border` outline, the same surface as the page.
- **Tappable rows** (the row itself, or its main body, opens something) are a `<button class="history-item">` or carry `.clickable`, which gives them the `--input-bg` "tap me" surface. Current `.clickable` rows: saved metronome setups, the Flow library and Quick-play history.
- Stripe colour: `style="border-left-color: var(--cat-lesson)"` (inline category token, never a hex).
- Drag to reorder: `.draggable-item` + `.drag-handle`. `.dragging` while moving.

## 6. States
Display (`--container-bg`) · Tappable (`button` / `.clickable`: `--input-bg`, and the hand cursor on a desktop) · Pressed (tappable rows) · Dragging (`opacity: var(--opacity-disabled)`, `--shadow-lg`) · Focus (`--focus-ring`).

## 7. Code example
```html
<!-- Display row: only the menu button is tappable -->
<div class="history-item" style="border-left-color: var(--cat-practise)">
  <div class="history-details"><strong>Practise</strong>3 Sep 2026 | 25 mins</div>
  <button class="list-item-menu-btn" aria-label="Options"><span class="material-symbols-outlined">more_vert</span></button>
</div>
<!-- Tappable row: the body opens the item -->
<div class="history-item clickable">
  <div style="flex-grow:1; cursor:pointer" onclick="openFlow(12)"><strong>Clarinet Concerto</strong></div>
  <button class="list-item-menu-btn" aria-label="Options"><span class="material-symbols-outlined">more_vert</span></button>
</div>
```

## 8. Cross-references
[icon-button](icon-button.md) · [dropdown-menu](dropdown-menu.md) · [card](card.md)

## 9. Accessibility
- Display rows: only the buttons inside are interactive. A tappable row body is a `<button>` or `role="button" tabindex="0"`.
- Reordering: the ☰ handle is a `<button>` - tap for Move up / Move down, arrow keys move directly (drag is never the only way).
- The category stripe is decorative; category is also in the row text.

See [accessibility foundation](../foundations/accessibility.md).
