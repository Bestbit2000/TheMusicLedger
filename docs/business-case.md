# Business case (ML-443)

**Admin → Business case** works out what each way of rolling the app out costs and could earn, month by
month for up to five years, and when - or whether - the money comes back. The owner changes any figure
and everything redraws; changes are kept when he presses Save. Read this before changing the sums, the
starting figures or the page.

It is a model to help the owner decide. It is not legal, tax or financial advice, and the page says so.

## Where things are

| What | Where |
|---|---|
| The sums (pure, no DOM, no database) | [`public/businessCase.js`](../public/businessCase.js) - `window.BusinessCase` |
| Their tests | `server/test/businessCase.test.js` (every expected figure is worked out by hand in the test) |
| The page | [`public/admin-business.js`](../public/admin-business.js), the section and pop-ups in `public/admin.html`, styles in `public/admin.css` (`.admin-bc-*`) |
| The design spec | [`specs/components/admin-business-case.md`](../specs/components/admin-business-case.md) |
| The starting plan | [`server/services/businessCaseDefaults.js`](../server/services/businessCaseDefaults.js) |
| Loading and saving | [`server/services/businessCase.js`](../server/services/businessCase.js), `GET` / `PUT /api/admin/business-case`, `POST /api/admin/business-case/reset` (super admins only) |
| Storage | `business_plans` (`102_business_case.sql`) - one row, the whole plan as JSON |

The sums run **in the browser**, so a changed figure redraws at once. The server loads the same file with
`vm` (as `restMessages.js` loads `practicePlan.js`) to tidy and check a plan before it is saved, so the
page, the server and the tests run one piece of code.

`admin.js` hands the page what it needs through `window.AdminPanel` (`apiCall`, `showToast`, the pop-up and
row-menu helpers) - the page lives in its own file, like Admin → Design.

## The plan

One document:

- **Settings:** the month building started (`buildStart`), the launch month, how many years to look at
  (1-5), and the dollar rate.
- **Costs** - a price list shared by every scenario. Each cost has an amount in pounds or dollars; is paid
  every month, every year or once; starts so many months after launch or in a set calendar month; and may
  stop. It can be a fixed amount or so much **for each member above a number**, and can **wait until there
  are enough members**. Each says what its figure rests on (`basis`): being paid now, a published price, an
  estimate, or the owner's own figure. A cost keeps its starting figure (`start`), so a changed one shows
  what it was and can be put back.
- **Scenarios** - each says how many members there are at launch and at the end of each year (a straight
  line in between), which costs it includes, a tax rate, and what it earns.
- **Usage** and **fees** - how the database cost is worked out, and what is taken from each payment.

Changing a cost changes it in every scenario; a scenario only chooses which costs it includes. To model a
different choice (Claude Pro or Max after launch), there are two costs and each scenario switches on one.

The four starting scenarios are only a start. The owner can **rename** any of them, **add** as many more as
he likes (**+ Add a scenario** beside the tabs - empty, or a copy of one he picks; **Copy** on a scenario's
own page), put them in a different order (⋮ → Move earlier / Move later) and delete them (never the last
one). Every scenario is a line on the chart, a card and a row in the comparison table, so "Premium" can be
set beside "Premium with teacher plans" - copy it, switch the teacher plans on, change the member numbers.
Two scenarios can't share a name. A scenario's id is made from its first name and stays when it is renamed.

`BusinessCase.tidy(plan)` puts a plan into a shape that is safe to store and to work out - numbers within
bounds, text a sensible length, ids unique, only `https://` source links - and refuses one it can't mend.
The server runs every save, and every load, through it.

## The rules

- **Months.** Everything is worked out a month at a time from the first month of building to the last
  month of the plan. Year 1 is the twelve months from launch.
- **Cash and revenue basis.** *Cash* counts money in the month it moves. *Revenue basis* spreads a yearly
  payment over the twelve months it covers, so a yearly fee, or a yearly membership, counts a twelfth each
  month. One-off costs count in the month they are paid either way.
- **Members** follow a straight line through each year, from the number at launch to the number typed for
  the end of year 1, then to the end of year 2, and so on. Nobody is a member before launch.
- **The database** (Neon) is the one cost worked out rather than typed. It is billed for the hours it is
  awake, and it stays awake while anyone has the app on screen, so visits overlap: the share of the day it
  is awake is `1 - (1 - visit / day) ^ visits`. It is free while the month's hours stay inside the
  allowance, then every hour is paid for. The share of members opening the app on a day and the minutes a
  visit keeps it awake are guesses until members are using it.
- **Premium.** The paying share is the share of members who are paying *at any one time*. A monthly plan
  is paid every month. A yearly plan is paid when it is bought and again each year after - by the same
  member or by whoever replaced them - so renewals need no figure of their own. Fees come off each
  payment: by card, a percentage and a fixed fee; through the app stores, VAT first and then the store's
  commission.
- **Other income** is a number of payers each year at so much each (band licences, teacher plans, paid
  listings, a sponsor, anything the owner adds), plus gifts (a share of members giving so much a year) and
  adverts (kept for comparison). Income paid yearly is counted a twelfth a month.
- **Tax on profit** is worked out a year at a time on the revenue basis, after the losses of earlier years
  - and what was spent before launch - are used up, and is paid nine months after the year. Tax on the last
  year's profit falls due after the plan ends and is reported separately.
