# Password field

## 1. Metadata
- **Name:** Password field (`.password-field`, `.password-toggle`)
- **Category:** Inputs
- **Status:** Stable (ML-355)

## 2. Overview
A password box with an eye button at its right end: tap it to see what you've typed, tap again to hide
it. Use it for **every** password box (log in, choose a password, confirm it, change it later), so
nobody has to type a long password blind. **Don't use** for anything that isn't a password.

## 3. Anatomy
`.password-field` (position: relative) › the standard `input[type=password]` (extra right padding so
text never runs under the button) › `.password-toggle` (a `<button>`, `--touch-target` square, pinned
to the input's right end, a Material Symbol: `visibility` while hidden, `visibility_off` while shown).

## 4. Tokens used
`--touch-target` (button size, and the input's extra right padding with `--space-2`), `--label-color`
(the eye, on `--input-bg`), `--radius-lg`.

## 5. Props / API
Markup: `<button type="button" class="password-toggle" data-password-toggle="<input id>" aria-label="Show password" aria-pressed="false">`.
One delegated click handler in app.js does every field (no per-field wiring). Before a form is sent,
any shown password is hidden again, so the browser never saves it as ordinary text.

## 6. States
Hidden (dots, `visibility`, `aria-pressed="false"`) · Shown (text, `visibility_off`, `aria-pressed="true"`) · Focus (`--focus-ring`).

## 7. Code example
```html
<label for="pw">Password</label>
<div class="password-field">
  <input type="password" id="pw" autocomplete="current-password">
  <button type="button" class="password-toggle" data-password-toggle="pw" aria-label="Show password" aria-pressed="false">
    <span class="material-symbols-outlined" aria-hidden="true">visibility</span>
  </button>
</div>
```

## 8. Cross-references
[splash-screen](splash-screen.md) (the login forms) · [icon-button](icon-button.md)

## 9. Accessibility
- The eye is a real `<button>` with a name that says what it will do ("Show password" / "Hide
  password") and `aria-pressed`, so a screen reader hears the state; the icon itself is hidden from it.
- `--label-color` on `--input-bg` is a checked pair (3:1+ for an icon). The button is a full
  `--touch-target` square.
- It doesn't take the password manager's autofill away: the input keeps its `autocomplete`.

See [accessibility foundation](../foundations/accessibility.md).
