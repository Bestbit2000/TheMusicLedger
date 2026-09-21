# Environment setup (Neon + local/sandbox/dev)

Status: **Neon side is live and in use; production is fully cut over**
(release 0.6.0, 2026-09-09) — schema applied and real data migrated on
`production`, `sandbox`, and `dev`. Sandbox's own Vercel/OAuth setup is also
done (`ML-189`) - see "Outstanding" at the bottom for what's still left. This
is the "what's
actually been done and how to
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
| `production` | — (root/default) | Live data | Applied (all 10 migration files) — schema + real data live since 2026-09-09 | Permanent |
| `sandbox` | `production` | Shared staging — verify features end-to-end before release | Applied (all 10 migration files) | Permanent |
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

## Outstanding

~~1. Vercel: add a `sandbox` git branch, confirm it deploys as a Preview
environment, add sandbox-scoped env vars (DB connection string, OAuth
redirect URIs) separate from production's.~~ — **done**, `ML-189`. The
`sandbox` git branch deploys as its own Vercel Preview, aliased to
`https://themusicledger-sandbox.vercel.app` (also reachable via the
standard `the-music-ledger-git-sandbox-bestbit.vercel.app` branch alias).
`DATABASE_URL`, `GOOGLE_REDIRECT_URI`, and `TEST_LOGIN_SECRET` all have a
`Preview (sandbox)`-scoped override in the Vercel dashboard, separate from
production's - everything else (`GOOGLE_CLIENT_ID`/`_SECRET`, `SESSION_SECRET`,
etc.) is shared across every Preview via the plain `Preview` scope, which
sandbox inherits like any other preview deployment. The sandbox callback URL
is in the Google OAuth app's authorised redirect URIs. Left as-is:
Vercel's own Deployment Protection still gates the sandbox Preview behind a
Vercel account login - intentional for now, not something this ticket
needed to change. `AUDIVERIS_SERVICE_URL` (mentioned in the original
ticket as possibly needing a per-environment value) isn't set for *any*
environment yet, matching `flow_import_from_file` still being feature-gated
off - nothing sandbox-specific to add there until that ships.
1a. **ML-179**: attach a Vercel Blob store to the project (Vercel dashboard),
    which auto-provisions `BLOB_READ_WRITE_TOKEN` for production/preview -
    then copy that same token into local `.env` (see `.env.example`) for
    local Flow recordings/documents upload testing.
2. Register the Microsoft Entra ID app (`ML-43`) and add its Client ID/secret
   per environment.

~~4. Write and run the actual data migration script against `sandbox`, then
`production`~~ — **done**, `ML-21`, release 0.6.0 (2026-09-09).
