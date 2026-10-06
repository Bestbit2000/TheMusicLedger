# Site security review (ML-231)

A repeatable check that this site is secure: **Admin → Release and checks → Security → This site**. It sits
beside the review of the PDF import service (ML-192, `docs/omr-security-review.md`) and is built on the
same pieces. It is a careful review by Claude, not a penetration test by a specialist firm.

## Where things are

| | |
|---|---|
| The checks, and the automated ones' code | [`server/services/siteSecurityReview.js`](../server/services/siteSecurityReview.js) |
| The deep reviews, one entry each (the audit trail) | [`server/securityReviews/site.js`](../server/securityReviews/site.js) - append, never edit |
| Security headers | [`server/middleware/securityHeaders.js`](../server/middleware/securityHeaders.js) |
| Fetching a member's web address safely | [`server/utils/publicUrl.js`](../server/utils/publicUrl.js) |
| Tests | `server/test/siteSecurity.test.js` (includes the real route files), `server/test/publicUrl.test.js` |
| Shared with the OMR review | `buildReview`, `saveRun`, `osvLookup` in `server/services/securityReview.js`; tables `security_review_runs` / `_results` |

## Two kinds of check

**Automated - "Run now", monthly.** They only read, and take a few seconds:

| Check | What it does |
|---|---|
| Every route still has its guard | Reads the route files: every admin route needs `requireSuperAdmin`; every app route needs a signed-in account, apart from the exceptions listed in `OPEN_ROUTES` with their reason. **The same check runs in the unit tests, so a release with an unguarded route fails before it goes out.** |
| What the live site says to someone not signed in | Asks this site for a member's data, admin data and the daily job with no sign-in and with a made-up one; each must be refused. Checks the test logins are shut (on the live site). |
| Administrators' sign-in | No super admin can sign in with a password alone. |
| Security headers | Fetches the front page and checks its headers. |
| Installed packages (OSV) | The packages the app depends on directly, at the versions installed in this deployment, against known advisories. |
| This deployment's settings | Secrets set and long enough, test logins off, the app knows its own address - no value is ever shown. |

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

## Reviews so far

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
| No security headers beyond HTTPS-only. | Medium | `nosniff`, no framing, a referrer policy, a permissions policy; a content security policy in report-only mode. |
| The test login relied on `NODE_ENV`, which was once set wrongly on production. | Low | It also refuses whenever Vercel says the site is production. |

Open, with a ticket:

| What | Ticket | Before others join? |
|---|---|---|
| Teachers are one list shared by every member: anyone can rename or delete a teacher for everyone, and everyone sees every teacher's name. | ML-472 | **Yes** |
| A member's private "organisation" is listed to everyone as a band anyone can join; and joining any band gives edit rights on everything it has. | ML-473 | **Yes** |
| The content security policy is report-only: the pages' inline handlers have to be moved out before it can be enforced. | ML-474 | Soon after |
| The sign-in token carries Google's own access keys, and is put in the address after a Google sign-in. | ML-475 | Soon after |
| Lockfiles not committed (builds aren't repeatable); no size limit on recordings; only sign-in is limited for repeated tries. | ML-476 | Soon after |

Checked and sound: every one of 80 admin routes is limited to super admins and all 149 app routes need a
signed-in account; no query is built from request input; the practice data, pieces, bars, Levels, lists,
set-ups and history are each limited to their owner; errors give nothing away; no secret is in the code;
signing out clears the device.

Not done this time: a line-by-line read of every place the front end builds HTML (it was scanned and the
hits read); Gitleaks over the git history; the bodies of the admin handlers (their guards were checked);
the two-step and password reset internals (reviewed when they were built, ML-355).
