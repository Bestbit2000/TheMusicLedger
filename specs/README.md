# The Music Ledger - design system specs (ML-198)

Structured, LLM-readable specs for every visual decision in the app. **Before writing or
modifying any UI code, read the relevant spec here.**

| Where | What |
|---|---|
| [`public/tokens.css`](../public/tokens.css) | The tokens themselves - Layer 1 primitives (`--ds-*`) and Layer 2 aliases |
| [`tokens/token-reference.md`](tokens/token-reference.md) | Master map of every token, its value (light/dark) and when to use it - generated, don't hand-edit |
| [`foundations/`](foundations/) | The rules per category: [layout - phone, tablet and desktop](foundations/layout.md), [color](foundations/color.md), [spacing](foundations/spacing.md), [typography](foundations/typography.md), [radius](foundations/radius.md), [elevation](foundations/elevation.md), [motion](foundations/motion.md), [accessibility](foundations/accessibility.md) |
| [`components/`](components/) | One spec per component that exists in the app |
| [`public/styleguide.html`](../public/styleguide.html) | Live rendered examples (open `/styleguide.html` on any environment) |

## The three layers

```
Layer 1  --ds-gold-500: #d4af37;                          primitives - tokens.css only
Layer 2  --primary-action: var(--ds-gold-500, #d4af37);   aliases - the only names components use
Layer 3  .btn-submit { background: var(--primary-action); }   components - style.css, admin.css
```

**No inline styles (ML-288).** Nothing is styled with `style=""` (in HTML or in markup built from
JS) or with `el.style.x = ...` from JS. Every style is a class in `style.css` / `admin.css`,
described in a spec, so a new layout (tablet, landscape, desktop) or a new colour scheme can reach
all of it from the stylesheet. For a one-off nudge use a utility class (`.mt-4`, `.text-sm`,
`.fw-bold` - see [utilities-and-states](components/utilities-and-states.md)). The only exception
is a value that's only known at run time (a chart bar's height, a slider position, a drag offset):
JS sets it as a custom property and a class reads it -
`el.style.setProperty('--bar-h', '40%')` with `.chart-bar { height: var(--bar-h); }`.
`npm run token-audit` reports any other inline style as an error.

**One button, one pop-up (owner rule, 3 Oct 2026, ML-400).** A choice from a set of options is **one
button that shows the current answer and opens a pop-up** to change it - never the whole list of
options laid out on the page. A page full of options is overwhelming; the page should show only what's
picked. This is the starting point for every new screen:
- Single choice: the button opens the choice list (`openFlowChoiceModal`, `#flowChoiceModal`, the one
  on now ticked). Multi-select: a [pick list](components/pick-list.md) pop-up.
- The button is **the value box** (`.metroBlk-ctrl-value-btn`): the answer big and bold, and what it is
  in small lower-case under it ("Treble" over "clef"). Two to a row (`.metro-transport-grid-2`, Theory
  options), or full width (`.w-full`) where an answer can be long (Add a piece). No arrows or carets on
  it. **Re-use this box - don't invent another style of picker button** (owner, 3 Oct 2026).
- **Not covered:** buttons that *go somewhere* (navigation, like Add a piece's "Create your own" /
  "Import"), a yes/no pair, and options inside a pop-up that is itself the picker.
- Laying a list out on the page needs the owner's say-so first.
- If an option needs more than a tap (a name for a new list), it's asked **inside the pop-up, in that
  option's own box** (`openFlowChoiceModal`'s `extra`) - never a field left on the page behind it.

**Every pop-up closes the same three ways (owner rule, 3 Oct 2026, ML-400).** Any pop-up (`.modal`):
- has a close **X** in its top right corner - the first thing in `.modal-content` - whether or not it also
  has a Cancel button. The X only closes (it does what Cancel does); it never saves. With no close code of
  its own, write it as `<button type="button" class="modal-close-x" data-modal-x aria-label="Close">` and the
  shared code closes the pop-up;
- closes on a **tap on the dark backdrop** outside it;
- closes on **Escape**.

