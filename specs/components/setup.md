# Set-up for new members

## 1. Metadata
- **Name:** Set-up (`#setupView`; the searchable choice list in `#flowChoiceModal`, `openSearchChoiceModal`)
- **Category:** Form / stepped set-up
- **Status:** New (ML-517)

## 2. Overview
Three short steps the first time a new member signs in, so the app suits them from the start: **What I
play** (every instrument they play, the clef they read each in where there is a choice - ML-528 - and their first name if the
account has none), **How it looks** (light or dark, text size, font, background tint, more spacing, reduce motion) and
**Who I play with** (bands on their own, private, list). "Set up again" in Settings goes through it whenever
they like. Feature `member_setup`. How it behaves is in `docs/home-greeting.md` ("Set-up for new members").

It is built from what exists: Quick entry's step bar, question and Back / Next foot
([piece-outline](piece-outline.md)), the value box and the choice pop-up ([add-piece](add-piece.md)), the
toggle row ([display-and-reading](display-and-reading.md)). **It adds no class of its own.** The one new thing
is that the choice pop-up can be searched, for a list too long to scroll.

The owner's rules it follows (12 Oct 2026, and "No pressure" in `specs/README.md`):
- **Every step can be left empty.** Next just carries on - there is no Skip button and nothing is required.
- **A page, never a pop-up that must be answered.** The < at the top, or the menu, leaves it.
- **Nothing is asked twice.** Finishing or leaving it marks it done on the account; it never comes up by
  itself again.
- **Each choice is one button and one pop-up**, saved as it is made - by the code My instruments, Display
  and reading and My bands already use. Set-up keeps nothing of its own.
- **It never leads into sharing.** The bands step adds a band to the member's own list and stops there.

## 3. Anatomy
- **Every step:** `.step-bar` (three `.step-bar-piece`s; `role="img"`, named "Step 2 of 3: How it looks") ›
  one line saying where you are, the step's name in bold (`.text-sm.text-muted`) › `.step-question` ›
  `.outline` (a column of rows, `--space-3` apart) › pinned to the bottom, `.flow-edit-sticky-bar-wrap` ›
  `.flow-edit-sticky-bar` › `.flow-edit-sticky-bar-actions.step-foot`: **Back** (`.btn-cancel.btn-nav`, not
  on the first step) and **Next** (`.btn-submit` - "Next: how it looks", "Next: who I play with", "Finish").
