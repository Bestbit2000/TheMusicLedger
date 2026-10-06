# Handover: the release after 0.47.0

Written 6 October 2026, the evening 0.47.0 went out. **Start here.** Delete this file once the next
release is out (or replace it with the next handover).

## Where things stand

`main`, `origin/main` and `origin/sandbox` are all at 0.47.0 (commit `cf5449d`). The work starts on
branch `after-0.47.0`. Migrations 107 to 109 are on dev, sandbox and production. Only the owner uses the app.

0.47.0 was "release A" of the work the two reviews left (see `docs/site-security-review.md` and
`docs/gdpr-assessment.md`): ML-477 (headers on the pages - checked on the live site with `curl -sI`,
all five, each once), ML-472 and ML-467 (each member has their own teachers), ML-473 (bands by invitation,
with Organiser / Can change music / Can play set by the organiser who invites - `docs/band-directory.md`),
ML-468, ML-476 (lockfiles and `npm ci`, 25 MB uploads, call limits). It also carried, with no ticket of
their own: an email for a band invitation (with a "choose a password" link for someone with no account),
Send again for app invites, the daily clear-up of old invites (`clearOldRecords`), and Gmail in place of
Resend in the register and the privacy policy.

## What comes next, in order

0. **ML-479 - do this first (a Bug, small; the owner asked for both parts).** Found when he invited
   someone to a band on sandbox and no email came: (a) the app says "They have been sent an email" on a
   site that only writes emails to `email_outbox` (sandbox and dev - `MAIL_PROVIDER` unset or `log`);
   it must say plainly that this site doesn't send email. (b) The email says "A member has invited you..."
   when the organiser's account has no name - ask for a name before they can invite. The ticket lists the
   code and the tests that will need changing. It could go out by itself as 0.47.1 (a Bug-only release)
   or with ML-478 - propose, and let him choose.
1. **ML-478 - one "My bands" list.** The owner agreed the model on 6 Oct (it is written out in the
   ticket): adding a band is private, sharing comes by invitation or a deliberate "Set up sharing",
   an invitation attaches to the band you already have, and duplicates can be merged or hidden. It
   changes `startBandGroup` (adding no longer makes you organiser) and makes the "Who with?" box and
   My bands the same list. New screens need his sign-off with pictures.
2. **Release B1: ML-475** - the sign-in token (Google's keys out of it; out of the address). Read
   `docs/password-login.md` and the ML-48 memory note first.
3. **Release B2: ML-474** - enforce the content security policy (move the inline `onclick` handlers
   out, screen by screen). Its own release.
4. **Release C: ML-466, ML-469, ML-470, ML-463, ML-465, ML-471** - data protection. Policy wording is
   the owner's; ML-465 needs his yes on the approach first.

## With the owner

- **Email.** Production sends through a free personal Gmail account (`MAIL_PROVIDER=smtp`): no data
  processing agreement, about 500 emails a day shared by everything, and every sent email stays in its
  Sent folder until deleted (the privacy policy says "until we delete them" - it needs tidying by hand).
  He wants email kept in the EU. The lasting answer is a domain plus Google Workspace with the Europe
  region or an EU email service. See the Gmail entry on Admin -> Third parties.
- A proper welcome / sign-up page for invited people, once there is a domain.
- **Neon's data processing agreement: signed by him on 6 Oct** (recorded on the register on this branch -
  it reaches the live Admin page with the next release). **Vercel has no agreement on his plan**, so an
  upgrade to Pro is coming. He is staying with Google for email for now; that may change.
- Still open from before: the five Word documents in
  `compliance-documents/`, real costs on production, his business plan on production.
- Nothing counts sent emails; the business case still has a "Resend Pro" line.

## Not yet checked on the live site

- A real band invitation email on production, and the "choose a password" link from it - he was about
  to try. If it says "the email couldn't be sent", look at `APP_URL` on Vercel and the day's Gmail limit.
  (The 25 MB limit he has checked himself: it caught large files.)
- The manual accessibility walk-through (keyboard only, screen reader, 200% zoom) of My bands, Members
  and Invite someone. The axe scan passed (64 of 64).
- Gitleaks over the git history (ML-476's last line).

## How this owner works (the short version)

- Plain English, UK spelling; short sentences; no jargon in what he reads.
- Commit when asked; **never push or release without being asked**. Releases: `docs/release-process.md`.
- New styling needs his sign-off **with pictures sent as files**.
- Privacy policy wording is his. Draft it, quote it, wait.
- A browser test must never Save, Reset or delete real rows on dev - he uses dev himself.
- Never write his ICO security number anywhere.
- To run a branch beside the main folder's server: a second launch config with
  `node --env-file=<main>/server/.env --env-file=<a file with PORT=3100> server/server.js`.
