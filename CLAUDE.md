# TheMusicLedger

Music practice tracking app, backed by Postgres (Neon) via an Express backend
(`server/`) and a static frontend (`public/`), deployed on Vercel. Google
Sheets is no longer used anywhere in the running app — `server/routes/api.js`
is 100% Postgres-backed (cut over to production 2026-09-09, release 0.6.0,
`ML-21`). `code.gs`/`server/config/google.js` are historical/removed; Google
OAuth is still used for login only (`server/config/passport.js`).

A full relational schema (accounts/bands/tutors, scores with sectioned
multi-bar metronome data per Jira `ML-35`, practice lists, sessions, scales,
technique exercises, challenges, and a monetization layer) is applied to all
three Neon branches (`production`/`sandbox`/`dev`). Beyond `sessions` and
`challenges`, `adhoc_metronome_setups`/`metronome_segments` (ad-hoc rows,
`parent_score_id` null) are wired up as **Quick Play's history** (`ML-34`), plus
`time_signature_options`/`account_time_signatures` and `playback_speed_options`,
behind `/api/metronome/*` and `/api/time-signatures*` in `server/routes/api.js`.
The old ad-hoc "Metronome Blocks" editor (`ML-35`) that also used those tables
was removed on 2026-09-27 (superseded by pieces in My music and Rehearse); its
rows stay in the tables. Headphone-delay calibration lives in Settings →
Metronome & playback. `scores` itself is now wired up too, as a **Flow**
(`ML-179` Phase 1 — see `docs/database-schema.md`'s "Flow" vs "Score" naming
note: the table stays `scores`, but the product concept/service file
(`server/services/flows.js`)/endpoints (`/api/flows/*`)/UI are "Flow"
throughout (on screen it is a "piece": the home tool **Rehearse** plays them and the ☰ menu's **My music**,
feature `flow_manage`, creates/imports/edits them - ML-299; the **Add a piece** tool, ML-400, is the way in to making one - who it's for, which practice list, create or import - `specs/components/add-piece.md`; **Quick entry**, ML-424, makes one from an outline by the bar numbers on the music - five stages (About, Structure, Time and speed, Extras, Media; ML-428) with one question a step for extras and media, saved as a whole piece without ever opening the edit screen - and cuts the same blocks itself: rules in `public/pieceOutline.js`, read `docs/quick-piece-entry.md` before changing it; feature `piece_quick_entry`; the **Prepare** tool, ML-401, lists the pieces not prepared yet and opens a piece's path, and a copy of a public piece keeps `scores.copied_from_score_id` so its take-up can be counted - `specs/components/prepare-list.md`), since a Flow is rhythm/structure only — "Score" is reserved for a
future feature that attaches real notation to the same piece). That covers
Flow metadata, recordings (`score_recordings`, mp3/mp4 via Vercel Blob or a
YouTube link), documents (`score_documents`, PDF/MusicXML/Sibelius/MuseScore
via Vercel Blob), and the three-way personal/band/admin-public ownership model
with fully-reversible transfer actions. Score-attached metronome blocks
(`parent_score_id` on `metronome_segments`) are wired up too, as a Flow's
blocks (ML-179 Phase 2 — `server/services/flowBlocks.js`, `/api/flows/:id/blocks`).
Flows move in and out of the app as **MusicXML** — one writer/reader pair used
by the admin panel's Flows page (export/import between environments),
"Import from MusicXML" and "Export to MusicXML" for
every user (feature-gated), and PDF/OMR import; read
[`docs/flow-musicxml.md`](docs/flow-musicxml.md) before touching any of them
(`ML-204`). The OMR service behind PDF import (solfascribe-omr, a third-party repo) has a repeatable security review - Admin → Security, with the write-up and verdict in [`docs/omr-security-review.md`](docs/omr-security-review.md) (`ML-192`); read it before touching `scoreImport.js`/`runOmr` or enabling `flow_import_from_file`. What a Flow plays, in what order and at what tempo (repeats, alternate endings, intro, jumps, Fine, ramps, fermatas/caesuras, stopping at the end), and where on the screen you are - plus Rehearse's repeat bars (`loopPlan`, ML-302) and the one-bar lead-in (ML-113) - all comes from the journey engine [`public/flowJourney.js`](public/flowJourney.js). Read [`docs/flow-journey.md`](docs/flow-journey.md) before touching Play Flow playback, the metronome player's sequence mode, the bar settings or the ML-248 consistency check. It's covered by `server/test/flowJourney.test.js` and back-test cases #12-17 (`ML-193`). The same engine holds the **practice Levels** maths (Level 1-5 speed %, session sub-beats, the 4:30 chunk length rule, the per-bar heat map; `piece_chunks`, `/api/flows/:id/levels`, feature `practice_levels`) for the practice session builder - epic `ML-314`, see the "Practice Levels" section of `docs/flow-journey.md` and `server/test/practiceLevels.test.js`. The **practice session builder** (ML-320: 5-minute blocks, Standard/Concert plans; ML-390 made it **three steps** - how long / pick a plan (or Build my plan) / what goes in - with Keep going, the **30-second rest** between blocks and its messages on Admin → Rest messages, and a piece's **path**: Prepare (run-through, paint the bars, cut into focus bits of 5 goes) → Practise to Level 4 → Play-through; "Start a practice session" on the home screen) keeps its rules in [`public/practicePlan.js`](public/practicePlan.js) (tests: `server/test/practicePlan.test.js`) and logs to `sessions` + `session_segments` (`/api/practice/*`). **Scales Levels** (ML-391: with the `scales_levels` switch on, a session's Scales block gives three scales, each at its own Level 1-5 - the notes slowly, faster, just the key, just the name, the name at ABRSM's speed - with Got it / Not yet; `PracticePlan.scale*`, `scale_levels`, tests `server/test/scaleLevels.test.js`) is in the same doc's "Scales Levels" section. **Practice lists** (ML-319: a concert's pieces, date, sessions a week; the readiness forecast `PracticePlan.forecast`; join-up groups as `piece_chunks` kind `group`) live on the Rehearse screen, behind `/api/practice/lists*` (`server/services/practiceLists.js`). How all of it fits together (sessions, your own templates, resuming a running session, practice lists incl. band lists, the forecast and **Skills lists**, ML-321) is in [`docs/practice-sessions.md`](docs/practice-sessions.md) - read it before changing any of it. **All music notation** (notes, clefs, key signatures, symbols) is drawn by [`public/notation.js`](public/notation.js) in the self-hosted **Bravura** font - never hand-drawn SVG or Unicode music characters. The Theory practice tool (quizzes, scoring, grades) is [`public/theoryEngine.js`](public/theoryEngine.js), which also builds the Scales practice tool's scales (ML-9, `specs/components/scales.md`); the Scales tool's list is the ABRSM Grade 1-8 brass and woodwind lists (plus Everything else) and the grade grid, in [`public/scaleGrades.js`](public/scaleGrades.js) - read [`docs/scales-grades.md`](docs/scales-grades.md) before changing a list or the placement rules (ML-357). The Warm-ups tool and its super-admin exercise editor are described in [`docs/warmups.md`](docs/warmups.md) (ML-294; the Scales layout, range locking and slurs ML-361). The drill tools - Tap tempo, Gap trainer and Ear (on screen Tempo, Pulse, Pitch; with Rhythm they open from the **Skills** tile and show their results as Levels like Theory, ML-406) - share one engine ([`public/drills.js`](public/drills.js)), one results table and screen; read [`docs/drills.md`](docs/drills.md) before changing a level or the scoring (ML-298/295/296). The **Rhythm** tool (word rhythms and the Takadimi crib sheet, tapped or played, speed Levels; feature `rhythm_trainer`, `public/rhythm.js`, rounds saved as drill rounds) is in [`docs/rhythm.md`](docs/rhythm.md) (ML-306). Read [`docs/theory-practice.md`](docs/theory-practice.md) before touching either (`ML-260`); its **Theory grades** (Grade 1-5 per quiz, feature `theory_grades`) are in [`docs/theory-grades.md`](docs/theory-grades.md). Each account's **instruments** (`instruments` meta table from `band_instruments_master_catalog.json`, `account_instruments`, `sessions.instrument_id` - practice time per instrument) are ML-309 A; each player's **comfortable range** per instrument and the home **Range** tool that stretches it a note at a time (feature `range_trainer`, `public/range.js`) are in [`docs/range.md`](docs/range.md) (ML-322/305); what's left of ML-309 (C, D, E) is handed over in [`docs/ml309-handover.md`](docs/ml309-handover.md). The **band directory** (kind, town, section, main band per band; checked area lists in `db/band-lists/`, turned into migrations by `scripts/band-seed-migration.mjs`) is in [`docs/band-directory.md`](docs/band-directory.md) - add an area with the **band-directory** skill, and never add a band that wasn't found on a real web page. **Display and reading** (ML-356: dark mode, dyslexia-friendly reading, reading font Lexend/OpenDyslexic, background colour, text size - saved on the account, applied as `html[data-*]` attributes that `tokens.css` switches, like dark mode) is in [`docs/display-and-reading.md`](docs/display-and-reading.md); third-party fonts and their licences are in the third-party register. **Third parties** (ML-267: every service, npm package, font, piece of outside content and build tool the app depends on, with its terms and what they ask of us) are in the register `server/thirdParties/register.js`, shown on Admin → Third parties and checked on release by `npm run third-party-audit` - read [`docs/third-party-providers.md`](docs/third-party-providers.md) before adding a package, an outside web address, a font or a service, and add it to the register in the same change. **Email + password login** (ML-355: invite-only, forgot/reset by email, "signed out everywhere" via `accounts.token_version`, email through `MAIL_PROVIDER` - `log` writes to `email_outbox` on dev) is behind the `password_login` feature's Live switch - read [`docs/password-login.md`](docs/password-login.md) before touching login, tokens or `server/middleware/auth.js`. **Delete my account** (ML-430: Account → My details; the row is anonymised in place so practice history survives as statistics, everything else the member made is deleted, and every device is signed out) is in [`docs/account-deletion.md`](docs/account-deletion.md) - read it before adding a table with an account column or changing what is kept, and keep it in step with the privacy policy. The main menu's **Invite someone** (ML-402: any member invites a Standard member, 5 a day, sees and cancels their own; feature `invite_members`) is in `specs/components/invite.md`. **Feature gates are per account type** (ML-345/346): `features.enabled` is Live (the master switch) and
`feature_access` says which account types (Standard, Premium, Beta tester, Teacher, Band admin; Super
admin always) have each feature - Admin → Feature access. A new feature is Super admin only until it's
switched on there. Read [`docs/feature-access-plan.md`](docs/feature-access-plan.md) before adding or
checking a gate. Back-tests: local-dev is a beta tester on dev; `/auth/login?as=standard` is a standard member.
The **home greeting** (your avatar - initials or one of 12 drawings in `public/avatars.js`, `accounts.avatar`; a greeting that follows the moment; one encouraging line picked at random, positive only - `public/homeGreeting.js`) and the **home layout** (Start a practice session, "My favourite tools" - up to four, chosen with "Choose favourite tools" (ML-412) - and the **All tools** page, `accounts.home_tools`, ML-378; **My stats** - numbers chosen on ☰ Stats, `accounts.home_stats`, how many by the `home_stats` limit, ML-387) are in [`docs/home-greeting.md`](docs/home-greeting.md) (ML-377/378/387). The in-app notification centre (red dot on ☰, admin announcements,
automatic "update available - reload" notice) is described in
[`docs/notifications.md`](docs/notifications.md) (`ML-201`). The rest of the schema (practice lists, scales, technique,
monetization) remains provisioned but not wired up to any endpoint. The full
history of the
Sheets→Postgres cutover (endpoint mapping, decisions, the real data migration)
is in [`docs/sheets-to-database-cutover.md`](docs/sheets-to-database-cutover.md)
— **read this before touching `server/routes/api.js` or account/tutor/
organisation resolution.**

