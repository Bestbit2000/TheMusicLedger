# Site security review (ML-231)

A repeatable check that this site is secure: **Admin → Release and checks → Security → This site**. It is
built on the pieces first made for the review of the old PDF import's music-scanning service (ML-192), which
went with that import (ML-543, 20 October 2026). It is a careful review by Claude, not a penetration test by
a specialist firm.

## Where things are

| | |
|---|---|
| The checks, and the automated ones' code | [`server/services/siteSecurityReview.js`](../server/services/siteSecurityReview.js) |
| The deep reviews, one entry each (the audit trail) | [`server/securityReviews/site.js`](../server/securityReviews/site.js) - append, never edit |
| Security headers | [`server/middleware/securityHeaders.js`](../server/middleware/securityHeaders.js) |
| Fetching a member's web address safely | [`server/utils/publicUrl.js`](../server/utils/publicUrl.js) |
| Tests | `server/test/siteSecurity.test.js` (includes the real route files), `server/test/publicUrl.test.js` |
| The admin panel's "prove it's you" check (ML-518) | [`docs/admin-passkey.md`](admin-passkey.md) - every admin route needs `requireAdminCheck` as well as `requireSuperAdmin`; the route-guard check and its unit test cover both, and "Administrators' sign-in" fails if the check is not being asked |
| The shared machinery | `buildReview`, `saveRun`, `osvLookup` in `server/services/securityReview.js`; tables `security_review_runs` / `_results` |

## Two kinds of check

**Automated - "Run now", monthly.** They only read, and take a few seconds:

| Check | What it does |
|---|---|
| Every route still has its guard | Reads the route files: every admin route needs `requireSuperAdmin`; every app route needs a signed-in account, apart from the exceptions listed in `OPEN_ROUTES` with their reason. **The same check runs in the unit tests, so a release with an unguarded route fails before it goes out.** |
| What the live site says to someone not signed in | Asks this site for a member's data, admin data and the daily job with no sign-in and with a made-up one; each must be refused. Checks the test logins are shut (on the live site). |
| Administrators' sign-in | No super admin can sign in with a password alone. |
| Security headers | Fetches the front page and checks its headers. On the live site the pages are static files that Vercel serves without Express, so the headers are declared twice: in the middleware (data answers) and in `vercel.json` (pages). `npm run sync-vercel-headers` copies the one list across and a unit test fails if they differ (ML-477). |
| Installed packages (OSV) | The packages the app depends on directly, at the versions installed in this deployment, against known advisories. |
| This deployment's settings | Secrets set and long enough, test logins off, the app knows its own address - no value is ever shown. |

**Admin → Security → Reviews (ML-470)** lists this review beside the others that come round (data
protection, the Children's Code, the breach plan), with when each was last done and when it is due.

The Dashboard shows "Needs you" when the monthly run is due, when a check is failing, or when a release has
gone out since the last deep review.

**Deep - done by Claude Code in a session.** Ask: *"re-run the ML-231 site security review"*. Do it after
anything that touches sign-in, sharing between members, uploads or a new kind of data, and at least twice a
year. What it covers, and how:

1. **Can a member reach another member's things?** List every route; for each one that takes an id (in the
   address or the body), follow it into its service and find the line that limits the row to the caller.
   A second reader (a read-only sub-agent) does the sweep; every finding is then confirmed by hand.
2. **Shared by design** - bands, teachers, organisations: who can see, join, rename, delete.
3. **Member-typed text on the page** - search the front end for text put into HTML without `escapeHtml`
   (names, titles, notes, addresses), reading every hit; look hardest at what one member can make another
   member see.
4. **Queries** - any SQL text built from a value; confirm none comes from a request.
5. **Addresses the server fetches** - every `fetch(` on the server; anything from a member goes through
   `publicUrl.js`.
