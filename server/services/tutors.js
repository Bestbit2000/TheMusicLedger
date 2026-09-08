// Teachers (the old Sheet's Lesson "who") map onto tutors, which already
// existed in the schema for exactly this. Not account-scoped - tutors has no
// account_id column (a shared directory, unlike bands which are per-account).

import pool from '../config/db.js';

function toListItem(row) {
  return { name: row.display_name, archived: !row.active };
}

export async function listTutors() {
  const { rows } = await pool.query('SELECT display_name, active FROM tutors ORDER BY display_name');
  return rows.map(toListItem);
}

export async function getOrCreateTutor(name) {
  const existing = await pool.query('SELECT id FROM tutors WHERE display_name = $1', [name]);
  if (existing.rows.length) return existing.rows[0].id;

  const inserted = await pool.query(
    'INSERT INTO tutors (display_name) VALUES ($1) RETURNING id',
    [name]
  );
  return inserted.rows[0].id;
}

export async function renameTutor(oldName, newName) {
  await pool.query('UPDATE tutors SET display_name = $1 WHERE display_name = $2', [newName, oldName]);
}

export async function isTutorUsedInHistory(name) {
  const { rows } = await pool.query(
    `SELECT 1 FROM sessions s JOIN tutors t ON t.id = s.tutor_id WHERE t.display_name = $1 LIMIT 1`,
    [name]
  );
  return rows.length > 0;
}

export async function archiveOrDeleteTutor(name) {
  const usedInHistory = await isTutorUsedInHistory(name);
  if (usedInHistory) {
    await pool.query('UPDATE tutors SET active = false WHERE display_name = $1', [name]);
  } else {
    await pool.query('DELETE FROM tutors WHERE display_name = $1', [name]);
  }
  return usedInHistory;
}

export async function unarchiveTutor(name) {
  await pool.query('UPDATE tutors SET active = true WHERE display_name = $1', [name]);
}
