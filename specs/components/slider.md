# Slider

## 1. Metadata
- **Name:** Slider (`.slider-wrap`, `.slider-track`, `.slider-fill`, `.slider-thumb`, `.slider-scale`, `.slider-readout-input`)
- **Category:** Inputs
- **Status:** Stable (shared design-system component, see styleguide.html)

## 2. Overview
Custom draggable slider for continuous values (BPM, volume, rewind window, speed). **Don't use**
native `<input type=range>` (it can't be themed consistently), and don't use a slider for fewer
than ~6 discrete values. Use a [radio-group](radio-group.md) for those.

## 3. Anatomy
`.slider-wrap` › `.slider-track` › `.slider-fill` + `.slider-thumb` (with an invisible 48px `::before` hit area) › `.slider-scale` (min / max labels). Optional `.slider-readout-input`, made tappable-to-type by `makeSliderReadoutEditable()` (app.js).

## 4. Tokens used
`--input-border` (track), `--primary-action` (fill, thumb, readout border), `--container-bg` (thumb
ring), `--shadow-md` (thumb), `--label-color`, `--input-bg`, `--radius-xs` (track), `--radius-circle`
(thumb), `--radius-sm` (readout), `--space-2`, `--space-5`, `--font-sm`, `--touch-target`.

## 5. Props / API
- **Value (ML-288):** the slider's value as a percentage is the custom property `--pct`, set on `.slider-fill` (its width) and `.slider-thumb` (its left) by the slider's update function. Static examples set it inline: `style="--pct:45%"`.
- `.slider-wrap.no-margin` inside compact rows (`.metro-volume-row`, `.tuner-rewind-row`).
- `touch-action: none` on track and thumb, since the drag is handled in JS with pointer events.

## 6. States
Default · Dragging (`cursor: grabbing`) · Focus (`--focus-ring` on the thumb) · Disabled (`--opacity-disabled`, no pointer events).

## 7. Code example
```html
<div class="slider-wrap">
  <div class="slider-track"><div class="slider-fill" style="width:40%"></div><div class="slider-thumb" style="left:40%"></div></div>
  <div class="slider-scale"><span>40</span><span>240</span></div>
</div>
```
(`width`/`left` percentages are data-driven geometry set by JS, not visual tokens.)

## 8. Cross-references
[metronome](metronome.md) · [tuner](tuner.md) · [form-field](form-field.md)

## 9. Accessibility
- The thumb is `role="slider" tabindex="0"` with `aria-label` and `aria-valuemin/max/now` (update `aria-valuenow` with the value).
- Keyboard (setupSliderInteraction): ←/↓ and →/↑ step, Home/End jump to min/max. Pair with the tap-to-type readout for exact values.
- Thumb has a `--primary-action-strong` ring so it meets 3:1 against the page.

See [accessibility foundation](../foundations/accessibility.md).
