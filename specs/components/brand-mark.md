# Brand mark

## 1. Metadata
- **Name:** Brand mark (`style.css`: `.brand-mark`; `html[data-brand-ready]`)
- **Category:** Identity
- **Status:** New (ML-484)

## 2. Overview
The app's small mark - a gold monogram on a dark rounded square - shown beside the app's name. "The Music
Ledger" is a working title, and the name on screen can be one of three while a new name is tried out
(Admin → App name; `docs/brand-trial.md`). The mark, the name and the sign-in picture follow that setting
together; `public/brand.js` does the swapping.

**Use** it only beside the app's own name. **Don't** put it on other screens (their top bar shows the
screen's name), use it as a button, or recolour it - the picture is the brand's artwork, drawn by
`brand-trials/build.mjs`.

## 3. Anatomy
- `img.brand-mark` - a square the size of a large icon with small rounded corners. Its `src` is
  `images/brands/<brand>-mark.svg`.
- **Top bar, Home, on a phone** (`#topBrandMark`): before the title, which is the app's name there. Hidden on
  every other screen (`switchView`) and on a wide screen, where the rail carries it.
- **Menu rail head** (`#railBrandMark`): before `.nav-rail-name`. With the rail folded to icons the name goes
  and the mark stays, above the fold button ([menu-rail](menu-rail.md)).
- **Admin → App name**: in each choice of the pop-up, before the name.
- The **browser-tab icon** is the same mark drawn bolder with no stave (`images/brands/<brand>-tab.svg` and
  `.png`), swapped by `brand.js` (`#brandTabIcon`, `#brandTabIconPng`). The installed-app icons and
  `manifest.json` do not follow the brand.

## 4. Tokens used
`--icon-xl` (its size), `--radius-sm`, `--space-2`.

## 5. Props / API
- `window.Brand` (`brand.js`): `name()` the name on screen, `key()` the brand's key, `known(key)` applies one.
- `<html data-brand="…">` says which brand is showing. `<html data-brand-ready>` is set once the brand is
  known - remembered on the device (`localStorage`, `tml.brand`), or answered by `/api/brand`, or after 2.5
  seconds at most. Until then the sign-in picture, the mark and the rail's name are held back
  (`visibility: hidden`), so nobody sees one name and then another.
- A trial brand's sign-in picture that can't be fetched falls back to the Music Ledger picture.

## 6. States
One of three brands. Held back / showing. Top bar: on Home / not on Home (hidden).

## 7. Code example
```html
<img class="brand-mark" id="topBrandMark" src="images/brands/music-ledger-mark.svg" alt="" aria-hidden="true">
<h1 class="top-bar-title" id="topTitle">The Music Ledger</h1>
```

## 8. Cross-references
[top-bar](top-bar.md) · [menu-rail](menu-rail.md) · [splash-screen](splash-screen.md) · [admin-shell](admin-shell.md) (Admin → App name)

## 9. Accessibility
- The mark is decoration beside a visible name: `alt=""` and `aria-hidden="true"`, so the name is read once.
  With the rail folded the name is gone from view; the rail's items still have their names, and the page
  heading says where you are.
- It is not a control - nothing to focus or tap.
- The artwork is gold on near-black inside its own square, so it reads the same in the light and dark themes
  and on every background tint; it is a picture, not text, and carries no information the name doesn't.
- The sign-in picture's `alt` is the name on screen.

See [accessibility foundation](../foundations/accessibility.md).
