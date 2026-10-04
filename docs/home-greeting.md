# Home screen: greeting and layout (ML-377, ML-378, ML-387)

## Layout (ML-378)

Home is short on purpose - one clear action, a few tools, everything else a tap away:

1. The **greeting** (below) - avatar, greeting, one encouraging line.
1. **My stats** (ML-387) - numbers you chose on the Stats page (see below). Hidden until you've logged something.
2. **Start a practice session** - the one gold button (or Start a challenge, when practice sessions are off).
3. **Log time you've already played** - a link (`.btn-text`) to Add session time, not a second button.
4. **My favourite tools** (ML-412 - it was "My tools"), **4 for Standard, 8 for everyone else** (the `home_tools` limit on Admin → Feature access, ML-388 - four to a row, so 8 is two rows), copies of the All tools tiles (`renderHomeTools`),
   in **your** order. Until you choose your own, the default follows what your account type has switched on:
   **no more tools than fit → all of them** (e.g. a Standard member's), **more → the Everyday ones (Metronome,
   Tuner, Timer) plus Rehearse** (`homeToolsDefault`) - so the metronome is always one tap away.
   Only tools switched on for the account show (a favourite that's off for now stays chosen).
5. **All tools** - a row that opens the All tools page, with the other tools named under it.

No fixed Progress cards on Home any more: the greeting line gives one number that matters, ☰ Stats has them all, and
you choose which of them sit on Home (My stats, below).

## My stats (ML-387)

Stat cards between the greeting and Start a practice session - **numbers only** (owner, 2026-09-30: a bar or
chart means little without a target; targets come later). Two to a row, up to the account type's `home_stats`
limit (Admin → Feature access, Limits: **Standard 2, everyone else 4** - migration 086). The greeting line stays.

- **Chosen on ☰ Stats** (`statsHomeView`): every stat is a card there, in groups - Practice time (this week,
  this month, this year - or this practice year when that's on), Streaks (current, longest), Sessions (this week,
  this month), Concerts (days to the nearest practice list with a date, `practice_levels`), Tools (last Theory Level,
  `theory_practice`; tools last played). A card whose feature is off is hidden. ★ marks the ones on Home.
- **Choose Home stats** works exactly like Choose favourite tools: tap cards to add or take off ("Home holds 2 stats -
  take one off first"), a pinned **My Home screen** card shows them in Home's order - tap one for Move earlier /
  Move later / Take off Home (the same `#homeToolMenu`) - and Done.
- **Default:** Practice time this week and Current practice streak. **Hidden** until the player has logged a
  session, so a new player never sees a row of zeros.
- Tapping a Home stat opens its full page, as on the Stats page. Weeks start on Monday, as everywhere else.
- Saved on the account: `accounts.home_stats` (migration 086, null = the default), `PUT /api/account { homeStats }`,
  checked against `HOME_STAT_IDS` in server/services/accounts.js. Past the limit, choices are kept, just not shown.
- Code: `renderStatsHome` (fills every card), `renderHomeStats` (Home's copies), `renderStatStars` (choosing) in
  public/app.js; styles in `specs/components/stat-card.md`; `server/test/homeStats.test.js` keeps the cards, the
  server's list, the defaults and the seeded limits in step.

**All tools** (`toolsView`) - every tool, in groups: **Everyday** (Metronome, Tuner, Timer) · **My routine**
(Warm-ups, Scales) · **Practise** (ML-409: a piece's three tools, in order - **Add a piece**, ML-400, **Prepare**, ML-401, **Rehearse** - `specs/components/add-piece.md`, `prepare-list.md`) · **Learn**
(Theory, Skills, Range - ML-406: **Skills** is one tile that lists Pitch, Tempo, Pulse and Rhythm, as Theory lists
its quizzes; anyone who had one of the four on Home got Skills there instead, migration 091). A ★ marks the ones on Home.
**Choose favourite tools** (ML-412 - the tools on Home are called favourites on screen; a quiet text link under the groups, ML-408) turns the tiles into toggles (tap to add or take off, up to your limit - "You can have 4
favourite tools"), **Done** to finish. **Order:** Home shows them in your order - a new one goes at the end - and while
choosing, a boxed **"My favourite tools"** card - pinned under the top bar as you scroll, with the "3 of 4 favourites"
line under it, and **Done** pinned to the bottom - shows them as Home will: tap one for **Move earlier / Move
later / Remove from favourites** (← / → from the keyboard). Tap-to-move, not drag: four tiles need a tap or two, and a
hold-to-drag would fight scrolling and still need this as its accessible alternative. Saved on the account: `accounts.home_tools` (migration 080, null = the default
above), `PUT /api/account { homeTools }`, checked against `HOME_TOOL_IDS` in server/services/accounts.js. The
☰ menu's Tools rows are built from the same groups. `server/test/homeTools.test.js` keeps the tiles, the
server's list, the routine's order and the defaults in step.

Why (the ML-378 review): 12 tools and 4 cards made the page long and every choice look equal (Hick's law);
"Add session time" looked like a tool; the routine was out of order; the Progress cards repeated the greeting
and showed a new player four zeros; and the ☰ menu already listed every tool.


The top of the home screen: your **avatar**, a **greeting that follows the moment**, and **one line of
encouragement** under it, just before "Start a practice session". Owner decisions, 2026-09-30.

- Rules: [`public/homeGreeting.js`](../public/homeGreeting.js) (pure, no DOM), tested by
  `server/test/homeGreeting.test.js`.
- Avatars: [`public/avatars.js`](../public/avatars.js), tested by `server/test/avatars.test.js`.
- Screen: `renderHomeGreeting`, `loadHomeExtras` and the avatar picker in `public/app.js`.
- Styles: `specs/components/avatar.md` and `specs/components/home-greeting.md`.

## Avatar

- **Default: your initials.** The first letters of first name and surname ("AS"); one name gives one
  letter; with neither, the display name's first letter, then the email's.
- **Or a drawing**, chosen in My account → My details → Avatar (the *Choose an avatar* pop-up):
  Initials, cornet, euphonium, trombone, French horn, saxophone, clarinet, flute, snare drum, metronome,
  music stand, tuning fork, headphones. **No photos.** Tapping one saves it straight away.
- Stored in `accounts.avatar` (migration 079, null = initials). `PUT /api/account { avatar }` checks it
  against `AVATAR_IDS` in `server/services/accounts.js`. That list and `Avatars.LIST` must match; the
  avatars test checks this. Adding a drawing needs no migration.
- The home screen's avatar is a button: tapping it opens My details.

## The greeting

Worked out on every render, first that applies:

| When | Greeting |
|---|---|
| You've logged a session today | Nice work today Andrew |
| 10pm to 4am | Burning the midnight oil, Andrew? |
| 3 or more days since your last session | Welcome back Andrew |
| Saturday or Sunday | Happy Saturday Andrew |
| Otherwise | Good morning / afternoon / evening Andrew, or on 1 visit in 3, "Ready to practise, Andrew?" |

No comma between "Hi"/"Good morning" and the name (owner). The name is the display name, else the
first name; with neither, the whole row is hidden.

## The line under it

**One line, positive only, never "you haven't practised".** It's picked at random from everything true
right now, and stays the same while it's still true (so it doesn't change under you). It's worked out once
the sessions have loaded and, for features that are on, the extras have too.

| Line | When it's offered |
|---|---|
| You're on a 3-day streak | 2+ days of Practise in a row (counted from yesterday until today's logged) |
| Your longest streak yet - 4 days / 2 more days to beat your best streak of 12 | a current streak that is the record, or within 3 days of it |
| 4h 20m practised this month | any time logged this calendar month |
| On track for 12h this month | the Stats page's projection (so far x days in the month / days gone) - **only while Settings → Stats → "Show this month's projection" is on**, from the 3rd to the second-last day |
| 3 sessions this week | any session since Monday |
| Last practised yesterday - on B♭ Euphonium | your last session was today or yesterday |
| 38h so far this practice year | the practice year is switched on, and it's an hour or more |
| Spring concert in 12 days | `practice_levels`: the nearest practice list with a date still to come, within 90 days |
| About 3 blocks a day to be ready for Spring concert | the same list's forecast (`PracticePlan.forecast`) |
| 2 passages at Level 5 | `practice_levels`: chunks at Level 5 |
| C♯6 is at Level 3 - keep stretching | `range_trainer`: the note above your range on your main instrument, once it has a Level |
| Your first session starts here | a new player with nothing logged - the only line then |

Not included (owner's call): "projected hours available" (there's no such setting) and birthdays
(not stored).

The extras (concert, pace, Level 5s, range note) are loaded once per visit, only for features that are
on (`loadHomeExtras`). A failed request just leaves that line out.
