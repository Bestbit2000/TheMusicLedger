# Filter bar

## 1. Metadata
- **Name:** Filter bar (`.filter-bar`, `.filter-bar-row`, `.filter-bar-text`, `.filter-bar-chips`, `.filter-chip`, `.filter-panel-choices`)
- **Category:** Inputs / navigation
- **Status:** New (ML-595, owner 23 Oct 2026)

## 2. Overview
The one way a member filters a list: My music, Rehearse's and My music's Practice lists, Prepare, Stats, History, and
inside pick lists (Add pieces, Choose pieces, Archive several, Add skills). It replaced the row of pills behind a
"tune" icon ([filter strip](filter-strip.md), which the admin panel still uses), which looked tappable when it wasn't,
ran off the screen, and could filter only one way at a time.

- **One button** (the value box, `.metroBlk-ctrl-value-btn`, lit while filters are on) says how many filters are on and
  how many things show: "All pieces · showing 42 · tap to filter", or "4 filters on · showing 3 of 42 · tap to change".
  It stays one size however many filters are on.
- **The filters on are chips under it** (`.filter-chip`), each with an x that takes just that one off, and **Clear
  all** beside the button. They wrap, so a long band name takes its own line and is never cut off.
- **Tapping the button lists every way of filtering** in one pop-up: a heading and wrapping pills for each group
  (`.filter-panel-choices` - Whose, Has, Prepared, On a practice list; Kind, Instrument), each pill saying how many it
  would show, and a yes/no as a toggle switch (Archived pieces). Within a group any choice will do; across groups every
  group must match. The list behind changes as you tap; the pop-up's button says "Show 6 pieces".
- **Inside a pick list's own pop-up** the filters open in place of the list (a back link, the groups, "Done - show N"),
  never as a second pop-up.
- Only choices something has are offered (no "A recording" when nothing has one); a group with one choice or none
  isn't shown. Per visit - opening the screen afresh starts with nothing on (Prepare starts on "Not prepared yet").

## 3. Anatomy
`.filter-bar` › `.filter-bar-row` (› the button: icon › `.filter-bar-text` (strong + label) › and, with filters on, a
`.btn-text` Clear all) › `.filter-bar-chips` (› `.filter-pill.active.filter-chip` × n, each ending in a `close` icon).
The pop-up: `.warmups-settings-head` per group › `.filter-panel-choices` › `.filter-pill[.active]` (a `check` icon when
on) › `.filter-pill-count`; a switch group is a `.display-toggle-row` with a `.toggle-switch`.

## 4. Tokens used
`--space-2`, `--space-3`, `--space-4`, `--font-md`, plus the value box's, the filter pill's and the toggle switch's own.

## 5. Props / API
`renderFilterBar(cfg)` in app.js ("FILTERS"); the rules - apply, count, chips, toggle, clean - are `public/filters.js`
(tests `server/test/filters.test.js`). `pieceFilterGroups` / `pieceFilterMatch` give every list of pieces the same
groups; Stats and History share `sessionFilterState`.

## 6. States
Nothing on (plain button) · Filters on (lit button, count, chips, Clear all) · Pop-up open · Open in place (in a pick list).

## 7. Code example
```html
<div class="filter-bar">
  <div class="filter-bar-row">
    <button type="button" class="metroBlk-ctrl-value-btn metroBlk-ctrl-value-btn-on"><span class="material-symbols-outlined" aria-hidden="true">filter_list</span><span class="filter-bar-text"><strong>2 filters on</strong><span class="metroBlk-ctrl-value-label">showing 3 of 42 · tap to change</span></span></button>
    <button type="button" class="btn-text">Clear all</button>
  </div>
  <div class="filter-bar-chips"><button type="button" class="filter-pill active filter-chip" aria-label="Take off the filter Mine">Mine<span class="material-symbols-outlined" aria-hidden="true">close</span></button></div>
</div>
```

## 8. Cross-references
[filter strip](filter-strip.md) · [selectable tile](selectable-tile.md) · [toggle switch](toggle-switch.md) · [pick list](pick-list.md)

## 9. Accessibility
- The button's name says what's on and how many show; each chip's name is "Take off the filter ...".
- Pills in the pop-up are `<button aria-pressed>`; a switch is a real checkbox. A group is a labelled `role="group"`.
- Nothing is shown by colour alone: an on pill has a tick as well as its outline and wash.

See [accessibility foundation](../foundations/accessibility.md).
