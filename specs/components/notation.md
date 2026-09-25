# Notation

## 1. Metadata
- **Name:** Notation (`.notation`, `.notation-glyph`, `.notation-text`, `.notation-text-italic`, `.notation-text-bold`) - SVG from `public/notation.js`
- **Category:** Data display
- **Status:** New (ML-262, for ML-260 Theory practice)

## 2. Overview
Every piece of real music notation the app shows: staves, clefs, notes, ledger lines, sharps/flats/
naturals, key signatures, barlines and repeats, articulations, fermatas, breath marks, caesuras,
note values with flags and dots, rests, time signatures, ties and slurs, dynamics, segno/coda,
D.C./D.S., 1st-time-bar and intro brackets, hairpins, and words printed in music. **It must look like
printed music, so it's always drawn by `Notation` with the Bravura font** (Steinberg's SMuFL reference
font, SIL OFL - `public/fonts/bravura.woff2`). **Don't** hand-draw notation paths, and don't use
Unicode music characters (𝄞 𝄐 ♯) for notation - they depend on the phone's fonts. (Plain ♯/♭ in a
button *label*, like "C♯" or "B♭ major", is text, not notation, and stays in the UI font.)

## 3. Anatomy
`<svg class="notation">` › staff/ledger/bracket/hairpin `<line>`s (stroke `currentColor`, Bravura's
engraving thicknesses) + `<text class="notation-glyph">` per glyph (Bravura, 1 em = 4 staff spaces)
+ `<text class="notation-text">` for words printed in music: expression words italic
(`.notation-text-italic`: Fine, rit., legato), tempo words bold and upright (`.notation-text-bold`:
Allegro), time-bar numbers plain. Ties and slurs are a filled `<path>` (thin ends, thick middle).

## 4. Tokens used
`--font-notation` (Bravura), `--font-notation-text` (serif, for Fine / time-bar numbers),
`--font-weight-bold` (italic and bold words). Colour is `currentColor` - it takes the surrounding text colour,
so it needs no colour token and follows dark mode automatically. Geometry is in SVG user units
(10 per staff space), not CSS - size the `<svg>` from the caller.

## 5. Props / API
- `Notation.staff({ clef, keySignature, items, spans, stepRange, hideClef, noteGap, minWidth, label })`,
  `Notation.symbol(glyphName, { label })`, `Notation.hairpin('cresc'|'dim')`, `Notation.textMark(text, { italic })`.
  Full reference and the pitch/step helpers: `docs/theory-practice.md` ("Notation").
- Clefs: treble and bass (alto/tenor slot into `CLEFS` when needed). Key signatures in the standard
  order and positions for each clef.
- `stepRange` keeps a run of staves the same height (the Theory note quiz uses its range + a step).
- `hideClef` for a symbol shown on a scrap of staff, so there's only one symbol on show.
- Scaling: callers multiply the SVG's `width`/`height` (the `viewBox` keeps the drawing) so a staff
  space is the same size everywhere on a screen, and give it `max-width: 100%` for narrow phones.

## 6. States
None of its own - it's drawn in the colour of whatever it sits in (a right/wrong answer button
colours its symbol with it).

## 7. Code example
```js
el.innerHTML = Notation.staff({ clef: 'treble', keySignature: { type: 'sharp', count: 3 }, label: 'A key signature' });
btn.innerHTML = Notation.symbol('segno');
```

## 8. Cross-references
[theory-quiz](theory-quiz.md) · [tool-icon-button](tool-icon-button.md) (Theory's treble-clef icon) · `docs/theory-practice.md`

## 9. Accessibility
- Pass `label` when the notation is the content (it becomes `role="img"` + `aria-label`); leave it off
  when something else names it (a button's `aria-label`) - it's then `aria-hidden`.
- A quiz must not give the answer away in the label ("A note on the treble staff", not "C4").
- Notation inherits the text colour of its container, so it meets the same contrast as that text.

See [accessibility foundation](../foundations/accessibility.md).
