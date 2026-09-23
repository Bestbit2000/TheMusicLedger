# Top bar

## 1. Metadata
- **Name:** Top bar (`.top-bar-sticky-group`, `.top-bar`, `.top-bar-title`, `.top-btn`, `.top-btn-back`, `.top-tuner-toggle`, `.top-bar-timer-pill`, `.hidden-btn`, `.top-bar-*`, `.top-tuner-*`)
- **Category:** Navigation
- **Status:** Stable

## 2. Overview
The sticky header on every app screen: back (‹), centred title, then the tuner toggle, a
running-timer pill when a timer is active, and the ☰ burger menu. The metronome mini bar docks
directly beneath it inside `.top-bar-sticky-group`. **Don't** add screen-specific actions here.
Put them in the screen body.

## 3. Anatomy
`.top-bar-sticky-group` (sticky, `--z-header`) › `.top-bar` › [`.top-btn-back`] [`.top-bar-title`] [`.top-tuner-toggle`] [`.top-bar-timer-pill`] [`#navBurgerMenuBtn.top-btn` + `.notif-dot`] › optional `.metro-mini-bar`

## 4. Tokens used
`--container-bg`, `--text-color`, `--label-color`, `--input-border`, `--primary-action`,
`--primary-action-tint` (running timer pill), `--shadow-md`, `--z-header`, `--app-max-width`,
`--space-2`, `--space-5`, `--font-md`, `--font-lg`, `--font-weight-bold`, `--radius-pill`, `--radius-circle`.

## 5. Props / API
- `.hidden-btn` keeps a slot's width but hides it, so the title stays centred when there's no back button.
- Timer pill: `.top-bar-timer-pill-running` while counting (gold tint + gold text).

## 6. States
| Element | States |
|---|---|
| Timer pill | idle (outline) · running (`--primary-action-tint` fill, `--primary-action` text) |
| Burger | default · has-unread (`.notif-dot`, see [notification-centre](notification-centre.md)) |

## 7. Code example
```html
<div class="top-bar-sticky-group">
  <div class="top-bar">
    <button class="top-btn-back">‹</button>
    <div class="top-bar-title">Timer</div>
    <button class="top-btn" id="navBurgerMenuBtn">☰</button>
  </div>
</div>
```

## 8. Cross-references
[dropdown-menu](dropdown-menu.md) · [notification-centre](notification-centre.md) · [metronome](metronome.md) · [elevation](../foundations/elevation.md)

## 9. Accessibility
- The title is the page `<h1>` (`#topTitle`, `tabindex="-1"`): `switchView` updates `document.title` and moves focus to it on every screen change.
- Burger: `aria-label="Menu" aria-haspopup="menu" aria-expanded`. Timer pill: `aria-haspopup="dialog"`.
- Back button needs an accessible name if it only shows a glyph.

See [accessibility foundation](../foundations/accessibility.md).
