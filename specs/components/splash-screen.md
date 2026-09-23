# Splash screen

## 1. Metadata
- **Name:** Splash screen (`.splash-screen`, `.splash-content`, `.splash-image`, `.splash-title`, `.splash-subtitle`, `.splash-login-btn`)
- **Category:** Page
- **Status:** Stable

## 2. Overview
The full-screen login/landing overlay shown before sign-in. It's always dark, whatever the theme
setting, so its colours use dedicated `--splash-*` aliases that dark mode doesn't remap.
**Don't** reuse these tokens elsewhere.

## 3. Anatomy
`.splash-screen` (fixed, `--z-splash`) › `.splash-content` › `.splash-image` › `.splash-title` › `.splash-subtitle` › `.splash-login-btn` (gold gradient, shown once auth status is known).

## 4. Tokens used
`--splash-bg`, `--splash-title-color`, `--splash-subtitle-color`, `--primary-action` →
`--primary-action-gradient-end` (button gradient), `--primary-action-text`, `--shadow-2xl`,
`--radius-md`, `--radius-sm`, `--z-splash`, `--space-2`, `--space-4`, `--space-5`, `--space-6`,
`--space-7`, `--font-md`, `--font-2xl`, `--font-weight-bold`.

## 5. Props / API
Login button starts hidden. JS reveals it. Google OAuth only ([passport.js](../../server/config/passport.js)).

## 6. States
Loading (no button) · Ready (button shown) · Button focus (`--focus-ring`).

## 7. Code example
```html
<div class="splash-screen"><div class="splash-content">
  <img class="splash-image" src="images/splash.png" alt="">
  <h1 class="splash-title">The Music Ledger</h1>
  <p class="splash-subtitle">Track your practice</p>
  <button class="splash-login-btn">Sign in with Google</button>
</div></div>
```

## 8. Cross-references
[button](button.md) · [color](../foundations/color.md)

## 9. Accessibility
- Title is a real heading; the sign-in button is a `<button>` with visible text. Splash colours are fixed dark and meet contrast on their own.

See [accessibility foundation](../foundations/accessibility.md).
