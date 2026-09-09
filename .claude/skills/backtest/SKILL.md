---
name: backtest
description: On-request back-test workflow for TheMusicLedger (ML-29) - write/update a Playwright spec for a feature, run the suite against the dev branch, and record results in Neon. Use when asked to add test coverage for a new/changed feature, or to run/check the back-test suite. No GitHub Actions, no ANTHROPIC_API_KEY - Claude does the writing and root-causing itself, in this session.
---

# Back-test workflow (ML-29)

Deliberately **manual, on-request only** - there is no CI trigger, no Jira
webhook, and no separate `ANTHROPIC_API_KEY` billing (see the ML-29 cost
discussion: the automated GitHub Actions/Neon/Claude-API pipeline from the
original ticket attachment was descoped for exactly that reason). Instead,
whoever is driving this Claude Code session does the work a script would
otherwise have done, when asked.

Registry lives in Neon (`db/migrations/012_test_registry.sql`,
`015_test_case_features.sql`): `features` (also the app-wide catalog behind
the admin panel's Features page, ML-26 - not test-specific), `test_cases`
(one row per Playwright spec, `script` column holds the full TypeScript
source), `test_case_features` (join table - **a test case can cover more
than one feature**, e.g. "add a session, then check stats" legitimately
exercises both `session_logging` and `statistics`; link it to every feature
it actually exercises rather than picking just one), `test_runs`,
`test_run_results`. None of these tables are read/written by the running app
itself. See the admin panel's **Test cases** view (linked from Release
tests) to see every test case and which features it's linked to.

## When asked to add test coverage for a feature

1. **Identify the feature(s).** If given a Jira key (e.g. `ML-7`), pull it via
   the Atlassian MCP tools already available in this session. Otherwise infer
   the feature(s) from what was just built/discussed in the conversation -
   check the `features` table for the current catalog and its `feature_key`s
   rather than guessing, since names/keys get edited by hand from the admin
   panel and can drift from what a past session last wrote.
2. **Decide if the spec can cover more than one feature in one flow** - it
   often can, and doing so is preferred over writing near-duplicate specs
   (e.g. one flow that logs a session and then checks the stats dashboard
   covers both `session_logging` and `statistics`; link both in
   `test_case_features`).
3. **Historic/multi-day state (streaks, aggregates over time) needs seeded
   data, not a single UI action.** The save-session screen does let you pick
   a past date, but clicking through the UI N times to build up days of
   history is slow and brittle. Use `tests/helpers/seedHistory.ts`
   (`seedConsecutiveDaySessions(days, sessionType, durationMinutes)`,
   `clearTestAccountSessions()`) to insert real rows directly for the
   `local-dev@themusicledger.local` account, then assert against the UI as
   normal. Always clear before seeding and again after asserting, so state
   doesn't accumulate across repeat runs.
4. **Write the Playwright spec yourself** - this is the step the original
   blueprint had an API call do; here it's just you, writing TypeScript.
   Guidelines (carried over from the blueprint, still good advice):
   - Rely on accessible locators - `getByRole()`, `getByLabel()`, `getByText()`.
     Avoid raw CSS/XPath selectors.
   - **Every radio/checkbox pill in this app is unclickable via `getByRole`.**
     `.radio-group input[type="radio"] { display: none; }` (style.css) hides
     the native input and styles the `<label>` as the visible pill - a
     `display:none` input is excluded from the accessibility tree entirely,
     so `getByRole('radio', {name: '...'})` matches nothing and every
     `.check()`/`.click()` on it times out. Click the `<label>` instead (scope
     it to the right container to avoid matching an identically-labelled pill
     elsewhere in the DOM, e.g. `page.locator('#timerDurationRadios').getByText('10', {exact: true})`),
     and for state assertions read the hidden input directly by id
     (`await expect(page.locator('#cat-practise')).toBeChecked()`) rather than
     via role.
   - Every test needs explicit assertions (`await expect(...).toBeVisible()`, etc).
   - Start each spec with `import { test, expect } from '@playwright/test';`
     and `import { loginAsLocalDev } from '../helpers/auth';`, then call
     `loginAsLocalDev(page)` in a `test.beforeEach`.
   - Test against `http://localhost:3000` (the `baseURL` in
     `playwright.config.ts`) - a local server on the `dev` Neon branch, not
     sandbox. Auth goes through the `NODE_ENV=development` bypass
     (`server/routes/auth.js`), never real Google OAuth.
   - Prefer read-only assertions over ones that mutate saved data (e.g. verify
     a save-session screen is correctly pre-filled rather than actually
     submitting it) unless the test's whole point is verifying a write - the
     `dev` branch is shared enough across a session that repeat runs
     shouldn't pile up junk rows.
5. **Upsert into Neon** - find or create each linked `features` row
   (`feature_key`, `name`, `description`), then insert or update the
   `test_cases` row (`jira_ticket_key`, `title`, `passes_if_criteria`,
   `script`, `version_added` = the app's current `package.json` version), then
   write one `test_case_features` row per linked feature (delete-and-reinsert
   the test case's links is simplest when updating an existing spec). Use
   `DATABASE_URL` from `.env` (points at `dev` - confirm with `.neon`/`docs/environments.md`
   before running anything against a database).
6. **Run it**: `npm run backtest` (materializes every active `test_cases.script`
   into `tests/generated/`, runs the Playwright suite, records the run in
   `test_runs`/`test_run_results`). Requires the local server running (or let
   Playwright's `webServer` config start it) and `DATABASE_URL` pointed at `dev`.
7. **Report the result** back in chat - don't just leave it in the database.

## When asked to run/check the back-test suite

Run `npm run backtest` (starts the local server against `dev` if one isn't
already running - see `playwright.config.ts`'s `webServer`). Report the
passed/failed counts.

## When a test fails

This is the step the blueprint had Claude Haiku do via a separate billed API
call - here, just investigate it yourself:

1. Read the failing `test_run_results` row (`error_message`) and the
   corresponding spec in `tests/generated/tc_<id>.spec.ts`.
2. Reproduce/investigate directly - re-run just that spec
   (`npx playwright test tests/generated/tc_<id>.spec.ts --trace on`), read
   the app code the assertion touches, etc.
3. Write what you found/did into that row's `notes` column:
   `UPDATE test_run_results SET notes = $1 WHERE id = $2`.
4. If the failure is a real regression, say so and propose/apply a fix. If
   the test itself is stale (the feature changed on purpose), update the
   `test_cases.script` and re-run.

## Jira status progression

ML-29's original ask was to move a ticket `In Progress` -> `Ready for
Sandbox` -> `Ready for Sandbox QA` as its back-test passes. Once a feature's
test is added and passing against `dev`, use the Atlassian MCP
(`transitionJiraIssue`) to advance its ticket - but only after confirming
with whoever's driving the session, the same as any other Jira write.
