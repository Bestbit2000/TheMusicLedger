// ML-220: a write the app sends twice is only done once. The app gives each write it queued offline an
// id of its own (X-Client-Write-Id). claimWrite records it before the handler runs: the first arrival
// goes ahead, a later one is told it is already saved. If the handler then fails, the claim is given
// back so the app's next try isn't turned away. See docs/offline.md.
import pool from '../config/db.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isWriteId = (v) => typeof v === 'string' && UUID.test(v);

// Pure: the time the app says something happened, if it is believable - not in the future (five
// minutes' grace for a wrong clock) and not more than 60 days old. Otherwise null: use now.
export function believableTime(value, now = new Date()) {
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  if (t > now.getTime() + 5 * 60 * 1000 || t < now.getTime() - 60 * 86400000) return null;
  return new Date(t).toISOString();
}

// true = this is the first time: do the write. false = it has been done already.
export async function claimWrite(accountId, writeId) {
  const { rowCount } = await pool.query('INSERT INTO client_writes (account_id, write_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [accountId, writeId]);
  if (rowCount && Math.random() < 0.02) pool.query("DELETE FROM client_writes WHERE created_at < now() - interval '60 days'").catch(() => {});
  return rowCount === 1;
}
export async function releaseWrite(accountId, writeId) {
  await pool.query('DELETE FROM client_writes WHERE account_id = $1 AND write_id = $2', [accountId, writeId]);
}
