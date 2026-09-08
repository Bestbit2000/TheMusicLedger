import pool from '../config/db.js';

// The whole app has only ever dealt in email strings - this is the one place
// that resolves one to a real accounts.id, creating the row on first sight.
export async function getOrCreateAccount(email, firstName = '', surname = '') {
  const existing = await pool.query('SELECT id FROM accounts WHERE email = $1', [email]);
  if (existing.rows.length) return existing.rows[0].id;

  const inserted = await pool.query(
    'INSERT INTO accounts (email, first_name, surname) VALUES ($1, $2, $3) RETURNING id',
    [email, firstName, surname]
  );
  return inserted.rows[0].id;
}
