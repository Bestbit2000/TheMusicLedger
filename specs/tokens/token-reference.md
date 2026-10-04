# Token reference

> Generated from `public/tokens.css` by `npm run token-reference` - do not edit by hand.
> To change a value or its usage note, edit `tokens.css` and re-run the script.

Components (Layer 3) may use **only** the Layer 2 tokens below. The `--ds-*` primitives
(Layer 1, listed at the end) exist so Layer 2 has something to point at and so dark mode
can remap an alias onto a different primitive - never reference them from component CSS.
`npm run token-audit` enforces both rules.

Related: [color](../foundations/color.md) - [spacing](../foundations/spacing.md) -
[typography](../foundations/typography.md) - [radius](../foundations/radius.md) -
[elevation](../foundations/elevation.md) - [motion](../foundations/motion.md)

## Surfaces

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--bg-color` | `#f4f7f6` | `#2e1f1b` | page background |
| `--container-bg` | `#ffffff` | `#3a2823` | main column, cards, modals, menus |
| `--secondary-color` | `#f1f8e9` | `#2c2c2c` | quiet tinted panel (month nav, active admin tab) |
| `--input-bg` | `#fafafa` | `#422f2a` | inputs + tappable surfaces |
| `--surface-inverse` | `#333333` | (same) | dark toast / snackbar |
| `--overlay-bg` | `rgba(0, 0, 0, 0.85)` | (same) | modal scrim |
| `--menu-backdrop-bg` | `rgba(0, 0, 0, 0.3)` | `rgba(0, 0, 0, 0.6)` | dims the page behind the open ☰ menu on a phone (ML-291) - lighter than a modal scrim |
| `--media-bg` | `#000000` | (same) | letterbox behind embedded video |
| `--splash-bg` | `#0a0a0a` | (same) | login splash backdrop only |

## Text

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--text-color` | `#333333` | `#e0e0e0` | body text |
| `--label-color` | `#6b6b6b` | `#bbbbbb` | secondary / muted text, labels, captions |
| `--text-on-accent` | `#1a1a1a` | (same) | text/icon on a saturated fill (danger, info, edit, pass) - dark, not white, for contrast (ML-210) |
| `--text-on-inverse` | `#ffffff` | (same) | text/icon on --surface-inverse (dark toasts) |
| `--text-on-warning` | `#000000` | (same) | text on amber |
| `--splash-title-color` | `#f5d78e` | (same) | login splash title only |
| `--splash-subtitle-color` | `#cfcfcf` | (same) | login splash subtitle only |

## Borders

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--input-border` | `#e0e0e0` | `#444444` | every hairline/outline border and divider |
| `--control-off-bg` | `#858585` | `#808080` | toggle track off, neutral accent stripe (3:1 against the page, ML-210) |
| `--control-border` | `#858585` | `#808080` | edge of a TAPPABLE surface (tile, input, value box) - 3:1 against the page so "lighter = clickable" is visible (ML-210). Display cards keep --input-border |
| `--control-knob` | `#ffffff` | (same) | toggle knob - white in both themes |

## Actions & interactive states

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--primary-action` | `#d4af37` | (same) | primary buttons, selected outlines, accents |
| `--primary-action-text` | `#1a1400` | (same) | text on --primary-action |
| `--primary-action-strong` | `#7a6214` | `#d4af37` | gold TEXT and thin gold outlines (selected tiles, links, focus ring) - passes 4.5:1; fills keep --primary-action (ML-210) |
| `--primary-action-tint` | `rgba(212, 175, 55, 0.12)` | (same) | selected/hover wash |
| `--primary-action-border-soft` | `rgba(212, 175, 55, 0.4)` | (same) | quiet gold outline around a featured card |
| `--selection-tint` | `rgba(255, 152, 0, 0.12)` | (same) | wash behind a --selection-color outline (lead-in) |
| `--danger-tint` | `rgba(244, 67, 54, 0.12)` | (same) | wash behind a danger/warning tile or icon |
| `--info-tint` | `rgba(33, 150, 243, 0.12)` | (same) | wash behind an info-coloured icon |
| `--primary-action-glow` | `rgba(212, 175, 55, 0.55)` | (same) | pulsing glow on a live/active element (fermata hold) |
| `--primary-action-glow-soft` | `rgba(212, 175, 55, 0.25)` | (same) | resting glow around a highlighted element |
| `--primary-action-gradient-end` | `#f5d78e` | (same) | second stop of the gold gradient (splash sign-in button) |
| `--nav-action` | `#c0c0c8` | (same) | navigation / neutral buttons |
| `--nav-action-text` | `#1a1a1a` | (same) | text on --nav-action |
| `--link-color` | `#7a6214` | `#d4af37` | inline text links |
| `--selection-color` | `#ff9800` | (same) | toggles on, edit buttons |
| `--button-overlay` | `rgba(255, 255, 255, 0.3)` | (same) | button sitting on a coloured toast |
| `--opacity-disabled` | `0.5` | (same) | any disabled control |
| `--opacity-muted` | `0.6` | (same) | de-emphasised text/content |

