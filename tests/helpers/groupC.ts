// Database helpers for the group C back-tests (password login, bands and teachers, feedback, Home
// choices). dev branch only (DATABASE_URL from .env). Reads are for assertions; the only writes are
// deletes of rows these specs created themselves - by a unique marker or the dedicated test address.
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

// ---- features ----
export async function isFeatureLive(featureKey: string): Promise<boolean> {
  return withClient(async (c) => (await c.query('SELECT enabled FROM features WHERE feature_key = $1', [featureKey])).rows[0]?.enabled === true);
}

// ---- password login (ML-355) ----
// Every address the password-login spec uses matches this, and nothing else on dev does.
export const PASSWORD_TEST_EMAIL_LIKE = 'ml-gc-test+%@themusicledger.local';
const isTestEmail = (email: string) => /^ml-gc-test\+[\w-]+@themusicledger\.local$/.test(email);

// The newest emailed link of a kind ('invite' | 'reset') for an address, as a path ("/?invite=...") -
// with MAIL_PROVIDER=log the email is a row in email_outbox. Waits a little for it to arrive.
export async function emailedLinkPath(email: string, purpose: 'invite' | 'reset', afterId = 0): Promise<{ path: string; id: number; subject: string }> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const row = await withClient(async (c) => (await c.query(
      `SELECT id, subject, body_text FROM email_outbox WHERE lower(to_email) = lower($1) AND id > $2 AND body_text LIKE $3 ORDER BY id DESC LIMIT 1`,
      [email, afterId, `%/?${purpose}=%`])).rows[0]);
    const m = row && String(row.body_text).match(new RegExp(`/\\?${purpose}=([A-Za-z0-9_-]+)`));
    if (m) return { path: `/?${purpose}=${m[1]}`, id: Number(row.id), subject: row.subject };
    if (Date.now() > deadline) throw new Error(`No ${purpose} email for ${email} in email_outbox - is the server running with MAIL_PROVIDER=log?`);
    await new Promise(r => setTimeout(r, 400));
  }
}

export async function outboxCount(email: string): Promise<number> {
  return withClient(async (c) => (await c.query('SELECT COUNT(*)::int AS n FROM email_outbox WHERE lower(to_email) = lower($1)', [email])).rows[0].n);
}

export async function tokenVersions(emails: string[]): Promise<Record<string, number | null>> {
  return withClient(async (c) => {
    const { rows } = await c.query('SELECT email, token_version FROM accounts WHERE email = ANY($1)', [emails]);
    const out: Record<string, number | null> = {};
    for (const e of emails) out[e] = null;
    for (const r of rows) out[r.email] = Number(r.token_version);
    return out;
  });
}

export async function accountExists(email: string): Promise<boolean> {
  return withClient(async (c) => (await c.query('SELECT 1 FROM accounts WHERE lower(email) = lower($1)', [email])).rows.length > 0);
}

// Removes everything the password-login spec made: the test account (its password, band memberships
// etc. go with it - ON DELETE CASCADE), its invite / reset links, its emails (and a sign-up alert about
// it), and its per-address rate-limit rows. Only ever touches the dedicated ml-gc-test+... addresses.
export async function removePasswordTestAccounts(): Promise<void> {
  await withClient(async (c) => {
    const { rows } = await c.query('SELECT email FROM accounts WHERE email LIKE $1', [PASSWORD_TEST_EMAIL_LIKE]);
    for (const r of rows) if (!isTestEmail(r.email)) throw new Error(`Refusing to delete ${r.email}`);
    await c.query('DELETE FROM email_outbox WHERE to_email LIKE $1 OR body_text LIKE $2', [PASSWORD_TEST_EMAIL_LIKE, '%ml-gc-test+%@themusicledger.local%']);
    await c.query('DELETE FROM auth_email_links WHERE email LIKE $1', [PASSWORD_TEST_EMAIL_LIKE]);
    await c.query('DELETE FROM auth_rate_events WHERE key LIKE $1', [PASSWORD_TEST_EMAIL_LIKE]);
    await c.query('DELETE FROM accounts WHERE email LIKE $1', [PASSWORD_TEST_EMAIL_LIKE]);
  });
}

