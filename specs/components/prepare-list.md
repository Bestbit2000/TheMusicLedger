# Prepare (the tool's list)

## 1. Metadata
- **Name:** Prepare list (`#prepareListView` - no classes of its own: `.theory-intro`, `.filter-strip`,
  `.filter-pill`, a search field, `.history-item.clickable`, the choice pop-up `#flowChoiceModal`; the tile is a
  `.tool-icon-btn`)
- **Category:** Navigation / list
- **Status:** New (ML-401)

## 2. Overview
A way straight into preparing a piece, as a tool of its own (All tools › Practise, between Add a piece and
Rehearse - add, prepare, rehearse), so it isn't buried in a piece's path or a practice session. Shown with
`practice_levels`.
- **The list** is every piece you can see - yours, your bands', public - that has bars to play.
- **To start with, only the ones you haven't prepared** ("To prepare"); the **All pieces** filter adds the rest.
  "Prepared" means you've given at least one of its bars a Level; it's per person, so a band or public piece can
  be prepared for you and not for someone else.
- **Tapping a piece opens its path** ([piece-path](piece-path.md)), where the run-through, painting and cutting
  already live. Nothing about Prepare itself is different here.
- **A public piece asks first** (the choice pop-up): **Prepare it as it is** (it stays in the public library; your
  Levels are your own) or **Copy it to my library first** (you get your own copy to change, and prepare that).
  A copy remembers the public piece it came from - and so does a copy of that copy - behind the scenes
  (`scores.copied_from_score_id`), so Admin → Flows can say how many times a public piece has been taken up:
  prepared as it is, plus copies. The player never sees the link.
- **Don't use** this list to play a piece (that's Rehearse) or to edit one (My music).

## 3. Anatomy
`#prepareListView` › `p.theory-intro` › `.filter-strip` (the tune icon + `.filter-strip-pills` › two
`.filter-pill`s with their counts: To prepare, All pieces) › a search field › `.history-item.clickable` per piece
(the title in bold; under it bars · Personal / Band / Public · Needs preparing / Prepared; a `construction` or
`check_circle` icon on the right).

## 4. Tokens used
None of its own - see [filter-strip](filter-strip.md), [list-row](list-row.md), [form-field](form-field.md),
[tool-icon-button](tool-icon-button.md).

## 5. Props / API
- app.js, "PREPARE (ML-401)": `openPrepareList` (a fresh visit starts on To prepare with no search; Back keeps the
  filter and re-reads the pieces), `renderPrepareList`, `preparePiece` (the public-piece question, then
  `openPiecePath`).
- `GET /api/flows` gives each piece `prepared` for the account asking (`listFlows`, server/services/flows.js).
- `duplicateFlow` sets `copied_from_score_id` (migration 093); `listFlowsForAdmin` returns `preparedBy` and
  `copyCount`, shown on Admin → Flows for a public piece.
- The tile's Home id is `prepare`.

## 6. States
| State | Treatment |
|---|---|
| Filter on | `.filter-pill.active`, `aria-pressed="true"` |
| Prepared piece | "Prepared" in the row and a `check_circle` icon (shown only under All pieces) |
| Nothing to prepare | "Every piece is prepared. Tap All pieces to see them." |
| No pieces at all | "No pieces to prepare yet - add one with Add a piece." |
| No search match | "No pieces match that search." |

## 7. Code example
```html
<button type="button" class="history-item clickable" data-prepare-id="42">
  <span class="grow"><strong>Floral Dance</strong><br><span class="text-sm text-muted">96 bars • Personal • Needs preparing</span></span>
  <span class="material-symbols-outlined" aria-hidden="true">construction</span>
</button>
```

## 8. Cross-references
[piece-path](piece-path.md) · [filter-strip](filter-strip.md) · [list-row](list-row.md) · [add-piece](add-piece.md) ·
docs/practice-sessions.md ("Getting a piece ready").

## 9. Accessibility
- Each piece is a real `<button>` whose text says its state in words ("Needs preparing" / "Prepared") - the icon
  is decorative (`aria-hidden`) and never the only cue. A public piece's row has `aria-haspopup="dialog"`.
- The filter pills are buttons with `aria-pressed`, in a labelled group ("Show pieces"); the search field has an
  `aria-label`.
- The public-piece question is the shared choice pop-up: an X, Escape and a tap outside all close it.

See [accessibility foundation](../foundations/accessibility.md).
