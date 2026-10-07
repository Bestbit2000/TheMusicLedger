# Layout: phone, tablet and desktop (ML-239)

The app is **phone first, desktop friendly**. Every screen is designed for a portrait phone; from 700px up
the same screens are laid out to use the room. (The admin panel is the other way round: desktop first, see
[admin-shell](../components/admin-shell.md).)

All of it is CSS at the end of `public/style.css` ("ML-239: tablet and desktop"). Script only remembers
whether the menu is folded and keeps a list showing beside what it opens (`app.js`, "ML-239: TABLET AND
DESKTOP").

## The three sizes

| Size | Width | What changes |
|---|---|---|
| Phone | under 700px | Nothing. One column the width of the screen, the ☰ menu. |
| Tablet | 700px and up | The ☰ menu becomes the [menu rail](../components/menu-rail.md). A page is a card on the page colour. Groups sit side by side when there is room. |
| Wide | 1000px and up | As tablet, plus [two panes](../components/two-pane.md) on the list pages. |

A phone turned sideways is usually under 700px tall but over 700px wide, so it gets the tablet layout - the
rail folded to icons leaves the most room. There is no separate landscape-phone layout (ML-238: not worth
one; the play screen's side-by-side groups are what a sideways phone gains).

The installed app may turn with the device (`manifest.json`: `"orientation": "any"`).

**Media queries cannot read a token**, so `700px` and `1000px` are written as numbers in `style.css` and in
`app.js` (`RAIL_QUERY`, `PANES_QUERY`). Change one, change both, and this table.

## A page is one of five kinds

Don't lay a screen out one-off. Decide which kind it is:

| Kind | Examples | On a wide screen |
|---|---|---|
| Home | Home | Wide card (`--page-max-wide`). `.home-main` (greeting, numbers, Start a practice session) beside `.home-tools` (favourite tools). |
| List, then one thing | My music, Rehearse, Settings, My account, About | [Two panes](../components/two-pane.md): the list stays on the left, what you tap opens on the right (`--page-max-panes`). |
| Playing | Play a piece | Wide card. `.play-side` (the mini tuner, where you are, the controls) beside `.play-main` (the piece). |
| Steps and forms | Session set-up, Quick entry, Add a piece, My details, the tools | Narrow card (`--page-max-narrow`), centred. A wide form is harder to use, not easier. |
| Reading | Release history, results, the policies | Narrow card. Long lines are harder to read, more so with the dyslexia-friendly settings. |

A screen is **narrow unless it is listed as wide** in `style.css`
(`.container:has(> :is(#mainView, #flowPlayView):not(.hidden-group))`) or is a two-pane page. A new screen
therefore works on a tablet with no extra CSS; make it wide only when it has something to put in the room.

## Side by side without a breakpoint

Two groups that should sit side by side are wrapped (`.home-main` / `.home-tools`, `.play-side` /
`.play-main`). On a phone the wrappers are `display: contents` - not boxes at all, so the phone screen is
exactly what it was. From 700px up their parent is a grid:

```css
grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--pane-col-min)), 1fr));
```

so the two sit side by side when each can have its minimum width and stack when they can't - whether the
rail is open or folded, on its own or inside a pane. Don't add a breakpoint for this.

A grid of tiles fits as many as it can the same way: `repeat(auto-fill, minmax(var(--tile-col-min), 1fr))`.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--rail-width` | 256px | the menu rail, open |
| `--rail-width-folded` | 64px | the menu rail, folded to icons |
| `--rail-head-height` | 58px | the rail's head and the top bar line up |
| `--page-max-narrow` | 640px | a narrow page |
| `--page-max-wide` | 1080px | Home, playing |
| `--page-max-panes` | 1320px | a two-pane page |
| `--pane-list-width` | 320px | the list side of two panes |
| `--pane-col-min` | 320px | narrowest a side-by-side group gets before the two stack |
| `--play-col-min` | 380px | the same, for the play screen's two groups |
| `--tile-col-min` | 96px | narrowest a tool tile gets |
| `--stat-col-min` | 180px | narrowest a stat card gets on the Stats page |
| `--app-max-width` | 500px | the phone column - still used by things that stay phone-sized |

`--rail-w` is set on `body` (the open or folded width) and read by everything that has to keep clear of the
rail: the page's left margin, the bottom bar, the toast.

## Rules

- **The phone layout is never changed to suit a wide screen.** Wide rules live inside
  `@media (min-width: 700px)`. The phone-only tweaks are inside `@media (max-width: 699px)`.
- **Pop-ups don't change.** A pop-up is the same fixed width at every size.
- **Nothing is only reachable on one size.** The rail holds exactly what the ☰ menu holds; two panes show
  the same two screens a phone shows one after the other.
- **Touch targets stay 44px** on every size - a tablet is still touched.
- **The back-tests run at 500px wide** (`playwright.config.ts`), the phone layout. A spec for the wide layout
  sets its own viewport.
