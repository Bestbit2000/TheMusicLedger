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
| Audiveris OMR service | "Create from file" PDF/scan import (`ML-79` Phase 2) — turns a scanned score into MusicXML, which `server/services/scoreImport.js` then parses the same way as a direct MusicXML upload. **Not this app** — Audiveris is a Java batch-CLI tool with no REST API of its own and doesn't fit this app's Vercel serverless deployment (no JVM/Docker/persistent process), so it has to be a separate, independently-hosted wrapper service this app calls over HTTP. **Not deployed anywhere yet** — `AUDIVERIS_SERVICE_URL` unset means PDF import fails with a clear "not available yet" message; MusicXML/.mxl import (Phase 1) is unaffected. | — (self-hosted, wherever that ends up) | `AUDIVERIS_SERVICE_URL` (base URL, no trailing slash) + optional `AUDIVERIS_SERVICE_TOKEN` (sent as `Bearer` on every call — only enforced if whatever's in front of the service actually checks it, see below) + optional `AUDIVERIS_POLL_TIMEOUT_MS` (default 50000). `runOmr` in `scoreImport.js` is written against a *real, verified* async job contract — [solfascribe-omr](https://github.com/James-Aidoo/solfascribe-omr)'s (MIT-licensed, self-hostable Audiveris wrapper): `POST {url}/jobs` (multipart, one file field, any name) → `202 {jobId}`; poll `GET {url}/jobs/{jobId}` → `{status: 'queued'\|'running'\|'done'\|'failed', movements: [{filename, bytes}], failure?: {class, detail}}`; fetch `GET {url}/jobs/{jobId}/files/{filename}` for the MusicXML once `status` is `'done'`. Async, not a single request/response, because real OMR takes real time (that service's own default timeout is 15 minutes) — `AUDIVERIS_POLL_TIMEOUT_MS` bounds how long `runOmr` itself will wait, which has to stay under whatever `maxDuration` the `api/[...slug].js` Vercel function is configured with (unset in `vercel.json` today = plan default, likely too short — raise it there if scanning routinely times out). solfascribe-omr ships with **no built-in authentication** ("no auth, `CORS_ORIGIN=*`") — don't expose it on the open internet as-is; put it behind a Cloudflare Tunnel + Access (or an equivalent auth-checking reverse proxy) if it needs to be reachable from Vercel. As of writing (2026-09-20) solfascribe-omr is a brand-new project (created July 2026, 0 stars, no tagged releases) — treat it as a reference implementation to test against, not a proven dependency, until it's actually been run against real scores. |

## Watch list

- **PostHog**: check event volume against the free-tier ceiling if the app's
  user base grows significantly — autocapture records every click, not just
  named events, so volume scales with traffic more than with intentional
  tracking.
