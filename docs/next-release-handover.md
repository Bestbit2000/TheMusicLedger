# Handover: release 0.48.0 is built and waiting

Written late on 6 October 2026. **Start here.** Delete this file once 0.48.0 is out (or replace it with
the next handover).

## Where things stand

`main`, `origin/main` and `origin/sandbox` are still at 0.47.0. Branch `after-0.47.0` (local, **not
pushed**) holds everything for **0.48.0**, one commit a ticket. Migrations 110 to 114 are on **dev only**.
Nothing has touched sandbox or production.

The owner's decision: **one release, 0.48.0, with all ten tickets, to sandbox** - not split.

| Ticket | What | State |
|---|---|---|
| ML-479 | A site that only keeps its emails says so; a name before inviting or joining a band | Built |
| ML-478 | My bands is one list; Set up sharing; Tidy my bands | Built - **needs sign-off** |
| ML-475 | Sign-in token: Google's keys out, and out of the address | Built - real Google sign-in to check on sandbox |
| ML-474 | No script written in a page; the policy allows none | Code built - **switching it on is the owner's** |
| ML-471 | The young players design rule | Done |
| ML-466 | Privacy policy: three additions | **Draft in the page - the owner checks the wording** |
| ML-469 | Agreement and transfer safeguard on each provider's card | Built |
| ML-470 | Reviews tab on Admin → Security, Dashboard reminder | Built |
| ML-463 | Important notice: "Before you continue..." | Built - **needs sign-off** |
| ML-465 | Change my email address | Built - **needs sign-off**; feature `change_email` is Super admin only |

Each ticket has a Jira comment saying what was built. Their status is left for the owner to move.

## Before it can go to sandbox - all with the owner

**7 Oct 2026, the owner's answers:** design sign-off is **granted** (item 1 - push with
`DESIGN_APPROVED=1` when he asks for the release). His two changes to "Young players" are in the policy;
the rest of the policy wording was quoted to him and waits for his yes (item 2). **Yes to a notice for
ML-478** (item 3) - wording drafted in the chat, his to agree; it is added on Admin → Notifications as an
Important notice on each site at release. `docs/competitor-analysis.md` is committed. ML-238/239 wait.

1. **Design sign-off.** Pictures of the real screens are in `signoff-pictures/` (not committed): ML-478
   (eight), ML-463 (three), ML-465 (three), ML-469 (three), ML-470 (two). One new CSS class:
   `.notification-important`. Run `npm run design-signoff` for the Admin → Design "what's new" pictures.
   Push with `DESIGN_APPROVED=1` only on his say-so.
2. **Privacy policy wording** (`public/privacy.html`): the ML-466 additions and one sentence for ML-465.
   Draft it, quote it, wait - it is his.
3. **Does anything need telling to members?** Proposed: ML-478 yes (the bands list changes; old names
   need sorting) - as an Important notice, which this release makes possible; the rest no. He decides.
4. **Version and release**: `npm run cut-release -- 0.48.0 ML-479 ML-478 ML-475 ML-474 ML-471 ML-466
   ML-469 ML-470 ML-463 ML-465`, then `npm run sync-releases`. Migrations 110-114 go to sandbox, then
   production (trial in a rolled-back transaction first - see the memory note on production migrations).

## After it is on sandbox

- **A real Google sign-in** (ML-475). The local server skips Google, so this has only been checked by
  tests. Google should sign a returning member straight in, with no consent screen.
- **The content security policy** (ML-474): console open, use every tool, then switch it on. The steps are
  in `docs/site-security-review.md`, "Switching the content security policy on". Its own small release.
- **Tidy my bands on his own account** (ML-478): his old session names (Cobham, The Cobham Band, WBA...)
  will be waiting under "Tidy my bands".
- **Third parties** (ML-469): record each transfer safeguard, and Google sign-in, on each environment.
- Switch `change_email` on for the account types that should have it (Admin → Feature access).
- Take `dropGoogleKeys` out of `server/middleware/auth.js` 30 days after 0.48.0 reaches production.
- A full site security review ("re-run the ML-231 site security review") would record ML-474 and ML-475
  as closed; the recorded review is never edited by hand.

## Things to know

- **Another session committed on this branch on 6 Oct** (`41ee49a`, competitor analysis and product
  values). `docs/competitor-analysis.md` had uncommitted changes from that session when this was written -
  they are not part of this work and were left alone.
- Back-tests: 57 cases. One flaky failure was seen twice in six full runs, each time in a different test
  and each passing on its own re-run (the local server restarts when a server file is saved mid-run).
- The back-test suite can be run against a server that **enforces** the content security policy: the
  `music-ledger-csp` set-up in `.claude/launch.json` (port 3100) and a Playwright config with that base URL.
- Not done: ML-238 and ML-239 (landscape and tablet layouts). They need the owner: which screens gain from
  the space is a design conversation, not a build. Thoughts are in the Jira-free summary given to him.
- Open from before, unchanged: email in the EU (Gmail has no agreement), Vercel Pro, the five compliance
  documents, real costs and his business plan on production, the manual accessibility walk-through,
  Gitleaks over the history.

## How this owner works (the short version)

- Plain English, UK spelling; short sentences; no jargon in what he reads.
- Commit when asked; **never push or release without being asked**. Releases: `docs/release-process.md`.
- New styling needs his sign-off **with pictures sent as files**.
- Privacy policy wording is his. Draft it, quote it, wait.
- A browser test must never Save, Reset or delete real rows on dev - he uses dev himself.
- Never write his ICO security number anywhere.