- **What I play** (every instrument they play, added here - owner, 25 Oct 2026): a welcome line
  (`.text-sm.text-muted`; "Welcome, Sam. Three quick things so the app suits you. If you want, you can leave
  any of them empty and come back to this later from the menu: My instruments." the first time, "Change
  anything here... Tap an instrument to change its clef." when gone through again) › a `.form-group` "My
  first name", only when the account has no first name › a `.history-item.settings-link` row per instrument
  (its name over its clef, "· my main instrument" on the main one; a chevron) › `.outline-add` "+ Add my
  instrument" / "+ Add another instrument" › "Play more than one? Add each of them here." while there are
  fewer than two.
- **An instrument's pop-up** (`#flowChoiceModal`, a tap on its row): its name › for an instrument read more
  than one way, "Which clef do you mainly read?" (`.flow-tile-section-label`; "mainly" because many read both -
  this is only the clef the app starts in, owner 25 Oct 2026) over a `.flow-choice-option` per clef,
  the one on now `.selected` with a tick - saved as it is tapped, the pop-up stays open › "Make it my main
  instrument" (`.btn-cancel.btn-nav.w-full`, not on the main one) › "Remove it from my list"
  (`.btn-text.btn-text-danger`) › Done. Adding an instrument read more than one way opens this pop-up straight
  away with a line at the top ("Added to your list..."); one read one way is simply added. The first one
  added is the main one; removing the main one makes the next one main (as My instruments does).
- **How it looks:** a line › `.outline-pair` of four value boxes (light or dark, text size, font,
  background tint), each opening the choice pop-up › a `.display-toggle-row` with a `.toggle-switch`
  ("More space between lines and letters" over "And no italics") › a second one, "Reduce motion" (ML-603), over the
  same help line as in Settings. Each choice shows straight away.
- **Who I play with:** a line saying the list is private › a `.history-item` per band already on the list
  (its name and a tick) › `.outline-add` "+ Add a band" / "+ Add another band".
- **The searchable choice list** (`#flowChoiceModal`): the question › `input[type="search"].mb-4` › the
  rows, `.flow-choice-option` (the one on now `.selected` with a tick), under a
  `.flow-tile-section-label` per group (instruments by family). With nothing typed a long list shows its
  first 40 rows and a line saying how many more there are ("type a few letters to find one"); nothing
  found says so. A last row, "My band isn't on the list", grows into its own box in the pop-up
  (`.flow-choice-option.plan-card.selected`: a `.form-group` and a `.btn-submit`) - never a second pop-up.
- **Settings:** a fifth `.history-item.settings-link` row, "Set up again" over "What I play, how it looks,
  who I play with".

## 4. Tokens used
None of its own - every class is an existing component's:

| Part | Class | Spec |
|---|---|---|
| Step bar, question, foot | `.step-bar`, `.step-bar-piece`, `.step-question`, `.step-foot` | [piece-outline](piece-outline.md), [practice-steps](practice-steps.md) |
| The column of rows, two across, "+ Add" | `.outline`, `.outline-pair`, `.outline-add` | [piece-outline](piece-outline.md) |
| Value box | `.metroBlk-ctrl-value-btn`, `.metroBlk-ctrl-value-label` | [metronome](metronome.md) |
| Choice rows, the row that grows | `.flow-choice-option`, `.plan-card`, `.flow-tile-section-label` | [add-piece](add-piece.md) |
| An instrument's pop-up buttons | `.btn-cancel.btn-nav`, `.btn-text.btn-text-danger` | [button](button.md) |
| Switch | `.display-toggle-row`, `.toggle-switch` | [toggle-switch](toggle-switch.md) |
| Instrument rows, band rows, Settings row | `.history-item`, `.settings-link` (no margin of its own in the column) | [list-row](list-row.md) |

## 5. Props / API
- `openSetup(first)` - opens it at step 1. `first`: it came up by itself for a new member (the welcome
  line says so, and the closing toast is "All set. Welcome!").
- `maybeStartSetup()` - called once after signing in: opens it when `member_setup` is on, there is a
  connection, and the account's `setupDoneOn` is empty. Not when the member arrived from a band's
  invitation (that opens My bands; set-up comes up at the next sign-in) - with `band_welcome` on, the band's
  welcome opens instead and set-up starts straight after **Join** (ML-534).
- `setupLeft()` - run by `switchView` on the way out, however it is left: saves a typed name and posts
  `/api/account/setup-done`.
- `openSearchChoiceModal(title, items, onSelect, { placeholder, all, other })` - `items`
  `[{ label, sub, group, value, selected }]` in the order to show; `all` shows every row with nothing
  typed (the instruments); `other` `{ label, sub, build(el, close, typed) }` is the last row that needs
  typing.

## 6. States
- **First time / again:** only the welcome line and the closing toast differ.
- **No instrument yet:** only "+ Add my instrument" and the line under it.
- **An instrument read one way:** its row shows its clef; its pop-up has no clef choice, only Make it my main
  (not on the main one) and Remove.
- **No bands yet:** the step is the line and "+ Add a band".
- **Offline:** it doesn't come up by itself; opened from Settings, a choice that can't be saved says so in
  a toast (display choices are kept on the device, as in Settings).

## 7. Code example
```html
<div class="step-bar" role="img" aria-label="Step 1 of 3: What I play"><span class="step-bar-piece is-now"></span><span class="step-bar-piece"></span><span class="step-bar-piece"></span></div>
<p class="text-sm text-muted mb-3"><strong>What I play</strong> · step 1 of 3</p>
<h2 class="step-question">What do you play?</h2>
<div class="outline">
    <p class="text-sm text-muted no-margin">Change anything here - each choice is saved as you make it. Tap an instrument to change its clef.</p>
    <button type="button" class="history-item settings-link" aria-haspopup="dialog"><span class="settings-link-text"><span class="settings-link-title">B♭ Euphonium (4 valves)</span><span class="settings-link-sub">Bass clef · my main instrument</span></span><span class="material-symbols-outlined settings-link-chevron" aria-hidden="true">chevron_right</span></button>
    <button type="button" class="outline-add" aria-haspopup="dialog">+ Add another instrument</button>
</div>
```

## 8. Cross-references
[piece-outline](piece-outline.md) · [add-piece](add-piece.md) · [display-and-reading](display-and-reading.md) ·
`docs/home-greeting.md` · `docs/range.md` ("The clef you read") · `specs/README.md` ("No pressure",
"One button, one pop-up")

## 9. Accessibility
- The step bar is a picture with a name; the line under it says the same in words.
- Going to another step moves the keyboard to the question (`tabindex="-1"`), so a screen reader reads the
  new step; after a pop-up closes it goes back to the button that opened it.
- Every choice is a `<button>`; the pop-up's rows carry `aria-pressed`; the search box has a name.
- Nothing is conveyed by colour alone: the clef on now has a tick, and the main instrument says so in words.
- The words are positive and nothing is urged: no step counts against the member for being left empty.
