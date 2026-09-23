// Temporarily raises the local-dev test account (local-dev@themusicledger.local - see auth.ts) to
// super_admin, so specs can exercise the admin panel, then puts it back. Always pair
// grantLocalDevSuperAdmin() in a beforeAll with restoreLocalDevLevel() in an afterAll, so the test
// account doesn't stay elevated between runs. dev branch only (DATABASE_URL from .env).
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

let previousLevel: string | null = null;

export async function grantLocalDevSuperAdmin(): Promise<void> {
  await withClient(async (client) => {
    const { rows } = await client.query('SELECT account_level FROM accounts WHERE email = $1', [TEST_ACCOUNT_EMAIL]);
    if (!rows.length) throw new Error(`${TEST_ACCOUNT_EMAIL} has no account yet - log in locally once first (see tests/helpers/auth.ts).`);
    previousLevel = rows[0].account_level;
    await client.query("UPDATE accounts SET account_level = 'super_admin' WHERE email = $1", [TEST_ACCOUNT_EMAIL]);
  });
}

export async function restoreLocalDevLevel(): Promise<void> {
  await withClient(async (client) => {
    await client.query('UPDATE accounts SET account_level = $1 WHERE email = $2', [previousLevel || 'standard_member', TEST_ACCOUNT_EMAIL]);
  });
}

// Deletes the test account's own flows whose title starts with `prefix` - for specs that import
// flows, so repeat runs don't pile them up. ON DELETE CASCADE removes their blocks/recordings.
export async function deleteLocalDevFlows(prefix: string): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `DELETE FROM scores WHERE title LIKE $1 AND owner_account_id = (SELECT id FROM accounts WHERE email = $2)`,
      [`${prefix}%`, TEST_ACCOUNT_EMAIL]
    );
  });
}
