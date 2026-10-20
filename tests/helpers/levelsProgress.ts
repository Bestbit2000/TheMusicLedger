// ML-557: clean-up for the "how far a piece has come" spec. The spec logs a practice session on a throwaway piece
// (so there are sessions and minutes to count); the session and the practice list it makes are taken away again
// here, before the piece itself is deleted, so nothing is left in the test account's history.
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

// The local-dev account's practice sessions that have a block on one of these pieces, and its practice lists
// whose names start with the prefix.
export async function clearProgressTestData(scoreIds: number[], listPrefix: string): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `DELETE FROM sessions s USING accounts a
        WHERE a.id = s.account_id AND a.email = 'local-dev@themusicledger.local'
          AND EXISTS (SELECT 1 FROM session_segments seg WHERE seg.session_id = s.id AND seg.score_id = ANY($1::bigint[]))`,
      [scoreIds]);
    await client.query(
      `DELETE FROM practice_lists pl USING accounts a
        WHERE a.id = pl.owner_account_id AND a.email = 'local-dev@themusicledger.local' AND pl.name LIKE $1`,
      [`${listPrefix}%`]);
    await client.query(
      `DELETE FROM piece_level_starts pls USING accounts a
        WHERE a.id = pls.account_id AND a.email = 'local-dev@themusicledger.local' AND pls.score_id = ANY($1::bigint[])`,
      [scoreIds]);
  });
}
