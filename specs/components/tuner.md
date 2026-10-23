# Tuner

## 1. Metadata
- **Name:** Tuner (`.tuner-card`, `.tuner-pitch-*`, `.tuner-note*`, `.tuner-bar-*`, `.tuner-status`, `.tuner-pause-btn`, `.tuner-rewind-*`, `.tuner-graph-*`, `.tuner-pitch-graph*`, `.tuner-dynamics-*`, `.tuner-history-bar*`, `.tuner-settings-*`, `.tuner-*`, `.at-top`, `.at-bottom`, `.at-middle`)
- **Category:** Tool
- **Status:** Stable (ML-181 graphs)

## 2. Overview
Live pitch readout (note, octave, Hz, cents needle), status line, pause/rewind, and the pitch and
dynamics history graphs, plus the tuner settings sheet.

**Tuner settings** (`#tunerSettingsModal`, off the cog): sharps or flats and note names as tiles, then **Transposition** and
**Tuning reference (A4)** as rows (`.tuner-settings-row-btn`) that show their choices **underneath them, inside the same
pop-up** - a second tap hides them, one open at a time (ML-591, owner 23 Oct 2026: they used to open pop-ups of their own,
and closing one of those closed Settings too). Transposition is 12 tiles; choosing one folds the row back up. Tuning
reference is the −/+ stepper, the slider and Reset to 440Hz, open while you adjust. An open row sits close to what it
opened (`.tuner-settings-row-btn[aria-expanded="true"]`). Then the display switches.

## 3. Anatomy
`.tuner-card[.in-tune|.out-of-tune]` › `.tuner-card-settings-btn` › `.tuner-pitch-row` › `.tuner-note-row` (`.tuner-note` + `.tuner-note-octave` + `.tuner-note-hz`) › `.tuner-bar-wrap` › `.tuner-bar-track` › `.tuner-bar-zone` + `.tuner-bar-center-mark` + `.tuner-bar-needle` › `.tuner-bar-scale` · `.tuner-status` · `.tuner-graph-card` › graphs.

## 4. Tokens used
`--container-bg` (display-only card), `--input-bg` (tappable settings rows, needle track),
`--input-border`, `--primary-action` (out of tune, note), `--tuner-in-tune-green` (in tune),
`--danger-color` (needle off-pitch), `--label-color`, `--text-color`, `--radius-lg`,
`--radius-2xs`, `--radius-circle`, `--space-*`, `--font-sm`…`--font-3xl`, `--line-height-tight`,
`--duration-fast` + `--ease-linear` (card state, needle).

## 5. Props / API
- The dashed reference lines on the history strips are placed with `.at-top` / `.at-bottom` / `.at-middle` on `.tuner-pitch-graph-gridline` / `.tuner-dynamics-gridline`. The needle position (`--needle-pos`) and each history bar's height (`--bar-h`, `--bar-top`) are custom properties set from JS.
`renderTunerPitch` / `renderTunerIdle` (app.js) set the card state classes. The needle's `left` and graph bar heights are data-driven geometry.

## 6. States
Idle (neutral border) · Out of tune (gold border) · In tune (green border + green wash; add a `--tuner-in-tune-tint` alias rather than an inline rgba) · Paused.

## 7. Code example
```html
<div class="tuner-card in-tune">
  <div class="tuner-note-row"><span class="tuner-note">A</span><span class="tuner-note-octave">4</span></div>
  <div class="tuner-status">In tune</div>
</div>
```

## 8. Cross-references
[card](card.md) · [slider](slider.md) · [charts](charts.md) · [motion](../foundations/motion.md)

## 9. Accessibility
- The state is always text as well as colour: "In tune" / "12¢ flat" / "8¢ sharp" under the needle; screen readers are told only when the state changes (polite live region).
- Settings sliders are `role="slider"`; the pause button has an accessible name.
- Transposition and Tuning reference are buttons with `aria-expanded` and `aria-controls`, their choices a group named by
  the row; choosing a transposition puts the focus back on its row.

See [accessibility foundation](../foundations/accessibility.md).
