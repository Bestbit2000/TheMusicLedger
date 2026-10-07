# Handover: release 0.49.0 is built and waits for the owner's check

Written 7 October 2026. **Start here.** Replace this file with the next handover when there is one.

## Where things stand

**0.48.0 is on production and sandbox** (commit `94c0d8d`). Branch `after-0.48.0` (local, not pushed) holds
what is to go out as **0.49.0**. The owner has agreed the version, signed off the design (7 Oct 2026) and
said no notice to members is needed. **He wants to check it himself before it is released - do not cut
the release or push until he says so.**

What is in it:

| Ticket | What |
|---|---|
| ML-239 | Tablet and desktop: the menu rail, a page as a narrow or wide card, Home and the play screen side by side, two panes on the list pages. `specs/foundations/layout.md` |
| ML-482 | Privacy policy: "change my email" is on for everyone, so the "where it is switched on" phrase is gone. GDPR assessment version 3 (`docs/gdpr-assessment.md`): 15 gaps closed, 6 open |
| ML-483 | Resend taken out (never used; he wants an email provider based in Europe) |
| ML-484 | Trying out a new name: Admin → App name switches the name on screen between The Music Ledger, Notably Better and Fivetto (sign-in picture, name and mark, browser tab). `docs/brand-trial.md`. The design gate lists its one new class, `.brand-mark` - **not yet signed off** |

No migrations. Checked on 7 Oct 2026: back-tests 59 of 59 (run 89), the axe scan 64 of 64 (run at 1280px, so
in the wide layout), token audit, accessibility audit, design gate hard checks, third-party audit and the
server's unit tests.

To release once he says so: `npm run cut-release -- 0.49.0 ML-239 ML-482 ML-483 ML-484`, `npm run sync-releases`,
commit, then `DESIGN_APPROVED=1 git push --atomic origin after-0.48.0:main after-0.48.0:sandbox` (his
approval of the design was given in the chat on 7 Oct 2026). `docs/release-process.md` has the steps.

## ML-239: what is and isn't done

- Done: the frame (rail, cards), Home, playing a piece, two panes for Rehearse, My music, Settings, My account
  and About. Every other screen is a narrow centred card - it works, but has no wide design of its own.
- **Not done by hand:** the keyboard and screen-reader walk-through of the release checklist, and a look on
  a real tablet. Everything was checked in a test browser at 390, 820, 1180 and 1440px.
- Later, kind by kind, if he wants them: the tools (Metronome, Tuner, Scales, Warm-ups) and the piece editor
  using the width; Practice lists as two panes; Stats as a wider dashboard.
- ML-238 (a phone on its side) is still open: no layout of its own was the agreed answer; it gets the tablet
  layout with the rail folded. He has not said to close the ticket.
- The rail is 256px wide (it was 232): "The Music Ledger" has to fit beside the mark.
- **ML-484:** production starts on `music-ledger` (no row in `app_config` means the default; no migration). He switches it himself on Admin → App name. Emails keep the old name, so tell him when it is switched - his wife will meet both. No notice to members (his decision). Another chat is working on the artwork in `brand-trials/` on this same branch: commit by file name, never `git add -A`.
- **The back-tests run at 500px wide** (`playwright.config.ts`) - the phone layout. Cases 9 and 21 set a
  desktop window before opening the admin panel. Case 58 is the wide layout; case 59 is the name on screen (it puts the setting back).

## Left over from before - all with the owner

- GDPR, the six open gaps: Vercel Pro (no domain needed), Google sign-in's safeguard on its card (no
  Workspace needed), switching the content security policy on (his sandbox check first), then the three
  that wait on a domain name - an email provider with an agreement, retention switched on, sign-up emails.
  He is choosing the app's name in another chat; a domain follows that.
- The notice for ML-478 ("My bands has changed") was agreed but never published; with one member signed in
  he may not want it now.
- "Upgrade now" on the SmartLearn prompt: "Ask to upgrade" would be truer (ML-471). Not decided.
- Take `dropGoogleKeys` out of `server/middleware/auth.js` after 6 November 2026.
- The monthly site security review is due about 6 November 2026.
- Real costs and his business plan on production; Gitleaks over the history.

## Things to know

- Other people now have accounts on production: his wife and his band's conductor, and his teacher has
  access. Nobody further should be invited until Vercel and the email provider have agreements.
- The five compliance documents: he keeps his own copies. **Never overwrite them** - a redraft is a new
  dated file, with no ICO number in it.
- `npm run design-signoff` empties the whole `design-signoff/` folder first - keep nothing else in it.
- A production migration: get the connection string with
  `neon connection-string production --project-id little-haze-42527245` into a shell variable (never
  printed), trial the pending files in one rolled-back transaction, then `DATABASE_URL="$P" node db/migrate.js`.

## How this owner works (the short version)

- Plain English, UK spelling; short sentences; no jargon in what he reads.
- Commit when asked; **never push or release without being asked**. Releases: `docs/release-process.md`.
- New styling needs his sign-off **with pictures sent as files**.
- Privacy policy wording is his. Draft it, quote it, wait.
- A browser test must never Save, Reset or delete real rows on dev - he uses dev himself.
- Never write his ICO security number anywhere.