## Feedback

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--info-color` | `#2196f3` | (same) | info toasts, informational highlights |
| `--warning-color` | `#ffc107` | `#ffca28` | warning toasts, caution icons |
| `--danger-color` | `#f44336` | (same) | destructive actions, errors, unread dots |
| `--success-color` | `#4caf50` | (same) | success states, completed status |
| `--danger-text` | `#c62828` | `#f7746a` | red text/icons (destructive text buttons, delete icons) |
| `--selection-text` | `#9a5b00` | `#ff9800` | orange text/icons/outlines (edit icon, lead-in) |
| `--info-text` | `#1565c0` | `#6ab7f7` | blue text/icons |
| `--success-text` | `#2e7d32` | `#66bb6a` | green text/icons |
| `--warning-text` | `#7a5c00` | `#ffca28` | amber text/icons |
| `--tuner-in-tune-text` | `#1d7e46` | `#2ecc71` | tuner in-tune state as text/outline |
| `--tuner-in-tune-green` | `#2ecc71` | (same) | tuner in-tune state only (brighter than --success-color) |
| `--tuner-in-tune-tint` | `rgba(46, 204, 113, 0.28)` | (same) | tuner card background while in tune |
| `--tuner-in-tune-zone` | `rgba(46, 204, 113, 0.45)` | (same) | in-tune band on the needle track |
| `--tuner-in-tune-zone-soft` | `rgba(46, 204, 113, 0.15)` | (same) | in-tune band on the pitch graph |

## Status chips (admin feedback / notification status)

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--status-amber-bg` | `#fdf3d0` | `#4a3c0c` | under review |
| `--status-amber-fg` | `#7a5c00` | `#f2dd90` | text on --status-amber-bg |
| `--status-green-bg` | `#d9f2df` | `#17431f` | planned, live |
| `--status-green-fg` | `#1c5c2e` | `#a7dcb5` | text on --status-green-bg |
| `--status-blue-bg` | `#d6e8fb` | `#123a63` | in progress, scheduled |
| `--status-blue-fg` | `#14457a` | `#a6cdf2` | text on --status-blue-bg |
| `--status-grey-bg` | `#e6e6e6` | `#3a3a3a` | not progressing, expired, withdrawn |
| `--status-grey-fg` | `#555555` | `#c4c4c4` | text on --status-grey-bg |
| `--status-purple-bg` | `#dfd9f5` | `#2f2557` | resolved |
| `--status-purple-fg` | `#3e2f7a` | `#c3b6f0` | text on --status-purple-bg |

## Data viz

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--cat-practise` | `#4caf50` | (same) | Practice category - chips, chart bars, history stripe |
| `--cat-rehearsal` | `#2196f3` | (same) | Rehearsal category |
| `--cat-lesson` | `#9c27b0` | (same) | Lesson category |
| `--cat-performance` | `#ff9800` | (same) | Performance category |
| `--cat-practise-text` | `#2e7d32` | `#66bb6a` | category colour as TEXT (history rows, active filter pill) |
| `--cat-rehearsal-text` | `#1565c0` | `#6ab7f7` | category colour as text |
| `--cat-lesson-text` | `#9c27b0` | `#ce93d8` | category colour as text |
| `--cat-performance-text` | `#9a5b00` | `#ff9800` | category colour as text |
| `--chart-hours` | `#d4af37` | (same) | stats "Hours" bar chart - gold, since it counts every session type (ML-235) |
| `--chart-days` | `#d4af37` | (same) | stats "Days" bar chart - gold (ML-235) |
| `--chart-sessions` | `#d4af37` | (same) | stats "Sessions" bar chart - gold (ML-235) |
| `--chart-streak` | `#d4af37` | (same) | practice and playing streak histogram bars (ML-235) |
| `--heat-time-0` | `#ebedf0` | `#2d333b` | practice-time heatmap, empty day (0-4 = intensity ramp) |
| `--heat-time-1` | `#f3e3a8` | `#4a3b0b` | intensity step 1 - gold ramp (ML-235) |
| `--heat-time-2` | `#e2c355` | `#7d6415` | intensity step 2 |
| `--heat-time-3` | `#c9a22c` | `#b8952b` | intensity step 3 |
| `--heat-time-4` | `#8f7114` | `#f5d78e` | intensity step 4 (max) |
| `--heat-sess-0` | `#ebedf0` | `#2d333b` | session-count heatmap, empty day (0-4 = intensity ramp) |
| `--heat-sess-1` | `#f3e3a8` | `#4a3b0b` | intensity step 1 - same gold ramp as time (ML-235) |
| `--heat-sess-2` | `#e2c355` | `#7d6415` | intensity step 2 |
| `--heat-sess-3` | `#c9a22c` | `#b8952b` | intensity step 3 |
| `--heat-sess-4` | `#8f7114` | `#f5d78e` | intensity step 4 (max) |
| `--level-1` | `#8f9398` | `#50545a` | practice Level 1 (ML-316) - dull silver: heat-map bar, Level chip, picker |
| `--level-2` | `#c9cdd2` | `#80858c` | practice Level 2 - silver |
| `--level-3` | `#f6e7ad` | `#6f5f22` | practice Level 3 - pale gold |
| `--level-4` | `#eccf62` | `#b8952b` | practice Level 4 - light gold |
| `--level-5` | `#f5c211` | `#ffd23f` | practice Level 5 - gold, performance-ready |
| `--level-1-text` | `#1a1a1a` | `#ffffff` | the Level number on a --level-1 fill |
| `--level-2-text` | `#1a1a1a` | (same) | the Level number on --level-2 |
| `--level-3-text` | `#1a1a1a` | `#ffffff` | the Level number on --level-3 |
| `--level-4-text` | `#1a1a1a` | (same) | the Level number on --level-4 |
| `--level-5-text` | `#1a1a1a` | (same) | the Level number on --level-5 |
| `--level-unset-border` | `#858585` | `#808080` | dashed outline of a bar with no Level yet (3:1 on the page) |

