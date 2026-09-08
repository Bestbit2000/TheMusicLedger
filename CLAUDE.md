# TheMusicLedger

Music practice tracking app. Currently backed by a single Google Sheet per user
(`code.gs`, `server/config/google.js`, `server/routes/api.js`) with an Express
backend (`server/`) and a static frontend (`public/`), deployed on Vercel.

## In progress: move off Google Sheets to Postgres

A full relational schema has been designed (accounts/bands/tutors, scores with
sectioned multi-bar metronome data per Jira `ML-35`, practice lists, sessions,
scales, technique exercises, challenges, and a monetization layer) but
**no migration or implementation has started yet**.

Before working on data model, scores, sections, the metronome, practice lists,
sessions, or billing/subscriptions: read
[`docs/database-schema.md`](docs/database-schema.md) first — it has the full
table list, the reasoning behind each design decision, and the open questions
still unresolved.

The actual SQL migrations implementing that schema are in
[`db/migrations/`](db/migrations/), applied via `npm run migrate` (see
[`docs/migrations.md`](docs/migrations.md) for file order and the handful of
translation decisions — BIGINT IDENTITY PKs, polymorphic tables with no FK on
the polymorphic column, etc.).

The Neon project, its three branches (`production`/`sandbox`/`dev`), and how
`.env` maps to them are documented in
[`docs/environments.md`](docs/environments.md) — **read this before running
any migration or touching `DATABASE_URL`**, since which branch that variable
points at changes depending on what's checked out, and production should never
be touched by accident. This doc exists in the repo (not just Jira `ML-21`)
specifically so a Claude session without Jira access still has full context.
