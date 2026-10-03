// Helpers for the sessions / timer / challenges back-tests (tc_new_session_*, tc_new_timer_save,
// tc_new_challenges). Unlike seedHistory.ts's clearTestAccountSessions (which wipes every session), these
// only ever touch the rows a spec made itself - by id, or by an unusual duration used as a marker - so
// other specs' data on the shared local-dev account is left alone.
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

// Every session id the test account has now - take it before a test, and again after, to find what it made.
export async function testAccountSessionIds(): Promise<number[]> {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT s.id FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE a.email = $1 ORDER BY s.id`,
      [TEST_ACCOUNT_EMAIL]
    );
    return rows.map(r => Number(r.id));
  });
}

// The test account's sessions of exactly these lengths (a spec's marker durations), newest first.
export async function sessionIdsWithMinutes(minutes: number[]): Promise<number[]> {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT s.id FROM sessions s JOIN accounts a ON a.id = s.account_id
        WHERE a.email = $1 AND s.total_duration_minutes = ANY($2::int[]) ORDER BY s.id DESC`,
      [TEST_ACCOUNT_EMAIL, minutes]
    );
    return rows.map(r => Number(r.id));
  });
}

// Deletes only these sessions, and only if they belong to the test account.
export async function deleteSessionsById(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await withClient(async (client) => {
    await client.query(
      `DELETE FROM sessions WHERE id = ANY($1::bigint[]) AND account_id = (SELECT id FROM accounts WHERE email = $2)`,
      [ids, TEST_ACCOUNT_EMAIL]
    );
  });
}

// A saved practice session's blocks, in order: [{ type, seconds }].
export async function sessionSegments(sessionId: number): Promise<Array<{ type: string; seconds: number }>> {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT segment_type, actual_seconds FROM session_segments WHERE session_id = $1 ORDER BY order_index`,
      [sessionId]
    );
    return rows.map(r => ({ type: String(r.segment_type), seconds: Number(r.actual_seconds) }));
  });
}
