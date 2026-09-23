// Seeds/clears flows directly in Postgres for the local-dev test account (see auth.ts) - for specs
// that need a flow to act on without clicking through the whole Flow editor first. Always pair with
// deleteLocalDevFlows (adminAccess.ts) in an afterAll, using the same title prefix.
import pg from 'pg';

const TEST_ACCOUNT_EMAIL = 'local-dev@themusicledger.local';

// A personal flow with a single 4-bar 4/4 block at 100bpm - enough for anything that reads or exports
// it. Returns the new flow's id.
export async function createLocalDevFlow(title: string, composer: string | null = null): Promise<number> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: acct } = await client.query('SELECT id FROM accounts WHERE email = $1', [TEST_ACCOUNT_EMAIL]);
    if (!acct.length) throw new Error(`${TEST_ACCOUNT_EMAIL} has no account yet - log in locally once first (see tests/helpers/auth.ts).`);
    const { rows: ts } = await client.query('SELECT id FROM time_signature_options WHERE numerator = 4 AND denominator = 4 LIMIT 1');
    const { rows } = await client.query(
      'INSERT INTO scores (title, composer, owner_account_id) VALUES ($1, $2, $3) RETURNING id',
      [title, composer, acct[0].id]
    );
    const scoreId = rows[0].id;
    await client.query(
      `INSERT INTO metronome_segments (parent_score_id, order_index, bar_count, bpm, time_signature_id, note_value)
       VALUES ($1, 0, 4, 100, $2, 'crotchet')`,
      [scoreId, ts[0].id]
    );
    return Number(scoreId);
  } finally {
    await client.end();
  }
}
