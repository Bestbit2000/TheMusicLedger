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

## Dev → sandbox: design gate (ML-198)

Every release reaches `sandbox` (`git push origin sandbox`, Vercel preview) before it goes to
`main`. That push is where **new styling gets checked with the product owner**. The `pre-push`
hook runs `scripts/design-gate.mjs` against the exact commit being pushed, and the push is
blocked until both parts pass. Run it yourself first to see the result early:

```bash
npm run design-gate
```

**Part 1: hard checks.** These must pass and are never bypassed for a normal release:
- `npm run token-audit` has zero errors (no raw colours/spacing/sizes, see `specs/`).
- Every CSS class in `style.css`/`admin.css` belongs to a spec in `specs/components/`.
- Every Layer 2 token in `tokens.css` has a usage comment, and
  `specs/tokens/token-reference.md` is regenerated (`npm run token-reference`).
- Every component spec has an example on **Admin → Design** (`public/admin-design.js`), and
  every example on that page points at a real spec.
- **Accessibility (ML-210)**: `npm run a11y-audit` finds no violation outside
  `specs/accessibility/baseline.json` (which is empty, and may only shrink). It covers contrast
  of every token pair in both themes, clickable non-buttons, accessible names, focus ring,
  44px targets, reduced motion, swipe/drag alternatives, dialog/toast/slider semantics and
  press-to-activate handlers. Every component spec also needs its "## 9. Accessibility" section.
  See `specs/foundations/accessibility.md`.

**Part 1b: accessibility scan and checklist (every sandbox release).** The gate can't see the
rendered page, so also:

1. Run the axe-core scan against the local dev server (11 main screens × light and dark):
   ```bash
   npm run a11y-scan
   ```
   Zero violations required. Paste the summary into the release's Jira issue.
2. Walk the manual checklist for every screen the release changed, and report it alongside the
   design sign-off list:
   - **Keyboard only:** Tab reaches every control in a sensible order, the focus ring is always
     visible, Enter/Space activate, Esc closes menus/dialogs and focus lands back where it was.
   - **Screen reader** (VoiceOver on iOS or TalkBack on Android): every control is announced
     with a name and its state (selected, expanded, playing, muted); new messages are read out.
   - **Both themes**, and with **text zoomed to 200%**: nothing overlaps, clips or disappears.
   - **Anything new that swipes or drags** has a tap alternative (listed in
     `specs/accessibility/gestures.json`).

**Part 2: design sign-off.** The gate lists everything *new to the design system* since the
last sandbox release: new CSS classes, new/changed/removed tokens, new/changed specs. Anything
on that list isn't yet part of the agreed style instructions, so:

1. Show the whole list to the product owner. Point them at **Admin → Design** on the
   dev environment, where every new element is rendered with its tokens annotated.
2. **Wait for explicit approval of each item.** Claude never approves on the owner's behalf and
   never sets `DESIGN_APPROVED` without being told to in this conversation.
3. Anything rejected gets reworked with existing components/tokens, and the gate is run again.
4. Once everything is approved, push: `DESIGN_APPROVED=1 git push origin sandbox`.

After that push the approved items are part of `origin/sandbox`, so the next release only lists
what's new since then. A push to `main` re-runs the hard checks only (sign-off already happened
on the way through sandbox). `DESIGN_GATE_SKIP=1` exists for production-incident hotfixes only
(see the production incident workflow). The next normal release must then pass the gate properly.

**When a release adds a new design element**, the same release must also: add or extend its spec
in `specs/components/`, add its example to `public/admin-design.js` (a `spec: '<name>'` entry
in the right group, with `measure` set to the parts whose spacing should be annotated), and
regenerate the token reference if tokens changed. The Design page is how the owner reviews it.

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
5. **Check for pending migrations against `production` before pushing** —
   not just `dev`/`sandbox`. The code about to go live may depend on a
   migration file that was only ever run against `dev`/`sandbox`; nothing
   catches that mismatch except this step (there's no
   `PRODUCTION_DATABASE_URL` convenience var by design, see
   `docs/environments.md`, so it can't be hook-enforced the way the version
   bump is):
   ```bash
   # Get production's connection string deliberately (via Neon MCP's
   # get_connection_string, or `neon connection-string production`) and run:
   DATABASE_URL="<production connection string>" node db/migrate.js
   ```
   It's safe to run any time — already-applied migrations are skipped (see
   `docs/migrations.md`), so this only ever applies what's actually missing.
   This exists because release 0.21.0 shipped code reading a column
   (`features.enabled`, migration `042_features_enabled.sql`) that had only
   been applied to `dev`/`sandbox` — production 500'd on it live (`ML-195`).
6. `git push origin main` — this deploys to production. A `pre-push` hook
   (`.husky/pre-push`) blocks this push if `package.json`'s version didn't
   actually change since `origin/main`, or if `public/releases.json` doesn't
   have an entry for the new version — i.e. it catches exactly the mistake
   made on 2026-09-08 (pushed straight to production with no version bump, no
   Jira Fix Version, no release notes). It does **not** catch a missing
   migration — that's what step 5 is for.

## Deliberately not a release

Not every push to `main` needs to be a release — groundwork/infrastructure
commits for a Jira Story that isn't finished yet shouldn't claim a version
(doing so would make the About page claim something is done when it isn't).
For that rare deliberate case, bypass the hook explicitly rather than let it
block you silently-wrong either way:

```bash
SKIP_RELEASE_CHECK=1 git push
```
