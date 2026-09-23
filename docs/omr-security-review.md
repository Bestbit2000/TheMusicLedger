# OMR service security review (ML-192)

**Target:** [solfascribe-omr](https://github.com/James-Aidoo/solfascribe-omr), the self-hostable
service that "Create from file" PDF import calls (`runOmr` in `server/services/scoreImport.js`) to
turn a scanned score into MusicXML. It is a **TypeScript/Fastify** wrapper (MIT, 4 source files,
~1,100 lines) around **Audiveris 5.10.2** (Java, AGPL-3.0) with Tesseract OCR, shipped as a Dockerfile
plus deploy configs for an Oracle Cloud VM (Caddy in front) and a home machine (Cloudflare tunnel).

**It isn't our repo.** Nothing in this review changes it. Fixes go in our own deployment config or our
own client code; anything for upstream would only be a GitHub issue, and only if the owner asks.

The Jira ticket was written for a Python service; ML-192's description now has the plan translated to
this stack (Bandit → Semgrep/ESLint, pip-audit → npm audit/OSV, plus sections 6-8 added).

## Where to look

| What | Where |
|---|---|
| Checks, latest results, verdict, full run history, **Run now** | Admin → **Security** |
| Deep-review history (the audit trail) | `server/securityReviews/solfascribe-omr.js` |
| Check definitions + automated checks | `server/services/securityReview.js` |
| Automated run history (per environment) | `security_review_runs` / `security_review_results` (`049_security_reviews.sql`) |
| Re-running the deep review | `.claude/skills/omr-security-review/SKILL.md` + `scripts/omr-security-review.mjs` |
| Tests | `server/test/securityReview.test.js`, `server/test/scoreImportGuards.test.js` |

## How re-running works

- **Automated checks** - Admin → Security → **Run automated checks now**. Runs from the Vercel
  function in ~3 seconds, records a run in that environment's database, and shows it in History.
  Checks: upstream changes since the last deep review (GitHub API); Node and Audiveris (Maven)
  dependencies vs [OSV](https://osv.dev); container hardening and supply-chain rules over the
  upstream Dockerfile/compose; whether the service or its proxy checks callers; a **live probe** of
  our deployment (needs `AUDIVERIS_SERVICE_URL`: a health check, one unauthenticated upload of a
  tiny `.txt` that must be refused with 401/403, and a CORS check); and self-tests of our own import
  guards. The page flags a run as **due** after 30 days.
- **Deep review** - ask Claude Code to "re-run the ML-192 OMR security review". It runs
  `scripts/omr-security-review.mjs` (Gitleaks, npm audit, OSV-Scanner, ESLint security, Audiveris
  dependencies), does the manual read, and appends a run to `server/securityReviews/solfascribe-omr.js`.
  That file ships with the code, so every environment shows the same deep-review history once
  released, and nothing writes to a production database from a laptop. Do one whenever Admin → Security
  says **Upstream since deep review: Changed**, and before turning on `flow_import_from_file`.
- Dependency advisories judged unreachable are listed in the run's `acceptedAdvisories`; the
  automated OSV checks then show them as accepted rather than new, so a *new* advisory stands out.

Optional env var: `GITHUB_TOKEN` (read-only, public repos) raises GitHub's API limit from 60/hour
per IP - shared on Vercel - to 5,000. A run uses 2-3 calls, so it's only needed if runs start failing
with 403s.

## Verdict (deep review 2026-09-23, upstream `a6325864`)

**Not yet - keep `flow_import_from_file` off.** The service code itself is careful (many earlier
review notes are visibly acted on), but it has **no authentication at all**, so it must not be
deployed anywhere the internet can reach until our deployment adds a check.

Conditions to turn it on:
1. **Authentication in our deployment** (blocking) - see the Caddyfile below. Set the same token as
   `AUDIVERIS_SERVICE_TOKEN` in Vercel. Admin → Security's live probe must pass.
2. **Deploy from a pinned upstream commit** (not `main`), with the compose override below.
3. **Self-host.** Never point `AUDIVERIS_SERVICE_URL` at someone else's instance. The upstream
   examples are configured for the author's own app (`solfascribe.app`) and home machine.
4. **Our side fixed** - done on branch `ml-192-omr-security-review` (below). Needs a release.
5. **Scan the built image** once Docker is available (Trivy / OSV-Scanner), and rebuild it regularly.

## Findings

| # | Area | Rating | Finding |
|---|---|---|---|
| 1 | Authentication | **Fail (blocking)** | No auth hook in `src/server.ts`; the Caddyfile is a plain `reverse_proxy`; the home tunnel has no Access policy. CORS only restricts browsers. Anyone can submit jobs, and at concurrency 1 with up to ~30 min per job (full pass + salvage retry), 25 queued jobs block our imports for hours. Our bearer token is sent but ignored. |
| 2 | Resource limits | Warn | Per-job limits are good (40 MB, 60 pages, 15-min timeout with process-tree kill, queue/live caps). But the page cap is approximate (compressed object streams aren't counted), there's no pixel cap for images, and there's no rate limit (see 1). |
| 3 | Container hardening | Warn | Non-root and memory-capped, but no `cap_drop`, `no-new-privileges`, read-only root, `pids_limit`, CPU limit or egress restriction. |
| 4 | Supply chain | Warn | Base images by tag, not digest; Audiveris cloned by tag (movable); NodeSource via `curl \| bash`; apt unpinned. Built on the VM from source, with `npm ci`, which is good. |
| 5 | Java dependencies | Warn | 9 advisories in Audiveris's declared dependencies (logback-core 1.4.14 ×6, itextpdf 5.5.13.2, commons-io 2.4 ×2). None is reachable from batch PDF/image conversion - all recorded as accepted, with reasons. PDFBox 3.0.6 is clean. |
| 6 | Image OS packages | Not run | No Docker on the review machine. |
| 7 | Whose instance | Warn | See condition 3. |
| 8 | Command injection, path traversal, SSRF, deserialisation | Pass | `spawn` with an argument array and no shell; UUID work dirs, sanitised names, manifest-only downloads; no URL inputs; `.omr` (JAXB/zip) inputs refused before the engine by extension allowlist + magic bytes. |
| 9 | Secrets | Pass | Gitleaks: 16 commits and working tree, no leaks. Example configs expect no credentials at all. |
| 10 | Node dependencies | Pass | 0 production advisories; 7 in vitest/vite/esbuild, which are dev-only and excluded by `npm ci --omit=dev`. |
| 11 | Static analysis | Pass | ESLint security: 17 warnings in `src/`, all false positives (paths built from UUIDs; one linear regex). |
| 12 | CI | Info | Upstream CI builds/tests only; actions pinned by major tag; nothing it produces reaches us. |
| 13 | Licence | Info | Wrapper MIT; Audiveris AGPL-3.0. Fine to run unmodified as a separate HTTP service. If we ever patch Audiveris and expose it, AGPL §13 means offering users the modified source. |

### Our side (fixed on this branch)

The review's section 8 turned up real issues in **our** code, all fixed in
`server/services/scoreImport.js` and `server/routes/api.js`, with tests in
`server/test/scoreImportGuards.test.js`:

- **SSRF (medium).** `POST /api/flows/from-file` fetched whatever `blobUrl` the request body gave -
  any signed-in user could make our server request any URL. It now only fetches from this app's own
  Vercel Blob store (`*.public.blob.vercel-storage.com`, https, no credentials/port), at exactly
  the `blobPathname` the upload returned, with redirects refused (`isOwnBlobUrl`).
- **No size caps (medium).** The Blob upload token had no `maximumSizeInBytes`, and the route read
  any body in full. Now 40 MB (`MAX_SCORE_FILE_BYTES`, matching the OMR service's own cap) at upload
  and on read (`readCappedBody`).
- **.mxl zip bomb (medium).** An `.mxl`'s root entry was inflated with no size check. It's now
  refused past 20 MB (`MAX_MUSICXML_BYTES`): first by the size the archive declares, then while inflating as a stream, which stops at the cap - so a forged small size in the header doesn't get past it either.
- **OMR output read as text (functional).** Audiveris exports compressed `.mxl`, but `runOmr` read
  the result with `.text()` - PDF import could never have worked. It now goes through the same capped
  unzip as an uploaded `.mxl`.
- **OMR job id (low).** The id the service returns is URL-encoded before it goes into request paths.
- Checked and fine: `fast-xml-parser` 5.11.1 has no known advisories, doesn't expand entity bombs,
  and refuses external entities (tested with the reader's own options). Only the service's short
  failure detail reaches users, never its log tail.

## Deploying it safely (our config, not upstream's)

Deploy upstream at a **pinned commit** (`git checkout <reviewed sha>`), then add these next to
`deploy/oracle/docker-compose.yml`. They're untested until the first real deploy - verify with
Admin → Security's live probe and the container rules.

`deploy/oracle/Caddyfile` - only proxy requests carrying our token; health check stays open for
monitoring:

```
{$OMR_DOMAIN} {
	handle /healthz {
		reverse_proxy omr:8480
	}
	@authorised header Authorization "Bearer {$OMR_TOKEN}"
	handle @authorised {
		reverse_proxy omr:8480
	}
	handle {
		respond 401
	}
}
```

`deploy/oracle/docker-compose.override.yml` - pass `OMR_TOKEN` to Caddy (a long random value, also
set as `AUDIVERIS_SERVICE_TOKEN` in Vercel), harden the engine container, and give it no route to
the internet:

```yaml
services:
  omr:
    cpus: 1.5
    pids_limit: 512
    read_only: true
    tmpfs:
      - /tmp:size=256m
      - /home/omr:size=256m   # Audiveris writes its config/logs under $HOME
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    networks: [engine]
  caddy:
    environment:
      OMR_TOKEN: ${OMR_TOKEN:?set OMR_TOKEN in deploy/oracle/.env}
    networks: [engine, default]

networks:
  engine:
    internal: true   # no egress - the engine never needs the internet
```

## History

| Date | Kind | Upstream | Verdict |
|---|---|---|---|
| 2026-09-23 | Deep review (Claude Code, ML-192) | `a6325864` | Not yet (no auth) |
