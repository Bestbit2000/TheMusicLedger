// Database helpers for the set-up back-test (ML-517): an account's "set-up done" day, read and put a
// known way round. dev branch only (DATABASE_URL from .env). The spec marks its account done again when
// it finishes.
import pg from 'pg';

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// accounts.setup_done_on for a test account: has set-up been seen?
export async function setupDone(email: string): Promise<boolean> {
  return withClient(async (c) => (await c.query('SELECT setup_done_on FROM accounts WHERE email = $1', [email])).rows[0]?.setup_done_on != null);
}
// done = false makes the account a new member again (set-up comes up after signing in); true marks it done.
export async function markSetup(email: string, done: boolean): Promise<void> {
  await withClient((c) => c.query(`UPDATE accounts SET setup_done_on = ${done ? 'COALESCE(setup_done_on, CURRENT_DATE)' : 'NULL'} WHERE email = $1`, [email]));
}