## ML-390: the kinds of practice block (Warm-up, Scales, Skills, Pieces)

edge, icon/text and fill

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--kind-warmup` | `#c2410c` | `#fb923c` | a Warm-up block's edge (3:1 on the page) |
| `--kind-warmup-text` | `#9a3412` | `#fdba74` | a Warm-up block's icon and name (4.5:1 on its tint) |
| `--kind-warmup-tint` | `rgba(194, 65, 12, 0.14)` | `rgba(251, 146, 60, 0.16)` | a Warm-up block's fill |
| `--kind-scales` | `#0f766e` | `#2dd4bf` | a Scales block's edge |
| `--kind-scales-text` | `#115e59` | `#5eead4` | a Scales block's icon and name |
| `--kind-scales-tint` | `rgba(15, 118, 110, 0.14)` | `rgba(45, 212, 191, 0.16)` | a Scales block's fill |
| `--kind-skills` | `#6d28d9` | `#a78bfa` | a Skills block's edge |
| `--kind-skills-text` | `#5b21b6` | `#c4b5fd` | a Skills block's icon and name |
| `--kind-skills-tint` | `rgba(109, 40, 217, 0.14)` | `rgba(167, 139, 250, 0.16)` | a Skills block's fill |
| `--kind-pieces` | `#1d4ed8` | `#60a5fa` | a Pieces block's edge (Prepare and Play-through too) |
| `--kind-pieces-text` | `#1e40af` | `#93c5fd` | a Pieces block's icon and name |
| `--kind-pieces-tint` | `rgba(29, 78, 216, 0.14)` | `rgba(96, 165, 250, 0.16)` | a Pieces block's fill |
| `--kind-theory` | `#be185d` | `#f472b6` | a Theory block's edge (ML-418 - deep pink, apart from the four playing kinds) |
| `--kind-theory-text` | `#9d174d` | `#f9a8d4` | a Theory block's icon and name |
| `--kind-theory-tint` | `rgba(190, 24, 93, 0.14)` | `rgba(244, 114, 182, 0.16)` | a Theory block's fill |

## ML-390: the 30-second rest screen

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--rest-bg` | `#e6f0f3` | `#14232a` | the rest screen's calm page |
| `--rest-surface` | `#ffffff` | `#1b2e36` | the message card and "Next up" on the rest screen |
| `--rest-text` | `#235b6e` | `#9fd3e3` | the countdown, the message's kind and its icon (4.5:1 on both) |
| `--rest-ring` | `#3d8aa3` | `#6fb6cc` | the countdown ring and the breathing circle's edge (3:1 on --rest-bg) |
| `--rest-track` | `#cfe0e6` | `#27414b` | the ring's empty track (decorative) |

## Spacing

| Token | Value | Use for |
|---|---|---|
| `--space-0` | `0` | reset only |
| `--space-0-5` | `2px` | hairline gaps (heatmap cells, stacked labels) |
| `--space-1` | `4px` | icon-to-label gaps, tight stacks |
| `--space-2` | `8px` | default gap between related items; label-to-input |
| `--space-3` | `12px` | inner padding of compact controls; list row padding |
| `--space-4` | `16px` | standard button padding; gap between stacked blocks |
| `--space-5` | `20px` | container padding; gap between form groups |
| `--space-6` | `24px` | modal/card padding; space before a new group |
| `--space-7` | `32px` | section separation |
| `--space-8` | `40px` | large section separation |
| `--space-9` | `48px` | touch-target-sized offsets |
| `--space-10` | `64px` | page-level whitespace (empty states, logged-out screens) |

