# Utilities and state modifiers

## 1. Metadata
- **Name:** Utilities and state modifiers
  - Layout utilities: `.container`, `.flex-row`, `.flex-col`, `.flex-1`, `.flex-wrap`, `.grow`, `.items-center`, `.items-start`, `.justify-between`, `.justify-center`, `.justify-end`, `.gap-xs`, `.gap-sm`, `.gap-md`, `.pos-relative`, `.w-full`, `.no-margin`, `.hidden-group`, `.hidden-btn`, `.tools-title`, `.material-symbols-outlined`, `.drag-reorder-highlight`, `.custom-option`, `.visually-hidden` (screen-reader-only text, ML-210)
  - Spacing utilities (ML-288): `.mt-*` (`.mt-0` to `.mt-7`), `.mb-*` (`.mb-1` to `.mb-6`), `.ml-1`, `.pl-1`, `.p-2`, `.p-3`, `.p-4`, `.p-5`
  - Type utilities (ML-288): `.text-2xs`, `.text-sm`, `.text-base`, `.text-md`, `.text-2xl`, `.fw-normal`, `.fw-bold`, `.leading-base`, `.pre-line`, `.text-center`, `.text-left`, `.text-muted`, `.text-accent-strong`, `.text-danger`, `.text-success`, `.text-selection`, `.icon-md`
  - Session categories (ML-288): `.category-practise`, `.category-rehearsal`, `.category-lesson`, `.category-performance`, `.category-edge`, `.category-text`
  - Run-time placement and motion (ML-288): `.is-placed`, `.is-moved`, `.is-faded`, `.is-raised`, `.no-transition`, `.transition-swipe`, `.transition-transform`, `.pointer-none`
  - State modifiers: `.active`, `.selected`, `.show`, `.lit`, `.accent`, `.dragging`, `.disabled`, `.expanded`, `.is-expanded`, `.is-muted`, `.is-danger`, `.is-complete`, `.is-closed`, `.is-running`, `.is-paused`, `.is-baseline`, `.invalid`, `.has-errors`, `.unread`, `.clickable`, `.compact`, `.blank`, `.below`, `.left`, `.right`, `.in-tune`, `.out-of-tune`, `.lead-in`, `.fermata-holding`, `.fermata-done`
  - Variant modifiers: `.success`, `.warning`, `.info`, `.undo`, `.pass`, `.fail`, `.warn`, `.skipped`, `.never`, `.cat`, `.type-audio`, `.type-metronome`, `.type-youtube`
  - Environment classes: `.dark-mode` (on `<body>`), `.installed-app` (on `<html>`, standalone PWA), `.admin-body`
- **Category:** Foundations
- **Status:** Stable

## 2. Overview
Small single-purpose classes that combine with a component rather than standing alone.

**There are no inline styles (ML-288).** No `style=""` in HTML or in markup built from JS, and no
`el.style.x = ...` from JS. Every style is a class in `style.css` / `admin.css` that uses tokens,
so a tablet, landscape or desktop layout (a media query) or a new colour scheme (a token remap) can
reach every style there is. `npm run token-audit` reports any inline style as an error. The one
exception is a **run-time value** (see below).

- **Utilities** are one class, one job, one token (`.mt-4` is `margin-top: var(--space-4)`). Use
  one for a one-off nudge instead of writing a new component class. Reach for a component class
  first: if the same combination keeps turning up, it's a component and wants its own class and
  spec. The ML-288 utilities are last in `style.css` so they beat the single-class component rule
  they adjust. The older `.flex-row` / `.flex-1` / `.gap-sm` / `.gap-md` / `.text-center` /
  `.no-margin` set sits further up, and existing component rules are written to override it, so
  it stays there.
- **State modifiers** are toggled by JS on a component (`.selected` on a tile, `.lit` on a metronome dot). A modifier never has meaning on its own. It's always styled as `.component.modifier`.
- **Variant modifiers** pick a fixed flavour of a component (`.toast.warning`, `.admin-badge.pass`).

**Don't** add a new bare modifier name that means something different from an existing one
(e.g. a second word for "selected"). Reuse the list above. A genuinely new state needs sign-off at
the dev → sandbox design gate.

### Run-time values
Some values are only known while the app runs: a chart bar's height, a slider's position, where a
menu opens, how far a row has been dragged. These are set as a **custom property** that the
element's class reads, never as the property itself:

```js
bar.style.setProperty('--bar-h', `${pct}%`);          // .chart-bar { height: var(--bar-h); }
```
```html
<div class="tuner-dynamics-bar" style="--bar-h:40%"></div>   <!-- markup built in JS -->
```

That's the only inline style allowed, and the audit lets it through. The properties in use:

| Property | Set by | Read by |
|---|---|---|
| `--bar-h`, `--bar-top` | chart and tuner renderers | `.chart-bar`, `.chart-bar-projection`, `.tuner-history-bar`, `.tuner-dynamics-bar` |
| `--line-pos` | chart renderers | `.grid-line`, `.chart-y-label` |
| `--series` | a `.series-*` class (charts spec), or inline on Admin → Design's category bars | `.chart-bar`, `.chart-bar-projection`, `.chart-legend-swatch` |
| `--pct` | each slider's update function | `.slider-fill` (width), `.slider-thumb` (left) |
| `--progress` | upload progress | `.flow-upload-progress-fill` |
| `--remaining` | Theory round clock | `.theory-countdown-fill` (scaleX) |
| `--needle-pos` | tuner | `.tuner-bar-needle`, `.metroBlk-mini-tuner-needle` |
| `--dot-x`, `--track-start`, `--track-end` | metronome dot row | `.metro-dot`, `.metro-fermata-marker`, `.metroBlk-row-track(-end)` |
| `--content-w`, `--scroll-x`, `--scroll-dur` | metronome follow-the-beat scroll | `.metro-display-content`, `.metro-mini-content` |
| `--viewport-h` | Play Flow media carousel | `.flow-media-carousel-viewport` |
| `--countdown-ms`, `--frozen-w` | toast countdown | `.toast-countdown-bar.is-running` / `.is-paused` |
| `--place-x`, `--place-y` | `placeAt(el, left, top)` | `.is-placed` |
| `--move-x`, `--move-y` | `setMove(el, x, y)` / `clearMove(el)` / `swipeTo(el, ...)` | `.is-moved` |
| `--row-frac` | Scales practice (ML-9), the short last stave row | `.scales-staff-row-short` |
| `--ring-left`, `--lap-left` | `renderTimerRing` (ML-293) | `.timer-ring-arc`, `.timer-ring-tip`, `.timer-ring-lap` |
| `--sample` | Admin → Design and style guide token tables | the table's sample class |

A new run-time value gets a row here.

## 3. Anatomy
N/A. Modifiers attach to a component's root element.

## 4. Tokens used
`--space-*` (spacing utilities, `.gap-*`), `--font-*` / `--font-weight-*` / `--line-height-base` (type utilities),
`--icon-md` (`.icon-md`), `--label-color` (`.text-muted`),
`--primary-action-strong` (`.text-accent-strong`), `--danger-text` / `--success-text` / `--selection-text`
(`.text-danger` / `.text-success` / `.text-selection`), `--cat-*` and `--cat-*-text` (`.category-*`),
`--z-raised` (`.is-raised`), `--duration-swipe` (`.transition-swipe`), `--duration-base` (`.transition-transform`),
plus whatever the host component uses for each state.

## 5. Props / API
- **Show and hide (app.js):** `setShown(el, on)` toggles `.hidden-group`; `isShown(el)` reads it.
  Screens, panels and controls start hidden with `class="hidden-group"` in the markup.
  `.hidden-group` is the one way to hide conditionally (`display: none !important`).
- **Pop-ups:** `showModal(el)` / `hideModal(el)` add or remove `.show` on a `.modal` (app.js;
  admin.js has its own pair). Toasts use `.toast.show` the same way. Both take an element or an id,
  including from an inline `onclick`.
- `.hidden-btn` keeps layout space but hides the element (top-bar alignment).
- **Session categories:** `.category-practise` / `-rehearsal` / `-lesson` / `-performance` set two
  custom properties, `--category-accent` (the fill) and `--category-accent-text` (the same hue as
  text, ML-210). `.category-edge` colours a `.history-item`'s left edge with the first,
  `.category-text` colours text with the second, and `.filter-pill[data-filter-cat]` takes both.
  In JS, `categoryClass(cat)` gives the class for a category name.
- **Placement and motion (app.js):** `placeAt(el, left, top)` puts a fixed menu or popup at a
  viewport position (`.is-placed`). `setMove(el, x, y)` shifts an element for a drag, a swipe or a
  FLIP reorder (`.is-moved`; a number is px, a string is used as is, e.g. `'-100%'`), and
  `clearMove(el)` puts it back. `swipeTo(el, offset, animate)` is the swipe-to-reveal row version.
  `.is-faded` (opacity 0) and `.is-raised` (above its neighbours) go with a FLIP reorder.
  `.no-transition` switches transitions off while a finger is moving something, or for a one-frame
  jump; `.transition-swipe` / `.transition-transform` are the settle and spring-back transitions.
  These are last in `style.css` because, while they apply, they must win over the component's own
  resting position.
- `.pointer-none` makes an element ignore taps (e.g. a header that can't be edited right now).

## 6. States
This spec *is* the state vocabulary. See each component spec for how it renders them.

## 7. Code example
```html
<div class="flex-row gap-sm"><span class="text-muted">Tempo</span><strong>120</strong></div>
<button class="btn-submit mt-2">Save session</button>
<div class="history-item category-edge category-lesson"><strong class="category-text">Lesson</strong></div>
<button class="flow-picker-tile selected">4/4</button>
```

## 8. Cross-references
[selectable-tile](selectable-tile.md) · [toast](toast.md) · [pill-badge](pill-badge.md) · [metronome](metronome.md) · [charts](charts.md) · [slider](slider.md) · [list-row](list-row.md) · [filter-strip](filter-strip.md)

## 9. Accessibility
- `.hidden-group` removes content for everyone (including screen readers). Use `.visually-hidden` for text that should be read but not seen.
- State modifiers (`.selected`, `.active`, `.lit`) must be paired with the matching ARIA state (`aria-pressed`, `aria-current`, `aria-expanded`) where the state matters to the user.
- A colour utility for text is always a `-text` or text token (`.text-success` is `--success-text`), never a fill hue - the same rule as everywhere (ML-210).
- `.pointer-none` only stops taps; if the control is also unavailable to the keyboard, set `aria-disabled` or `disabled` too.

See [accessibility foundation](../foundations/accessibility.md).
