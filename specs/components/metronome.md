# Metronome

## 1. Metadata
- **Name:** Metronome (`.metro-display*`, `.metro-tier`, `.metro-dot*`, `.metro-transport-*`, `.metro-play-btn`, `.metro-stop-btn`, `.metro-bpm-step`, `.metro-speed-*`, `.metro-volume-row`, `.metroBlk-*`, `.metroSeg-*`, `.qp-*`, `.metro-*`, `.timer-inline-*`, `.is-date` on a value box)
- **Category:** Tool
- **Status:** Stable. Largest single area of the stylesheet

## 2. Overview
The beat display (lit dots per beat/subdivision), transport controls, tempo/volume controls,
Quick play (`qp-*`), Rehearse, and the headphone-delay calibration in Settings. The `metroBlk-*`/`metroSeg-*`
classes that remain (now-playing row, value boxes, tile strip, time-signature and beat-note pickers, mini
tuner) are shared by those screens - the Metronome Blocks editor they started in, and its mini bar, were
removed on 2026-09-27 (superseded by pieces in My music and Rehearse).

**Speed names (ML-297):** every bpm readout (`.metro-speed-readout` whose sub-label is "bpm") shows the
Italian speed name under it (`.metro-speed-name`, `--font-xs` semibold, `--label-color`, one line):
Grave / Largo 15-55, Adagio / Lento 56-75, Andante 76-107, Moderato 108-119, Allegro 120-155, Vivace 156-175,
Presto / Prestissimo 176-200. The bands are `TheoryEngine.SPEEDS` - the same ones the Theory quiz's Speeds set
teaches. `attachSpeedNames()` in app.js adds it and keeps it in step with the number, so a new tempo box
gets it for free.

## 3. Anatomy
`.metro-display` › `.metro-display-viewport` › `.metro-tier` × n › `.metro-dot` (`.lit`, `.metro-dot-note`, `.metro-dot-sub`, `.fermata-holding`, `.fermata-done`) ·
`.metro-transport-row` › `.metro-transport-btn.metro-play-btn` / `.metro-stop-btn` ·
`.metro-volume-row` › `.metro-mute-btn` + [slider](slider.md).

## 4. Tokens used
`--primary-action` (lit beat, play), `--primary-action-text`, `--primary-action-glow`,
`--primary-action-glow-soft`, `--primary-action-tint`, `--nav-action` (stop, reset),
`--nav-action-text`, `--input-bg`, `--input-border`,
`--label-color`, `--text-color`, `--radius-sm`, `--radius-md`, `--radius-xl`, `--radius-circle`,
`--space-*`, `--font-xs`…`--font-lg`, `--icon-lg`, `--duration-instant` (dot lighting),
`--duration-base`, `--duration-pulse` + `--ease-in-out` (fermata glow), `--touch-target`.