## Typography

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--font-sans` | `'Inter', 'Segoe UI', Tahoma, sans-serif` | `'OpenDyslexic', 'Comic Sans MS', sans-serif` | all UI text |
| `--font-mono` | `ui-monospace, 'SFMono-Regular', Consolas, monospace` | (same) | code, IDs, timestamps in admin |
| `--font-music` | `'Noto Music', serif` | (same) | Unicode musical symbols (segno, coda) |
| `--font-notation` | `'Bravura'` | (same) | music notation glyphs (notes, clefs, symbols) - Bravura via public/notation.js (ML-262) |
| `--font-notation-text` | `Georgia, 'Times New Roman', serif` | (same) | words printed in music: Fine, 1./2. time-bar numbers (ML-262) |
| `--font-2xs` | `0.6rem` | (same) | heatmap day labels only |
| `--font-xs` | `0.65rem` | (same) | micro labels, badges, chart axes |
| `--font-sm` | `0.8rem` | (same) | secondary text, captions, chips, metadata |
| `--font-base` | `0.95rem` | (same) | body text, list rows, inputs |
| `--font-md` | `1.1rem` | (same) | buttons, card titles, top-bar title |
| `--font-lg` | `1.3rem` | (same) | large buttons, modal titles, stat values |
| `--font-xl` | `1.6rem` | (same) | hero values (current piece, tuner octave) |
| `--font-2xl` | `2rem` | (same) | page titles, splash title |
| `--font-3xl` | `3rem` | (same) | giant readouts (tuner note) |
| `--font-weight-normal` | `400` | (same) | body text |
| `--font-weight-semibold` | `600` | (same) | form labels, nav/tab items, modal titles |
| `--font-weight-bold` | `700` | (same) | buttons, titles, emphasised values |
| `--line-height-tight` | `1` | (same) | icon glyphs, single-line numeric readouts |
| `--line-height-snug` | `1.2` | (same) | multi-line button labels, chart labels |
| `--line-height-base` | `1.45` | `1.7` | body paragraphs, notifications |
| `--line-height-relaxed` | `1.6` | `1.85` | long-form reading text (release notes) |
| `--text-scale` | `100%` | `125%` | the root font size - Text size setting |
| `--reading-letter-spacing` | `normal` | `0.035em` | dyslexia-friendly: a little more |
| `--reading-word-spacing` | `normal` | `0.12em` | dyslexia-friendly: a little more |
| `--reading-em-style` | `italic` | `normal` | dyslexia-friendly: no italics |
| `--tile-label-fit` | `15cqi` | (same) | the biggest a tool tile's label can be and still fit its tile |
| `--scale-grid-label-width` | `64px` | (same) | ML-357 the Scales grade grid's row-label column (the 15 key columns share the rest) |
| `--font-preview-standard` | `'Inter', 'Segoe UI', Tahoma, sans-serif` | (same) | each Reading font choice drawn in its own font |
| `--font-preview-lexend` | `'Lexend', 'Segoe UI', sans-serif` | (same) | the Lexend choice, in Lexend |
| `--font-preview-opendyslexic` | `'OpenDyslexic', 'Comic Sans MS', sans-serif` | (same) | the OpenDyslexic choice, in OpenDyslexic |
| `--swatch-standard` | `#f4f7f6` | `#121212` | Background choice swatches - the light page colours (the dark shades in dark mode, ML-359) |
| `--swatch-cream` | `#f9f1df` | `#2b2517` | the Cream choice's swatch |
| `--swatch-blue` | `#ecf2f9` | `#16222f` | the Pale blue choice's swatch |
| `--swatch-green` | `#eaf4eb` | `#17261b` | the Pale green choice's swatch |
| `--swatch-yellow` | `#f8f3d2` | `#29260f` | ML-359 the Soft yellow choice's swatch |
| `--swatch-peach` | `#ffede6` | `#2e1f1b` | ML-359 the Peach choice's swatch |

## Icon glyph sizes (Material Symbols font-size)

| Token | Value | Use for |
|---|---|---|
| `--icon-sm` | `16px` | inline icons inside text or chips |
| `--icon-md` | `20px` | default Material Symbols size |
| `--icon-lg` | `24px` | icon-only buttons |
| `--icon-xl` | `32px` | tool tiles, hero icons |

## Practice Levels heat map (ML-316)

