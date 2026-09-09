// Seeds/clears session history directly in Postgres for the local-dev test
// account (server/routes/auth.js, NODE_ENV=development bypass). Some
// features (streaks, stats) need several days of history that would be slow
// and brittle to build one session at a time through the UI - even though
// the UI itself does support picking a past date on the save-session screen
// (see the ML-29 chat: "an instant add won't cut it").
import pg from 'pg';

const TEST_ACCOUNT_EMAIL = 'local-dev@themusicledger.local';

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function getTestAccountId(client: pg.Client): Promise<string> {
  const { rows } = await client.query('SELECT id FROM accounts WHERE email = $1', [TEST_ACCOUNT_EMAIL]);
  if (!rows.length) {
    throw new Error(`${TEST_ACCOUNT_EMAIL} has no account yet - log in locally once first (see tests/helpers/auth.ts).`);
  }
  return rows[0].id;
}

// Same noon-UTC convention as server/routes/api.js's sessionDateToTimestamp,
// so seeded sessions land on the intended calendar date regardless of
// timezone.
function dateAtNoonUtc(daysAgo: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
}

// Inserts one session per day for `days` consecutive days ending today
// (daysAgo 0..days-1) - real rows the app's own streak calculation
// (public/app.js, calculateCurrentStreak) will pick up like any other data.
export async function seedConsecutiveDaySessions(
  days: number,
  sessionType: 'practice' | 'rehearsal' | 'lesson' | 'performance' = 'practice',
  durationMinutes = 20
): Promise<void> {
  await withClient(async (client) => {
    const accountId = await getTestAccountId(client);
    for (let daysAgo = 0; daysAgo < days; daysAgo++) {
      await client.query(
        `INSERT INTO sessions (session_type, account_id, started_at, total_duration_minutes) VALUES ($1, $2, $3, $4)`,
        [sessionType, accountId, dateAtNoonUtc(daysAgo), durationMinutes]
      );
    }
  });
}

// Removes every session for the test account - call before/after a test
// that needs a known-empty starting point, so seeded history (or anything
// logged through the UI during the test) doesn't pile up across runs.
export async function clearTestAccountSessions(): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `DELETE FROM sessions WHERE account_id = (SELECT id FROM accounts WHERE email = $1)`,
      [TEST_ACCOUNT_EMAIL]
    );
  });
}
