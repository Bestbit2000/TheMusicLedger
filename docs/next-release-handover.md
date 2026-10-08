# Handover: after release 0.51.0

**0.51.0 went to production and sandbox on 8 October 2026** (commit ca3c13b): ML-487, ML-456, the rehearsal score (ML-312, ML-488, ML-489), ML-278, ML-490, and Vercel on Pro with its spend reader. Migrations 115 to 120 are on all three databases. An Important notice was published on production. Everything below that says "not committed" or "not released" about those is now out.

**Next:** (1) the Recordings tool stays Super admin only until the privacy policy's "Young players" part has its line about recordings - his wording; then switch on `rehearsal_recordings` and `recording_clip` for every account type (`docs/rehearsal-score.md`, "The Children's Code check"). (2) He adds `VERCEL_API_TOKEN` in Vercel. (3) ML-381's sub-tasks ML-492 to ML-497 and ML-501, as a release of their own - his answers are in a comment on ML-381.

*The rest of this file was written after 0.50.0.*

Written 7 October 2026. **Start here.** Replace this file with the next handover when there is one.

## Where things stand

**0.50.0 (ML-486, the content security policy switched on) followed 0.49.0 the same evening.**

**0.49.0 went to production and sandbox on 7 October 2026**: ML-239, ML-480, ML-481, ML-482, ML-483, ML-484.
No migrations. The owner signed off the design (the layout, the brand mark and the timer pop-up) in the chat
that day, and said no notice to members was needed.

| Ticket | What |
|---|---|
| ML-239 | Tablet and desktop: the menu rail (starts open, folds to icons), a page as a narrow or wide card, Home and the play screen side by side, two panes on the list pages. `specs/foundations/layout.md` |
| ML-484 | Trying out a new name: Admin → App name switches the name on screen between The Music Ledger, Notably Better and Fivetto. `docs/brand-trial.md` |
| ML-481 | The timer pop-up shows the Timer screen's ring above its controls, so a time over an hour fits |
| ML-480 | Download my information leaves out what a super admin entered for the app, the people a member invited, and the app's own workings. `docs/account-deletion.md` |
| ML-482 | Privacy policy: "change my email" is on for everyone. GDPR assessment version 3: 15 gaps closed, 6 open |
| ML-483 | Resend taken out (never used; he wants an email provider based in Europe) |
| (ML-474) | The editor's YouTube preview uses the privacy-enhanced player; the security policy allows YouTube's player script |

Checked before release: back-tests 60 of 60 (run 91), the axe scan 64 of 64 (run at 1280px, so in the wide
layout), token audit, accessibility audit, design gate, third-party audit, the server's unit tests.

## Next, with the owner

- **The content security policy is on (0.50.0, ML-486, 7 Oct 2026).** Enforced on the pages (`vercel.json`) and the
  server's answers (`CSP_ENFORCE=true` in Vercel for production and sandbox). A new outside address the app loads or
  connects to must be added to `server/middleware/securityHeaders.js` and `npm run sync-vercel-headers -- --enforce`
  run, or it will be blocked. On sandbox the console always shows two `manifest.json` lines - Vercel's sign-in wall.
- **The name.** Production is on `music-ledger` until he switches it on Admin → App name. Dev was left on
  whatever he last chose (Fivetto when this was written). Emails keep the old name, so his wife will meet
  both. He is choosing in another chat, which also draws the artwork in `brand-trials/` on whatever branch
  is checked out - **commit by file name, never `git add -A`.**
- **GDPR, four gaps open (17 of 21 closed):** Google sign-in's safeguard on its card (no Workspace needed),
  an email provider with an agreement and retention switched on (both wait on a domain name), and sign-up
  emails in his inbox. **Vercel is on Pro since 7 Oct 2026**, so its agreement is in place; the register
  (`server/thirdParties/services.js`) says so, not yet released. He still has to record it on production's
  Admin → Third parties (Vercel and Vercel Blob: in place, "the UK addendum in its agreement").
- **Vercel's usage is read from its bill** (built 7 Oct 2026, not released): one meter in dollars against the
  $20 Pro includes, and "Where Vercel's usage is going" under it - use and cost per service, where each is
  heading, and for each member. Migration 115 (`third_party_usage_lines`), applied to dev only. **It has never
  run against Vercel**: he has to make a token and set `VERCEL_API_TOKEN` in Vercel; the first Read now is the
  test (`docs/third-party-providers.md`, "Costs and usage"). Check the billing day on Vercel → Billing (7 is
  assumed).

