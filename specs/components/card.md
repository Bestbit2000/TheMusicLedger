# Card

## 1. Metadata
- **Name:** Card (`.flow-card`, `.flow-blocks-card`, `.tuner-card`, `.release-change-list`)
- **Category:** Layout / surfaces
- **Status:** Stable

## 2. Overview
A bordered surface that groups related content inside the app column. Cards are flat (no shadow).
**Don't** nest a card inside a card more than one level deep. Use an inset box
(`--container-bg` with an `--input-border` outline, one radius step smaller) for the inner level.

**Info rows** (`.info-row`, `.info-row-end` on the last of a group): a label and its read-only value, e.g. My account's Email / Account type / Member since - `--container-bg`, `--input-border` outline, label left, value right.
**Editable info rows** (ML-379, `button.info-row.info-row-edit` › label › value + `.info-row-edit-icon`): My details' Name, Display name and Avatar - and Email (ML-465) where the change_email feature is on: `#accountEditEmailBtn` opens `#accountEmailModal` (the address now, a field for the new one, a password field only for someone who signs in with one, a help line, Cancel / **Send the link**); without the feature the address is a plain `.info-row`. The whole row is one button (tap anywhere - it opens a pop-up: Name, Display name (Save / Cancel, × = Cancel) or Choose an avatar), on the tappable surface (`--input-bg`, `--control-border`) so it reads differently from the read-only rows. The pencil wears the list-row ⋮'s quiet grey circle (`.list-item-menu-btn`: `--control-border`, `--input-bg`, `--label-color`, `--radius-circle`), not `.btn-icon-edit`'s bold brown ring - the whole row is the button, the pencil only a hint but is decorative (`aria-hidden`); a visually hidden ", edit" / ", change" ends the button's name. Only one action, so no ⋮ menu.

**A card is never `--input-bg` (ML-286).** Cards are display surfaces; the lighter `--input-bg` means *you can tap this* ([color](../foundations/color.md)), so it belongs on the buttons and inputs inside a card, not on the card.

| Variant | Surface | Radius | Use |
|---|---|---|---|
| `.flow-card` | `--container-bg`, 1px `--input-border` | `--radius-xl` | Sections of the Flow editor/detail |
| `.tuner-card` | `--container-bg`, 2px state border | `--radius-lg` | Live tuner readout (see [tuner](tuner.md)) |

## 3. Anatomy
Container › optional header row (title + `.flow-pill` / actions) › content.

## 4. Tokens used
`--container-bg`, `--input-bg`, `--input-border`, `--primary-action`, `--radius-md`/`-lg`/`-xl`,
`--space-3`…`--space-6`, `--font-sm`…`--font-xl`.

## 5. Props / API
- `.release-change-list` is the bulleted change list under each release on About.

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
