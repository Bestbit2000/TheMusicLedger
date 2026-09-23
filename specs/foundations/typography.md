# Typography

Status: stable. Tokens: [token-reference.md#typography](../tokens/token-reference.md).

## Families

| Token | Use |
|---|---|
| `--font-sans` | Everything. Inter, loaded from Google Fonts on every page |
| `--font-mono` | Code, IDs, raw values in the admin panel and style guide |
| `--font-music` | Unicode musical symbols (segno 𝄋, coda 𝄌), Noto Music |

Buttons and inputs inherit (`font: inherit` / `font-family: inherit`). Never re-declare the family on a component.

## Size scale (rem, 1rem = 16px)

| Token | rem | px | Use |
|---|---|---|---|
| `--font-2xs` | 0.6 | 9.6 | Heatmap day labels only |
| `--font-xs` | 0.65 | 10.4 | Micro labels, badges, chart axes, help text |
| `--font-sm` | 0.8 | 12.8 | Secondary text, captions, chips, metadata |
| `--font-base` | 0.95 | 15.2 | Body, list rows, inputs |
| `--font-md` | 1.1 | 17.6 | Buttons, card and top-bar titles |
| `--font-lg` | 1.3 | 20.8 | Large buttons, modal titles, stat values |
| `--font-xl` | 1.6 | 25.6 | Hero values (current piece) |
| `--font-2xl` | 2 | 32 | Page titles, splash |
| `--font-3xl` | 3 | 48 | Giant readouts (tuner note) |

Icon glyphs (Material Symbols) are sized with `--icon-sm/md/lg/xl` (16/20/24/32px), not the text scale.

`em` sizes are allowed only for a glyph that must scale with the text around it (e.g.
`.btn-nav-arrow { font-size: 1.2em }`). The audit reports these as warnings, not errors.

## Weights

Three only: `--font-weight-normal` (400), `--font-weight-semibold` (600), `--font-weight-bold` (700).
Inter is loaded at exactly these weights. Anything else (500, 800) renders as a synthesised
fallback, so it's drift.

| Weight | Use |
|---|---|
| normal | Body text, secondary counts |
| semibold | Form labels, nav/tab items, modal titles |
| bold | Buttons, titles, emphasised values, chips |

## Line height

`--line-height-tight` (1) for icons and single-line numbers, `--line-height-snug` (1.2) for
multi-line button labels, `--line-height-base` (1.45) for paragraphs, `--line-height-relaxed`
(1.6) for long-form reading.

## Rules

- Sentence case everywhere ("Current practise streak"), written into the HTML, not forced by CSS.
- Numbers that update live use `font-variant-numeric: tabular-nums` so they don't jitter.
- Legacy sizes were snapped to the nearest step (ties go down): 0.85rem → `--font-sm`, 0.9rem/1rem/16px → `--font-base`,
  1.2rem/18px → `--font-md`, 1.4rem/20-22px → `--font-lg`, 1.5rem → `--font-xl`. Icon glyph px sizes → `--icon-*`.
