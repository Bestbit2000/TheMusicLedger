# Release process

Releases are tracked as Jira Versions on the `ML` project (site
`bestbit2000.atlassian.net`) — decided during planning on 2026-09-05/06, so
Jira is the single system of record for "what shipped when," surfaced in-app
via the About page. This doc is the actual step-by-step, and the thing a
`pre-push` hook now enforces the tail end of.

## Versioning rule

X.Y.Z, keyed to the *type* of Jira issue(s) in the release, not strict semver:

- **Patch (Z)** — release contains only Bug-type issues.
- **Minor (Y)** — release contains any non-Bug issue (Story/Task/Epic), patch resets to 0.
- **Major (X)** — only for a deliberate milestone called out explicitly (e.g. the
  Sheets→database migration once it's actually live) — never picked automatically.

The app is pre-1.0 (started at `0.1.0`, not `1.0.0`). Whoever proposes a version
number states it and waits for confirmation before it's cut — never silently
picked.

## Steps

1. Decide which completed Jira issue(s) belong in this release, and what the
   next version number should be per the rule above. **Propose it, get it
   confirmed** — this is the one step that isn't automated on purpose.
2. Run the Jira-side automation:
   ```bash
   npm run cut-release -- <version> <ISSUE-1> [ISSUE-2 ...]
   # e.g. npm run cut-release -- 0.4.1 ML-37
   ```
   This finds-or-creates the Jira Version, tags each issue's Fix Version,
   transitions each issue to Released, marks the Version released, and bumps
   `package.json`'s version to match. See `scripts/cut-release.mjs`.
3. Regenerate the changelog the About page reads:
   ```bash
   npm run sync-releases
   ```
   Writes `public/releases.json` from every released Jira Version. **Must be
   committed** — Vercel's build only runs `npm install`, never this script.
4. Review the diff of `package.json` and `public/releases.json`, then commit:
   ```bash
   git commit -m "Cut release <version>: <short description>"
   ```
5. `git push origin main` — this deploys to production. A `pre-push` hook
   (`.husky/pre-push`) blocks this push if `package.json`'s version didn't
   actually change since `origin/main`, or if `public/releases.json` doesn't
   have an entry for the new version — i.e. it catches exactly the mistake
   made on 2026-09-08 (pushed straight to production with no version bump, no
   Jira Fix Version, no release notes).

## Deliberately not a release

Not every push to `main` needs to be a release — groundwork/infrastructure
commits for a Jira Story that isn't finished yet shouldn't claim a version
(doing so would make the About page claim something is done when it isn't).
For that rare deliberate case, bypass the hook explicitly rather than let it
block you silently-wrong either way:

```bash
SKIP_RELEASE_CHECK=1 git push
```
