// Teachers (the old Sheet's Lesson "who") are rows in tutors. A teacher belongs to the member who
// typed the name in (ML-472): every read and write here takes that member's account id and touches
// nothing else. Until migration 107 it was one list shared by every member.
// A teacher is a name only (ML-467) - they are not a member and are told nothing, so nothing else
// about them is held. Don't add a column without assessing it first (docs/gdpr-assessment.md).

import pool from '../config/db.js';
import { withStatus } from './metronomeSetups.js';

function toListItem(row) {
  return { name: row.display_name, archived: !row.active };
}

export async function listTutors(accountId) {
  const { rows } = await pool.query('SELECT display_name, active FROM tutors WHERE account_id = $1 ORDER BY display_name', [accountId]);
  return rows.map(toListItem);
}

export async function getOrCreateTutor(accountId, name) {
  const { rows } = await pool.query(
    `INSERT INTO tutors (account_id, display_name) VALUES ($1, $2)
     ON CONFLICT (account_id, display_name) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`,
    [accountId, name]
  );
  return rows[0].id;
}

export async function renameTutor(accountId, oldName, newName) {
  if (oldName === newName) return;
  const taken = await pool.query('SELECT 1 FROM tutors WHERE account_id = $1 AND display_name = $2', [accountId, newName]);
  if (taken.rows.length) throw withStatus(409, `You already have a teacher called ${newName}.`);
  await pool.query('UPDATE tutors SET display_name = $1 WHERE account_id = $2 AND display_name = $3', [newName, accountId, oldName]);
}

export async function isTutorUsedInHistory(accountId, name) {
  const { rows } = await pool.query(
    `SELECT 1 FROM sessions s JOIN tutors t ON t.id = s.tutor_id WHERE t.account_id = $1 AND t.display_name = $2 LIMIT 1`,
    [accountId, name]
  );
  return rows.length > 0;
}

export async function archiveOrDeleteTutor(accountId, name) {
  const usedInHistory = await isTutorUsedInHistory(accountId, name);
  if (usedInHistory) {
    await pool.query('UPDATE tutors SET active = false WHERE account_id = $1 AND display_name = $2', [accountId, name]);
  } else {
    await pool.query('DELETE FROM tutors WHERE account_id = $1 AND display_name = $2', [accountId, name]);
  }
  return usedInHistory;
}

export async function unarchiveTutor(accountId, name) {
  await pool.query('UPDATE tutors SET active = true WHERE account_id = $1 AND display_name = $2', [accountId, name]);
}
