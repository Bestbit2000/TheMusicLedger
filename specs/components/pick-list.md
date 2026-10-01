# Pick list

## 1. Metadata
- **Name:** Pick list (`.pick-row`, `.pick-row-check`, `.pick-bar`)
- **Category:** Inputs
- **Status:** Stable (ML-351, ML-353)

## 2. Overview
A list you tick several things in, then add them all at once: pieces to a practice list (Add pieces)
and skills to a skills list (Add skills). **Don't use** for a single choice (use a plain
[selectable tile](selectable-tile.md) choice list) or for on/off settings (use a toggle).

## 3. Anatomy
In a popup: `.modal-content.modal-content-sticky-footer` › `.metroSeg-scroll-area` (title › optional
[filter strip](filter-strip.md) › optional search › `.pick-bar` › rows) › `.metroSeg-sticky-footer`
(the one `.btn-submit`, **always visible** however long the list is).

- **Row:** `.flow-choice-option.level-answer.pick-row` - a `<button>` with a tick box on the left
  (`.pick-row-check`, the Material Symbol `check_box` / `check_box_outline_blank`) and the item's text
  (bold name over a `.text-sm.text-muted` line). Tapping anywhere on the row toggles it.
- **Select all / Unselect all:** `.pick-bar`, two `.btn-text` buttons, right-aligned. They act **only on
  the rows showing** under the current filter and search. Hidden when there's one row or none. Left out
  altogether (`barEl` null) where one row must stay ticked - a Theory quiz's Clef, whose ticks apply at
  once and whose button is Done, not Add.
- **Button:** "Add" (disabled) with nothing ticked, then "Add 1 piece" / "Add 3 pieces" - the count is
  everything ticked, including rows the filter is hiding.
- Things already added aren't offered at all (they're taken off from the list itself).

## 4. Tokens used
`--label-color` (empty tick box), `--primary-action-strong` + `--primary-action-tint` (ticked row and
tick box - the `.flow-choice-option.selected` look), `--space-1`, `--space-2`, `--space-3`, `--space-4`.

## 5. Props / API
`renderPickList(listEl, barEl, rows, picked, onChange, emptyHtml)` (app.js): `rows` is
`[{ key, html }]` for the rows showing now, `picked` a `Set` of keys the caller keeps across filter
changes, `onChange` updates the Add button (`pickCountLabel(n, 'piece')`). Re-call it when the filter or
search changes.

## 6. States
Unticked · Ticked (`.selected`, `aria-pressed="true"`, filled gold tick box) · Focus (`--focus-ring`).

## 7. Code example
```html
<div class="pick-bar">
  <button type="button" class="btn-text">Select all</button>
  <button type="button" class="btn-text">Unselect all</button>
</div>
<button type="button" class="flow-choice-option level-answer pick-row selected" aria-pressed="true">
  <span class="material-symbols-outlined pick-row-check" aria-hidden="true">check_box</span>
  <span class="grow"><strong>Abide with Me</strong><br><span class="text-sm text-muted">30 bars · Mine</span></span>
</button>
```

## 8. Cross-references
[modal](modal.md) · [filter-strip](filter-strip.md) · [selectable-tile](selectable-tile.md) · [button](button.md)

## 9. Accessibility
- Each row is a `<button>` with `aria-pressed`; the tick box is decorative (`aria-hidden`), so ticked
  isn't shown by colour alone - the box fills and gets a tick, and the state is announced.
- Rows are at least `--touch-target` tall (`.level-answer`); the Select all / Unselect all buttons are 48px.
- The Add button stays in the pinned footer, so it's reachable without scrolling past the whole list.

See [accessibility foundation](../foundations/accessibility.md).