| Token | Value | Use for |
|---|---|---|
| `--level-cell-size` | `24px` | one bar's square in a piece's Level map (display only, not a tap target) |
| `--level-strip-height` | `12px` | the thin one-row strip (Range's notes past your range) |
| `--level-bar-height` | `20px` | ML-390 a piece's Levels bar chart on a list row - holds the Level number |
| `--time-strip-height` | `12px` | ML-390 step 1: the strip of 5-minute blocks - thin (ML-419), so it can't pass for a row of buttons |

## Radius

see specs/foundations/radius.md. --radius-md is THE button radius.

| Token | Value | Use for |
|---|---|---|
| `--radius-2xs` | `2px` | heatmap cells, chart bar tops |
| `--radius-xs` | `4px` | inline code, tiny tags, toast buttons |
| `--radius-sm` | `8px` | menus, toasts, popups, small inset boxes |
| `--radius-md` | `12px` | EVERY button and tile, list rows, stat cards |
| `--radius-lg` | `16px` | inputs, choice options, picker tiles, feature cards |
| `--radius-xl` | `20px` | modals, flow cards, block boxes |
| `--radius-pill` | `999px` | badges, chips, filter pills, toggle tracks - never a button |
| `--radius-circle` | `50%` | icon-only circular buttons, dots, avatars |

## Elevation

| Token | Value | Use for |
|---|---|---|
| `--shadow-sm` | `0 2px 4px rgba(0, 0, 0, 0.2)` | small raised controls (toggle knob, scroll buttons) |
| `--shadow-md` | `0 2px 8px rgba(0, 0, 0, 0.1)` | top bar, slider thumb |
| `--shadow-lg` | `0 4px 12px rgba(0, 0, 0, 0.2)` | item being dragged |
| `--shadow-xl` | `0 4px 12px rgba(0, 0, 0, 0.3)` | menus, modals, popups |
| `--shadow-2xl` | `0 10px 40px rgba(0, 0, 0, 0.6)` | splash artwork only |
| `--shadow-top` | `0 -2px 8px rgba(0, 0, 0, 0.1)` | bars docked to the bottom edge |
| `--shadow-info` | `0 4px 12px rgba(33, 150, 243, 0.4)` | info toast only |
| `--focus-ring` | `0 0 0 2px #ffffff, 0 0 0 4px #7a6214` | keyboard focus outline, selected-swatch ring |
| `--selected-ring-inset` | `inset 0 0 0 1px #7a6214` | ML-359 thickens a chosen colour tile's outline inside it (the tile is filled with its colour, so no tint wash) |
| `--shadow-ring-surface` | `0 0 0 2px #ffffff` | separates a dot/badge from whatever it overlaps |
| `--shadow-cut-line` | `inset 4px 0 0 #f44336` | ML-390 the knife's cut on Focus bits: a red line down a bar's left edge |
| `--shadow-glow` | `0 0 10px 5px rgba(212, 175, 55, 0.55)` | peak of the pulsing gold glow |
| `--shadow-glow-rest` | `0 0 0 0 rgba(212, 175, 55, 0.55)` | rest frame of the pulsing gold glow |
| `--shadow-glow-soft` | `0 0 14px rgba(212, 175, 55, 0.25)` | static halo on a selected featured option |

## Z-index

one ladder, low to high. Never invent a number in a component.

| Token | Value | Use for |
|---|---|---|
| `--z-base` | `1` | lift above a sibling in the same stacking context |
| `--z-raised` | `2` | second layer inside the same component |
| `--z-sticky` | `10` | sticky axis/column inside a scroller |
| `--z-float` | `30` | floating scroll buttons over content |
| `--z-header` | `50` | sticky top bar group |
| `--z-menu-backdrop` | `40` | ☰ menu backdrop: over the page and its floating buttons, under the top bar that holds the menu |
| `--z-header-overlay` | `60` | element that must sit over the sticky header (timer dropdown) |
| `--z-dropdown` | `100` | menus, and the base modal layer |
| `--z-modal` | `100` | modal scrim + dialog |
| `--z-modal-stacked` | `200` | a modal opened from inside another modal |
| `--z-toast` | `1000` | toasts, anchored popups |
| `--z-splash` | `9999` | login splash - always on top |

## Motion

| Token | Value | Use for |
|---|---|---|
| `--duration-instant` | `80ms` | press feedback |
| `--duration-fast` | `150ms` | colour/border state changes |
| `--duration-swipe` | `200ms` | a swiped row settling open or shut (swipeTo, app.js) |
| `--duration-base` | `250ms` | slides, fades, toggles, expanding panels |
| `--duration-slow` | `400ms` | chart bar growth |
| `--duration-pulse` | `1000ms` | looping attention animations |
| `--duration-breath` | `10000ms` | one slow breath on the practice rest screen (ML-390): 4 s in, 6 s out |
| `--ease-standard` | `ease` | default easing for UI transitions |
| `--ease-in-out` | `ease-in-out` | looping/pulsing animations |
| `--ease-linear` | `linear` | colour/opacity tracking a live value (meters, metronome dots) |

## Layout

| Token | Value | Use for |
|---|---|---|
| `--app-max-width` | `500px` | single source of truth for the centred app column (ML-53) |
| `--touch-target` | `48px` | minimum tap target for any button |
| `--bottom-bar-clearance-lg` | `150px` | scroll room above the taller Flow details sticky bar |

## Layer 1 primitives (reference only - never use in components)

| Primitive | Value |
|---|---|
| `--ds-neutral-0` | `#ffffff` |
| `--ds-neutral-25` | `#fafafa` |
| `--ds-neutral-50` | `#f4f7f6` |
| `--ds-neutral-75` | `#ebedf0` |
| `--ds-neutral-100` | `#e0e0e0` |
| `--ds-neutral-150` | `#cfcfcf` |
| `--ds-neutral-200` | `#cccccc` |
| `--ds-neutral-300` | `#bbbbbb` |
| `--ds-neutral-400` | `#aaaaaa` |
| `--ds-neutral-500` | `#888888` |
| `--ds-neutral-600` | `#777777` |
| `--ds-neutral-650` | `#666666` |
| `--ds-neutral-700` | `#444444` |
| `--ds-neutral-750` | `#333333` |
| `--ds-neutral-775` | `#2d333b` |
| `--ds-neutral-800` | `#2c2c2c` |
| `--ds-neutral-850` | `#1e1e1e` |
| `--ds-neutral-875` | `#1a1a1a` |
| `--ds-neutral-900` | `#121212` |
| `--ds-neutral-950` | `#0a0a0a` |
| `--ds-neutral-1000` | `#000000` |
| `--ds-gold-300` | `#f5d78e` |
| `--ds-gold-500` | `#d4af37` |
| `--ds-gold-950` | `#1a1400` |
| `--ds-silver-300` | `#c0c0c8` |
| `--ds-sage-50` | `#f1f8e9` |
| `--ds-blue-500` | `#2196f3` |
| `--ds-orange-500` | `#ff9800` |
| `--ds-amber-400` | `#ffca28` |
| `--ds-amber-500` | `#ffc107` |
| `--ds-red-500` | `#f44336` |
| `--ds-green-400` | `#2ecc71` |
| `--ds-green-500` | `#4caf50` |
| `--ds-purple-500` | `#9c27b0` |
| `--ds-gold-700` | `#7a6214` |
| `--ds-red-700` | `#c62828` |
| `--ds-red-300` | `#f7746a` |
| `--ds-orange-800` | `#9a5b00` |
| `--ds-blue-800` | `#1565c0` |
| `--ds-blue-300` | `#6ab7f7` |
| `--ds-green-800` | `#2e7d32` |
| `--ds-green-300` | `#66bb6a` |
| `--ds-amber-800` | `#7a5c00` |
| `--ds-purple-300` | `#ce93d8` |
| `--ds-tuner-green-800` | `#1d7e46` |
| `--ds-neutral-625` | `#6b6b6b` |
| `--ds-neutral-550` | `#858585` |
| `--ds-neutral-500b` | `#808080` |
| `--ds-heat-gold-1` | `#f3e3a8` |
| `--ds-heat-gold-2` | `#e2c355` |
| `--ds-heat-gold-3` | `#c9a22c` |
| `--ds-heat-gold-4` | `#8f7114` |
| `--ds-heat-gold-dark-1` | `#4a3b0b` |
| `--ds-heat-gold-dark-2` | `#7d6415` |
| `--ds-heat-gold-dark-3` | `#b8952b` |
| `--ds-heat-gold-dark-4` | `#f5d78e` |
| `--ds-level-1` | `#8f9398` |
| `--ds-level-2` | `#c9cdd2` |
| `--ds-level-3` | `#f6e7ad` |
| `--ds-level-4` | `#eccf62` |
| `--ds-level-5` | `#f5c211` |
| `--ds-level-dark-1` | `#50545a` |
| `--ds-level-dark-2` | `#80858c` |
| `--ds-level-dark-3` | `#6f5f22` |
| `--ds-level-dark-4` | `#b8952b` |
| `--ds-level-dark-5` | `#ffd23f` |
| `--ds-kind-warmup` | `#c2410c` |
| `--ds-kind-warmup-deep` | `#9a3412` |
| `--ds-kind-warmup-a14` | `rgba(194, 65, 12, 0.14)` |
| `--ds-kind-scales` | `#0f766e` |
| `--ds-kind-scales-deep` | `#115e59` |
| `--ds-kind-scales-a14` | `rgba(15, 118, 110, 0.14)` |
| `--ds-kind-skills` | `#6d28d9` |
| `--ds-kind-skills-deep` | `#5b21b6` |
| `--ds-kind-skills-a14` | `rgba(109, 40, 217, 0.14)` |
| `--ds-kind-pieces` | `#1d4ed8` |
| `--ds-kind-pieces-deep` | `#1e40af` |
| `--ds-kind-pieces-a14` | `rgba(29, 78, 216, 0.14)` |
| `--ds-kind-theory` | `#be185d` |
| `--ds-kind-theory-deep` | `#9d174d` |
| `--ds-kind-theory-a14` | `rgba(190, 24, 93, 0.14)` |
| `--ds-kind-warmup-dark` | `#fb923c` |
| `--ds-kind-warmup-soft-dark` | `#fdba74` |
| `--ds-kind-warmup-a16-dark` | `rgba(251, 146, 60, 0.16)` |
| `--ds-kind-scales-dark` | `#2dd4bf` |
| `--ds-kind-scales-soft-dark` | `#5eead4` |
| `--ds-kind-scales-a16-dark` | `rgba(45, 212, 191, 0.16)` |
| `--ds-kind-skills-dark` | `#a78bfa` |
| `--ds-kind-skills-soft-dark` | `#c4b5fd` |
| `--ds-kind-skills-a16-dark` | `rgba(167, 139, 250, 0.16)` |
| `--ds-kind-pieces-dark` | `#60a5fa` |
| `--ds-kind-pieces-soft-dark` | `#93c5fd` |
| `--ds-kind-pieces-a16-dark` | `rgba(96, 165, 250, 0.16)` |
| `--ds-kind-theory-dark` | `#f472b6` |
| `--ds-kind-theory-soft-dark` | `#f9a8d4` |
| `--ds-kind-theory-a16-dark` | `rgba(244, 114, 182, 0.16)` |
| `--ds-rest-page` | `#e6f0f3` |
| `--ds-rest-card` | `#ffffff` |
| `--ds-rest-ink` | `#235b6e` |
| `--ds-rest-ring` | `#3d8aa3` |
| `--ds-rest-track` | `#cfe0e6` |
| `--ds-rest-page-dark` | `#14232a` |
| `--ds-rest-card-dark` | `#1b2e36` |
| `--ds-rest-ink-dark` | `#9fd3e3` |
| `--ds-rest-ring-dark` | `#6fb6cc` |
| `--ds-rest-track-dark` | `#27414b` |
| `--ds-black-a20` | `rgba(0, 0, 0, 0.2)` |
| `--ds-black-a10` | `rgba(0, 0, 0, 0.1)` |
| `--ds-black-a30` | `rgba(0, 0, 0, 0.3)` |
| `--ds-black-a60` | `rgba(0, 0, 0, 0.6)` |
| `--ds-black-a85` | `rgba(0, 0, 0, 0.85)` |
| `--ds-white-a30` | `rgba(255, 255, 255, 0.3)` |
| `--ds-gold-a12` | `rgba(212, 175, 55, 0.12)` |
| `--ds-gold-a25` | `rgba(212, 175, 55, 0.25)` |
| `--ds-gold-a55` | `rgba(212, 175, 55, 0.55)` |
| `--ds-blue-a40` | `rgba(33, 150, 243, 0.4)` |
| `--ds-gold-a40` | `rgba(212, 175, 55, 0.4)` |
| `--ds-orange-a12` | `rgba(255, 152, 0, 0.12)` |
| `--ds-red-a12` | `rgba(244, 67, 54, 0.12)` |
| `--ds-blue-a12` | `rgba(33, 150, 243, 0.12)` |
| `--ds-green-a15` | `rgba(46, 204, 113, 0.15)` |
| `--ds-green-a28` | `rgba(46, 204, 113, 0.28)` |
| `--ds-green-a45` | `rgba(46, 204, 113, 0.45)` |
| `--ds-status-amber-bg` | `#fdf3d0` |
| `--ds-status-amber-fg` | `#7a5c00` |
| `--ds-status-amber-bg-dark` | `#4a3c0c` |
| `--ds-status-amber-fg-dark` | `#f2dd90` |
| `--ds-status-green-bg` | `#d9f2df` |
| `--ds-status-green-fg` | `#1c5c2e` |
| `--ds-status-green-bg-dark` | `#17431f` |
| `--ds-status-green-fg-dark` | `#a7dcb5` |
| `--ds-status-blue-bg` | `#d6e8fb` |
| `--ds-status-blue-fg` | `#14457a` |
| `--ds-status-blue-bg-dark` | `#123a63` |
| `--ds-status-blue-fg-dark` | `#a6cdf2` |
| `--ds-status-grey-bg` | `#e6e6e6` |
| `--ds-status-grey-fg` | `#555555` |
| `--ds-status-grey-bg-dark` | `#3a3a3a` |
| `--ds-status-grey-fg-dark` | `#c4c4c4` |
| `--ds-status-purple-bg` | `#dfd9f5` |
| `--ds-status-purple-fg` | `#3e2f7a` |
| `--ds-status-purple-bg-dark` | `#2f2557` |
| `--ds-status-purple-fg-dark` | `#c3b6f0` |
| `--ds-size-0` | `0` |
| `--ds-size-2` | `2px` |
| `--ds-size-4` | `4px` |
| `--ds-size-8` | `8px` |
| `--ds-size-12` | `12px` |
| `--ds-size-16` | `16px` |
| `--ds-size-20` | `20px` |
| `--ds-size-24` | `24px` |
| `--ds-size-32` | `32px` |
| `--ds-size-40` | `40px` |
| `--ds-size-48` | `48px` |
| `--ds-size-64` | `64px` |
| `--ds-font-inter` | `'Inter', 'Segoe UI', Tahoma, sans-serif` |
| `--ds-font-mono` | `ui-monospace, 'SFMono-Regular', Consolas, monospace` |
| `--ds-font-music` | `'Noto Music', serif` |
| `--ds-font-bravura` | `'Bravura'` |
| `--ds-font-serif` | `Georgia, 'Times New Roman', serif` |
| `--ds-font-lexend` | `'Lexend', 'Segoe UI', sans-serif` |
| `--ds-font-opendyslexic` | `'OpenDyslexic', 'Comic Sans MS', sans-serif` |
| `--ds-text-scale-100` | `100%` |
| `--ds-text-scale-112` | `112.5%` |
| `--ds-text-scale-125` | `125%` |
| `--ds-leading-1-7` | `1.7` |
| `--ds-leading-1-85` | `1.85` |
| `--ds-tracking-reading` | `0.035em` |
| `--ds-word-spacing-reading` | `0.12em` |
| `--ds-tile-label-fit` | `15cqi` |
| `--ds-cream-page` | `#f9f1df` |
| `--ds-cream-card` | `#fdf8ec` |
| `--ds-cream-field` | `#fffcf4` |
| `--ds-blue-page` | `#ecf2f9` |
| `--ds-blue-card` | `#f1f6fb` |
| `--ds-blue-field` | `#f9fbfd` |
| `--ds-green-page` | `#eaf4eb` |
| `--ds-green-card` | `#f0f8f1` |
| `--ds-green-field` | `#f9fcf9` |
| `--ds-yellow-page` | `#f8f3d2` |
| `--ds-yellow-card` | `#fcf9e6` |
| `--ds-yellow-field` | `#fffdf3` |
| `--ds-peach-page` | `#ffede6` |
| `--ds-peach-card` | `#fff6f2` |
| `--ds-peach-field` | `#fff8f5` |
| `--ds-cream-page-dark` | `#2b2517` |
| `--ds-cream-card-dark` | `#362f1f` |
| `--ds-cream-field-dark` | `#3a3223` |
| `--ds-blue-page-dark` | `#16222f` |
| `--ds-blue-card-dark` | `#1f2d3c` |
| `--ds-blue-field-dark` | `#273544` |
| `--ds-green-page-dark` | `#17261b` |
| `--ds-green-card-dark` | `#213225` |
| `--ds-green-field-dark` | `#27372a` |
| `--ds-yellow-page-dark` | `#29260f` |
| `--ds-yellow-card-dark` | `#343118` |
| `--ds-yellow-field-dark` | `#37341d` |
| `--ds-peach-page-dark` | `#2e1f1b` |
| `--ds-peach-card-dark` | `#3a2823` |
| `--ds-peach-field-dark` | `#422f2a` |
| `--ds-text-0-6` | `0.6rem` |
| `--ds-text-0-65` | `0.65rem` |
| `--ds-text-0-8` | `0.8rem` |
| `--ds-text-0-95` | `0.95rem` |
| `--ds-text-1-1` | `1.1rem` |
| `--ds-text-1-3` | `1.3rem` |
| `--ds-text-1-6` | `1.6rem` |
| `--ds-text-2` | `2rem` |
| `--ds-text-3` | `3rem` |
| `--ds-weight-400` | `400` |
| `--ds-weight-600` | `600` |
| `--ds-weight-700` | `700` |
| `--ds-leading-1` | `1` |
| `--ds-leading-1-2` | `1.2` |
| `--ds-leading-1-45` | `1.45` |
| `--ds-leading-1-6` | `1.6` |
| `--ds-radius-2` | `2px` |
| `--ds-radius-4` | `4px` |
| `--ds-radius-8` | `8px` |
| `--ds-radius-12` | `12px` |
| `--ds-radius-16` | `16px` |
| `--ds-radius-20` | `20px` |
| `--ds-radius-full` | `999px` |
| `--ds-radius-50pct` | `50%` |
| `--ds-duration-80` | `80ms` |
| `--ds-duration-150` | `150ms` |
| `--ds-duration-200` | `200ms` |
| `--ds-duration-250` | `250ms` |
| `--ds-duration-400` | `400ms` |
| `--ds-duration-1000` | `1000ms` |
| `--ds-duration-10000` | `10000ms` |
