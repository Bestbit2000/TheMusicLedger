# Filter strip

## 1. Metadata
- **Name:** Filter strip (`.filter-strip`, `.filter-strip-icon`, `.filter-strip-badge`, `.filter-strip-pills`, `.filter-pill`, `.filter-pill-count`)
- **Category:** Inputs / navigation
- **Status:** Stable (ML-176)

## 2. Overview
Inline, horizontally scrollable category filter above a list or stats (Session history, Detailed
stats). Replaced the old full-width filter button + modal. **Don't use** for more than ~8 options,
or for a single required choice (use [radio-group](radio-group.md)).

## 3. Anatomy
`.filter-strip` › `.filter-strip-icon` (decorative, not a button: no outline, no fill, just a `--label-color` icon (ML-200), with the `.filter-strip-badge` active count) › `.filter-strip-pills` (drag-scrollable) › `.filter-pill[.active]` × n › optional `.filter-pill-count`

## 4. Tokens used
`--input-bg`, `--input-border`, `--text-color`, `--label-color`, `--primary-action` (fallback accent,
badge), `--primary-action-text`, `--radius-pill`, `--radius-circle`, `--space-2`, `--space-3`,
`--space-4`, `--space-5`, `--font-xs`, `--font-sm`, `--font-weight-bold`, `--opacity-muted`.

## 5. Props / API
- Per-pill accent: set `--filter-pill-accent` inline to the category token, e.g. `style="--filter-pill-accent: var(--cat-lesson)"`. "All" has no accent and falls back to gold.
- `enableDragScroll()` (app.js) adds mouse drag-panning. `.dragging` while panning.

## 6. States
Unselected (outline) · Selected (`.active`: accent outline in `--cat-*-text` + 15% accent wash via `color-mix`; the text stays `--text-color` - accent text on its own wash failed contrast, ML-210) · Dragging · Focus (`--focus-ring`).

## 7. Code example
```html
<div class="filter-strip">
  <div class="filter-strip-icon"><span class="material-symbols-outlined">filter_list</span></div>
  <div class="filter-strip-pills">
    <button class="filter-pill active">All</button>
    <button class="filter-pill active" style="--filter-pill-accent: var(--cat-practise)">Practise <span class="filter-pill-count">12</span></button>
  </div>
</div>
```

## 8. Cross-references
[pill-badge](pill-badge.md) · [radio-group](radio-group.md) · [charts](charts.md)

## 9. Accessibility
- Pills are `<button>`s; the active state is outline + tint + text colour (`--cat-*-text`), not colour alone.
- The funnel icon is decorative (not a button). The strip scrolls natively and by keyboard focus; drag-panning is only a mouse convenience.

See [accessibility foundation](../foundations/accessibility.md).
