# Display and reading

## 1. Metadata
- **Name:** Display and reading (`.font-preview-standard`, `.font-preview-lexend`, `.font-preview-opendyslexic`, `.bg-swatch`, `.bg-swatch-standard`, `.bg-swatch-yellow`, `.bg-swatch-peach`, `.bg-swatch-cream`, `.bg-swatch-blue`, `.bg-swatch-green`) and the page-wide reading preferences (`html[data-font]`, `html[data-bg]`, `html[data-text]`, `html[data-reading]`)
- **Category:** Settings / foundations
- **Status:** Stable (ML-356)

## 2. Overview
Settings → **Display and reading**: dark mode, **dyslexia-friendly reading**, the reading font, the
background colour and the text size. Saved on the account, so they follow the person to every device.
Each preference is a data attribute on `<html>` that `tokens.css` switches on - like dark mode, only
Layer 2 aliases change, so every screen follows without a component knowing. Music notation always
keeps Bravura. See [docs/display-and-reading.md](../../docs/display-and-reading.md).

## 3. Anatomy
Settings screen: the Dyslexia-friendly reading `.setting-row` toggle + a `.text-sm` line saying what it
does › Reading font (a `.radio-group`, each label drawn in its own font - `.font-preview-*`) › **Background**
(ML-359): the Dark mode `.setting-row` toggle, then Standard, Cream, Pale blue, Pale green, Soft yellow and
Peach (a `.radio-group`, two to a row, each label led by a `.bg-swatch` circle of that colour - the dark
shade while dark mode is on, since every colour has a dark version) › Text size (Standard / Large / Larger).
Dark mode sits with the colours because it's one of the two halves of the same choice.

## 4. Tokens used
Settings: `--font-preview-standard | -lexend | -opendyslexic`, `--swatch-standard | -cream | -blue |
-green | -yellow | -peach` (dark-mode shades in `body.dark-mode`), `--space-2`, `--space-4`, `--control-border`, `--radius-circle`.
Page-wide (switched by the data attributes): `--font-sans` (reading font), `--text-scale` (root font
size: 100 / 112.5 / 125%), `--line-height-base` and `--line-height-relaxed`, `--reading-letter-spacing`,
`--reading-word-spacing`, `--reading-em-style` (dyslexia-friendly), `--bg-color`, `--container-bg`,
`--input-bg` (background colour - with a dark variant of each), `--tile-label-fit` (a home tool tile's
label shrinks to fit when the font or text is bigger).

## 5. Props / API
`public/display-prefs.js` (first thing in `<body>`) applies the device's copy before anything draws and
defines `window.applyDisplayPrefs(prefs)`. app.js: `saveDisplayPrefs(changes)` (applies, keeps the
device copy, saves to the account), `loadDisplayPrefs()` at startup. Server: `GET/PUT
/api/account/display`, `accounts.display_prefs` (migration 077), values checked by
`DISPLAY_PREF_CHOICES` (server/services/accounts.js).

## 6. States
Each preference's value; turning dyslexia-friendly on picks Lexend and cream if the font and
background are still standard, and turning it off puts back whichever of them it changed (ML-359).

## 7. Code example
```html
<input type="radio" name="readingFont" id="readingFont-lexend" value="lexend">
<label for="readingFont-lexend" class="font-preview-lexend">Lexend</label>
<input type="radio" name="readingBackground" id="readingBackground-cream" value="cream">
<label for="readingBackground-cream"><span class="bg-swatch bg-swatch-cream" aria-hidden="true"></span>Cream</label>
```

## 8. Cross-references
[radio-group](radio-group.md) · [toggle-switch](toggle-switch.md) · [typography](../foundations/typography.md) · [color](../foundations/color.md)

## 9. Accessibility
- The whole point: WCAG and the British Dyslexia Association's style guide - more line spacing (1.7),
  letter and word spacing, no italics, a choice of font, background colour and text size.
- Every text colour meets 4.5:1 on every background choice, light and dark (checked for text, labels,
  links, the gold text and danger text; lowest 4.59).
- The swatch is decorative (`aria-hidden`) - each choice is named in words. Text size scales everything
  sized in rem; nothing is lost at Larger (tool tile labels shrink to fit their tile).
- Letter spacing is never applied to the icon font (it would break its ligatures) or to notation.

See [accessibility foundation](../foundations/accessibility.md).
