# Third parties (ML-267)

Every person and company The Music Ledger depends on is in **the register**:
[`server/thirdParties/register.js`](../server/thirdParties/register.js) (split into `services.js`,
`assetsAndContent.js` and `librariesAndTools.js`). It is the single list - this doc only explains how
it works. The owner reads it on **Admin → Third parties** (super admin only).

The register covers five groups:

| Group | What | Examples |
|---|---|---|
| `service` | Services the live app needs | Neon, Vercel, Vercel Blob, Google sign-in, PostHog, Resend, Have I Been Pwned, jsDelivr, YouTube, the OMR service |
| `asset` | Fonts and icons | Bravura, OpenDyslexic, Lexend, Inter, Noto Music, Material Symbols |
| `content` | Other people's material and ideas | ABRSM syllabuses (ML-313), Takadimi, MusicXML, band directory sources |
| `library` | npm packages named in `package.json` and `server/package.json` | express, pg, @vercel/blob... |
| `build` | Tools used to build the app, and duties that come with running it | GitHub, Jira, Claude Code, OSV, Node.js and npm, the ICO data protection fee |

Each entry says who they are, what they give us, the plan and cost, links to their terms with the date
printed on each, **what the terms say** (in our own words), **what they ask of us**, things that need
the owner's attention, and the plan's limits. The field list is at the top of `register.js`.

**Every font is hosted by us** (ML-430): Inter, Noto Music and Material Symbols were loaded from Google Fonts until
0.41, which sent each visitor's IP address to Google. Don't add a font, script or stylesheet loaded from someone
else's server without the owner's say-so - it has to go in the privacy policy.

## Copies of terms

- **Open licences** (MIT, Apache, OFL...) are kept in full: fonts next to the font
  (`public/fonts/*-LICENSE.txt`), npm packages in `public/licences/npm/` (written by
  `npm run third-party-licences`). The page links to our copy.
- **Service terms** (Neon, Vercel, Google...) are **not copied**: they are the provider's own
  copyright text. The register holds a link, the date printed on the page, the date we read it
  (`termsCheckedOn`) and a summary in our own words. Never paste terms text into the register.

The summaries are a working record, not legal advice. Where something could not be confirmed, the
entry says so.

## The release check

```bash
npm run third-party-audit
```

It fails (and so does the release gate, `npm run design-gate`, which runs it on every push to
`sandbox` and `main`) when:

- an npm package in either `package.json` has no entry, or its installed licence differs from the
  register's;
- an outside web address appears in `public/`, `server/`, `api/`, `scripts/` or `db/` that no entry
  owns (`hosts`) and that isn't listed under `notDependencies` with a reason;
- a font file in `public/fonts/`, or a Google Fonts family loaded by a page, has no entry;
- something a licence asks of us has a `check` and it no longer holds - a licence file gone, the ABRSM
  disclaimer removed from About or the Scales pop-up, the YouTube player no longer privacy-enhanced;
- an entry is incomplete, or a licence copy it points at is missing.

It warns (without failing) when an entry's terms haven't been re-read for a while: 6 months for a
service, a year for build tools and content, two years for a fixed font or library.

- a service in use isn't named in the privacy policy (`public/privacy.html`): each service entry says what the
  policy calls it (`policyName`), or why it isn't in it (`notInPolicy`). **Adding a service that sees anyone's
  information means adding it to the policy in the same change** (ML-430).

What a script can't check is printed as **Check by hand before a release**, and shown on the admin
page. Walk it when a release touches the thing concerned.

The rules are in `server/thirdParties/audit.js`; tests in `server/test/thirdParties.test.js`.
Only directly named npm packages are covered, not the packages those bring in.

## Adding or changing a dependency

1. Read its terms or licence **before** using it - and its pricing page, for a service.
2. Add an entry (or extend one: `hosts`, `packages`, `files`, `googleFonts`). Write `says` and
   `asks` in plain words; give an `asks` item a `check` wherever a file or a piece of text proves it.
3. For an npm package: `npm run third-party-licences`. For a font we host: put its licence next to
   it in `public/fonts/`.
4. `npm run third-party-audit` - zero errors.
5. Anything the owner has to do or decide goes in `attention`, with `status: 'attention'`.

## Re-checking terms

When the audit warns, or the owner asks: open each link in the entry, compare the date printed on
the page with `dated`, re-read what changed, update `says` / `asks` / `limits`, and set
`termsCheckedOn` to today. Tell the owner about anything that changes what we must do or pay.

## The OMR service: how the app calls it

Kept here because `server/services/scoreImport.js` points at this doc for it. The licences and what
they ask of us are in the register entry; the security verdict is in
[`omr-security-review.md`](omr-security-review.md).

**What it is.** "Create from file" PDF/scan import (`ML-79` Phase 2) — turns a scanned score into MusicXML, which `server/services/scoreImport.js` then parses the same way as a direct MusicXML upload. **Not this app** — Audiveris is a Java batch-CLI tool with no REST API of its own and doesn't fit this app's Vercel serverless deployment (no JVM/Docker/persistent process), so it has to be a separate, independently-hosted wrapper service this app calls over HTTP. **Not deployed anywhere yet** — and **not safe to deploy as-is**: the ML-192 security review found it has no authentication of its own, so our deployment has to add one (Caddy bearer-token match) - see [`omr-security-review.md`](omr-security-review.md) for the verdict and the deployment config. `AUDIVERIS_SERVICE_URL` unset means PDF import fails with a clear "not available yet" message; MusicXML/.mxl import (Phase 1) is unaffected.

**How it is configured.** `AUDIVERIS_SERVICE_URL` (base URL, no trailing slash) + optional `AUDIVERIS_SERVICE_TOKEN` (sent as `Bearer` on every call — only enforced if whatever's in front of the service actually checks it, see below) + optional `AUDIVERIS_POLL_TIMEOUT_MS` (default 50000). `runOmr` in `scoreImport.js` is written against a *real, verified* async job contract — [solfascribe-omr](https://github.com/James-Aidoo/solfascribe-omr)'s (MIT-licensed, self-hostable Audiveris wrapper): `POST {url}/jobs` (multipart, one file field, any name) → `202 {jobId}`; poll `GET {url}/jobs/{jobId}` → `{status: 'queued'|'running'|'done'|'failed', movements: [{filename, bytes}], failure?: {class, detail}}`; fetch `GET {url}/jobs/{jobId}/files/{filename}` for the MusicXML once `status` is `'done'`. Async, not a single request/response, because real OMR takes real time (that service's own default timeout is 15 minutes) — `AUDIVERIS_POLL_TIMEOUT_MS` bounds how long `runOmr` itself will wait, which has to stay under whatever `maxDuration` the `api/[...slug].js` Vercel function is configured with (unset in `vercel.json` today = plan default, likely too short — raise it there if scanning routinely times out). solfascribe-omr ships with **no built-in authentication** ("no auth, `CORS_ORIGIN=*`") — don't expose it on the open internet as-is; put it behind a Cloudflare Tunnel + Access (or an equivalent auth-checking reverse proxy) if it needs to be reachable from Vercel. As of writing (2026-09-20) solfascribe-omr is a brand-new project (created July 2026, 0 stars, no tagged releases) — treat it as a reference implementation to test against, not a proven dependency, until it's actually been run against real scores.

## Costs and usage (release 2, not built yet)

Each service entry already records `limits`, `overLimit`, `nextTier` and `usageSource` - what the plan
allows, what happens past it, the next plan up, and where real usage can be read from. Release 2 adds
recorded costs (in pounds, with US dollars beside them), daily usage readings against those limits and
an email warning to the owner as a limit gets near.
