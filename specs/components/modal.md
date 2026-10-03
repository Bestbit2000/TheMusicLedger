# Modal

## 1. Metadata
- **Name:** Modal (`.modal`, `.modal-content`, `.modal-close-x`, `.modal-content-sticky-footer`, `.metroSeg-scroll-area`)
- **Category:** Overlays
- **Status:** Stable

## 2. Overview
A blocking dialog over a dark scrim for a focused task or a confirmation. **Don't use** for
information that doesn't need a decision (use a [toast](toast.md) or [anchored-popup](anchored-popup.md)),
or for a whole multi-step flow (use a screen).

## 3. Anatomy
`.modal` (fixed scrim, flex-centred; shown with `style.display = 'flex'`) › `.modal-content` › `.modal-close-x` › `h2` title › body › action buttons. **Every pop-up closes the same three ways** (owner rule, 3 Oct 2026, ML-400, specs/README.md): the X (top right, the first thing in `.modal-content`, alongside any Cancel; it only closes, never saves - `data-modal-x` when it has no code of its own), a tap on the backdrop, and Escape. The backdrop tap and Escape are automatic (`a11y.js`). **A pop-up with a form showing** (a text / number / date field, text area or drop-down - usually with a Save button) ignores the backdrop tap, so a stray tap can't lose what's been entered; that's automatic too, checked at the moment of the tap (a search box, ticks and radios don't count). A pop-up that must be answered carries `data-no-dismiss` (urgent notice, timer finished, "Are you sure?", "Did you nail it?") and those four keep only their own buttons (the urgent notice and timer finished have no X). The timer's inline box has no X either - it isn't a titled pop-up - but closes on a tap outside.
Long bodies: `.modal-content.modal-content-sticky-footer` › `.metroSeg-scroll-area` (scrolls) › footer (stays put).

## 4. Tokens used
`--overlay-bg`, `--container-bg`, `--input-bg` (close button), `--text-color`, `--radius-xl`,
`--radius-circle`, `--shadow-xl`, `--z-modal`, `--z-modal-stacked`, `--space-3`, `--space-5`,
`--space-6`, `--font-lg`, `--font-weight-semibold`, `--touch-target`.

## 5. Props / API
- **Open and close (ML-288):** a `.modal` is hidden until it has `.show` - `showModal(id)` / `hideModal(id)` (app.js; admin.js has its own pair), never `style.display`. `.modal-intro` is a short explanatory line straight under the title.
- Confirmations: `showConfirmModal(title, msg, callback, isDanger, actionLabel, cancelLabel)` (app.js). Don't build a one-off.
- Max width 400px, max height 90vh, scrolls internally.
- A modal opened from inside another modal uses `--z-modal-stacked`.

## 6. States
Closed (`display: none`) · Open · Destructive confirm (primary action uses `--danger-color`).

## 7. Code example
```html
<div class="modal" id="exampleModal">
  <div class="modal-content">
    <button class="modal-close-x" aria-label="Close">✕</button>
    <h2>Delete session?</h2>
    <p>This can't be undone.</p>
    <button class="btn-submit">Delete</button>
  </div>
</div>
```

## 8. Cross-references
[button](button.md) · [toast](toast.md) · [elevation](../foundations/elevation.md)

## 9. Accessibility
- `role="dialog" aria-modal="true"` + `aria-labelledby` pointing at its heading (or `aria-label`).
- a11y.js: focus moves into the dialog on open, Tab is trapped, Escape closes (via its own Cancel/close control), focus returns to the opener.
- The page behind stays still while one is open (ML-371): `html:has(.modal.show)` hides its overflow, and `.modal-content` has `overscroll-behavior: contain`, so scrolling to the end of a long pop-up doesn't carry on into the page. A page showing a scrollbar that takes room (a desktop browser, a page taller than the window) keeps its gutter so it doesn't shift sideways; any other page doesn't (`--scroll-lock-gutter`, set by `a11y.js`), so the backdrop covers the whole window and nothing moves.
- Close button (✕) needs `aria-label="Close"`.

See [accessibility foundation](../foundations/accessibility.md).
