# Accessibility

Status: stable (ML-210). Standard: **WCAG 2.2 AA in both light and dark mode**, plus a house rule
of a **44×44px minimum touch target** (musicians tap at arm's length on a music stand).

Enforced on every push to sandbox/main by `npm run a11y-audit` (part of `npm run design-gate`),
backed by an axe-core scan and a manual checklist at release time (see
[docs/release-process.md](../../docs/release-process.md)).

## Rules

| # | Rule | How it's met here | Checked by |
|---|---|---|---|
| A1 | Text contrast ≥ 4.5:1 (3:1 large), both themes | Hues have `-text` variants (`--primary-action-strong`, `--danger-text`, `--cat-*-text`…). Fills (`--primary-action`, `--danger-color`…) are **never** a text colour | `specs/accessibility/contrast-pairs.json` + CSS lint |
| A2 | Control edges and state indicators ≥ 3:1 | Tappable surfaces use `--control-border`; selected outlines and the focus ring use `--primary-action-strong`; toggle track uses `--control-off-bg` / `--selection-text` | contrast pairs |
| A3 | Anything clickable is a `<button>`/`<a href>` | Where a button can't nest (a tile containing its own ⋮), `role="button"` + `tabindex="0"`; `public/a11y.js` adds Enter/Space | markup lint |
| A4 | Every control has an accessible name | Visible `<label for>`, or `aria-label` on icon/glyph-only buttons ("Increase tempo", "Beat note: crotchet") | markup lint |
| A5 | Visible keyboard focus | One global `:focus-visible` ring (`--focus-ring`), never `outline: none` without it | CSS lint |
| A6 | 44px targets | Small visible controls get an invisible `::before` hit area sized `var(--touch-target)` (see the A6 block at the end of style.css) | CSS lint + axe |
| A7 | Reduced motion | `@media (prefers-reduced-motion: reduce)` kills slides/pulses/scale; beat dots keep colour only | CSS lint |
| A8 | Every swipe/drag has a single-tap alternative | ⋮ menus (Delete, Move up/down); ☰ handle opens Move up/down | `specs/accessibility/gestures.json` |
| S1 | Popup triggers declare it | `aria-haspopup="menu"` / `"dialog"` + `aria-expanded` (kept in sync by `a11y.js`) | markup lint |
| S2 | Modals are dialogs | `role="dialog" aria-modal="true"` + a label. `a11y.js`: focus moves in, Tab is trapped, Esc closes, focus returns | markup lint |
| S3 | Status messages are announced | Toasts are `role="status"`; they pause while hovered/focused (WCAG 2.2.1) | markup lint |
| S4 | No activation on press (2.5.2) | Press listeners only start gestures/close popups, each with an `// a11y:` note | JS lint |
| S5 | Custom sliders are sliders | `role="slider"` + `tabindex` + `aria-value*`; arrows/Home/End | markup lint |
| - | State isn't colour-only (1.4.1) | Tuner shows "In tune / 12¢ flat / 8¢ sharp" as text; selected tiles change outline **and** tint **and** text | manual + axe |
| - | View changes are announced | `switchView` sets `document.title` and moves focus to the screen's `h1` | manual |

## Shared behaviour (`public/a11y.js`)

Loaded on the app and the admin panel. It keys off markup conventions, so new components get it
automatically: role="button" keyboard activation; dialog focus/trap/Esc/return; menu Esc/arrows/
return; `aria-expanded` sync; `aria-pressed` mirrored from play/pause and mute icons (a button marked `data-pressed-managed` sets its own, e.g. the tuner history pause, where pressed = paused - ML-258).

## Adding something new

1. Use an existing component - its spec's **Accessibility** section says what it needs.
2. New colour combination → add it to `specs/accessibility/contrast-pairs.json`.
3. New swipe/drag → add it to `specs/accessibility/gestures.json` with its tap alternative.
4. `npm run a11y-audit` must report **0 new**. The baseline (`specs/accessibility/baseline.json`)
   is empty and may only shrink - an exception needs `--allow-new` and the owner's approval.

## Not automated (manual checklist each release)

Keyboard walk-through of changed screens · VoiceOver/TalkBack spot check · both themes · 200% text zoom.
