# Offline status

## 1. Metadata
- **Name:** Offline status (`style.css`: `.offline-bar`, `.offline-bar-text`, `.offline-bar-btn`, `.offline-item`, `.offline-item-text`, `.is-failed`)
- **Category:** Status
- **Status:** New (ML-220)

## 2. Overview
The app works with no internet: it opens from a copy of the member's data kept on the device, and what
they log (a session, a quiz round, a Level) waits on the device and is sent when the connection is back.
This is how the app says so: a bar under the top bar, and a pop-up listing what is waiting.
How it works is in `docs/offline.md`; the rules are `public/offline.js`.

**Use** the bar only for the connection and the sync queue. **Don't** use it for other warnings (that is a
[toast](toast.md)) and don't add a second bar: one line, one button.

## 3. Anatomy
- **The bar** - `div.offline-bar` (`role="status"`, `aria-live="polite"`) in `.top-bar-sticky-group`, above the
  [practice session](practice-session.md) bar: an icon (`cloud_off` offline, `cloud_sync` waiting,
  `sync_problem` when something was refused), the words (`.offline-bar-text`) and at most one button
  (`button.offline-bar-btn`).
- **The pop-up** - `#offlineModal`, an ordinary [modal](modal.md): a line of introduction, then an
  `.offline-item` per thing waiting (`.offline-item-text`: what it is in bold, then when it was logged), and
  **Sync now** (`.btn-submit`). An item the server refused is `.offline-item.is-failed`: it says why and has a
  **Remove** button (`.btn-nav`).

## 4. Tokens used
`--status-amber-bg`, `--status-amber-fg` (the bar, its button's edge and words), `--input-border`,
`--label-color`, `--danger-text` (why an item wasn't synced), `--app-max-width`, `--touch-target`,
`--radius-sm`, `--space-0-5`, `--space-1`, `--space-2`, `--space-3`, `--space-5`, `--font-sm`, `--font-sans`,
`--font-weight-semibold`, `--font-weight-bold`.

## 5. Props / API
What the bar says (`Offline.status`, tested):

| Connection | Waiting | The bar | Button |
|---|---|---|---|
| Online | nothing | hidden | - |
| Offline | nothing | "Offline. What you log is kept on this device and synced later." | none |
| Offline | some | "Offline. 3 things waiting to sync." | See them (opens the pop-up) |
| Online | some | "3 things waiting to sync." | Sync now |
| Online | only refused ones | "1 thing could not be synced." | See why (opens the pop-up) |

- A save that waits answers with a success toast: "Saved on this device. It will sync when you are back online."
- Something that needs a connection (editing a piece, a band, the account) fails with "You are offline. This
  needs a connection." in the usual warning toast.
- When things are sent: a success toast, "3 things synced."

## 6. States
Bar: hidden / offline / waiting / refused. Item: waiting / refused (`.is-failed`). Sync now: enabled / disabled
(offline, already sending, or nothing left to send).

## 7. Code example
```html
<div class="offline-bar" role="status" aria-live="polite">
  <span class="material-symbols-outlined" aria-hidden="true">cloud_off</span>
  <span class="offline-bar-text">Offline. 3 things waiting to sync.</span>
  <button type="button" class="offline-bar-btn">See them</button>
</div>
```

## 8. Cross-references
[toast](toast.md) · [modal](modal.md) · [practice-session](practice-session.md) (the other bar under the top bar)

## 9. Accessibility
- The bar is a polite live region, so going offline, coming back and "N things waiting" are read out without
  taking focus. The icon is decoration (`aria-hidden`): the words say everything.
- Amber on amber-tint is an existing checked pair (`--status-amber-fg` on `--status-amber-bg`); the state is
  never colour alone.
- The button is a real `<button>` at least `--touch-target` tall. The pop-up follows the modal rules (X, Escape,
  backdrop tap, focus kept inside and returned).

See [accessibility foundation](../foundations/accessibility.md).
