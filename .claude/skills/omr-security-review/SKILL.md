---
name: omr-security-review
description: Re-run the ML-192 deep security review of solfascribe-omr (the third-party OMR service behind "Create from file" PDF import) and record it for Admin -> Security. Use when asked to re-run/refresh the OMR security review, when Admin -> Security says the upstream repo changed since the last deep review, or before enabling flow_import_from_file.
---

# OMR security review (ML-192)

Target: [solfascribe-omr](https://github.com/James-Aidoo/solfascribe-omr) - TypeScript/Fastify
wrapper around Audiveris (Java, AGPL-3.0). **The repo is not ours**: never push, open issues or PRs
there unless the owner asks. Fixes go in our own deployment config or our client code.

Read `docs/omr-security-review.md` first - it has the plan, the findings so far and the verdict.

Two halves, both shown in **Admin -> Security**:
- **Automated** checks run from the admin page ("Run now") - nothing to do here except look at them.
- **Deep review** (this skill): scanners + a manual read, recorded as a new entry in
  `server/securityReviews/solfascribe-omr.js`. That file ships with the code, so the result appears
  in every environment after the next release. Never write deep-review results to a database.

## 1. Tools (ask before downloading)

Downloading is a separate permission - ask the owner first, name each file, source and size.
Put them in the session scratchpad, never the repo. Verify the checksum against the release's
checksums file before running anything.

| Tool | From | Used for |
|---|---|---|
| Gitleaks | github.com/gitleaks/gitleaks releases (`gitleaks_<v>_windows_x64.zip` + `_checksums.txt`) | secrets in history |
| OSV-Scanner | github.com/google/osv-scanner releases (`osv-scanner_windows_amd64.exe` + `osv-scanner_SHA256SUMS`) | lockfile advisories |
| ESLint + eslint-plugin-security | npm registry (the script installs them into its scratch folder) | risky code patterns |
| Trivy (optional) | only if Docker is available | built image OS packages |

## 2. Run the scanners

```bash
node scripts/omr-security-review.mjs --tools <scratchpad>/tools --out <scratchpad>/omr-review
```

Clones upstream into the scratch folder, runs Gitleaks (history + tree), npm audit (all and
`--omit=dev`), OSV-Scanner, OSV for Audiveris's declared Maven dependencies, and ESLint security.
Writes `draft-run.json` with the head commit, the Audiveris tag's commit, and every tool's result.

## 3. The manual read (the part a script can't do)

1. If Admin -> Security shows the upstream changed, start from the diff:
   `git -C <clone> diff <last reviewed sha>..HEAD`. The last reviewed sha is `upstreamCommitSha` on
   the newest run in `server/securityReviews/solfascribe-omr.js`.
2. Read every file in `src/` in full, whatever the diff says - it's ~1,100 lines.
3. Go through each check in `server/services/securityReview.js` `CHECKS` whose mode is `assisted`
   and decide pass / warn / fail / info / not_run, with evidence. The previous run's results are a
   good template, but re-check each one rather than copying it.
4. For every dependency advisory, decide whether batch PDF/image conversion can actually reach it.
   Ones that can't go in `acceptedAdvisories` (with a reason), so the automated OSV checks report
   them as accepted rather than new. Anything reachable is a finding.
5. Re-check our side too: `server/services/scoreImport.js` and the `/flows/from-file` routes in
   `server/routes/api.js` (SSRF guard, size caps, zip-bomb guard, how OMR output is read).
6. Reach a verdict (`go` / `conditional` / `no-go`) and list the conditions, marking which are done.

## 4. Record it

- **Append** a new run to `server/securityReviews/solfascribe-omr.js` (never edit an old one - the file
  is the audit trail). `reviewedAt` is the real time the review finished, in UTC.
- `cd server && npm test` - `securityReview.test.js` checks every result uses a known check key.
- Update `docs/omr-security-review.md` (findings table, verdict, date).
- Comment on ML-192 with the verdict and what changed since the last review.
- It reaches production with the next release (`docs/release-process.md`). Commit on a branch; don't
  push without the owner's go-ahead.

## Adding a check

Add it to `CHECKS` in `server/services/securityReview.js` (a new key, section, mode, title and
`rerun` text). Automated: add a function to `AUTOMATED` (and `NEEDS` if it reads upstream files), plus
a unit test for any pure rule logic. Assisted: just record results for it in the next deep review.
