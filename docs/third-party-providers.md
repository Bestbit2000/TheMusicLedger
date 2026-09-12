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

## Watch list

- **PostHog**: check event volume against the free-tier ceiling if the app's
  user base grows significantly — autocapture records every click, not just
  named events, so volume scales with traffic more than with intentional
  tracking.
