# Usage bar

## 1. Metadata
- **Name:** Usage bar (`admin.css`: `.usage-meter`, `.usage-bar`, `.usage-bar-fill`, `.usage-meter-text`;
  modifiers `.is-near`, `.is-full`)
- **Category:** Data display (admin panel)
- **Status:** New (ML-515)

## 2. Overview
How much of a limit has been used, at a glance. The track is the whole limit; the fill is what is used; the
fill's colour says whether that is fine. It is on **Admin → Business → Costs and usage**: each thing a plan
limits has two - **used so far**, and what it is **heading for** by the end of the period - and so do
Vercel's cost so far and the cost it is heading for, against the $20 the plan includes.

**Use** it for one amount against one limit. **Don't use** it for a range of notes (that is the
[range bar](range-bar.md)), for amounts over time (a [chart](charts.md)), or for a status with no amount (a
[badge](pill-badge.md) - a meter with no reading still shows "Not connected" as a badge).

## 3. Anatomy
`div.usage-meter` (the bar over its words) ›
- `span.usage-bar` (the track, `role="img"`) › `span.usage-bar-fill` (the fill; its width is `--bar-w`)
- `span.usage-meter-text` - the percentage and the word: "20.5% · Fine".

The steps are the ones the warning emails use:

| Of the limit | Fill | Class | Word |
|---|---|---|---|
| under 75% | green | (none) | Fine |
| 75% to under 90% | amber | `.is-near` | Getting near |
| 90% to 100% | red | `.is-full` | Nearly full |
| over 100% | red, the bar full | `.is-full` | Over the limit |

A very small amount still shows as a sliver (`min-width`), so "something" never looks like "nothing".

## 4. Tokens used
`--meter-ok`, `--meter-near`, `--meter-full` (the fill), `--control-border` (the track's edge),
`--container-bg` (the track), `--label-color` and `--font-sm` (the words), `--radius-pill`, `--space-1`,
`--space-2`, `--space-3`, `--space-10`.

## 5. Props / API
`usageBar(amount, limit, what)` in `public/admin.js` returns the markup, or nothing when there is no amount
or no limit. `what` ("Used so far", "Heading for") goes in the bar's spoken name. The width is a run-time
value: `style="--bar-w:20.5%"` on the fill (see [utilities and states](utilities-and-states.md)).

## 6. States
Fine · Getting near (`.is-near`) · Nearly full and Over the limit (`.is-full`). In a table cell it is at
least two tiles' worth wide; in a stat tile it takes the tile's width.

## 7. Code example
```html
<div class="usage-meter">
  <span class="usage-bar is-near" role="img" aria-label="Heading for: 78% of the limit - Getting near">
    <span class="usage-bar-fill" style="--bar-w:78%"></span>
  </span>
  <span class="usage-meter-text">78% · Getting near</span>
</div>
```

## 8. Cross-references
[admin-shell](admin-shell.md) (Costs and usage) · [stat-card](stat-card.md) · [pill-badge](pill-badge.md) ·
[range-bar](range-bar.md) · [charts](charts.md)

## 9. Accessibility
- **Colour is never the only signal.** The percentage and the word ("Fine", "Getting near", "Nearly full",
  "Over the limit") are always written beside the bar, and the bar's length says the same thing a third way.
- The bar is a picture with a name (`role="img"`, `aria-label`): "Used so far: 20.5% of the limit - Fine".
  The words beside it are ordinary text, so nothing depends on the picture being announced.
- Each fill colour is at least 3:1 against the track in both themes, and the track's edge is 3:1 against
  the page and against a stat tile (`specs/accessibility/contrast-pairs.json`).
- It is not a control - nothing to focus or tap.

See [accessibility foundation](../foundations/accessibility.md).
