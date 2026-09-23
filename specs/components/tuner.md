# Tuner

## 1. Metadata
- **Name:** Tuner (`.tuner-card`, `.tuner-pitch-*`, `.tuner-note*`, `.tuner-bar-*`, `.tuner-status`, `.tuner-pause-btn`, `.tuner-rewind-*`, `.tuner-graph-*`, `.tuner-pitch-graph*`, `.tuner-dynamics-*`, `.tuner-history-bar*`, `.tuner-settings-*`, `.tuner-*`)
- **Category:** Tool
- **Status:** Stable (ML-181 graphs)

## 2. Overview
Live pitch readout (note, octave, Hz, cents needle), status line, pause/rewind, and the pitch and
dynamics history graphs, plus the tuner settings sheet.

## 3. Anatomy
`.tuner-card[.in-tune|.out-of-tune]` › `.tuner-card-settings-btn` › `.tuner-pitch-row` › `.tuner-note-row` (`.tuner-note` + `.tuner-note-octave` + `.tuner-note-hz`) › `.tuner-bar-wrap` › `.tuner-bar-track` › `.tuner-bar-zone` + `.tuner-bar-center-mark` + `.tuner-bar-needle` › `.tuner-bar-scale` · `.tuner-status` · `.tuner-graph-card` › graphs.

## 4. Tokens used
`--container-bg` (display-only card), `--input-bg` (tappable settings rows, needle track),
`--input-border`, `--primary-action` (out of tune, note), `--tuner-in-tune-green` (in tune),
`--danger-color` (needle off-pitch), `--label-color`, `--text-color`, `--radius-lg`,
`--radius-2xs`, `--radius-circle`, `--space-*`, `--font-sm`…`--font-3xl`, `--line-height-tight`,
`--duration-fast` + `--ease-linear` (card state, needle).

## 5. Props / API
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

See [accessibility foundation](../foundations/accessibility.md).