- **Payback** is the month the running total, counted from the first month of building, gets back to
  nought. If it isn't back by the end, the page says how far short it is and, when the last year made
  money, how many more years that rate would take. `shareToPayBack` answers "what would it take": the
  paying share that would have the money back by the end, everything else unchanged.
- **The running cost a month** is what the last month of the plan costs: yearly costs as a twelfth,
  one-offs left out. The paying members needed are that cost, less other income, divided by what one
  payer brings after fees.

What the sums leave out, on purpose: the owner's time, price rises, VAT (the page warns when sales in any
twelve months near the £90,000 threshold), and members leaving faster than they join.

## The starting plan

Four scenarios, from ML-443: **Only me**, **Invite only**, **Free to anyone** and **Premium**. The prices
were read on each provider's or regulator's own page on 4-5 October 2026 (`CHECKED_ON` in the defaults
file). Each cost carries the link it was read from; those hosts are in the third-party register's
`notDependencies`, because they are links, not things the app depends on.

Worth knowing about the figures:

- **Claude** is priced in pounds with VAT for a UK subscriber (Max 5x £90, Pro £18 a month). **Vercel Pro**
  is $20 plus UK VAT. Other dollar prices are as published; whether Neon adds VAT was not confirmed.
- **Vercel Pro is in "Invite only"**, not just the paid scenarios: Vercel's data processing agreement
  covers only its paid plans. It is the owner's decision; switching it off shows the bare cost.
- **A domain is in "Invite only"**: without one the app's email can only come from a Gmail account. (The app has had one, notablybetter.com, since October 2026.)
- **Estimates**, marked as such on the page: a solicitor's read of the terms, the domain, a server for PDF
  import, paid uptime checks, and the 3,000 members at which a paid email plan is assumed to start (no provider is chosen yet).
- **Placeholders:** the member numbers for years 2 to 5, and the counts for other income. They are there
  to be typed over.
- **Not confirmed** when the figures were read: Apple's price in pounds, the pound price of Claude Max
  (20x), whether an insurer covers a service holding under-18s' recordings, and the start day of the new
  subscription rules.

The research behind them, with every source, is the ML-443 proposal (published as an artifact on
5 October 2026).

### Re-checking a price

Change the figure in `businessCaseDefaults.js` and move `CHECKED_ON`. That changes the starting plan only.
A plan the owner has saved keeps its own figures - that is the point of saving - so tell him what moved;
"Back to the starting figures" on the Overview brings the new starting plan in, at the cost of his changes.

## What the page shows that is real

The Overview's **Today** tiles are read, not forecast: members (accounts that aren't deleted), what has
been spent and what is running (Costs and usage, ML-429), and how full the database's free allowance is
(the latest `neon-compute` reading). Each is left out if it can't be read.

## Limits (ML-443)

The **Limits** tab answers "how many members can the free plans carry?" from measurements instead of guesses.
It takes every plan limit on Costs and usage (ML-429) with its latest reading, and today's member count:

- **One member uses** = what is used ÷ today's members. A monthly limit is judged on what it is **on course
  for** by the end of the month, not what it has reached so far.
- **Members that fit** = the limit ÷ one member's share. The limit with the fewest is marked **Goes first**.
- Today's use includes the owner's own building and testing, so a member's share is overstated and the real
  number that fit is higher. The page says so. It sharpens as real members arrive.
- A limit with no reading shows none, never a guess.

**The step up.** A limit can be linked to the cost that starts when it is reached (`cost.meter` = the usage
meter's key). **Use N** sets that cost's
"wait until there are this many members" to the number the reading says fit, in every scenario that includes
it. It is a change like any other: it waits in the Save bar. It is one press, not automatic, so a forecast
never moves without the owner seeing it. Sums: `BusinessCase.limits(meters, members)`.

## Actual v forecast (ML-443)

The **Actual v forecast** tab is a row a month (`business_actuals`, migration 103): members and money paid
out, beside what the plan forecast.

- **Actual** - members are counted from accounts; paid out is the payments on Costs and usage that fell in the
  month (`paidInMonth` in `server/thirdParties/costs.js`). The current month is brought up to date every day
  by the daily job (`/api/cron/usage-readings`) and whenever the business case is opened, so a month ends up
  as it stood on its last day.
- **Forecast** - written **once**, the first time a month is recorded, from the scenario marked "where I am
  now", and never changed. Editing the plan later can't hide how far out it was.
- Money coming in isn't in the table yet: there are no payments to count. It joins when Premium is sold.
- Code: `server/services/businessActuals.js`. The page only reads it.

## Copying the plan between environments (ML-461)

Each environment (dev, sandbox, production) keeps its own plan in its own database. To take one across, the
Overview has two buttons beside "Back to the starting figures":

- **Save a copy to a file** downloads the plan on the page (unsaved changes included) as
  `business-plan-<site>-<date>.json`.
- **Load a plan from a file** reads such a file on the other site and puts its plan on the page. It is checked
  and tidied exactly as a save is (`BusinessCase.fromFile` → `tidy`). **Nothing is kept until Save** is
  pressed; Discard brings the old plan back.

The file holds the plan only - settings, costs, scenarios. Members, usage readings and the actual v forecast
months are not in it: they belong to each environment. A file that isn't a business plan is refused with a
message and the plan on the page is left alone. It all happens in the browser; the server only ever sees the
ordinary Save.

## Still open

Everything in the ML-443 proposal is built (the menu groups and the Dashboard are in
`specs/components/admin-shell.md`). `business_plans` can hold more than one row, for kept copies of a plan, when that is wanted.
