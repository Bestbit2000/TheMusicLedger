# Display and reading (ML-356)

Settings → **Display and reading** - for dyslexic players first, and useful to anyone. Since ML-359
the screen is, top to bottom:

1. **Preview** - pinned under the top bar, compact, so it stays in view as you scroll the choices: a line of music (a C major scale, drawn by `Notation`) and a sentence, so you see
   the tint, font, size and spacing on both music and words as you choose. Every choice applies at
   once (to the whole app, not just the preview).
2. **Display & theme** card - Theme (Light / Dark) and Background tint.
3. **Reading & typography** card - Font, Text size and Increased spacing.
4. **Reset to standard** - always at the bottom, disabled while every reading choice is already
   standard. Puts background, font, text size and spacing back to Standard (every one of them has a
   "Standard" option, so it's one word throughout) with an **Undo** toast; Light / Dark is left as it is.

**No one-tap dyslexia preset (removed 2026-09-30).** ML-359 had an "Apply dyslexia-friendly preset"
button (Lexend, Cream, Large text and Increased spacing at once, with Undo). It was taken out on the
owner's call after looking at the research: what helps differs a lot from person to person, the
"dyslexia fonts" show no reliable gain in reading speed or accuracy, and a bundle of four changes is
harder to adjust than one change at a time with the live preview. So each is chosen on its own.

| Setting | Choices | What it does |
|---|---|---|
| Theme | Light · Dark | Dark mode (`darkMode`). Every tint has a dark version, so the theme and a tint go together - the tint tiles show the dark shades while Dark is on |
| Background tint | Standard · Cream · Pale blue · Pale green · Soft yellow · Peach | Page, cards and fields, with a dark version of each for dark mode (ML-359: stronger, so a colour shows in the dark too). Soft yellow and peach/rose are the overlays most often asked for for visual stress - which colour helps differs from person to person. Each choice is a tile filled with its colour |
| Font | Standard (Inter) · Lexend · OpenDyslexic | The font for all UI text (buttons too). Music notation always stays in Bravura |
| Text size | Standard · Large (112.5%) · Extra large (125%) | The root font size - everything sized in rem grows. Stored as `standard` / `large` / `larger` |
| Increased spacing | on / off | Stored as `dyslexia` (`html[data-reading="on"]`). Line spacing 1.7 (1.85 for long text), a little more letter (0.035em) and word (0.12em) spacing, no italics - the British Dyslexia Association style guide |

Before ML-359 "Dyslexia-friendly reading" was an on/off switch that also picked Lexend and cream (and a
`beforeDyslexia` field remembered what to put back). That switch became the Increased spacing switch
(for a while alongside the preset button, since removed); the server no longer keeps `beforeDyslexia` (an old copy left in an account's
`display_prefs` does nothing).

**Saved on the account** (`accounts.display_prefs`, migration 077; `GET/PUT /api/account/display`,
values checked by `DISPLAY_PREF_CHOICES` in `server/services/accounts.js`), so they follow the person
to every device. A copy is kept on the device (`localStorage tml.display`) so
`public/display-prefs.js` - the first thing in `<body>` - can apply them before anything draws (this also
fixed dark mode's flash of light mode on startup). The first time an account has none saved, the
device's own dark mode is kept and saved.

**How it's built:** each preference is a data attribute on `<html>` (`data-font`, `data-bg`,
`data-text`, `data-reading`) and `public/tokens.css` switches Layer 2 aliases on them, exactly like dark
mode - no component needs to know. `style.css` only reads the new aliases (`--text-scale`,
`--reading-letter-spacing`, ...). Adding another background or font is a few token lines plus a choice
in `DISPLAY_PREF_CHOICES` and the settings screen. Spec: `specs/components/display-and-reading.md`.

**Fonts:** Lexend and OpenDyslexic are self-hosted in `public/fonts/` under the SIL Open Font License,
with each licence stored next to it and listed in `docs/third-party-providers.md` ("Licensed assets").
They're only downloaded when chosen. OpenDyslexic is a wide font by design, so text in it takes more
room; home tool tile labels shrink to fit their tile (`--tile-label-fit`).

**Contrast:** every text colour (body, labels, links, gold text, danger, success) meets 4.5:1 on every
background's page, cards and fields, light and dark - lowest 4.52 (success on the peach page). Body text is
an off-black dark grey (#333333), not pure black, so the pale backgrounds don't get a harsh, shimmering
edge. ML-359 lightened the cream, blue and green pages a touch so the green success text passes too.