## 5. Props / API
- Dot lighting uses `--duration-instant` + `--ease-linear` so it feels locked to the audio clock. Don't slow it down.
- **Play Flow tiles** lead with the block's rehearsal mark (boxed) or its starting bar number. A mark over 3 characters uses `.metroBlk-tile-mark-box-long`: `--font-sm`, max 2 lines then "…", never wider than the tile. The full mark is the tile's tooltip/accessible name and leads the now-playing line ("Test it again for movement 2 · 1 of 8 bars · 3/4 · 90 bpm").
- Transport buttons are **square** (`--radius-md`), not circles.
- **Mini tuner** (`.metroBlk-mini-tuner`, opened from the top bar's tuner button on Metronome, My music, Rehearse, Scales and Warm-ups): while open (`.metroBlk-mini-tuner-open`) it is **pinned under the top bar** (`position: sticky`, `top: --header-h`, `--z-sticky`, `--shadow-md`) so it never scrolls out of view (ML-385). It stays opaque: in tune, the translucent `--tuner-in-tune-tint` is laid over `--container-bg`, so nothing shows through it.
- **Value boxes** (`.metroBlk-ctrl-value-btn`: sub beats, play speed, time, beat note; also Quick play, Rehearse and the timer inline row) use the Flow block tile look: 1px `--input-border`, `--radius-lg`, `--font-md` bold value over a `--font-xs` `--label-color` caption, **no dropdown caret** (ML-205). They open the app's own tile pickers, not a native dropdown.
- Press-and-hold Play resets (`setupPlayButtonHoldReset`).
- **Rehearse transport (ML-302)** is `.metro-transport-grid.metro-transport-grid-5`: reset, **repeat**, Play (a 1.4× wider middle cell), sub beats, play speed. Where-you-are controls sit left of Play, how-it-sounds ones right. The value boxes in it lose most of their side padding and never wrap their value ("12–16" stays on one line). Quick Play keeps the 4-cell grid.
- **Date value box** (`.metroBlk-ctrl-value-btn.is-date`, ML-348): a practice list's target date ("30 May 26"), one cell of the 4-across `.metro-transport-grid`, on its own row for now. The cell stays a fixed quarter width, so the date never wraps (`nowrap`). Instead it steps down in size with a container query on the box: `--font-sm` in a narrow cell, `--font-base` from 72px of content width, `--font-md` from 84px. Its side padding is `--space-1`.
- **Switched-on value box** (`.metroBlk-ctrl-value-btn-on`): the repeat box while bars are repeating - `--primary-action-tint` fill, `--primary-action-strong` edge, value and caption (the same gold selected look as `.flow-multiselect-num.selected`). Off, it shows "off" in the plain value-box look.
- **Repeat bars sheet** (`#flowLoopModal`) is built only from existing parts: `.flow-tile-section` + the `.metro-speed-row` bar steppers (start bar, end bar), each with a `.slider-wrap` slider under it (1 to the last bar - pieces can run to hundreds of bars) and a readout you can tap to type a bar number (`makeSliderReadoutEditable`), a live `.metro-help-text` line saying what will play ("Plays bars 7–8, then 1–2, over and over.") or why it can't, and a `.flow-multiselect-grid-3` of `.flow-multiselect-num` for rest bars (None, 1–5). Turn off / Repeat in `.flow-edit-sticky-bar-actions`.
- **Lead-in tile (ML-113):** in every layout the lead-in is the first tile, the same shape and border as the bars. In 4 columns it's a `.metroBlk-tile`: `.metroBlk-tile-sig.text-md` "Lead‑in" (non-breaking hyphen, so it never splits in a narrow tile) over bar 1's bpm and "1 bar", so its lines match the bars. No special border: the double gold edge it shows at the start is the usual "playing now" marker (`.metroBlk-tile-active`), which moves to bar 1 when it starts. In 1 and 2 columns it's a `.flow-bar-full-tile` / `.flow-bar-detail-tile` named "Lead-in", in bar 1's time, beat note and tempo, with plain barlines and nothing else.
- **Rehearse tiles line up (ML-302):** the 4-column strip on Rehearse also has `.flow-play-tile-strip`. Each tile is a CSS subgrid over three shared rows (heading, bpm, bars), so in every row of tiles the heading line is as tall as the tallest heading there (a boxed mark, a 2-line long mark, a bar number, "Lead‑in") and the bpm and bar lines sit level across the row. Every tile in it must have exactly those three children. The Bars tab's 4-column grid keeps the plain centred tile.
- **Tiles while repeating** get `.flow-tile-in-repeat` (on `.metroBlk-tile`, `.flow-bar-detail-tile` and `.flow-bar-full-tile`): a dashed `--primary-action-strong` edge on each bar in the loop. The bar sounding keeps the solid active edge on top (`.flow-tile-in-repeat.metroBlk-tile-active`).
- Disabled transport controls use `opacity: 0.4`. Converge on `--opacity-disabled`.

## 6. States
Dot: off · lit · accent (downbeat) · fermata-holding (pulsing glow) · fermata-done. Transport: idle · playing · disabled. Repeat box: off · on (`.metroBlk-ctrl-value-btn-on`). Tile: plain · in the repeat (dashed) · sounding (solid).

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
- Repeat box (ML-302): its accessible name says the state - "Repeat bars - off. Tap to set up" or "Repeat bars - Bars 5–12, 1 rest bar. Tap to change" - and `aria-expanded` follows the sheet; closing the sheet returns focus to it. The sheet's "Plays…" line is `aria-live="polite"`, and the rest-bar numbers carry `aria-pressed`. The dashed outline on tiles is extra: the range is also in the box's name and the now-playing line ("Repeat 3 · …").
- Beat dots are a visual aid to the audible click; under reduced motion they change colour only (no scale pulse).
- Swipe-to-delete and drag-to-reorder bars both have ⋮ menu alternatives.

See [accessibility foundation](../foundations/accessibility.md).
