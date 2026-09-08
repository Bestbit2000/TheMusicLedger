# Environment setup (Neon + local/sandbox/dev)

Status: **Neon side is live and in use.** Vercel/sandbox deployment and the
actual data migration from the Google Sheet are still outstanding — see
"Outstanding" at the bottom. This is the "what's actually been done and how to
work with it" doc; [`docs/database-schema.md`](database-schema.md) is the "why"
and [`docs/migrations.md`](migrations.md) is "how the schema itself gets
applied". Written here (not just in Jira `ML-21`) specifically so a future
Claude session without access to Jira still has this context.

## Neon project

- Project: `little-haze-42527245`, org: `org-noisy-tooth-38400253`
  (these IDs aren't secret — the actual connection strings are, and those live
  only in the gitignored `.env`, never in this repo).
- Free tier, 10 branches max, currently using 3.

## Branches

| Branch | Parent | Purpose | Schema | Lifetime |
|---|---|---|---|---|
| `production` | — (root/default) | Live data, once the sheet migration happens | Not yet applied — intentionally, until the real migration runs | Permanent |
| `sandbox` | `production` | Shared staging — verify features end-to-end before release | Applied (all 8 migration files) | Permanent |
| `dev` | `production` | Personal local development, disposable | Applied | **Auto-expires 7 days after creation** (see `neon.ts` policy below) |

`sandbox` is deliberately never used for local iteration — it needs to stay a
clean "this is what's about to go live" check, not accumulate half-finished
local experiments. That's what `dev` is for.

## `.env` keys

All written by the Neon CLI, all gitignored:

| Key | Points at | Set by |
|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH` | Whichever branch this repo is currently checked out to (`.neon` file) — **currently `dev`** | `neon link` / `neon checkout <branch>` |
| `SANDBOX_DATABASE_URL` | `sandbox`, always, regardless of which branch is checked out | added manually via `neon connection-string sandbox`, piped straight into `.env` (never typed/displayed in plain text) |

There is deliberately no `PRODUCTION_DATABASE_URL` convenience var — production
should only ever be touched deliberately, not by accident because it happened
to be the default.

**Before running anything against a database, check which branch `DATABASE_URL`
actually points at** (`neon status` or look at `.neon`) — it changes whenever
someone runs `neon checkout`.

## Running migrations against a specific branch

```bash
# Against whichever branch .env / DATABASE_URL currently points at (dev, right now):
node --env-file=.env db/migrate.js

# Against sandbox specifically, regardless of what's checked out:
DATABASE_URL="$SANDBOX_DATABASE_URL" node db/migrate.js
```

(`npm run migrate` is the same as the first form, just via the package.json script.)

## Recreating `dev` once it expires

```bash
neon branches create --name dev --parent production --no-secrets
neon checkout dev
node --env-file=.env db/migrate.js
```

`neon checkout` re-links this repo to the new branch and refreshes `DATABASE_URL`
in `.env` automatically.

## Neon CLI / MCP setup already done

- `neon login` — authenticated.
- `neon mcp -y` — registered Neon's MCP server for Claude Code (and Copilot,
  VS Code). This minted an **account-wide API key** (`neon-cli-mcp-...`, id
  `3320456`) — it reaches everything the account can, across every org. Revoke
  with `neon api-keys revoke 3320456` if it ever needs rotating.
- `neon skills -y` — **skipped**, deliberately not run.
- `neon config init` generated `neon.ts` with a branch policy: the default
  branch (`production`) gets no overrides; any **new** non-default branch gets
  a 7-day TTL; existing branches are left alone. This is why `dev` expires but
  `sandbox` doesn't — `sandbox` already existed when the policy was written.
  `neon config plan` / `neon config apply` have been run and the policy is active.

## Outstanding (from `ML-21`, not yet done)

1. Vercel: add a `sandbox` git branch, confirm it deploys as a Preview
   environment, add sandbox-scoped env vars (DB connection string, OAuth
   redirect URIs) separate from production's.
2. Register the Microsoft Entra ID app (`ML-42`) and add its Client ID/secret
   per environment.
3. Add the sandbox URL to the Google OAuth app's authorised redirect URIs.
4. Write and run the actual data migration script (Google Sheet → `sessions`/
   `challenges` tables) against `sandbox`, verify it, then get sign-off to run
   it against `production` and retire the sheet.