6. **Uploads** - who may upload, what types, how big, and that an address is checked before it is kept.
7. **Sign-in tokens, the test logins, limits on repeated tries.**
8. **`npm audit --omit=dev`** in the root and in `server/`; decide for each advisory whether it can be
   reached, and record accepted ones in `acceptedAdvisories`.
9. **Secrets** - search every tracked file; run Gitleaks over the history when it is available.
10. **Errors** - what an unexpected error tells the caller.

Then: fix what can be fixed safely, raise a ticket for the rest, **append a run** to
`server/securityReviews/site.js` (a result for every deep check, a verdict with its conditions, the app
version reviewed), update this document's "Reviews so far", and run the tests.

## No script in a page (ML-474)

The content security policy (`server/middleware/securityHeaders.js`) allows script only from the app's own
files and the two outside addresses it loads from. Script written **in** a page - an `onclick="..."`, a
`<script>` with its code in the page, a `javascript:` address - is not allowed, because that is exactly how
text that reached a page unescaped would run. So:

- **A click is said, not scripted.** An element carries `data-act="view" data-arg="statsView"` (and
  `data-arg2` when there are two). `CLICK_ACTIONS` in `public/app.js` is the one table that says what each
  action does; an attribute can never name a function to run. Each element gets its own click listener
  (`bindClickActions`), and markup added later is bound as it arrives (a `MutationObserver`), so the order
  things happen in is the same as when it was an `onclick`.
- **New code uses a listener** (`addEventListener`, or a delegated one with `data-` attributes - most of the
  app already does) or a `data-act`. Add an action to the table only for something used from markup.
- **A member's text rides in a `data-` attribute, escaped with `escapeHtml`** - never inside a script string.
- **A script is a file.** `blob-upload.js` (the one module) and `styleguide.js` were inline.
- `server/test/noInlineScript.test.js` reads every page and script on each release and fails on an inline
  handler, a `<script>` with no `src`, a `javascript:` address, `eval`, a `data-act` the table doesn't know, or
  the policy allowing inline script again. `npm run a11y-audit` treats `data-act` as it did `onclick`.

### Switching the content security policy on

Until it is switched on the policy is **report-only**: the browser's console says what it would have
stopped, and stops nothing. Switching it on is the owner's step, sandbox first:

1. On **sandbox**, with the release that has ML-474 in it, open the app with the browser's console open and
   use every tool, including an import from MusicXML, a photo or PDF read, a recording upload and a YouTube link. Anything the console
   reports as "would have been blocked" is an outside address missing from `CSP` - add it (and to the
   third-party register) before going on. A local run can't show this for the analytics and the file store.
2. Set `CSP_ENFORCE=true` in Vercel for sandbox (the data answers), run
   `npm run sync-vercel-headers` (the pages - `vercel.json`; enforced is its default since ML-555 - it took `--enforce`
   then) and release that change.
   `server/test/vercelHeaders.test.js` must agree with the setting you are releasing.
3. Check a page with `curl -sI`: `content-security-policy`, not `...-report-only`. Use the app again.
4. Then the same on production. Admin -> Security -> This site -> "Security headers" then shows the
   policy as enforced, with nothing about inline script.

**The owner's sandbox walk, 7 October 2026 (step 1).** One thing reported: a YouTube video in the piece editor was
framed from `www.youtube.com`, which the policy does not allow (`frame-src` is `youtube-nocookie.com`). The fix was to the
page, not the policy: the editor now uses the privacy-enhanced player like everywhere else (and as the privacy policy
says). Reading the code for the same walk found one the console had not shown: the play screen loads YouTube's player
script (`https://www.youtube.com/iframe_api`) so a video can be paused when you leave - `script-src` now allows
`https://www.youtube.com`. Both are in 0.49.0. The `manifest.json` errors on sandbox are Vercel's own sign-in wall for
preview sites, not the policy, and do not happen on production. **Step 1 should be walked once more on sandbox with
0.49.0 on it - playing a piece that has a video - before step 2.**

