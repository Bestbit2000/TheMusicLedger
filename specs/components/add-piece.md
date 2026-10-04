# Add a piece

## 1. Metadata
- **Name:** Add a piece (`#addPieceView` - no classes of its own: the value box `.metroBlk-ctrl-value-btn` +
  `.w-full`, the choice pop-up `#flowChoiceModal`, `.step-question`, `.form-group`; its own: `.metroBlk-entry-choices`,
  `.metroBlk-entry-choice`; the tile is a `.tool-icon-btn`)
- **Category:** Flow / input
- **Status:** New (ML-400)

## 2. Overview
The way into making a piece, as a tool of its own (All tools › Practise, before Prepare and Rehearse) so it isn't
hidden under ☰ My music. One screen, asked **before** the piece is made. The first two questions are **one value box
each** (the same box as Theory's options - the answer over what it is, no arrows) that opens a pop-up to change it ("One button, one pop-up", specs/README.md; owner,
3 Oct 2026: a page of options is overwhelming):
- **Who it's for:** Just me, or one of your bands. Hidden when you're in no band.
- **Practice list:** On its own (a single piece, not part of a list - it says what the piece is, not what it isn't; owner, 3 Oct 2026), one of your lists, or **+ New practice list** - named and saved **inside the
  pop-up, in that option's own box** (the row grows to hold the name field and Save, so it's plain what they
  belong to; the pop-up's Cancel backs out), so nothing is left on
  the page behind it (owner, 3 Oct 2026). Save makes the list there and then and picks it. Hidden without `practice_levels`. A band's list is only offered for that band's pieces - the rest of the
  band couldn't open a piece that's just yours - so the lists follow the first answer; a new list belongs to
  whoever the piece is for.
- **How do you want to make it?** Create your own, or Import (its name and help line follow the import gates;
  hidden with none on). These two carry on - there's no separate Continue button.

The same screen opens from **+ Add a piece** in My music and Rehearse, and **Create new** in the player's ⋮ menu.
The journey that follows (Details › Bars › Media) ends with **Done**, which lands on **My music** with the new
piece in the list and a toast naming it (and the list it went on) - it used to open the player.
- **Don't use** this screen for editing a piece that exists; that's the Edit flow screen ([flow-editor](flow-editor.md)).

## 3. Anatomy
`#addPieceView` › two full-width value boxes, one under the other
(`button.metroBlk-ctrl-value-btn.w-full` › `strong` the answer + `.metroBlk-ctrl-value-label` "who it's for" /
"practice list"). Each opens `#flowChoiceModal` (an X top right, the question as its title, a row per option - a bold title over a
`.text-sm.text-muted` line - the one on now `.selected` with a tick). Picking "+ New practice list" keeps the pop-up open and turns
that row into a box - `div.flow-choice-option.plan-card.selected` (`role="group"`; `.plan-card` only for its
stacked layout) › the row's words, then `.form-group` › label + text input, then **Save** (`.btn-submit`) - with
the pop-up's own Cancel under the list as always. Then `h2.step-question` "How do you want to make it?" over
`.metroBlk-entry-choices` (a 2-column grid, equal-height rows) › `button.metroBlk-entry-choice` × 2 (3 when a
third way in is added): a Material icon, a `strong` title, a `.metro-help-text` line. These are the square icon
tiles My music's start screen had until ML-329, brought back (owner, 3 Oct 2026) so the ways to go on look
different from the value boxes above them.

## 4. Tokens used
The tiles: `--control-border`, `--input-bg`, `--text-color`, `--primary-action-strong` (icon), `--radius-md`,
`--space-2` / `--space-3` / `--space-4`, `--icon-xl`, `--font-md`. The rest - see [metronome](metronome.md) (the value box), [practice-steps](practice-steps.md)
(`.step-question`), [radio-group](radio-group.md) / [pick-list](pick-list.md) (`.flow-choice-option`),
[form-field](form-field.md) and [tool-icon-button](tool-icon-button.md). Spacing is the `.mb-2` / `.mb-4` /
`.mt-2` utilities.

## 5. Props / API
- app.js, the "ADD A PIECE (ML-400)" section: `openAddPiece` (a fresh visit starts on Just me / On its own; Back keeps
  the answers), `renderAddPiece`, `addPieceOwnerChoices` / `addPieceListChoices`, `addPieceOpenChoice`
  (`openFlowChoiceModal`; an option with `extra(el, close)` stays open and draws its own fields - here
  `addPieceNewListForm`), `addPieceTakeTarget` (returns
  `{ bandId, listId, listName }`), `addPieceToTargetList`, `createAndOpenFlow(target)`, `flowCreateDone`.
- Server: `POST /api/flows { bandId }` and `POST /api/flows/from-file { ..., bandId }` (checked with
  `assertBandMembership`); the list through the existing `/api/practice/lists` routes.
- The tile shows with `flow_manage` + `flow_create` (as My music's + Add a piece); its Home id is `add-piece`.
- The piece is made, and put on the list, as soon as a "how" button is tapped - backing out leaves it there
  (ML-404 covers tidying those up).

## 6. States
| State | Treatment |
|---|---|
| Answer picked | the button shows it; in the pop-up its row is `.selected` with a tick, `aria-pressed="true"` |
| No bands | the "who it's for" box is hidden; the piece is yours |
| Practice lists off | the practice list box is hidden |
| New list, no name | Save gives a warning toast and puts focus in the name field; nothing is made, the pop-up stays |
| New list form showing | a tap outside the pop-up no longer closes it (a form is showing); the X, Cancel and Escape do |
| New list saved | the pop-up closes and the practice list box shows the new list's name |
| Making the piece | the "Create your own" button is disabled until it's done, so a double tap makes one piece |

## 7. Code example
```html
<button type="button" class="metroBlk-ctrl-value-btn w-full" aria-haspopup="dialog" aria-label="Who it's for: Just me - tap to change">
  <strong>Just me</strong><span class="metroBlk-ctrl-value-label">who it's for</span>
</button>
```

**A new piece left untouched isn't kept (ML-404).** "Create your own" saves the piece the moment it's tapped
(a default name and one default bar). Leaving the create journey without naming it, changing a bar or adding
anything deletes it again (`flowCreateLeft`, app.js - what's on screen is checked first, then the server's copy)
and says "Nothing was added, so the new piece wasn't kept." Done always keeps it; an import is never removed.
My music's **Delete several pieces** (a `.btn-text` under the list) cleans up older ones: a [pick list](pick-list.md)
of the pieces you can delete (your own, and band pieces you added - ML-411), then one confirm pop-up saying how
many, which are on a practice list and which are band pieces.

## 8. Cross-references
[tool-icon-button](tool-icon-button.md) · [practice-steps](practice-steps.md) · [flow-editor](flow-editor.md) ·
[form-field](form-field.md) · docs/practice-sessions.md (practice lists) · docs/flow-musicxml.md (import).

## 9. Accessibility
- Each value box is a real `<button>`, 60px tall, with `aria-haspopup="dialog"` and an `aria-label` that says what
  it is, the answer and that it can be changed ("Who it's for: Just me - tap to change"), as Theory's boxes.
- The pop-up is a dialog (`showModal`): focus moves in, Escape and the backdrop close it, focus returns to the
  button. The option on now is shown by border, tint, a tick **and** `aria-pressed`, never colour alone.
- Picking "+ New practice list" moves focus to the field (visible label, "What is the list called?") inside the same
  dialog; Enter saves. The label avoids the word "name" and the input carries `autocomplete="off"` and
  `data-form-type="other"`, so a password manager doesn't take it for a person's name and offer to fill it.
- The tiles are real `<button>`s, 140px or taller, named by their title and help line; their icons are decorative
  (`aria-hidden`). The icon colour is never the only cue - each tile has its words.

See [accessibility foundation](../foundations/accessibility.md).
