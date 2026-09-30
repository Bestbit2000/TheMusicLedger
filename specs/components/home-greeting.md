# Home greeting

## 1. Metadata
- **Name:** Home greeting (`.home-greeting`, `.home-greeting-text`, `.home-greeting-hello`, `.home-greeting-line`)
- **Category:** Data display
- **Status:** Stable (ML-330, ML-377)

## 2. Overview
The top of the home screen: your [avatar](avatar.md), a greeting that follows the moment ("Good morning
Andrew", "Nice work today Andrew", "Welcome back Andrew"…) and **one** encouraging line under it ("You're
on a 3-day streak"), just before "Start a practice session". The rules are in
[docs/home-greeting.md](../../docs/home-greeting.md). **Don't** put more than one line here, and never a
discouraging one.

## 3. Anatomy
`.home-greeting` (a row: `--space-3` gap, `--space-6` under it - a clear break before Start a practice session) › `button.avatar` › `.home-greeting-text` ›
`p.home-greeting-hello` (the greeting, bold, `--font-md`) › `p.home-greeting-line` (the line, `--font-sm`,
`--label-color`; hidden until it's worked out, and when there's nothing to say). The whole row is hidden
when the account has no name.

## 4. Tokens used
`--space-3`, `--space-6`, `--font-md`, `--font-sm`, `--font-weight-bold`, `--label-color` (and the avatar's own).

## 5. Props / API
`renderHomeGreeting()` (app.js) - on the profile arriving, after the sessions load (`renderAllViews`) and
after the extras load (`loadHomeExtras`). The text comes from `HomeGreeting.greeting` and
`HomeGreeting.lines` / `pickLine` (`public/homeGreeting.js`).

## 6. States
Greeting only (the line still loading, or nothing to say) · Greeting + line · Hidden (no name).

## 7. Code example
```html
<div class="home-greeting">
  <button type="button" class="avatar" aria-label="Your avatar: your initials, A S - change it in My details"><span class="avatar-initials" aria-hidden="true">AS</span></button>
  <div class="home-greeting-text">
    <p class="home-greeting-hello">Good morning Andrew</p>
    <p class="home-greeting-line">You're on a 3-day streak</p>
  </div>
</div>
```

## 8. Cross-references
[avatar](avatar.md) · [stat-card](stat-card.md) · [button](button.md)

## 9. Accessibility
- Plain text in reading order: greeting, then the line. `--label-color` on the page passes 4.5:1 in both
  themes and every tint (an existing pair).
- The line doesn't change while you're looking at it (it's kept while it's still true), so nothing moves
  under a screen reader.

See [accessibility foundation](../foundations/accessibility.md).
