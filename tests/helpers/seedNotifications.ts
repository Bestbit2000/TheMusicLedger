// Seeds/clears notifications (ML-201) directly in Postgres, for specs that need a live, scheduled or
// expired notification without driving the admin panel first. Always clear by the same title
// prefix before seeding and again afterwards - notifications are visible to EVERY account on the
// branch, so leftovers would show up for anyone using dev.
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

// publishInMinutes: negative = already live, positive = scheduled for later.
export async function createNotification(title: string, body: string, publishInMinutes = -1, expiresInMinutes: number | null = null): Promise<number> {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO notifications (title, body, publish_at, expires_at)
       VALUES ($1, $2, now() + make_interval(mins => $3), CASE WHEN $4::int IS NULL THEN NULL ELSE now() + make_interval(mins => $4::int) END)
       RETURNING id`,
      [title, body, publishInMinutes, expiresInMinutes]
    );
    return Number(rows[0].id);
  });
}

export async function deleteNotifications(titlePrefix: string): Promise<void> {
  await withClient(async (client) => {
    await client.query('DELETE FROM notifications WHERE title LIKE $1', [`${titlePrefix}%`]);
  });
}

// Marks every currently-live notification read for the local-dev test account, so a spec that
// asserts "the red dot clears once I read mine" isn't thrown off by some other notification that
// happens to be live and unread on the shared dev branch at the time.
export async function markAllLiveReadForLocalDev(): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO notification_reads (notification_id, account_id)
       SELECT n.id, a.id FROM notifications n, accounts a
       WHERE a.email = 'local-dev@themusicledger.local'
         AND n.withdrawn_at IS NULL AND n.publish_at <= now() AND (n.expires_at IS NULL OR n.expires_at > now())
       ON CONFLICT DO NOTHING`
    );
  });
}
