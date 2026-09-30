# Range bar

## 1. Metadata
- **Name:** Range bar (`.range-bar`, `.range-bar-part`, `.range-bar-potential`, `.range-bar-stretch`,
  `.range-bar-yours`, `.range-bar-tick`, `.range-bar-ends`, `.range-bar-end`, `.range-bar-key`, `.range-bar-swatch`;
  modifiers `.is-slim` (the bar alone, thin - ML-384), `.is-open` (potential part, open at the top), `.is-start` / `.is-at` / `.is-end` (end notes),
  `.is-yours` / `.is-potential` (key swatches))
- **Category:** Data display
- **Status:** Stable (ML-370)

## 2. Overview
Your playing range drawn inside the instrument's, so you can see what's left to learn. It sits in the
See your range pop-up (Scales and Warm-ups), under the stave that shows your bottom and top notes, and in the
My range… pop-up (the range picker) under the two staves, redrawn as you change your notes (ML-384). Every one is
drawn by `public/rangeBar.js` (`RangeBar.html(inst, ctx, { slim })`), so they always match. **Slim** (`.range-bar.is-slim`, ML-384): the bar alone, `--space-2` tall with 1px edges, under each instrument's text on My instruments - no note names or key (the row names the notes), in the instrument's written pitch like that text. `rangeBarHtml(inst, ctx, { slim: true })`.
**Don't use** it for anything that isn't a range of notes; for a single amount use a [slider](slider.md)
or a [chart](charts.md).

## 3. Anatomy
`.range-bar` (one bar, `role="img"`) › `.range-bar-part`s, each placed with `--rb-from` / `--rb-to`:
- **Potential range:** `.range-bar-potential`, the instrument's range from its bottom to its usual top.
- **Past the usual top** (brass and woodwind only): `.range-bar-potential.is-open` loses its right end, and
  `.range-bar-stretch` carries on for a 4th with a dashed, open-ended edge, because an experienced
  player goes higher. `.range-bar-tick` (`--rb-at`) marks the usual top.
- **Your range:** `.range-bar-yours` on top, from your bottom note to your top note. It can run into the
  stretch.

Under the bar: `.range-bar-ends` (the instrument's bottom note at the start; the usual top at the tick,
"C6 usual top", or at the end when there's no stretch), then `.range-bar-key` (Your range · Potential
range, each with a `.range-bar-swatch`). The key goes **below** the bar, and it doesn't repeat your notes
(the stave above shows them). A "Still to learn: 4 notes below, 7 up to the usual top." line follows.

## 4. Tokens used
`--primary-action` + `--primary-action-strong` (your range: the selected tile's gold fill and edge),
`--input-bg` + `--control-border` (potential range: a tappable surface's fill and 3:1 edge),
`--text-color` (usual-top tick), `--label-color` (end notes), `--radius-pill`, `--space-1` to `--space-5`,
`--font-xs`, `--font-sm`. Run-time: `--rb-from`, `--rb-to`, `--rb-at` (percentages of the bar).

## 5. Props / API
`rangeBarHtml(inst, ctx)` (app.js) returns `{ html, text }`. `ctx` has MIDI numbers in the clef's pitch:
`low` / `usualHigh` the instrument's range and `bottom` / `top` yours. How far past the usual top it goes
comes from `PlayRange.STRETCH_ABOVE` and `PlayRange.STRETCH_FAMILIES` (public/range.js), the same rule
the Range tool uses (`PlayRange.outerLimit`, docs/range.md). With no instrument range there's no bar.

## 6. States
Inside the usual range · Past the usual top (gold runs over the tick into the dashed part; the line says
"You're N notes past the usual top") · No stretch (not brass or woodwind: a closed bar, no tick).

## 7. Code example
```html
<div class="range-bar" role="img" aria-label="Your range, B♭3 to F5, inside the instrument's F♯3 to C6 - and up to F6 with experience">
  <div class="range-bar-part range-bar-potential is-open" style="--rb-from:0%;--rb-to:85.7%"></div>
  <div class="range-bar-part range-bar-stretch" style="--rb-from:85.7%;--rb-to:100%"></div>
  <div class="range-bar-part range-bar-yours" style="--rb-from:11.4%;--rb-to:65.7%"></div>
  <div class="range-bar-tick" style="--rb-at:85.7%"></div>
</div>
<div class="range-bar-ends" aria-hidden="true">
  <span class="range-bar-end is-start">F♯3</span>
  <span class="range-bar-end is-at" style="--rb-at:85.7%">C6 usual top</span>
</div>
<ul class="range-bar-key" aria-hidden="true">
  <li><span class="range-bar-swatch is-yours"></span>Your range</li>
  <li><span class="range-bar-swatch is-potential"></span>Potential range</li>
</ul>
```

## 8. Cross-references
[range](range.md) · [scales](scales.md) · [warmups](warmups.md) · [notation](notation.md) · [modal](modal.md)

## 9. Accessibility
- The bar is one `role="img"` with the whole comparison as its label, including the notes. The end notes and
  the key are `aria-hidden` because the label already says it.
- Both parts have a 3:1 edge against the pop-up (`--control-border`, `--primary-action-strong`), so they're
  told apart by edge and fill, not colour alone. The open top is a dashed edge rather than a fade, which
  would drop below 3:1.
- The "Still to learn" line under it says the same thing in words.

See [accessibility foundation](../foundations/accessibility.md).
