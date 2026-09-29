# Two-step sign-in

## 1. Metadata
- **Name:** Two-step sign-in (`.two-step-key`, `.recovery-codes`, `.two-step-message`)
- **Category:** Account / security
- **Status:** Stable (ML-355 batch 2)

## 2. Overview
Setting up and managing two-step sign-in for an email + password login: the setup key, the one-time
recovery codes, and the in-app error line. Built by `renderTwoStepSetup` / `renderRecoveryCodes`
(app.js) in two places - the login splash (a super admin's first password login, where it's required)
and My account → Sign-in and security. See [docs/password-login.md](../../docs/password-login.md).

## 3. Anatomy
Setup: intro › step 1 text › "Add to my authenticator app" (the primary button - opens the `otpauth:`
link, so a phone goes straight to its authenticator app) › "type this key" text › `.two-step-key` (the
key in groups of 4) › "Copy the setup key" (text button) › step 2 text › the code field
(`inputmode="numeric"`, `autocomplete="one-time-code"`) › `.two-step-message` / `.splash-message` (error)
› "Turn on two-step sign-in".

Recovery codes: the explanation › `.recovery-codes` (an `<ol>` of 10 codes, 2 columns, numbered) ›
"Copy the codes" (text button) › "I've saved them" (primary).

The same structure takes the splash classes (`.splash-hint` text, `.splash-login-btn` buttons,
`.splash-link-btn` links, `.splash-message`) or the app ones (`.text-sm`, `.btn-submit`, `.btn-text`,
`.two-step-message`) - `TWO_STEP_LOOK` in app.js.

## 4. Tokens used
`--input-bg` + `--text-color` (the key and codes card - a checked pair, and it reads the same on the
dark splash), `--control-border`, `--radius-lg`, `--font-mono`, `--font-md`, `--space-2`, `--space-3`,
`--space-4`, `--space-7` (room for the list numbers), `--danger-text` + `--font-weight-bold` (the in-app
error line).

## 5. Props / API
`renderTwoStepSetup(box, 'splash' | 'app', { setup, confirm, finished, intro })`,
`renderRecoveryCodes(box, look, codes, done, heading)`.

## 6. States
Getting ready · Setup (key + code) · Wrong code (message shown) · Recovery codes (shown once).

## 7. Code example
```html
<p class="two-step-key" aria-label="Setup key">JBSW Y3DP EHPK 3PXP</p>
<ol class="recovery-codes" aria-label="Recovery codes"><li>k7m2-9xqp</li><li>a3cd-ef4g</li></ol>
<p class="two-step-message" role="alert">That code isn't right - check the app and try again.</p>
```

## 8. Cross-references
[splash-screen](splash-screen.md) · [password-field](password-field.md) · [button](button.md)

## 9. Accessibility
- The key and codes are real text (selectable, read out), with a monospace font so 0/O and 1/l can't
  be confused - and the codes are generated without those characters anyway.
- Errors are `role="alert"`. The code field has a visible label, `inputmode="numeric"` (a number pad)
  and `autocomplete="one-time-code"` (the phone can offer it).
- `--text-color` on `--input-bg` meets 4.5:1 in both themes; on the splash the card is the same light
  card the inputs use.

See [accessibility foundation](../foundations/accessibility.md).
