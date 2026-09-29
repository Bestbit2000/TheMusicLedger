# Display and reading (ML-356)

Settings → **Display and reading** - for dyslexic players first, and useful to anyone:

| Setting | Choices | What it does |
|---|---|---|
| Dark mode | on / off | Saved on the account. Since ML-359 it sits in the **Background** box: every colour below has a dark version, so dark mode and a colour go together |
| Dyslexia-friendly reading | on / off | Line spacing 1.7 (1.85 for long text), a little more letter (0.035em) and word (0.12em) spacing, no italics - the British Dyslexia Association style guide. Turning it on picks Lexend and cream if the font and background are still standard, remembering them (`beforeDyslexia`), so turning it off puts them back - unless you changed them yourself in between (ML-359) |
| Reading font | Standard (Inter) · Lexend · OpenDyslexic | The font for all UI text (buttons too). Music notation always stays in Bravura |
| Background colour | Standard · Cream · Pale blue · Pale green · Soft yellow · Peach | Page, cards and fields, with a dark version of each for dark mode (ML-359: stronger, so a colour shows in the dark too). Soft yellow and peach/rose are the overlays most often asked for for visual stress - which colour helps differs from person to person |
| Text size | Standard · Large (112.5%) · Larger (125%) | The root font size - everything sized in rem grows |

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
