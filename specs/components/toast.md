# Toast

## 1. Metadata
- **Name:** Toast (`.toast.success`, `.toast.warning`, `.toast.info`, `.toast.undo`, `.toast-countdown-bar`)
- **Category:** Feedback
- **Status:** Stable

## 2. Overview
A transient message pinned to the bottom centre, auto-dismissing with a shrinking countdown bar.
**Don't use** for anything the user must act on (use a [modal](modal.md)) or for persistent news
(use the [notification centre](notification-centre.md)).

| Variant | Helper (app.js) | Surface |
|---|---|---|
| success | `showSuccessToast(msg, cat, sessionId)` | `--surface-inverse` |
| warning | `showWarningToast(msg)` | `--warning-color`, `--text-on-warning` |
| info | `showInfoToast(msg)` | `--info-color`, `--shadow-info` |
| undo | `showUndoToast(msg, onUndo)` | `--surface-inverse` + Undo button |

## 3. Anatomy
`.toast.<variant>` › message (pre-line, so `\n` breaks lines) › optional button › `.toast-countdown-bar`

## 4. Tokens used
`--surface-inverse`, `--text-on-accent`, `--warning-color`, `--text-on-warning`, `--info-color`,
`--shadow-info`, `--button-overlay` (button fill), `--radius-sm`, `--radius-xs` (button),
`--z-toast`, `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-7` (bottom offset),
`--font-base`, `--font-weight-bold`.

## 5. Props / API
- **Show and hide (ML-288):** a toast is hidden until it has `.show` (the `showXToast` functions add it, `closeToast` removes it). The countdown bar shrinks under `.toast-countdown-bar.is-running` over `--countdown-ms`, and `.is-paused` freezes it (at `--frozen-w`) while the toast is hovered or focused.
Hidden by default (`display: none`). Only the helpers show it. Lifetimes live in `TOAST_DURATIONS_MS` (behaviour, stays in JS).

## 6. States
Hidden · Visible (counting down) · Dismissed.

## 7. Code example
```js
showWarningToast('Pick a category first.\nThen press Save.');
```

## 8. Cross-references
[modal](modal.md) · [anchored-popup](anchored-popup.md) · [notification-centre](notification-centre.md)

## 9. Accessibility
- `role="status" aria-live="polite"` so messages are read without stealing focus.
- The countdown pauses while the toast is hovered or focused (WCAG 2.2.1), so there's time to reach Undo.

See [accessibility foundation](../foundations/accessibility.md).
