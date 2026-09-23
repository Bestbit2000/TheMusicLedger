# Metronome

## 1. Metadata
- **Name:** Metronome (`.metro-display*`, `.metro-tier`, `.metro-dot*`, `.metro-transport-*`, `.metro-play-btn`, `.metro-stop-btn`, `.metro-bpm-step`, `.metro-speed-*`, `.metro-volume-row`, `.metro-mini-bar`, `.metro-mini-*`, `.metroBlk-*`, `.metroSeg-*`, `.qp-*`, `.metro-*`, `.timer-inline-*`)
- **Category:** Tool
- **Status:** Stable. Largest single area of the stylesheet

## 2. Overview
The beat display (lit dots per beat/subdivision), transport controls, tempo/volume controls,
the Metronome Blocks editor (`metroSeg-*`/`metroBlk-*`), Quick play (`qp-*`), and the
persistent mini bar docked under the top bar while a metronome runs elsewhere in the app.

## 3. Anatomy
`.metro-display` › `.metro-display-viewport` › `.metro-tier` × n › `.metro-dot` (`.lit`, `.metro-dot-note`, `.metro-dot-sub`, `.fermata-holding`, `.fermata-done`) ·
`.metro-transport-row` › `.metro-transport-btn.metro-play-btn` / `.metro-stop-btn` ·
`.metro-volume-row` › `.metro-mute-btn` + [slider](slider.md) ·
`.metro-mini-bar` › `.metro-mini-viewport` + `.metro-mini-controls` › `.metro-mini-ctrl-btn` × n.

## 4. Tokens used
`--primary-action` (lit beat, play), `--primary-action-text`, `--primary-action-glow`,
`--primary-action-glow-soft`, `--primary-action-tint`, `--nav-action` (stop, mini controls),
`--nav-action-text`, `--secondary-color` (mini bar), `--input-bg`, `--input-border`,
`--label-color`, `--text-color`, `--radius-sm`, `--radius-md`, `--radius-xl`, `--radius-circle`,
`--space-*`, `--font-xs`…`--font-lg`, `--icon-lg`, `--duration-instant` (dot lighting),
`--duration-base`, `--duration-pulse` + `--ease-in-out` (fermata glow), `--touch-target`.

## 5. Props / API
- Dot lighting uses `--duration-instant` + `--ease-linear` so it feels locked to the audio clock. Don't slow it down.
- **Play Flow tiles** lead with the block's rehearsal mark (boxed) or its starting bar number. A mark over 3 characters uses `.metroBlk-tile-mark-box-long`: `--font-sm`, max 2 lines then "…", never wider than the tile. The full mark is the tile's tooltip/accessible name and leads the now-playing line ("Test it again for movement 2 · 1 of 8 bars · 3/4 · 90 bpm").
- Transport buttons are **square** (`--radius-md`), not circles.
- **Value boxes** (`.metroBlk-ctrl-value-btn`: sub beats, play speed, time, beat note; also Quick play and the timer inline row, and `.metroBlk-mini-ctrl-value-btn` in the mini bar) use the Flow block tile look: 1px `--input-border`, `--radius-lg`, `--font-md` bold value over a `--font-xs` `--label-color` caption, **no dropdown caret** (ML-205). They open the app's own tile pickers, not a native dropdown.
- Press-and-hold Play resets (`setupPlayButtonHoldReset`).
- Disabled transport controls use `opacity: 0.4`. Converge on `--opacity-disabled`.

## 6. States
Dot: off · lit · accent (downbeat) · fermata-holding (pulsing glow) · fermata-done. Transport: idle · playing · disabled.

## 7. Code example
```html
<div class="metro-transport-row">
  <button class="metro-transport-btn metro-play-btn" aria-label="Play"><span class="material-symbols-outlined">play_arrow</span></button>
  <button class="metro-transport-btn metro-stop-btn" aria-label="Stop"><span class="material-symbols-outlined">stop</span></button>
</div>
```

## 8. Cross-references
[slider](slider.md) · [selectable-tile](selectable-tile.md) · [flow-editor](flow-editor.md) · [top-bar](top-bar.md) · [motion](../foundations/motion.md)

## 9. Accessibility
- Play: `aria-pressed` mirrors playing (a11y.js). Value boxes: `aria-haspopup="dialog"`. Steppers: "Increase/Decrease tempo".
- Beat dots are a visual aid to the audible click; under reduced motion they change colour only (no scale pulse).
- Swipe-to-delete and drag-to-reorder bars both have ⋮ menu alternatives.

See [accessibility foundation](../foundations/accessibility.md).
