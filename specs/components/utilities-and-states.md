# Utilities and state modifiers

## 1. Metadata
- **Name:** Utilities and state modifiers
  - Layout utilities: `.container`, `.flex-row`, `.flex-col`, `.flex-1`, `.gap-sm`, `.gap-md`, `.text-center`, `.text-muted`, `.no-margin`, `.hidden-group`, `.hidden-btn`, `.tools-title`, `.material-symbols-outlined`, `.drag-reorder-highlight`, `.custom-option`, `.visually-hidden` (screen-reader-only text, ML-210)
  - State modifiers: `.active`, `.selected`, `.show`, `.lit`, `.accent`, `.dragging`, `.disabled`, `.expanded`, `.is-expanded`, `.is-muted`, `.invalid`, `.has-errors`, `.unread`, `.clickable`, `.compact`, `.blank`, `.below`, `.left`, `.right`, `.in-tune`, `.out-of-tune`, `.lead-in`, `.fermata-holding`, `.fermata-done`
  - Variant modifiers: `.success`, `.warning`, `.info`, `.undo`, `.pass`, `.fail`, `.skipped`, `.never`, `.cat`, `.type-audio`, `.type-metronome`, `.type-youtube`
  - Environment classes: `.dark-mode` (on `<body>`), `.installed-app` (on `<html>`, standalone PWA), `.admin-body`
- **Category:** Foundations
- **Status:** Stable

## 2. Overview
Small single-purpose classes that combine with a component rather than standing alone.
- **Utilities** tweak layout without a new component class. Use them instead of an inline `style=""` for flex rows, gaps and hiding.
- **State modifiers** are toggled by JS on a component (`.selected` on a tile, `.lit` on a metronome dot). A modifier never has meaning on its own. It's always styled as `.component.modifier`.
- **Variant modifiers** pick a fixed flavour of a component (`.toast.warning`, `.admin-badge.pass`).

**Don't** add a new bare modifier name that means something different from an existing one
(e.g. a second word for "selected"). Reuse the list above. A genuinely new state needs sign-off at
the dev → sandbox design gate.

## 3. Anatomy
N/A. Modifiers attach to a component's root element.

## 4. Tokens used
`--space-2` (`.gap-sm`), `--space-3` (`.gap-md`), `--label-color` / `--opacity-muted` (`.text-muted`), plus whatever the host component uses for each state.

## 5. Props / API
- `.hidden-group` is the one way to hide conditionally (`display: none !important`). Don't set `style.display` for show/hide of a whole group.
- `.hidden-btn` keeps layout space but hides the element (top-bar alignment).

## 6. States
This spec *is* the state vocabulary. See each component spec for how it renders them.

## 7. Code example
```html
<div class="flex-row gap-sm"><span class="text-muted">Tempo</span><strong>120</strong></div>
<button class="flow-picker-tile selected">4/4</button>
```

## 8. Cross-references
[selectable-tile](selectable-tile.md) · [toast](toast.md) · [pill-badge](pill-badge.md) · [metronome](metronome.md)

## 9. Accessibility
- `.hidden-group` removes content for everyone (including screen readers). Use `.visually-hidden` for text that should be read but not seen.
- State modifiers (`.selected`, `.active`, `.lit`) must be paired with the matching ARIA state (`aria-pressed`, `aria-current`, `aria-expanded`) where the state matters to the user.

See [accessibility foundation](../foundations/accessibility.md).
