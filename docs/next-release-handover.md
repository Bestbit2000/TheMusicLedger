# Handover: after release 0.48.0

Written 7 October 2026. **Start here.** Replace this file with the next handover when there is one.

## Where things stand

**0.48.0 is on production and sandbox** (commit `94c0d8d`, 7 Oct 2026): ML-479, 478, 475, 474, 471, 466,
469, 470, 463, 465. Migrations 110 to 114 are on dev, sandbox and production. The owner signed off the
design and the privacy policy wording, and checked sandbox himself. Checked on the live site: 0.48.0 is
served, the five security headers are on the page, the policy page has the new wording, the API still
asks for a sign-in.

Branch `after-0.48.0` (local, not pushed) holds only this file.

## Left over from 0.48.0 - all with the owner

- **The notice for ML-478** ("My bands has changed"). He agreed the wording on 7 Oct. It is typed in on
  Admin → Notifications on production, marked Important. Ask whether he has added it.
- **The content security policy is still report-only** (ML-474). The release note says "Enforce", but
  switching it on is its own small release: the steps are in `docs/site-security-review.md`, "Switching
  the content security policy on".
- **Third parties** (ML-469): record each transfer safeguard, and Google sign-in, on production.
- **`change_email`** is Super admin only until switched on in Admin → Feature access. When it is on for
  everyone, the policy's "where it is switched on for your account" can go (his wording to agree).
- **"Upgrade now"** on the SmartLearn prompt: "Ask to upgrade" would be truer (ML-471). Not decided.
- Take `dropGoogleKeys` out of `server/middleware/auth.js` after 6 November 2026 (30 days on production).
- A full site security review ("re-run the ML-231 site security review") would record ML-474 and ML-475
  as closed; the recorded review is never edited by hand.

## Not started

- ML-238 and ML-239 (landscape and tablet). Agreed with the owner that they wait. Landscape is only
  worth it for playing a piece; tablet would start with Home, playing a piece and the admin panel, with
  mock-ups first.
- Upgrades and young players: he doesn't know which members are young. The advice given: don't ask ages;
  make every prompt fit for a child, and do the encouraging where adults are (a plans page, what an
  organiser sees, emails, the website).
- Open from before, unchanged: email in the EU (Gmail has no agreement), Vercel Pro, the five compliance
  documents, real costs and his business plan on production, the manual accessibility walk-through,
  Gitleaks over the history.

## Things to know

- Back-tests: 57 cases. A flaky failure shows up now and then, in a different test each time, when a
  server file is saved mid-run (the local server restarts).
- The back-test suite can be run against a server that **enforces** the content security policy: the
  `music-ledger-csp` set-up in `.claude/launch.json` (port 3100) and a Playwright config with that base URL.
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
