# Third-party providers

A running list of external services the app depends on, so it's easy to keep
an eye on which free tiers are being approached and which services would cost
money if usage grew. Add a new row here whenever a new service is wired in —
for now this is list-only, not linked to any billing/usage dashboard.

| Provider | Used for | Tier | Where configured |
|---|---|---|---|
| [Neon](https://neon.tech) | Postgres database (`production`/`sandbox`/`dev` branches) | Free tier, 10 branches max (using 3) — see [`docs/environments.md`](environments.md) | `DATABASE_URL` env vars |
| [Vercel](https://vercel.com) | Hosting/deployment | — | Deploy on push to `main`, see [`docs/release-process.md`](release-process.md) |
| Google OAuth | Login only (`server/config/passport.js`) | Free | `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` |
| [PostHog](https://posthog.com) | Client-side usage analytics — autocaptures button clicks so it's possible to see which features are actually used (`ML-47`) | Free self-serve tier (1M events/month) | `public/analytics.js` (`POSTHOG_KEY`, public/client-side key by design); dashboard link stored in the `app_config` table, editable from the admin panel's Usage section without a release |
| Audiveris OMR service | "Create from file" PDF/scan import (`ML-79` Phase 2) — turns a scanned score into MusicXML, which `server/services/scoreImport.js` then parses the same way as a direct MusicXML upload. **Not this app** — Audiveris is a Java batch-CLI tool with no REST API of its own and doesn't fit this app's Vercel serverless deployment (no JVM/Docker/persistent process), so it has to be a separate, independently-hosted wrapper service this app calls over HTTP. **Not deployed anywhere yet** — and **not safe to deploy as-is**: the ML-192 security review found it has no authentication of its own, so our deployment has to add one (Caddy bearer-token match) - see [`omr-security-review.md`](omr-security-review.md) for the verdict and the deployment config. `AUDIVERIS_SERVICE_URL` unset means PDF import fails with a clear "not available yet" message; MusicXML/.mxl import (Phase 1) is unaffected. | — (self-hosted, wherever that ends up) | `AUDIVERIS_SERVICE_URL` (base URL, no trailing slash) + optional `AUDIVERIS_SERVICE_TOKEN` (sent as `Bearer` on every call — only enforced if whatever's in front of the service actually checks it, see below) + optional `AUDIVERIS_POLL_TIMEOUT_MS` (default 50000). `runOmr` in `scoreImport.js` is written against a *real, verified* async job contract — [solfascribe-omr](https://github.com/James-Aidoo/solfascribe-omr)'s (MIT-licensed, self-hostable Audiveris wrapper): `POST {url}/jobs` (multipart, one file field, any name) → `202 {jobId}`; poll `GET {url}/jobs/{jobId}` → `{status: 'queued'\|'running'\|'done'\|'failed', movements: [{filename, bytes}], failure?: {class, detail}}`; fetch `GET {url}/jobs/{jobId}/files/{filename}` for the MusicXML once `status` is `'done'`. Async, not a single request/response, because real OMR takes real time (that service's own default timeout is 15 minutes) — `AUDIVERIS_POLL_TIMEOUT_MS` bounds how long `runOmr` itself will wait, which has to stay under whatever `maxDuration` the `api/[...slug].js` Vercel function is configured with (unset in `vercel.json` today = plan default, likely too short — raise it there if scanning routinely times out). solfascribe-omr ships with **no built-in authentication** ("no auth, `CORS_ORIGIN=*`") — don't expose it on the open internet as-is; put it behind a Cloudflare Tunnel + Access (or an equivalent auth-checking reverse proxy) if it needs to be reachable from Vercel. As of writing (2026-09-20) solfascribe-omr is a brand-new project (created July 2026, 0 stars, no tagged releases) — treat it as a reference implementation to test against, not a proven dependency, until it's actually been run against real scores. |

## Exam board material - keep a legal eye on this (ML-313)

Content that follows an exam board's published syllabus. It is **not licensed**: no permission has been given.
ABRSM's syllabuses say: "All the syllabus information in this document, including repertoire and scale lists,
is the copyright of ABRSM. No syllabus listing may be reproduced or published without the permission of ABRSM."
The owner is asking ABRSM (the draft email is on ML-313); until there's an answer the content stays free, with
the disclaimer below. This is not a legal opinion - record ABRSM's reply here when it comes.

| Source | What we hold | Where | Status and what we do |
|---|---|---|---|
| ABRSM Brass Practical Grades syllabus from 2023 (rev. Jan 2026) and Woodwind Practical Grades specification from 2026 (`ScaleGrades.SOURCES`) | The scale requirements for Grades 1-8 per instrument - keys, forms, lengths, and for Grades 7-8 the printed top and bottom notes (ML-357) | `public/scaleGrades.js` (`DATA`); shown as "ABRSM list: ..." in the Scales pop-up | Transcribed from the syllabus tables. **Permission being asked.** Free feature, not sold. Disclaimer in the Scales pop-up and on About. Fallback if refused: drop the grade presets and keep "Everything else" / the player's own list. |
| The same two syllabuses | The guide speeds for scales, arpeggios, 7ths and scales in thirds per grade (ML-391) | `PracticePlan.SCALE_SPEEDS` in `public/practicePlan.js` | As above - part of the same request. Fallback: our own speeds. |
| ABRSM Music Theory syllabus, Grades 1-5 | What each Theory grade asks - **our own selection and wording**, not ABRSM's text (ML-309) | `public/theoryEngine.js`, Admin → Theory grades (`docs/theory-grades.md`) | Lower concern. "ABRSM" isn't named on the Theory screens. Covered by the About disclaimer. |
| The name "ABRSM" | Used to say whose lists the Scales tool follows | Scales pop-up, About, docs | Descriptive use only: no logo, nothing implying endorsement. |

**The disclaimer** (About, "Exam grades", and under the list name in the Scales pop-up): The Music Ledger isn't
affiliated with, endorsed by or approved by ABRSM; the requirements are ABRSM's and can change - check the current
syllabus at abrsm.org. Keep it wherever a board's list is shown. **Before adding another board** (Trinity...), check
its terms first and add a row here.

## Licensed assets (fonts, icons) - keep a legal eye on these

Third-party files the app serves or loads. Each licence's full text is stored next to the file where we
host it ourselves (`public/fonts/*-LICENSE.txt`). Add a row whenever a new font, icon set, sound or
similar asset is added, with where its licence lives and what it asks of us.

| Asset | Used for | Licence | Where | What the licence asks of us |
|---|---|---|---|---|
| [Bravura](https://github.com/steinbergmedia/bravura) (Steinberg) | All music notation (ML-262) | SIL Open Font License 1.1 | Self-hosted: `public/fonts/bravura.woff2`, licence `public/fonts/Bravura-LICENSE.txt` | Keep the copyright notice and licence with the font; don't sell the font on its own; if we ever modify it, it can't keep the name "Bravura" (Reserved Font Name). Using it in the app is fine. |
| [OpenDyslexic](https://opendyslexic.org) (Abbie Gonzalez) | Reading font choice, Settings → Display and reading (ML-356) | SIL Open Font License 1.1 - Reserved Font Name "OpenDyslexic" | Self-hosted: `public/fonts/opendyslexic-regular.woff2`, `-bold.woff2` (downloaded 2026-09-29 from the official repo, github.com/antijingoist/opendyslexic, `compiled/`), licence `public/fonts/OpenDyslexic-LICENSE.txt` | As Bravura: licence travels with the files, no selling the font by itself, and a modified version (including our own subsetting) must be renamed. We use the files unmodified. |
| [Lexend](https://www.lexend.com) (The Lexend Project) | Reading font choice, Settings → Display and reading (ML-356) | SIL Open Font License 1.1 - Reserved Font Name "RevReading Lexend" | Self-hosted: `public/fonts/lexend-latin.woff2`, `lexend-latin-ext.woff2` (Google Fonts' Latin and Latin-extended files, downloaded 2026-09-29), licence `public/fonts/Lexend-LICENSE.txt` (from github.com/googlefonts/lexend) | As above. The files are Google Fonts' own published subsets, unmodified by us. |
| [Inter](https://rsms.me/inter/) | All UI text | SIL Open Font License 1.1 | Loaded from Google Fonts (`index.html`), not hosted by us | Nothing while it's loaded from Google; if we ever self-host it, store its licence with it like the others. |
| [Noto Music](https://fonts.google.com/noto/specimen/Noto+Music) | A few Unicode music symbols (segno, coda) | SIL Open Font License 1.1 | Loaded from Google Fonts | As Inter. |
| [Material Symbols](https://fonts.google.com/icons) (Google) | Every icon | Apache License 2.0 | Loaded from Google Fonts | Nothing while loaded from Google; if self-hosted or copied into the repo, include the Apache 2.0 licence and any NOTICE. |

**Watch:** the SIL OFL is permissive for our use (bundling in an app, including a commercial one, is
allowed). The two things that would matter are selling a font on its own (we don't) and modifying one
(we don't - subsetting or converting ourselves would count, so use the published files).

## Watch list

- **PostHog**: check event volume against the free-tier ceiling if the app's
  user base grows significantly — autocapture records every click, not just
  named events, so volume scales with traffic more than with intentional
  tracking.