The last two are automatic for every `.modal` (`public/a11y.js`, `closeModal`) - don't wire them up per
pop-up. Two kinds of pop-up **don't** close on a backdrop tap (the X, Cancel and Escape still work):
- **A pop-up with a form showing** - anything to type or pick into (a text, number or date field, a text
  area, a drop-down), which usually means there's a Save button. A stray tap would lose the entry
  without your noticing. This is automatic too, and checked at the moment of the tap, so a pop-up that
  only grows a form part-way (Add a piece's "+ New practice list") is protected from then on. A pop-up
  that is only a selection still closes - you just open it and pick again. A search box, ticks and
  radio pills don't count as a form.
- **A pop-up that must be answered**, marked `data-no-dismiss` on the `.modal`: today the urgent notice, the important notice ("Before you continue...", ML-463),
  timer finished, "Are you sure?" and "Did you nail it?". Adding another needs the owner's say-so.

See [modal](components/modal.md).

**No pressure - young players use this (owner rule, ML-471).** Children play in bands, so the app is
built to the Children's Code (UK). The self-assessment passes standards 5 (detrimental use), 12 (profiling)
and 13 (nudge techniques) because the app has none of the things those standards worry about. It stays
that way only if every new screen is held to this - **read it before building an upgrade prompt, anything
that encourages practice, a reminder, or anything that shows one member another**:
- **An upgrade prompt says what the upgrade gives and how to ask - and nothing else.** No countdown or
  "today only". No "everyone else has it", no numbers of other players. It is not asked again once
  answered, it never appears on its own (the member taps to see it), and it never stands between a
  member and what they were doing: the free thing carries on working beside it.
- **No streak that punishes a missed day.** A streak may be counted and shown; nothing is lost, reset
  with a warning, or said in a disappointed voice when a day is missed. No "don't break your streak".
- **No comparison with other players** - no league table, no "you are behind", no ranking in a band
  (see also [product values](../docs/product-values.md), "Share the music, never the progress").
- **No reminder designed to bring someone back.** No notification, email or badge whose job is to get a
  member to open the app. A notice tells them something they need to know (ML-201, ML-463); it does not
  nag. Any future practice reminder is the member's own, off until they switch it on, in their words.
- **Nothing nudges a member to share more or to weaken their privacy.** The private choice is the
  default and is never the smaller, greyer button. Deleting an account and downloading its data stay as
  easy to reach as anything else on My account.
- **Encouragement is positive only** - already the rule for the home greeting, Levels, results and the
  rest messages: what went well and what comes next, never a score to feel bad about.

A feature that touches any of these is checked against the Children's Code self-assessment before it is
released (`docs/release-process.md`, step 1), and the self-assessment is updated if the answer to a
standard changes.

*Checked against this rule, 6 Oct 2026 - the one upgrade prompt there is, SmartLearn (ML-396):* a strip on
the Theory, Pitch and Tempo set-up screens and in the results box says "Learn faster with SmartLearn"
with **Learn more**; it is one quiet line, opens nothing by itself and blocks nothing - the plain round
is played as before. The pop-up says what SmartLearn does and why it works, and ends in one button that
emails the owner a request, once per device ("Upgrade requested" afterwards). No countdown, no other
players, no second ask. **It passes.** One thing for the owner to decide: the button says "Upgrade
**now**" - the only word in it that hurries - and what it really does is ask; "Ask to upgrade" would say
that. Left as it is until he says.

Dark mode is Layer 2 only: `body.dark-mode` in `tokens.css` points an alias at a different primitive.
A component never needs its own `body.dark-mode` colour override, so if you find yourself writing
one, you're probably missing an alias. Add the alias instead.

## Workflow

1. Read the component spec (or the foundation spec for a new component).
2. Use only Layer 2 tokens. If nothing fits, add a Layer 2 alias to `tokens.css` with a usage
   comment. Don't reach for a raw value.
3. `npm run token-reference` if you touched `tokens.css`.
4. `npm run token-audit`. Zero errors is required before committing.
5. New component? Add `specs/components/<name>.md` using the template below.

## Component spec template

1. Metadata (name, category, status)
2. Overview (when to use / when not to use)
3. Anatomy
4. Tokens used
5. Props / API (classes, modifiers, JS helpers)
6. States (default, hover, active, focus, disabled, error)
7. Code example
8. Cross-references
9. Accessibility (keyboard, ARIA, focus, touch target, anything not conveyed by colour)

## The words under a value line up (owner rule, ML-451)

In a value box (`.metroBlk-ctrl-value-btn`: the answer over what it is) the label sits in the same place in every
box, whatever the value is - text, a number or a picture. A picture taller than a line of text (a beat note) keeps
the value line one line high: it is centred on the line and spills a little above and below. Never let a value push
its label out of line with the boxes beside it.