**Switched on, 7 October 2026.** With 0.49.0 on sandbox the owner played a piece with a video and opened its
editor's Media tab with the console open: nothing from the policy. He set `CSP_ENFORCE=true` in Vercel for
production and sandbox (production's API answers were checked enforcing straight after his redeploy), and
`vercel.json` was rewritten with `npm run sync-vercel-headers -- --enforce` so the pages enforce it too.

**Enforced on sandbox, the same day.** Eight blocked connections to `cdn.jsdelivr.net/sm/*.map` showed in the console.
They are the source maps of the upload script jsDelivr serves, asked for by the browser's developer tools and by nobody
else - nothing in the app was blocked. `connect-src` now allows `cdn.jsdelivr.net` so a console check stays readable.
The `manifest.json` lines on sandbox are still Vercel's sign-in wall.

To try it on your own machine first: the `music-ledger-csp` set-up in `.claude/launch.json` runs the app
on port 3100 with the policy enforced (it needs a file `.claude/csp-enforce.tmp.env` holding `PORT=3100` and
`CSP_ENFORCE=true`).

## Reviews so far

### 21 October 2026 - a re-check, version 0.65.0 and ML-574 - verdict: go

**Sound for members.** The owner asked for the 20 October review to be checked again. Its five conditions are all
live (released in 0.64.0, now 0.65.0): the pages enforce the content security policy again (checked on the live site,
a page and a data answer), a stored file must be in this app's own store, a band's name is escaped on History, a
photo or PDF read's pages are always deleted, and every organiser action asks that the organiser is an adult.

- **All of `app.js` read line by line** (25,750 lines, eight read-only readers, about 430 places that build HTML).
  Nothing one member types reaches another member's screen unescaped. Five small places were hardened - the member's
  own data, or values no member can type: the session category and an error message on History, the clef on My
  instruments, the time signature on the play screen's now-playing line, and the avatar's initials. An avatar is one
  of 12 drawings in the app's own code (the server refuses anything else) or the first letter of each name.
- **Fixed in ML-574**, the lows still open on 20 October: the server now checks the "right to upload" confirmation
  before any upload of music (before, only the app asked); the recording, document and MusicXML upload tokens hold the
  upload to its own folder (MusicXML imports now go to the member's own folder, not one everyone shared); a kept file's
  size and type are read from the file store, not taken from the browser; removing a piece's copy of a Recordings-tool
  recording on Admin -> Recordings removes the tool's row too.
- **`npm audit`**: one new advisory since 20 October, in `follow-redirects` (high), not reachable - it comes in only
  through `axios`, which no code uses. Updated to the fixed version in both lockfiles anyway; `axios` could be taken out.
- **The sign-in token is out of the upload address** (also ML-574). Every upload sent it to its upload-token route as
  `?token=`, where it reached request logs and the browser's history. The upload library can send a header to that
  route (and only that route), so the app now sends it as an `Authorization` header (`uploadToStore`). The server still
  accepts the address for one release, for a device running the older app; ML-575 drops it in the release after.
- **The content security policy** is enforced on the live site (pages and data answers, checked) and now on the
  owner's own machine too (`CSP_ENFORCE=true` in `server/.env`); the upload and other back-tests pass with it enforced.
  The two "report-only" lines on Security -> This site come from the last automated run, 6 October on a local machine -
  before it was switched on. "Run now" on the live site clears them.

Not re-run (the 20 October results stand): reaching another member's rows, queries, server fetches, the test
logins, limits, the device, secrets, errors. Still open, low: three IPv6 forms and DNS rebinding; `list_count` on a band piece; a band list showing a title a viewer can't open;
inviting says whether an address has an account. Still not done: the bodies of the admin handlers, the inside of the
password, two-step, email change and recording removal services, a line-by-line read of `admin.js`, Gitleaks itself,
and whether the AI Gateway honours zero data retention on the photo reader's endpoint.

### 20 October 2026 - version 0.63.0 and the next release - verdict: conditional

**Sound for members once the next release is out.** No member can reach another member's private practice, and a
conductor or organiser sees nothing of anyone's practice or readiness. Nothing high was found in the code, but the
live pages' content security policy had slipped back to report-only, and four medium gaps were found. All five are
fixed in the next release (uncommitted on the branch when reviewed); until it is out, the live site has them.

| What | How serious | The fix |
|---|---|---|
| The pages' content security policy went back to **report-only** in 0.63.0: the header sync script's default was report-only, and a plain run of it in the ML-534 change undid the 7 Oct switch. The data answers still enforced it. | High | Enforced is now the script's default (`--report-only` to go back, on the owner's say-so), `server/test/vercelHeaders.test.js` fails on a report-only `vercel.json`, and `vercel.json` is enforcing again. **ML-555** |
| "A file in this app's own store" accepted any Vercel customer's store, so a member could attach a file from their own (beyond the size and type limits, changeable after the check, out of reach of Admin -> Recordings). | Medium | The store id is taken from the upload key (`ownStoreHost`, `blobUrls.js`). **ML-551** |
| A band's name another member chose was put on the History page unescaped. | Medium | Escaped. **ML-552** |
| The pages of a photo or PDF read were only deleted inside the read - not after a refused or failed read, a part-failed upload or a closed tab, nor with the account. | Medium (the privacy policy says they are deleted) | Deleted on every refusal or failure, swept daily after a day, cleared with the account (`discardReadFiles`, `sweepReadUploads`). **ML-553** |
| "An organiser is an adult" was only asked when inviting or setting up sharing, and an organiser can be one without confirming. | Medium | Every organiser action asks (logo, members' levels, removing someone); stepping yourself down doesn't. **ML-554** |

The owner's rule, confirmed during the review: a member an organiser has given "change music" may add recordings,
videos and documents to a band's piece - only an organiser can give that level. The Recordings tool puts a recording
on a band's piece for organisers only. `docs/rehearsal-score.md` and CLAUDE.md said "only an organiser" and are corrected.

Recorded, not fixed (low): a piece's `list_count` counts every member's practice lists (an organiser can see how many
members have a band piece on a list); a band list shows titles a viewer can't open; inviting a member says whether an
address has an account; the server never checks the "right to upload" confirmation; three upload tokens don't fix the
folder, and file sizes and types are kept as the browser sent them; removing a Recordings-tool recording on Admin ->
Recordings leaves the tool's row; the sign-in token rides in the upload token request's address; three IPv6 forms are
treated as public, and DNS rebinding is still open; the initials on an avatar aren't escaped (only your own).

Checked and sound: every one of 182 app routes that takes an id limits the row to the caller; all 111 admin routes are
super admins only and 104 ask the admin check (the other 7 make it); no query is built from request input; the only
member-typed address the server fetches goes through `publicUrl.js`; `npm audit` reports nothing; no secret in any
file or anywhere in the git history (a pattern search - Gitleaks wasn't installed); the test logins refuse on
production; errors give nothing away.

Not done this time: the bodies of the admin handlers; the inside of the password, two-step, email change and
recording removal services; a true line-by-line read of all of `app.js`; Gitleaks itself; whether the AI Gateway
honours zero data retention on the endpoint the photo reader uses (check against Vercel's documentation).


### 6 October 2026 - version 0.45.0 - verdict: conditional

**Safe for the owner's own use. Not yet ready for other people.** The review found five ways one member
could affect another. Three were fixed the same day; two are how the data is laid out and have tickets.

Found and fixed:

| What | How serious | The fix |
|---|---|---|
| A stored file's address was kept as the browser sent it, and put into the page inside `onclick`. A member could add a "document" to a band piece that ran script for everyone who opened it, and take their sign-in. | High | The address must be a file in this app's own store, uploaded for that very piece, and not already attached (`isPieceFileUrl` in `blobUrls.js`, `assertOwnUnusedBlob` in `flows.js`). Checked against all 20 real stored files on dev. The page no longer builds script from it. |
| The same unchecked address let a member attach a public piece's file to their own piece and delete it - removing the real file. | High | As above; and a file is only deleted when no other piece points at it (`delUnreferenced`). |
| Adding a band made the server fetch whatever address was typed, follow any redirect and report the status code: a way to probe this machine or a private network. | Medium | Only public internet addresses are fetched, each redirect is checked, and only "it answered / it didn't" comes back (`publicUrl.js`). |
| A band's name, a challenge's name and a teacher's or organisation's name were put on the page unescaped. | Medium (band names are seen by other members) | Escaped. |
| Deleting a challenge reported the item count of any challenge id. | Low | The count is the caller's own. |
| No security headers beyond HTTPS-only. | Medium | `nosniff`, no framing, a referrer policy, a permissions policy; a content security policy in report-only mode. **In 0.46.0 these only reached the data answers (`/api/...`), not the pages - found with `curl -sI` straight after the release and put right in the next one (ML-477).** |
| The test login relied on `NODE_ENV`, which was once set wrongly on production. | Low | It also refuses whenever Vercel says the site is production. |

Open, with a ticket:

| What | Ticket | Before others join? |
|---|---|---|
| Teachers are one list shared by every member: anyone can rename or delete a teacher for everyone, and everyone sees every teacher's name. | ML-472 | **Yes** - **fixed in the release after 0.46.0**: a teacher belongs to the member who typed it in (migration 107, `server/services/tutors.js`, `server/test/tutors.test.js`) |
| A member's private "organisation" is listed to everyone as a band anyone can join; and joining any band gives edit rights on everything it has. | ML-473 | **Yes** - **mostly fixed in the release after 0.46.0** (migration 108): a member's labels are theirs alone, and a band's shared space is by invitation only. What a member may do inside a band (organiser / change music / play) is set by the organiser who invites them. The time signature owner check is in too (`assertOwnTimeSignatures`). |
| The content security policy is report-only: the pages' inline handlers have to be moved out before it can be enforced. | ML-474 | Soon after - **the code is done in 0.48.0**: no page and no script-built markup has an inline handler (a click is `data-act`, run by `CLICK_ACTIONS` in `app.js`), the one inline script is a file (`blob-upload.js`), and the policy no longer allows inline script. Every screen and the whole back-test suite ran clean against a local server enforcing it. **Still to do, by the owner: switch it on** - see "Switching the content security policy on" below. |
| The sign-in token carries Google's own access keys, and is put in the address after a Google sign-in. | ML-475 | Soon after - **done in 0.48.0**: Google's keys are dropped where they arrive (`passport.js`) and offline access is no longer asked for; the token goes back to the page after the `#`, which is never sent to a server; a token signed before 0.48.0 is swapped for a clean one on its next request and its refresh key cancelled at Google (`dropGoogleKeys`). `server/test/signInToken.test.js` fails if either comes back. |
| Lockfiles not committed (builds aren't repeatable); no size limit on recordings; only sign-in is limited for repeated tries. | ML-476 | Soon after - **done in the release after 0.46.0**: both lockfiles are committed and the build is `npm ci`; a recording or document is 25 MB at most (the file store refuses a bigger one, the server checks again, the buttons say so); upload tokens (40 an hour), adding a band (10 a day) and feedback (20 a day) are limited per account (`limitCalls`). Still to do at the next review: Gitleaks over the git history. |

Checked and sound: every one of 80 admin routes is limited to super admins and all 149 app routes need a
signed-in account; no query is built from request input; the practice data, pieces, bars, Levels, lists,
set-ups and history are each limited to their owner; errors give nothing away; no secret is in the code;
signing out clears the device.

Not done this time: a line-by-line read of every place the front end builds HTML (it was scanned and the
hits read); Gitleaks over the git history; the bodies of the admin handlers (their guards were checked);
the two-step and password reset internals (reviewed when they were built, ML-355).
