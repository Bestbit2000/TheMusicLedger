# Card

## 1. Metadata
- **Name:** Card (`.flow-card`, `.flow-blocks-card`, `.play-card`, `.tuner-card`, `.about-running-note`, `.metro-section-box`, `.metroSeg-inset-box`, `.play-*`, `.slide-in-*`, `.slide-out-*`)
- **Category:** Layout / surfaces
- **Status:** Stable

## 2. Overview
A bordered surface that groups related content inside the app column. Cards are flat (no shadow).
**Don't** nest a card inside a card more than one level deep. Use an inset box
(`.metroSeg-inset-box`, `--container-bg` with an `--input-border` outline, one radius step smaller) for the inner level.

**Info rows** (`.info-row`, `.info-row-end` on the last of a group): a label and its read-only value, e.g. My account's Email / Account level / Member since - `--container-bg`, `--input-border` outline, label left, value right.

**A card is never `--input-bg` (ML-286).** Cards are display surfaces; the lighter `--input-bg` means *you can tap this* ([color](../foundations/color.md)), so it belongs on the buttons and inputs inside a card, not on the card.

| Variant | Surface | Radius | Use |
|---|---|---|---|
| `.flow-card` | `--container-bg`, 1px `--input-border` | `--radius-xl` | Sections of the Flow editor/detail |
| `.play-card` | `--container-bg`, 2px `--primary-action-strong` | `--radius-lg` | The current piece in Quick play (slides left/right between items) |
| `.tuner-card` | `--container-bg`, 2px state border | `--radius-lg` | Live tuner readout (see [tuner](tuner.md)) |
| `.about-running-note` | `--input-bg`, 1px `--primary-action` | `--radius-md` | Highlighted informational note |

## 3. Anatomy
Container › optional header row (title + `.flow-pill` / actions) › content.

## 4. Tokens used
`--container-bg`, `--input-bg`, `--input-border`, `--primary-action`, `--radius-md`/`-lg`/`-xl`,
`--space-3`…`--space-6`, `--font-sm`…`--font-xl`, `--duration-base` (play-card slide).

## 5. Props / API
`.play-card.slide-out-left/-right/.slide-in-left/-right` drive the swipe animation (JS toggles them).

## 6. States
Static surfaces. State is shown by border colour where a card has one (tuner in/out of tune).

## 7. Code example
```html
<div class="flow-card">
  <div class="flow-card-header"><strong>Recordings</strong><span class="flow-pill">3</span></div>
  …
</div>
```

## 8. Cross-references
[stat-card](stat-card.md) · [list-row](list-row.md) · [tuner](tuner.md) · [flow-editor](flow-editor.md) · [elevation](../foundations/elevation.md)

## 9. Accessibility
- Display surfaces - not interactive, no role. If a whole card opens something, make its main area a `<button>` or `role="button" tabindex="0"`.
- Card titles should be real headings when they start a section.

See [accessibility foundation](../foundations/accessibility.md).