- **Built 7 Oct 2026 after 0.50.0, not committed or released:**
  - **ML-487** (bug): a video or recording playing on the editor's Media tab stops when the editor is left
    (`stopFlowEditorMedia` in `app.js`, called where `switchView` leaves the editor). Back-test 61.
  - **ML-456**: MuseScore files (.mscz, .mscx) are accepted as a piece's score or part - the two file
    pickers and their wording. Nothing on the server changed: an unknown file type already went up the
    same way a Sibelius file does.
  - **The rehearsal score - ML-312 (A), ML-488 (C), ML-489 (B)**: built overnight 7-8 Oct at his say-so, in
    that order. A recording or video on a piece has a start and end; the piece's bars are mapped onto it
    (repeat bars, start from a bar, play slower); the Recordings tool holds a whole rehearsal and gives it
    to pieces. **Read `docs/rehearsal-score.md`** - it has what was built, his decisions, and the list of
    what is still to do before members get it. In short:
    - three features, all **Super admin only**; migrations 116, 117, 118 on **dev only**;
    - no new CSS classes, but a new spec (`rehearsal-score.md`), so the design gate wants his sign-off -
      the pictures are `signoff-pictures/ml312-*`, `ml488-*`, `ml489-*`;
    - **the privacy policy was not touched** (his wording) and the Children's Code check is not done:
      both are needed before the Recordings tool is switched on for anyone but him;
    - never tried on a real phone, with a big file, or with a real YouTube video;
    - back-tests 62, 63, 64; they upload a small file to the dev file store and delete it.
  - **His answers on 8 Oct, built the same day:** Standard keeps 5 recordings, the rest 20; the bar tiles
    light up for a recording and the playing tile is kept in view (the metronome too); "Delete this list's
    recordings" on a practice list; My music's "With a recording" filter; rest bars stay metronome-only.
    Mapping a band's piece is for organisers and members an organiser has let change the band's music -
    how it already worked; he was asked to confirm that reading.
  - **ML-278**: before a first upload of music a member confirms, once, that they have the right to upload
    it; the day is kept (migration 119, dev only). **This one is for every member, not behind a switch**, so
    it needs the privacy policy to name the date before release, and a decision on whether members need
    telling. A draft of the policy wording was given to him in the chat on 8 Oct - not put in the page.
    Back-test 65.
  - **ML-490** (8 Oct, his ask): Admin → Content → Recordings - find any recording held and remove it on
    request in one action: off every piece, the file deleted, the people it belonged to told by an urgent
    notification only they see and by email, and a record kept. Notifications can now go to named members
    (migration 120, dev only). Back-test 66.
  - **The privacy policy and terms were changed on 8 Oct** with wording he agreed in the chat. "Why we hold it" has the reason for the upload date too.

## ML-239: what is and isn't done

- Done: the frame (rail, cards), Home, playing a piece, two panes for Rehearse, My music, Settings, My account
  and About. Every other screen is a narrow centred card - it works, but has no wide design of its own.
- **Not done by hand:** the keyboard and screen-reader walk-through of the release checklist, and a look on
  a real tablet. Everything was checked in a test browser at 390, 820, 1180 and 1440px.
- Later, kind by kind, if he wants them: the tools (Metronome, Tuner, Scales, Warm-ups) and the piece editor
  using the width; Practice lists as two panes; Stats as a wider dashboard.
- ML-238 (a phone on its side) is still open: no layout of its own was the agreed answer; it gets the tablet
  layout with the rail folded. He has not said to close the ticket.
- The rail is 256px wide: "The Music Ledger" has to fit beside the mark.
- **The back-tests run at 500px wide** (`playwright.config.ts`) - the phone layout. Cases 9 and 21 set a
  desktop window before opening the admin panel. Case 58 is the wide layout, 59 the name on screen (it puts
  the setting back), 60 the timer pop-up (it clears the timer it starts).

## Left over from before - all with the owner

- The notice for ML-478 ("My bands has changed") was agreed but never published; with one member signed in
  he may not want it now.
- "Upgrade now" on the SmartLearn prompt: "Ask to upgrade" would be truer (ML-471). Not decided.
- Take `dropGoogleKeys` out of `server/middleware/auth.js` after 6 November 2026.
- The monthly site security review is due about 6 November 2026.
- Real costs and his business plan on production; Gitleaks over the history.

## Things to know

- Other people have accounts on production: his wife and his band's conductor, and his teacher has access.
  Nobody further should be invited until the email provider has an agreement (Vercel's is in place).
- The five compliance documents: he keeps his own copies. **Never overwrite them** - a redraft is a new
  dated file, with no ICO number in it.
- `npm run design-signoff` empties the whole `design-signoff/` folder first - keep nothing else in it.
- A back-test run fails now and then when a server file is saved mid-run (the local server restarts and a
  test sees "You are offline"). Re-run the case.
- An edit to `public/index.html` made by cutting between two markers once removed the line that loads
  `brand.js` and the page's card (7 Oct 2026, caught the same hour). After editing that file by position,
  check `git diff` touches only what was meant.
- PostHog's console warning about `persistence: 'memory'` is expected: no ID is kept on the device, by
  design. Its suggested fixes would break "anonymous and cookieless".
- A production migration: get the connection string with
  `neon connection-string production --project-id little-haze-42527245` into a shell variable (never
  printed), trial the pending files in one rolled-back transaction, then `DATABASE_URL="$P" node db/migrate.js`.

## How this owner works (the short version)

- Plain English, UK spelling; short sentences; no jargon in what he reads.
- Commit when asked; **never push or release without being asked**. Releases: `docs/release-process.md`.
- New styling needs his sign-off **with pictures sent as files**, each item explicitly.
- Privacy policy wording is his. Draft it, quote it, wait.
- A browser test must never Save, Reset or delete real rows on dev - he uses dev himself.
- Never write his ICO security number anywhere.
