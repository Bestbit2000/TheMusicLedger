# Toggle switch

## 1. Metadata
- **Name:** Toggle switch (`.toggle-switch`, `.toggle-slider`, the rows it sits in: `.setting-row` (+ `.setting-row-grouped`), `.tuner-display-toggle-row`, `.flow-volta-toggle-row`)
- **Category:** Inputs
- **Status:** Stable

## 2. Overview
An on/off setting that takes effect immediately. **Don't use** inside a form that has a Save
button (use a checkbox-style [radio-group](radio-group.md) there), or for choices with more than two states.

## 3. Anatomy
`label.toggle-switch` (50×28) › hidden `input[type=checkbox]` › `.toggle-slider` (track, with a `::before` knob). Put it in a flex row with its text label.

**The row is a display surface (ML-286):** `.setting-row` (Settings), `.tuner-display-toggle-row` (tuner settings) and `.flow-volta-toggle-row` (Flow pop-ups) are `--container-bg` with an `--input-border` outline - only the switch in them is tappable, so the row is never the lighter `--input-bg`. `.setting-row-grouped` tightens the gap below a row that belongs with the next one. Style rows with these classes, never inline styles.

## 4. Tokens used
`--control-off-bg` (track off), `--selection-color` (track on), `--container-bg` (knob),
`--shadow-sm` (knob), `--radius-pill` (track), `--radius-circle` (knob), `--duration-base`, `--ease-standard`.

## 5. Props / API
`flex-shrink: 0` is required. The knob moves by a fixed `translateX(22px)`, so a squashed track would let it poke out (ML-190).

**Whole row is tappable (ML-211).** A row that directly contains one `.toggle-switch` flips it when tapped anywhere (public/a11y.js), gets a pointer cursor, and - being a tappable surface - uses `--input-bg` with a `--control-border` edge. Don't put a second control that should *not* toggle directly in the row without its own button/link.

## 6. States
Off (`--control-off-bg`) · On (`--selection-color`, knob right) · Focus (`--focus-ring` on the track) · Disabled (`--opacity-disabled`).

## 7. Code example
```html
<div class="tuner-display-toggle-row">
  <span>Show pitch graph</span>
  <label class="toggle-switch"><input type="checkbox"><span class="toggle-slider"></span></label>
</div>
```

## 8. Cross-references
[form-field](form-field.md) · [radio-group](radio-group.md) · [color](../foundations/color.md)

## 9. Accessibility
- Built on a real `<input type="checkbox">` inside the `<label>` - keyboard and screen readers get a checkbox for free.
- Focus ring is drawn on the visible track (`input:focus-visible + .toggle-slider`). Off track `--control-off-bg`, on track `--selection-text`, both 3:1 against the page.

See [accessibility foundation](../foundations/accessibility.md).
