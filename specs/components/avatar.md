# Avatar

## 1. Metadata
- **Name:** Avatar (`.avatar`, `.avatar-initials`, and inside a drawing `.is-solid`, `.is-dot`)
- **Category:** Data display
- **Status:** Stable (ML-377)

## 2. Overview
A small gold circle that stands for your account: your initials, or one of the app's drawings of an
instrument or other musical thing. It's shown next to the home greeting (a button that opens My details)
and in My details and the Choose an avatar pop-up. No photos. **Don't use** it for anything but the
signed-in account.

## 3. Anatomy
`.avatar` (a circle, `--touch-target` across) holding either:
- `span.avatar-initials` - two letters (first name + surname), one when there's only one, else the
  display name's or email's first letter; or
- an inline `<svg viewBox="0 0 48 48">` line drawing from `public/avatars.js` (`Avatars.inner(profile)`):
  lines in the circle's colour; `.is-solid` parts filled with the circle's tint so they hide the lines
  behind them (a valve block, a drum head); `.is-dot` parts are filled dots (keys, tone holes).

The drawings: cornet, euphonium, trombone, French horn, saxophone, clarinet, flute, snare drum,
metronome, music stand, tuning fork, headphones.

**Choose an avatar** (My details → Avatar's pencil): a `.modal` with a `.flow-tile-grid.flow-tile-grid-3`
of `.flow-picker-tile`s - Initials first, then each drawing - each with an `.avatar` and its name; the
current one `.selected`. Tapping one saves it and closes the pop-up.

## 4. Tokens used
`--primary-action-tint` (circle fill, and `.is-solid`), `--primary-action-strong` (edge, lines, initials),
`--radius-circle`, `--touch-target`, `--font-sm`, `--font-weight-bold`.

## 5. Props / API
`Avatars.inner(profile)` (the circle's contents), `Avatars.label(profile)` (words for a screen reader),
`Avatars.initials(profile)`, `Avatars.LIST` (`{ id, name, svg }`). The ids must match `AVATAR_IDS` in
`server/services/accounts.js` (`server/test/avatars.test.js` checks). Saved as `accounts.avatar` through
`PUT /api/account { avatar }` (null = initials). See [docs/home-greeting.md](../../docs/home-greeting.md).

## 6. States
Initials · Drawing · (as a button) Focus (`--focus-ring`). In the picker: Selected (the tile's own `.selected`).

## 7. Code example
```html
<button type="button" class="avatar" aria-label="Your avatar: Euphonium - change it in My details">
  <svg viewBox="0 0 48 48" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">…</svg>
</button>
<span class="avatar" role="img" aria-label="Your avatar: your initials, A S"><span class="avatar-initials" aria-hidden="true">AS</span></span>
```

## 8. Cross-references
[home-greeting](home-greeting.md) · [selectable-tile](selectable-tile.md) · [modal](modal.md)

## 9. Accessibility
- On the home screen it's a `<button>` named by `Avatars.label` ("Your avatar: Euphonium - change it in
  My details"), 48px across. Elsewhere it's `role="img"` with the same words. The drawing and the letters
  themselves are `aria-hidden`.
- Strong gold on its own tint is an existing pair (`--primary-action-strong` on `--primary-action-tint`),
  4.5:1 in both themes, so the letters pass as text and the lines as graphics.

See [accessibility foundation](../foundations/accessibility.md).
