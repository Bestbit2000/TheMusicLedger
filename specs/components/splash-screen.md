# Splash screen

## 1. Metadata
- **Name:** Splash screen (`.splash-screen`, `.splash-content`, `.splash-image`, `.splash-title`, `.splash-subtitle`, `.splash-google-btn`, `.splash-login-btn`, `.splash-or`, `.splash-form`, `.splash-hint`, `.splash-message`, `.splash-link-btn`)
- **Category:** Page
- **Status:** Stable

## 2. Overview
The full-screen login/landing overlay shown before sign-in. It's always dark, whatever the theme
setting, so its colours use dedicated `--splash-*` aliases that dark mode doesn't remap.
**Don't** reuse these tokens elsewhere.

## 3. Anatomy
`.splash-screen` (fixed, `--z-splash`, scrolls when taller than the screen) › `.splash-content` › `.splash-image` › `.splash-title` › `.splash-subtitle` › `.splash-google-btn` (**Google's own "Sign in with Google" picture**, white theme - `public/icons/google-sign-in-light.svg` from their asset pack, scaled as a whole to 1.25 × `--touch-target` high and never restyled: Google's branding guidelines fix its colours, logo and wording, and the G may only sit on their white, dark or grey; shown with `.show` once auth state is known; ML-430) › for the other actions `.splash-login-btn` (gold gradient, shown once auth status is known).

**Email + password (ML-355, when `password_login` is on):** under Google's button, `.splash-subtitle.splash-or` ("or log in with your email") › `.splash-form` (a column: `label`s in `--splash-subtitle-color`, the standard inputs, a `.splash-message` for errors/results in `--splash-title-color`, the gold `.splash-login-btn` as the submit, and a `.splash-link-btn` - an underlined gold text button, e.g. "Forgot your password?"). The same form shape serves Forgot password and the "choose a password" screen an emailed invite/reset link opens, which adds a `.splash-hint` under the password field.

## 4. Tokens used
`--splash-bg`, `--splash-title-color`, `--splash-subtitle-color`, `--primary-action` →
`--primary-action-gradient-end` (button gradient), `--primary-action-text`, `--shadow-2xl`,
`--radius-md`, `--radius-sm`, `--z-splash`, `--space-2`, `--space-4`, `--space-5`, `--space-6`,
`--space-7`, `--font-md`, `--font-2xl`, `--font-weight-bold`; the forms add `--font-sm`, `--space-3`, `--touch-target`, `--opacity-muted` (disabled button).

## 5. Props / API
Login button starts hidden. JS reveals it. Google ([passport.js](../../server/config/passport.js)), plus email + password when the `password_login` feature is Live - see [docs/password-login.md](../../docs/password-login.md).

## 6. States
Loading (no button) · Ready (button shown) · Button focus (`--focus-ring`) · Submitting (button disabled, `--opacity-muted`) · Error / result (`.splash-message` shown).

## 7. Code example
```html
<div class="splash-screen"><div class="splash-content">
  <img class="splash-image" src="images/splash.png" alt="">
  <h1 class="splash-title">The Music Ledger</h1>
  <p class="splash-subtitle">Track your practice</p>
  <button class="splash-google-btn show" aria-label="Sign in with Google"><img src="icons/google-sign-in-light.svg" alt="" width="180" height="40"></button>
</div></div>
```

## 8. Cross-references
[button](button.md) · [color](../foundations/color.md)

## 9. Accessibility
- Title is a real heading; the sign-in button is a `<button>` with visible text. Splash colours are fixed dark and meet contrast on their own.
- The forms are real `<form>`s with `<label for>`s and the right `autocomplete` (`username`, `current-password`, `new-password`) so password managers fill them. Errors are `role="alert"`, results `role="status"`. `.splash-link-btn` is at least `--touch-target` tall.

See [accessibility foundation](../foundations/accessibility.md).
