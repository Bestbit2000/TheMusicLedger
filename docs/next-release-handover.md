# Handover: the release after 0.46.0

Written 6 October 2026 at the end of the session that shipped 0.45.0 and 0.46.0. **Start here.** It says
where things stand, what the next release is for, and the order to do it in. Delete this file once that
release is out (or replace it with the next handover).

## Where things stand

Release **0.46.0** drew a line under a long session. It shipped:

| | What | Read before touching |
|---|---|---|
| ML-443 (0.45.0) | Admin → Business case, the grouped admin menu and Dashboard, last seen | `docs/business-case.md`, `specs/components/admin-shell.md` |
| ML-461 | Copy the business plan between environments as a file | `docs/business-case.md` |
| ML-462 | The owner's own reference, note and "done" marks on Third parties | `docs/third-party-providers.md` |
| ML-220 | Use the app offline and sync afterwards | `docs/offline.md` |
| ML-464 | Retention: unused accounts warned twice then deleted - **built, switched off** | `docs/retention.md` |
| ML-221 | UK GDPR assessment, version 2, with a gap register | `docs/gdpr-assessment.md` |
| ML-231 | Site security review - verdict **conditional** | `docs/site-security-review.md` |

Migrations 102 to 106 are on dev, sandbox and production. Only the owner uses the app.

## What the next release is for

**Closing what the two reviews found**, so the app is fit to invite other people. The reviews are the
source: the security review's open findings (`docs/site-security-review.md`) and the GDPR gap register
(`docs/gdpr-assessment.md`). Every item has a Jira ticket.

### Do first - these block inviting anyone else

1. **ML-472 - teachers are one list shared by every member.** Anyone can rename or delete a teacher for
   everyone, and all names go to all members. Give each member their own. Do **ML-467** (a teacher is a
   name only) in the same change - same table.
2. **ML-473 - private organisations are listed as bands, and band joining is open.** Part 1 (a member's
   own organisation labels are theirs alone) is a fix. Part 2 (who can join a band, what a new member can
   change) is **the owner's decision** - ask before building; his earlier line was "bands start open, can
   be closed down later, with librarians". Part 3 (a custom time signature's owner isn't checked) is a
   small fix.
3. **ML-468 - say who will see it when sharing with a band.** Small, and it goes with ML-473.

### Then - security hardening

4. **ML-476 - commit the lockfiles** (`package-lock.json` is in `.gitignore`; change the build to
   `npm ci`), **a size limit on recordings** (ask the owner what limit), **limits on repeated calls**.
5. **ML-475 - the sign-in token**: keep Google's own keys out of it; stop putting it in the address.
   Read `docs/password-login.md` and the ML-48 memory note first - sign-in has bitten before.
6. **ML-474 - enforce the content security policy.** The big one: the pages' inline `onclick` handlers
   have to be moved out first. Do it screen by screen. It can be its own release.

### Then - data protection

7. **ML-466 - privacy policy additions** (the lawful reason for three items, a few lines for young
   players, the teacher's name). Claude drafts; **the wording is the owner's**.
8. **ML-469 - record each provider's data processing agreement** on Admin → Third parties.
9. **ML-470 - reviews that come round**, with a reminder on the Dashboard. The Security page already has
   two reviews on it; this adds the data protection ones and "mark as reviewed".
10. **ML-463 - an important notice that pops up at next sign-in.** Its first use is telling members about
    the last-seen date.
11. **ML-465 - changing an account's email address.** A decide-how ticket first: write the approach into
    the ticket and get the owner's yes before building.
12. **ML-471 - the no-pressure design rule for young players** (a paragraph in `specs/README.md` and a
    check of the existing "Upgrade now" strip).

This is too much for one release. Suggested split: **A** = 1 to 4 (the blockers and the quick hardening);
**B** = 5 and 6; **C** = 7 to 12. Propose the split to the owner and let him choose (see his standing
preference: flag and split big bundles rather than running them all in one pass).

## Things only the owner can do (remind him, don't do them)

- Vercel: move to Pro (its data processing agreement covers Pro only). Neon: its GDPR compliance is
  self-declared and a contract appears to come only with the Scale plan - he is asking Neon. Resend:
  confirm its agreement. Until these are settled, nobody else's data should be held.
- Read the five Word documents in `compliance-documents/` (not in git) and fill in the blanks.
- On production: enter real costs on Admin → Costs and usage and press Read now; re-enter (or load from a
  file, ML-461) his business plan; type his ICO reference into the ICO card's "My reference".
- Try on sandbox: uploading a recording and a document (the new stored-file check, and the first real test
  of the report-only security policy - watch the browser console); offline on a real phone; retention with
  the unit set to hours.
- Delete sign-up emails older than 12 months from his inbox.

## Not yet verified on the live site

Nobody but the owner can sign in to production or sandbox admin, so every admin page added in 0.45.0 and
0.46.0 was exercised on the local server against dev only. Offline was tested in a desktop browser with
the network switched off, not on a phone. Real file uploads were not exercised after the stored-file check
was added (it was tested against all 20 real stored files on dev). If he reports a problem, start there.

## Known loose ends

- **Back-tests:** 7 were out of date before this session (Quick entry, practice lists, a Theory round, the
  sign-in button). A separate session was started to fix them; check `npm run backtest` (it needs
  `node --env-file=.env scripts/run-backtest.mjs`) before the next release and deal with what is left.
- **The business plan lives per environment.** His worked plan is on dev.
- **Retention is off everywhere.** It must stay off on production until the app sends email from its own
  domain (Resend only delivers to the owner's address until a domain is verified).
- **`CSP_ENFORCE`** is unset everywhere (report-only).
- The proposal artifact for ML-443 (14 questions) was never answered as a set; the build followed
  Claude's suggestions. Not needed any more unless he raises it.

## How this owner works (the short version)

- Plain English, UK spelling; short sentences; no jargon in what he reads.
- Commit when asked; **never push or release without being asked**. Releases: `docs/release-process.md` -
  propose the version and wait; ask "does anything need telling to members?"; migrations on sandbox and
  production before the code; `git push --atomic origin main main:sandbox`.
- New styling needs his sign-off **with pictures sent as files** (`npm run design-signoff`).
- Privacy policy wording is his. Draft it, quote it, wait.
- A browser test must never Save, Reset or delete real rows on dev - he uses dev himself.
- Never write his ICO security number anywhere.
- The memory notes carry the detail: start with `ml231-site-security-review`, `ml221-gdpr-assessment`,
  `ml220-offline`, `ml443-business-case`, `scripted-edits-on-this-machine`.
