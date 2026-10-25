# Instrument support

## 1. Metadata
- **Name:** Instrument support (`#instrumentSupportView`, `#supportList`, `#supportBusinessModal`,
  `#supportTownModal`, `#instrumentSupportNavItem`, `#supportFromInstrumentsLink`)
- **Category:** Screen (a ☰ menu item, not a tool)
- **Status:** New (ML-610)

## 2. Overview
Repairers, shops and hire within about 45 minutes of the towns of the bands on My bands, nearest first,
then the UK-wide ones that post, deliver or sell online. A plain list the owner keeps - no reviews, and
contact is outside the app. Feature `instrument_support`. The rules are in `docs/instrument-support.md`.

It is built entirely from existing pieces: the value box, the list row, the choice pop-up and the modal.
**No new classes.** Designed in Claude Design first (canvas on ML-610).

## 3. Anatomy
- **The screen** (a narrow page):
  - a `.metro-help-text` line: what it is, and to get in touch with them directly;
  - `.outline-pair` of two value boxes (`.metroBlk-ctrl-value-btn.w-full`): **near** ("My bands' towns", or
    the town picked) and **looking for** ("Everything", "Brass repairs"...). One button, one pop-up each;
  - `#supportList`: `h2.section-title` "Within about 45 minutes", a help line ("Nearest first, from
    Addlestone, Cobham."), then one `button.history-item.settings-link` per business - icon `handyman`,
    the name as `.settings-link-title`, and "about 15 min · Staines-upon-Thames · Brass repairs" as
    `.settings-link-sub` (time and town first: the line is cut short on a phone). Then `h2.section-title`
    "Anywhere in the UK", a help line, and the UK-wide rows (icon `local_shipping`, the town or "UK-wide");
  - a `.metro-help-text` line on where the list comes from, and a `.btn-text` "Something wrong or missing?
    Tell us" (Send feedback).
- **The business pop-up** `#supportBusinessModal` (`.modal`): the name; a help line with what it offers,
  its town and how far; what they do; a column (`.flex-col.gap-sm`) of buttons - "Visit their website" or
  "Their Facebook page" (`.btn-submit`), "Call 01932 ..." and "Email ..." (`.btn-cancel.btn-nav`), each opening
  outside the app; then where the listing came from and when it was checked, and how a business asks for
  a change.
- **Near where?** - the choice pop-up (`openFlowChoiceModal`): My bands' towns (the towns under it), each
  town on its own, Another town ("Only for now - nothing is kept").
- **Another town** `#supportTownModal`: a search box; towns and villages as you type (a
  `.flow-choice-option` each, the county under the name), an exact name first, then the nearest to your
  bands.
- **Looking for** - the choice pop-up: Everything, Brass repairs, Woodwind repairs, A shop, Hire,
  Percussion, each with a line saying what it covers.
- **The menu item** in the You group, straight after My instruments (icon `handyman`), and **the link on
  My instruments** (a `.settings-link` row, "Need a repair, a shop or hire?" over "Instrument support -
  brass, near your bands"), which opens it on the main instrument's family.

## 4. Tokens used
None of its own - each part is its component's ([list-row](list-row.md), [modal](modal.md),
[form-field](form-field.md), [dropdown-menu](dropdown-menu.md)).

## 5. Props / API
- `startSupport()` runs each time the screen opens: near goes back to My bands' towns and looking for to
  Everything (a town picked was for that look only). `openSupport(lookingFor)` opens it set to a family
  instead (My instruments' link).
- `loadSupport()` fetches `GET /api/support?for=&near=&county=` and draws it (`renderSupportList`).
- `openSupportBusiness(id)`, `openSupportNear()`, `openSupportTown()`, `openSupportFor()`.
- `supportForInstrument()` - the looking-for key for the main instrument's family; `renderSupportLink()`
  shows the My instruments link when the feature is on.

## 6. States
- **Loading** - "Loading…" in the list.
- **None of my bands has a town** (no My bands, or none linked to the directory) - a line saying so and
  pointing at "near"; the UK-wide group still shows.
- **Nothing within about 45 minutes** - a line saying so; the UK-wide group still shows.
- **A town picked** - the near box shows the town; it goes back to My bands' towns next time the screen
  opens.
- **Feature off** - the menu item and the My instruments link are hidden.

## 7. Code example
```html
<div class="outline-pair">
    <button type="button" class="metroBlk-ctrl-value-btn w-full" aria-haspopup="dialog"><strong>My bands' towns</strong><span class="metroBlk-ctrl-value-label">near</span></button>
    <button type="button" class="metroBlk-ctrl-value-btn w-full" aria-haspopup="dialog"><strong>Everything</strong><span class="metroBlk-ctrl-value-label">looking for</span></button>
</div>
<h2 class="section-title">Within about 45 minutes</h2>
<button type="button" class="history-item settings-link" aria-haspopup="dialog">
    <span class="material-symbols-outlined settings-link-icon" aria-hidden="true">handyman</span>
    <span class="settings-link-text"><span class="settings-link-title">A repairer</span><span class="settings-link-sub">about 15 min · A town · Brass repairs</span></span>
    <span class="material-symbols-outlined settings-link-chevron" aria-hidden="true">chevron_right</span>
</button>
```

## 8. Cross-references
[list-row](list-row.md) · [modal](modal.md) · [dropdown-menu](dropdown-menu.md) · `docs/instrument-support.md` ·
Admin → Instrument support (`public/admin-instrument-support.js`)

## 9. Accessibility
- Every row and value box is a `<button>`; the ones that open a pop-up say so (`aria-haspopup="dialog"`).
- The list is `aria-live="polite"`, so a new look is announced; the town results are too.
- The contact buttons say what they do and to whom ("Call 01932 ...") - no icon-only buttons.
- The pop-ups close the three usual ways (✕, the backdrop, Escape); the town search, having a field, ignores
  the backdrop tap.