// ---- feedback (ML-170) ----
export async function feedbackRows(marker: string): Promise<{ id: number; message: string; email: string; route: string | null; status: string }[]> {
  return withClient(async (c) => (await c.query(
    `SELECT f.id, f.message, a.email, f.route, f.status FROM feedback f JOIN accounts a ON a.id = f.account_id WHERE f.message LIKE $1 ORDER BY f.id`,
    [`%${marker}%`])).rows.map(r => ({ ...r, id: Number(r.id) })));
}
// Admin -> Feedback has no delete, so the spec's own message is removed by its unique marker.
export async function deleteFeedbackByMarker(marker: string): Promise<void> {
  if (!/^GC-FEEDBACK-/.test(marker)) throw new Error('Refusing to delete feedback without the spec marker');
  await withClient(async (c) => { await c.query('DELETE FROM feedback WHERE message LIKE $1', [`%${marker}%`]); });
}

// ---- limits (ML-383) ----
// A limit's value for an account type as it is now. Limits are changed on Admin -> Feature access (e.g. Home
// tools 8 -> 12), so a test reads the number rather than assuming the one the migration seeded.
export async function limitValue(limitKey: string, accountLevel: string): Promise<number | null> {
  return withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT v.value FROM feature_limit_values v JOIN feature_limits l ON l.id = v.limit_id WHERE l.limit_key = $1 AND v.account_level = $2`,
      [limitKey, accountLevel]);
    return rows.length ? Number(rows[0].value) : null;
  });
}

// ---- bands and teachers ----
export async function bandIdsOf(email: string): Promise<number[]> {
  return withClient(async (c) => (await c.query(
    `SELECT m.band_id FROM band_members m JOIN accounts a ON a.id = m.account_id WHERE a.email = $1 ORDER BY m.band_id`, [email])).rows.map(r => Number(r.band_id)));
}
// The bands the app lists for the account / offers in the directory: active ones only (an archived band
// keeps its members but isn't shown).
export async function activeBandIdsOf(email: string): Promise<number[]> {
  return withClient(async (c) => (await c.query(
    `SELECT m.band_id FROM band_members m JOIN accounts a ON a.id = m.account_id JOIN bands b ON b.id = m.band_id
      WHERE a.email = $1 AND b.active ORDER BY m.band_id`, [email])).rows.map(r => Number(r.band_id)));
}
export async function bandCount(): Promise<{ total: number; active: number }> {
  return withClient(async (c) => (await c.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE active)::int AS active FROM bands WHERE kind = 'directory'`)).rows[0]);
}

// ---- Home choices (ML-378 / ML-387) ----
export async function homeChoices(email: string): Promise<{ homeTools: string[] | null; homeStats: string[] | null }> {
  return withClient(async (c) => {
    const r = (await c.query('SELECT home_tools, home_stats FROM accounts WHERE email = $1', [email])).rows[0];
    return { homeTools: r?.home_tools ?? null, homeStats: r?.home_stats ?? null };
  });
}

// The per-IP rate-limit rows (auth_rate_events) the password-login spec itself caused, so repeat runs
// don't trip "too many tries from here". Only rows made since the spec started (dbNow() in its
// beforeAll); nothing else on dev makes these while the spec runs.
export async function dbNow(): Promise<string> {
  return withClient(async (c) => (await c.query('SELECT now()::text AS t')).rows[0].t);
}
export async function removeRateEventsSince(since: string): Promise<void> {
  await withClient(async (c) => {
    await c.query(`DELETE FROM auth_rate_events WHERE created_at >= $1::timestamptz AND kind IN ('login', 'link', 'forgot-ip', 'forgot-email')`, [since]);
  });
}
