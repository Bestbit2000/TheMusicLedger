# Tool icon button

## 1. Metadata
- **Name:** Tool icon button (`.tool-group`, `.tool-group-title`, `.tool-icon-row`, `.tool-icon-btn`, `.tool-icon-label`, `.tool-icon-svg`; the All tools page `.tools-page` (+ `.is-editing`), `.tool-fav-star`, `.is-fav`, `.tools-home-card`, `.tools-done-bar`, `.tool-move-icon`)
- **Category:** Navigation
- **Status:** Stable

## 2. Overview
Square launcher tiles on the home screen for the practice tools (Timer, Metronome, Tuner, Quick
play, Flow…). **Don't use** for in-page actions. They always navigate to a tool.

**Home and All tools (ML-378):** Home shows only **My tools** - up to the `home_tools` limit of favourites (ML-388: 4 Standard, 8 others) in one `.tool-icon-row`
(`#homeToolsRow`, copies of the All tools tiles made by `renderHomeTools`; default Metronome, Tuner, Timer,
Warm-ups) and an **All tools** row (a `.settings-link`). The tiles themselves live on the **All tools** page
(`#toolsView.tools-page`), in three groups, each a `.tool-group` with a small label (`.tool-group-title`:
`--font-sm` bold, `--label-color`) over its own 4-column row: **Everyday** (Metronome, Tuner, Timer), **My
routine** in the order it's practised (Warm-ups, Scales, Rehearse - as the session templates - with Add a piece, ML-400, just before Rehearse: see [add-piece](add-piece.md)) and **Learn**
(Theory, Skills, Range - ML-406: Skills opens Pitch, Tempo, Pulse and Rhythm from one list, see [drills](drills.md)). A group hides when none of its tools
are on (`renderToolGroups`), and the ☰ menu's tools are one labelled row per group (`renderNavToolsRow`).
A tile on Home has a filled **★** (`.tool-fav-star` on `.is-fav`, the tile's own text colour).
**Choose Home tools** (a `.btn-nav.btn-cancel`, "Done" while choosing) puts the page in `.is-editing`:
every tile shows a ★ (outline = not on Home), a tap toggles it instead of opening the tool (`aria-pressed`),
the ones on Home take the selected look (`--primary-action-tint` + `--primary-action-strong`), and a fifth is
refused ("Home holds 4 tools"). **Order:** Home shows them in your order (a new one goes at the end). While
choosing, a **"My Home screen"** card at the top (`#toolsHomeOrder`: a compact `.flow-card` titled like the Display and
reading preview - a small `.display-preview-label` - over a `.tool-icon-row`; boxed so it can't be taken for more tools;
not a `.tool-group`, so the ☰ menu skips it) shows them as Home will. Each tile there has a **⋮** in its corner
(`.tool-move-icon`, where the ★ sits on the tiles below) - the app's options menu, since it can be moved or taken
off; tapping anywhere on the tile opens it; tapping one opens a `.dropdown-menu`
(`#homeToolMenu`: Move earlier / Move later / Take off Home), and ← / → move it from the keyboard. Tap-to-move
rather than drag (owner, 2026-09-30): four tiles need one or two taps, and a press-and-hold drag would fight
scrolling (ML-367) and still need this as its accessible alternative. Saved on the account
(`accounts.home_tools`, in order). While choosing, the card is pinned under the top bar (`.tools-home-card`: sticky,
`top: var(--header-h)`, `--shadow-md` - as the Display and reading preview) with the "3 of 4 on Home" line under it,
and **Done** is pinned to the bottom of the screen (`.tools-done-bar`: sticky, `bottom: 0`, on `--container-bg`), so
both stay in reach however far you scroll. See docs/home-greeting.md.

## 3. Anatomy
`.tool-icon-row` (4-column grid) › `.tool-icon-btn` (1:1 square) › icon (Material Symbol, inline `.tool-icon-svg`, or a Bravura glyph from [notation](notation.md) given the `.tool-icon-svg` class, like Theory's treble clef) › `.tool-icon-label`

## 4. Tokens used
`--nav-action`, `--nav-action-text`, `--radius-md`, `--space-1` (icon↔label), `--space-2` / `--space-1` (padding, vertical / horizontal: narrow sides so "Metronome" fits and all tiles stay equal width on a phone),
`--space-3` (row gap), `--space-4` (row margin), `--icon-xl`, `--font-sm`, `--font-weight-bold`; the ★: `--icon-sm`, `--space-1`;
choosing: `--primary-action-tint`, `--primary-action-strong`.

## 5. Props / API
- Custom SVG glyphs are inlined (not `<img>`) so `fill: currentColor` follows the theme. JS adds the `viewBox`.
- The row is a 4-column grid (`repeat(4, minmax(0, 1fr))`, ML-260): a 5th tool starts a second row in the same columns. Never make a row of 5 narrower tiles. Home's My tools holds as many as the account type's `home_tools` limit (ML-388: Standard 4 = one row, others 8 = two rows).
- The `--space-3` row gap is the app's gutter ([stat-card](stat-card.md) grids use the same gap).
- Each tile has `data-tool` (its id - `HOME_TOOL_IDS` in server/services/accounts.js; `server/test/homeTools.test.js` keeps them in step).

## 6. States
Default / Active (native press) / Focus (`--focus-ring`) / On Home (★, `.is-fav`) / Choosing (`.tools-page.is-editing`: a toggle, `aria-pressed`). No disabled or error state: hide a tool rather than disable it.

## 7. Code example
```html
<div class="tool-icon-row">
  <button class="tool-icon-btn"><span class="material-symbols-outlined">timer</span><span class="tool-icon-label">Timer</span></button>
</div>
```

## 8. Cross-references
[button](button.md) · [icon-button](icon-button.md)

## 9. Accessibility
- A `<button>` whose visible label is its name - keep the label text, don't hide it.
- Icon is decorative (Material Symbol ligature text is ignored as a name). So is the ★ (`aria-hidden`): while choosing, `aria-pressed` says whether a tool is on Home, and the hint above the tiles (`aria-live`) says how many are.

See [accessibility foundation](../foundations/accessibility.md).
