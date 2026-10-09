# Brand mark

## 1. Metadata
- **Name:** Brand mark (`style.css`: `.brand-mark`)
- **Category:** Identity
- **Status:** Stable (ML-484; one name since the app was renamed Notably Better)

## 2. Overview
The app's small mark - a gold "NB" monogram on a dark rounded square, its first stroke a note's stem with
its notehead - shown beside the app's name, Notably Better (`docs/app-name.md`).

**Use** it only beside the app's own name. **Don't** put it on other screens (their top bar shows the
screen's name), use it as a button, or recolour it - the picture is the app's artwork, drawn by
`brand-trials/build.mjs`.

## 3. Anatomy
- `img.brand-mark` - a square the size of a large icon with small rounded corners. Its `src` is
  `images/brands/notably-better-mark.svg`.
- **Top bar, Home, on a phone** (`#topBrandMark`): before the title, which is the app's name there. Hidden on
  every other screen (`switchView`) and on a wide screen, where the rail carries it.
- **Menu rail head** (`#railBrandMark`): before `.nav-rail-name`. With the rail folded to icons the name goes
  and the mark stays, above the fold button ([menu-rail](menu-rail.md)).
- The **browser-tab icon** is the same mark drawn bolder with no stave (`images/brands/notably-better-tab.svg`
  and `.png`), on every page. The **installed app's icons** (`public/icons/`) are the mark with its stave.

## 4. Tokens used
`--icon-xl` (its size), `--radius-sm`, `--space-2`.

## 5. Props / API
- `window.Brand.name()` (`brand.js`) is the app's name, for anything a script writes (the Home title, the
  browser tab). The mark, the name in the page and the sign-in picture are plain markup - no script sets them.

## 6. States
Top bar: on Home / not on Home (hidden). Rail: open (mark and name) / folded (mark only).

## 7. Code example
```html
<img class="brand-mark" id="topBrandMark" src="images/brands/notably-better-mark.svg" alt="" aria-hidden="true">
<h1 class="top-bar-title" id="topTitle">Notably Better</h1>
```

## 8. Cross-references
[top-bar](top-bar.md) · [menu-rail](menu-rail.md) · [splash-screen](splash-screen.md)

## 9. Accessibility
- The mark is decoration beside a visible name: `alt=""` and `aria-hidden="true"`, so the name is read once.
  With the rail folded the name is gone from view; the rail's items still have their names, and the page
  heading says where you are.
- It is not a control - nothing to focus or tap.
- The artwork is gold on near-black inside its own square, so it reads the same in the light and dark themes
  and on every background tint; it is a picture, not text, and carries no information the name doesn't.
- The sign-in picture's `alt` is the app's name.

See [accessibility foundation](../foundations/accessibility.md).
