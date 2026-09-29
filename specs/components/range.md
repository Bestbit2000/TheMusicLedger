# Range (tool and range picker)

## 1. Metadata
- **Name:** Range (`.range-staff`, `.range-edge`, `.range-stave-btn`)
- **Category:** System specific (the Range tool, ML-305; your range, ML-322)
- **Status:** New (ML-305 / ML-322)

## 2. Overview
Two screens stretch your playing range a note at a time:
- **The Range tool** (home, Learn group). It shows the run to your comfortable top (or bottom) note with the note to hold in gold, how long you held it and each note's Level.
- **The range picker.** It's a pop-up where you set your comfortable bottom and top notes on a stave, or measure them with the tuner. It opens from the Range tool or from My account → My instruments → My range….

Everything else on both screens is a shared component:
- the drill options pills and feedback line ([drills](drills.md))
- the beat dots (one `.drill-bar` of 8 `.drill-beat`s, `.is-now` as each beat is held)
- the Level strip (`.level-strip` / `.level-cell.lv-N`, [level-map](level-map.md))
- the −/+ steppers (`.metro-speed-row` / `.metro-bpm-step`)
- the buttons

Rules: `docs/range.md`.

## 3. Anatomy
- **Range tool:** `#rangeView` contains, in order:
  - the options (`#rangeOptions`: instrument, top/bottom notes, speed)
  - `.theory-best-line` (your range)
  - a button to set or change it
  - `.range-staff` (the run, the note to hold `.is-now`)
  - `.drill-feedback` (the note's Level)
  - `.level-strip` (every note beyond your range)
  - `.drill-bar` of 8 `.drill-beat`s
  - `.drill-feedback` (live status)
  - Start (`.btn-submit`), then Held it / Not yet (`.btn-nav`)
- **Range picker:** `#rangePickerModal` › `.modal-content` contains:
  - the title and help line
  - two `.range-edge` blocks: Bottom note, Top note. Each is a `.flow-tile-section-label`, then a `.range-stave-btn` (a stave with the note on it), then a `.metro-speed-row` (−, the note name, +).
  - Measure it with the tuner, with its status line
  - Cancel / Save

## 4. Tokens used
- `--primary-action-strong`: the note to hold. It's the same gold as Scales' playing note.
- The stave button: `--input-bg`, `--control-border`, `--radius-md`, `--text-color`
- Sizes and spacing: `--touch-target` (the stave button is at least 3× tall), `--space-1`…`--space-4`

## 5. Props / API
- **Drawing:** both staves are drawn by `Notation.staff` in Bravura.
- **Picking a note by tap:** the picker's staves use `tappable: true`, which puts `data-step-hi` and `data-step-pad` on the SVG. A tap's height becomes a staff step: `hi - (y - pad) / (S / 2)`. That step becomes the natural note there (`PlayRange.pitchAtStep`), kept inside the instrument's range. The staves always show the same step range (a few ledger lines above and below). A note further out still draws, and the stave grows.
- **−/+:** these move a semitone (`PlayRange.stepSemitone`), spelled the usual way (C♯, E♭, F♯, A♭, B♭).
- **The run:** built by `PlayRange.run` and written as one bar (`PlayRange.writeRun`). The last note carries `cls: 'is-now'`.

## 6. States
| State | Treatment |
|---|---|
| Note to hold | Gold fill (`--primary-action-strong`) on its notehead and accidental |
| Stave button default | `--input-bg` with a 2px `--control-border` |
| Stave button focus | The global focus ring. Keyboard users pick with −/+ (a keyboard "click" on the stave does nothing) |
| Listening | Start reads "Stop". The status line says what it hears, then "Holding A♭5: 3.1 beats" |
| At the instrument's limit | The run is empty, a line says so, and Start / Held it / Not yet are disabled |

## 7. Code example
```html
<div class="range-staff"><!-- Notation.staff({ clef, items: [...run, { pitch: 'Ab5', cls: 'is-now' }] }) --></div>
<div class="range-edge">
  <span class="flow-tile-section-label" id="rangeTopLabel">Top note</span>
  <button type="button" class="range-stave-btn" aria-label="Top note: G5. Tap the stave near a note to pick it"><!-- tappable staff --></button>
  <div class="metro-speed-row no-margin" role="group" aria-labelledby="rangeTopLabel">
    <button type="button" class="metro-bpm-step" aria-label="Top note a semitone lower">&minus;</button>
    <div class="metro-speed-readout"><div aria-live="polite">G5</div></div>
    <button type="button" class="metro-bpm-step" aria-label="Top note a semitone higher">+</button>
  </div>
</div>
```

## 8. Cross-references
[notation](notation.md) · [drills](drills.md) · [level-map](level-map.md) · [modal](modal.md) · [button](button.md)

## 9. Accessibility
- The stave button is a `<button>` at least 3 × `--touch-target` tall. Its `aria-label` names the note. The −/+ buttons are 44px targets with their own labels, and the note name is a polite live region. A screen-reader or keyboard user never needs to tap the stave.
- The run is `role="img"`, labelled "The scale up to G5, then A♭5 to hold". The Level strip's `aria-label` lists each note with its Level.
- Nothing needs the microphone. **Held it / Not yet** records a go without it, and the picker's staves and −/+ set a range without measuring.
- The gold note isn't the only signal: the line under the stave names the note to hold.

See [accessibility foundation](../foundations/accessibility.md).
