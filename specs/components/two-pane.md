# Two panes

## 1. Metadata
- **Name:** Two panes (`style.css`: `.two-pane` on the page's `.container`, `.two-pane-demo` for the Admin → Design examples, `.pane-list`, `.has-detail`, `.pane-selected`, `.home-main`, `.home-tools`, `.play-side`, `.play-main`)
- **Category:** Layout
- **Status:** New (ML-239)

## 2. Overview
On a wide screen (1000px and up) a list page keeps its list on the left and opens what you tap on the right.
On anything narrower the two are separate screens, one after the other, as they always were.

**What a tap does never changes** - a piece still opens to play, with editing in its ⋮ menu (owner, 7 Oct
2026). Only whether the list is still showing changes.

The same file holds the **side-by-side groups** of a single screen (Home, playing a piece), which need no
script: see [layout](../foundations/layout.md), "Side by side without a breakpoint".

**Use** two panes for a list whose rows each open a screen. **Don't** use them for a set of steps, or for a
list whose rows open a pop-up.

## 3. Anatomy
- `.container.two-pane` - the page's card as a two-column grid: `--pane-list-width`, then the rest.
- `.pane-list` - the list screen, kept showing in the first column, with a line down its right side.
- The opened screen is the second column. While there is one the card is `.has-detail`.
- With nothing opened yet the second column shows a hint in muted text (`data-pane-hint` on the card, drawn
  by `::after`): "Pick a piece to play."
- `.history-item.pane-selected` - the row that was tapped, marked with the primary tint and edge.

## 4. Tokens used
`--pane-list-width`, `--page-max-panes`, `--pane-col-min`, `--play-col-min`, `--input-border`, `--label-color`,
`--primary-action`, `--primary-action-tint`, `--space-5`, `--space-6`, `--space-8`, `--space-10`.

## 5. Props / API
`PANES` in `app.js` says which screens are lists and what each opens:

| List | Opens beside it | Hint |
|---|---|---|
| Rehearse (`rehearseView`) | the piece, playing | Pick a piece to play. |
| My music (`metroBuilderView`) | the piece, playing | Pick a piece to open it. |
| Settings (`settingsView`) | Display, Stats, Tuner, Metronome and playback | Pick a setting. |
| My account (`accountView`) | My details, Sign-in and security, My bands, My teachers | Pick what to look at. |
| About (`aboutView`) | Release history, Exam grades | Pick what to read. |

- `applyPanes(viewName)` runs at the end of every `switchView`. A screen opened from its list (the screen
  before it on the stack) gets the list beside it; anything else is a page on its own.
- Opening a second thing from the list **replaces** the first on the stack (`paneReplaces`), so Back always
  goes to the list.
- The ☰ menu / rail marks the list you are in, not the tool the opened screen usually belongs to.
- To add a list page, add a line to `PANES`. Nothing else.

## 6. States
List alone (hint showing) / list with something opened (row marked). Below 1000px: not two panes at all.
Turning a tablet or resizing a window across 1000px re-lays the current screen.

## 7. Code example
```html
<div class="container two-pane has-detail" data-pane-hint="Pick a piece to play.">
  <div id="rehearseView" class="pane-list">
    <button class="history-item clickable pane-selected">Floral Dance …</button>
  </div>
  <div id="flowPlayView">…</div>
</div>
```

## 8. Cross-references
[layout foundation](../foundations/layout.md) · [menu-rail](menu-rail.md) · [list-row](list-row.md)

## 9. Accessibility
- Reading and Tab order is the list, then what it opened - the order on screen.
- Focus moves to the page heading on a screen change exactly as on a phone (`a11y.js`); the list is not
  re-read.
- The marked row is not colour alone: it also has the thicker primary edge. Tint and edge are existing
  checked pairs.
- The hint is muted text on the card (`--label-color` on `--container-bg`, a checked pair). It is decoration
  drawn by CSS: the list beside it already says what to do.

See [accessibility foundation](../foundations/accessibility.md).
