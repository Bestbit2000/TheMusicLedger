# Modal

## 1. Metadata
- **Name:** Modal (`.modal`, `.modal-content`, `.modal-close-x`, `.modal-content-sticky-footer`, `.metroSeg-scroll-area`, `.metroSeg-modal-heading`)
- **Category:** Overlays
- **Status:** Stable

## 2. Overview
A blocking dialog over a dark scrim for a focused task or a confirmation. **Don't use** for
information that doesn't need a decision (use a [toast](toast.md) or [anchored-popup](anchored-popup.md)),
or for a whole multi-step flow (use a screen).

## 3. Anatomy
`.modal` (fixed scrim, flex-centred; shown with `style.display = 'flex'`) › `.modal-content` › optional `.modal-close-x` › `h2` title › body › action buttons.
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
- Close button (✕) needs `aria-label="Close"`.

See [accessibility foundation](../foundations/accessibility.md).
