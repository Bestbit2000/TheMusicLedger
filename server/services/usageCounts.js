// ML-22: usage counts - the server side. The app gathers its counts on the device (public/usage.js) and
// sends them every 30 seconds; each is added to its item's row for today (usage_counts, migration 160).
// Nothing about who sent them is kept: the account is used only to tell a member's use from the owner's
// own and from the local test accounts (`who`). Which rows are taken: usageRules.js. See docs/usage-stats.md.
import pool from '../config/db.js';
import { cleanRows } from './usageRules.js';

export { whoFor } from './usageRules.js';

export async function recordUsage(rows, who) {
  const clean = cleanRows(rows);
  if (!clean.length) return 0;
  await pool.query(
    `INSERT INTO usage_counts (day, kind, item, place, who, started, finished, members)
     SELECT (now() AT TIME ZONE 'Europe/London')::date, x.kind, x.item, x.place, $1, x.started, x.finished, x.members
       FROM unnest($2::text[], $3::text[], $4::text[], $5::int[], $6::int[], $7::int[]) AS x(kind, item, place, started, finished, members)
     ON CONFLICT (day, kind, item, place, who) DO UPDATE SET
       started = usage_counts.started + EXCLUDED.started,
       finished = usage_counts.finished + EXCLUDED.finished,
       members = usage_counts.members + EXCLUDED.members`,
    [who, clean.map((r) => r.kind), clean.map((r) => r.item), clean.map((r) => r.place), clean.map((r) => r.started), clean.map((r) => r.finished), clean.map((r) => r.members)]
  );
  return clean.length;
}