Before working on data model, scores, sections, the metronome, practice lists,
sessions, or billing/subscriptions: read
[`docs/database-schema.md`](docs/database-schema.md) first — it has the full
table list, the reasoning behind each design decision, and the open questions
still unresolved.

The actual SQL migrations implementing that schema are in
[`db/migrations/`](db/migrations/), applied via `npm run migrate` (see
[`docs/migrations.md`](docs/migrations.md) for file order and the handful of
translation decisions — BIGINT IDENTITY PKs, polymorphic tables with no FK on
the polymorphic column, etc.).

The Neon project, its three branches (`production`/`sandbox`/`dev`), and how
`.env` maps to them are documented in
[`docs/environments.md`](docs/environments.md) — **read this before running
any migration or touching `DATABASE_URL`**, since which branch that variable
points at changes depending on what's checked out, and production should never
be touched by accident. This doc exists in the repo (not just Jira `ML-21`)
specifically so a Claude session without Jira access still has full context.

## Design system (ML-198)

**Before writing or modifying any UI code, read the relevant spec file in
[`specs/`](specs/README.md). Use only tokens from
[`public/tokens.css`](public/tokens.css). Run the token audit script
(`npm run token-audit`) before committing. Zero errors required.**

- `specs/foundations/` holds the rules per category (color, spacing, typography,
  radius, elevation, motion). `specs/components/` has one spec per component
  that exists. `specs/tokens/token-reference.md` is the master token map,
  generated by `npm run token-reference` (don't hand-edit it).
- `tokens.css` has three layers. Components (`style.css`, `admin.css`) may
  reference only the Layer 2 aliases, never a `--ds-*` primitive and never a
  raw hex/px/rem value. Dark mode is handled entirely in `tokens.css`
  (`body.dark-mode` remaps aliases), so a component never needs its own
  dark-mode colour.
- **No inline styles (ML-288).** No `style=""` (in HTML or JS-built markup)
  and no `el.style.x = ...` from JS - every style is a spec'd class, so a
  tablet/landscape/desktop layout or a new colour scheme can reach it. Use a
  utility (`.mt-4`, `.text-sm`...) or a component class; show/hide with
  `setShown` / `showModal` / `hideModal` (app.js). The one exception is a
  value only known at run time (a bar height, a drag offset): set it as a
  custom property that a class reads (`el.style.setProperty('--bar-h', ...)`).
  `npm run token-audit` fails on anything else. Details and the list of run-time
  properties: `specs/components/utilities-and-states.md`.
- **One button, one pop-up (owner rule, ML-400).** A choice from a set of options is one button
  showing the current answer that opens a pop-up to change it (`openFlowChoiceModal`, or a pick
  list for multi-select) - never the whole list of options laid out on the page. Navigation
  buttons and a yes/no pair are the exceptions. The button is the existing value box
  (`.metroBlk-ctrl-value-btn`: the answer over what it is) - no new picker styles. Start every new
  screen this way; see `specs/README.md` ("One button, one pop-up").
- **Every pop-up closes the same three ways (owner rule, ML-400).** A `.modal` has `.modal-close-x` top
  right (as well as any Cancel; it only closes - `data-modal-x` if it has no close code of its own), and
  closes on a tap on the backdrop and on Escape. Those two are automatic (`public/a11y.js`) - never wire
  them per pop-up. A pop-up with a form showing (a field to type or pick into) ignores the backdrop tap -
  also automatic - so a stray tap can't lose an entry; `data-no-dismiss` does the same for a must-answer
  pop-up (owner's say-so).
- If no token fits, add a Layer 2 alias (with a usage comment) to
  `tokens.css` and re-run `npm run token-reference`. Don't reach for a raw value.
- **Admin → Design** (`public/admin-design.js`) renders every component spec
  with its tokens annotated. A new component needs a spec *and* an entry
  there, or it can't be released.
- **Dev → sandbox design gate**: pushing to `sandbox` runs
  `npm run design-gate`. Anything new to the design system (classes, tokens,
  specs) must be shown to the product owner and explicitly approved before pushing with
  `DESIGN_APPROVED=1`. Never approve it on their behalf. **Always send pictures with the
  request.** `npm run design-signoff` screenshots the "Only what's new" view on Admin → Design,
  where every example that uses a new class is marked NEW, into `design-signoff/`. Send those
  screenshots in the chat. Full process is in
  `docs/release-process.md` ("Dev → sandbox: design gate").
- **Accessibility (ML-210): WCAG 2.2 AA in both themes + 44px touch targets.**
  Read `specs/foundations/accessibility.md` and the component spec's
  "## 9. Accessibility" section before building UI. `npm run a11y-audit` must
  report 0 new violations (it runs inside the design gate). Never use a fill
  hue (`--primary-action`, `--danger-color`, `--cat-*`...) as a text colour -
  use its `-text` variant. Anything clickable is a `<button>`; new colour
  pairs go in `specs/accessibility/contrast-pairs.json`, new swipe/drag
  gestures in `specs/accessibility/gestures.json`. Shared keyboard/dialog/
  menu behaviour lives in `public/a11y.js`. Sandbox releases also run
  `npm run a11y-scan` (axe-core) and the manual checklist in
  `docs/release-process.md`.
- `tokens.css` is loaded before `style.css` on every page and is in the
  service worker's app shell (`public/sw.js`). Keep both in step if you add
  a stylesheet.

## Releases

**Before pushing to `main`**, read [`docs/release-process.md`](docs/release-process.md).
Pushing to `main` deploys straight to production. A `pre-push` hook
(`.husky/pre-push`) blocks the push unless `package.json`'s version changed and
`public/releases.json` documents it — cut a release properly with
`npm run cut-release -- <version> <ISSUE-1> [...]` then `npm run sync-releases`
rather than trying to work around the hook. It exists because a push went out
on 2026-09-08 with no version bump and no release notes at all.

**Sandbox must always match production.** Release with
`git push --atomic origin main main:sandbox`, never `main` alone. The hook blocks a
push to `main` whose code differs from `origin/sandbox` (apart from the release
commit's `package.json`/`public/releases.json`), and a push to `sandbox` that's
missing anything already on `origin/main`. See "Sandbox = production parity" in
`docs/release-process.md`.
