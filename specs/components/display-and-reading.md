# Display and reading

## 1. Metadata
- **Name:** Display and reading (`.font-preview-standard`, `.font-preview-lexend`, `.font-preview-opendyslexic`, `.text-size-preview-large`, `.text-size-preview-larger`, `.display-preview`, `.display-preview-label`, `.display-preview-staff`, `.display-preview-text`, `.display-card`, `.display-card-title`, `.display-toggle-row`, `.display-toggle-help`, `.bg-tile-tick`, `.bg-tile-name`, `.bg-swatch`, `.bg-swatch-standard`, `.bg-swatch-yellow`, `.bg-swatch-peach`, `.bg-swatch-cream`, `.bg-swatch-blue`, `.bg-swatch-green`) and the page-wide reading preferences (`html[data-font]`, `html[data-bg]`, `html[data-text]`, `html[data-reading]`)
- **Category:** Settings / foundations
- **Status:** Stable (ML-356; screen redesigned ML-359)

## 2. Overview
Settings → **Display and reading**: dark mode, **dyslexia-friendly reading**, the reading font, the
background colour and the text size. Saved on the account, so they follow the person to every device.
Each preference is a data attribute on `<html>` that `tokens.css` switches on - like dark mode, only
Layer 2 aliases change, so every screen follows without a component knowing. Music notation always
keeps Bravura. See [docs/display-and-reading.md](../../docs/display-and-reading.md).

## 3. Anatomy
Settings screen (ML-359), top to bottom:
1. **Preview** - a compact `.flow-card.display-preview`, **pinned under the top bar** (`position: sticky`,
   `top: var(--header-h)` - app.js measures the top bar, which grows with text size) with a shadow, so the
   effect of each choice stays in view while you scroll the settings: a small `.display-preview-label`
   "Preview", a line of music in `.display-preview-staff` (a C major scale drawn by Notation, 64px tall -
   `--space-10` - and centred) and a short centred `.display-preview-text` sentence.
2. (No preset and no hint: the one-tap dyslexia-friendly preset was taken out - what helps differs from
   person to person, so each choice is made on its own.)
3. **Display & theme** - a `.flow-card.display-card` with an `h2.display-card-title` (icon + words):
   Theme as a `.radio-group.is-segmented` (Light / Dark with icons), then Background tint as a
   `.radio-group.is-tiles` - six tiles, three to a row, each filled with its colour (a `.bg-swatch` +
   `.bg-swatch-*` behind the `.bg-tile-name`), the chosen one with the strong outline and a
   `.bg-tile-tick`. The tiles show the dark shades while Dark is on.
4. **Reading & typography** - a second `.display-card`: Font (`.radio-group.compact.is-fit.is-centred`, each label
   in its own font - `.font-preview-*`; OpenDyslexic is wide, so it takes its own row), Text size
   (`.radio-group.compact.is-centred`, Large and Extra large drawn at their size - `.text-size-preview-*`)
   and a `.display-toggle-row`: "Increased spacing" with a `.display-toggle-help` line, and a
   `.toggle-switch`.
5. **Reset to standard** - a `.btn-text` at the bottom, always there and `disabled` while every reading
   choice is already standard. It puts background, font, text size and spacing back to Standard (the first
   option of each is called "Standard", including the tint) - not Light / Dark - and offers Undo.

## 4. Tokens used
Settings: `--font-preview-standard | -lexend | -opendyslexic`, `--swatch-standard | -cream | -blue |
-green | -yellow | -peach` (dark-mode shades in `body.dark-mode`), `--selected-ring-inset` (the chosen tile), `--primary-action-strong`,
`--text-color`, `--label-color`, `--z-base`, `--touch-target`, `--font-sm` … `--font-lg`, `--space-1` … `--space-5`.
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
Each preference's value. Reset to standard is disabled while all four reading choices are standard.

## 7. Code example
```html
<input type="radio" name="readingFont" id="readingFont-lexend" value="lexend">
<label for="readingFont-lexend" class="font-preview-lexend">Lexend</label>
<input type="radio" name="readingBackground" id="readingBackground-cream" value="cream">
<label for="readingBackground-cream"><span class="bg-swatch bg-swatch-cream" aria-hidden="true"></span><span class="material-symbols-outlined bg-tile-tick" aria-hidden="true">check_circle</span><span class="bg-tile-name">Cream</span></label>
```

## 8. Cross-references
[radio-group](radio-group.md) · [toggle-switch](toggle-switch.md) · [typography](../foundations/typography.md) · [color](../foundations/color.md)

## 9. Accessibility
- The whole point: WCAG and the British Dyslexia Association's style guide - more line spacing (1.7),
  letter and word spacing, no italics, a choice of font, background colour and text size.
- Every text colour meets 4.5:1 on every background choice, light and dark (checked for text, labels,
  links, the gold text and danger text; lowest 4.59).
- The swatch and tick are decorative (`aria-hidden`) - each choice is named in words, and the chosen
  tile has a thicker outline and a tick, not colour alone. Tile names are `--text-color`, which meets
  4.5:1 on every tint (light shades in light mode, dark shades in dark).
- The preview's stave has an `aria-label`; Text size scales everything
  sized in rem; nothing is lost at Larger (tool tile labels shrink to fit their tile).
- Letter spacing is never applied to the icon font (it would break its ligatures) or to notation.

See [accessibility foundation](../foundations/accessibility.md).
