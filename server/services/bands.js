// "Organisations" (the old Sheet's Rehearsal/Performance "who") are bands
// now - see docs/sheets-to-database-cutover.md for why. Scoped by
// created_by_account_id since bands.name has no uniqueness constraint on its
// own (two accounts could each have their own band called the same thing).

import pool from '../config/db.js';

function toListItem(row) {
  return { name: row.name, archived: !row.active };
}

export async function listBands(accountId) {
  const { rows } = await pool.query(
    'SELECT name, active FROM bands WHERE created_by_account_id = $1 ORDER BY name',
    [accountId]
  );
  return rows.map(toListItem);
}

export async function getOrCreateBand(accountId, name) {
  const existing = await pool.query(
    'SELECT id FROM bands WHERE created_by_account_id = $1 AND name = $2',
    [accountId, name]
  );
  if (existing.rows.length) return existing.rows[0].id;

  const inserted = await pool.query(
    'INSERT INTO bands (name, created_by_account_id) VALUES ($1, $2) RETURNING id',
    [name, accountId]
  );
  return inserted.rows[0].id;
}

export async function renameBand(accountId, oldName, newName) {
  await pool.query(
    'UPDATE bands SET name = $1 WHERE created_by_account_id = $2 AND name = $3',
    [newName, accountId, oldName]
  );
}

export async function isBandUsedInHistory(accountId, name) {
  const { rows } = await pool.query(
    `SELECT 1 FROM sessions s JOIN bands b ON b.id = s.band_id
     WHERE b.created_by_account_id = $1 AND b.name = $2 LIMIT 1`,
    [accountId, name]
  );
  return rows.length > 0;
}

// Deleting a band still referenced in session history would silently orphan
// those past sessions, so it's archived instead - kept in the list (hidden
// from new-entry pickers) rather than removed outright. Mirrors the old
// Sheet's archive-if-used behaviour exactly.
export async function archiveOrDeleteBand(accountId, name) {
  const usedInHistory = await isBandUsedInHistory(accountId, name);
  if (usedInHistory) {
    await pool.query(
      'UPDATE bands SET active = false WHERE created_by_account_id = $1 AND name = $2',
      [accountId, name]
    );
  } else {
    await pool.query(
      'DELETE FROM bands WHERE created_by_account_id = $1 AND name = $2',
      [accountId, name]
    );
  }
  return usedInHistory;
}

export async function unarchiveBand(accountId, name) {
  await pool.query(
    'UPDATE bands SET active = true WHERE created_by_account_id = $1 AND name = $2',
    [accountId, name]
  );
}
