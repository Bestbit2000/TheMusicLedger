import pool from '../config/db.js';
import { getAccountBands } from './bands.js';

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

const ACCOUNT_LEVELS = ['super_admin', 'band_admin', 'premium_member', 'standard_member', 'beta_tester'];

function toProfile(row, bands) {
  return {
    id: Number(row.id),
    firstName: row.first_name,
    surname: row.surname,
    email: row.email,
    accountLevel: row.account_level,
    createdAt: row.created_at,
    bands
  };
}

// ML-77 "See account details" - name/email/level/signup date plus the
// account's real band memberships (see server/services/bands.js's shared
// directory section).
export async function getAccountProfile(accountId) {
  const { rows } = await pool.query(
    'SELECT id, first_name, surname, email, account_level, created_at FROM accounts WHERE id = $1',
    [accountId]
  );
  if (!rows.length) { const e = new Error('Account not found'); e.status = 404; throw e; }
  return toProfile(rows[0], await getAccountBands(accountId));
}

// Email is Google-sourced (see server/config/passport.js) and never editable
// here - only the name fields the ticket calls out as fillable.
export async function updateAccountProfile(accountId, { firstName, surname }) {
  await pool.query('UPDATE accounts SET first_name = $1, surname = $2 WHERE id = $3', [firstName, surname, accountId]);
}

// ML-234: the account's own "practice year" for the stats time-period list (051_practice_year_
// setting.sql). Off by default; when on, the year starts on startDay/startMonth.
export async function getPracticeYearSetting(accountId) {
  const { rows } = await pool.query(
    'SELECT practice_year_enabled, practice_year_start_month, practice_year_start_day FROM accounts WHERE id = $1',
    [accountId]
  );
  if (!rows.length) return { enabled: false, startMonth: 9, startDay: 1 };
  return { enabled: rows[0].practice_year_enabled, startMonth: rows[0].practice_year_start_month, startDay: rows[0].practice_year_start_day };
}

export async function updatePracticeYearSetting(accountId, { enabled, startMonth, startDay }) {
  const month = Number(startMonth);
  const day = Number(startDay);
  // 29 Feb is allowed (the stats treat it as 28 Feb in a non-leap year); 31 Apr etc. isn't.
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > daysInMonth[month - 1]) {
    const e = new Error('Choose a real day and month for the start of your practice year.'); e.status = 400; throw e;
  }
  await pool.query(
    'UPDATE accounts SET practice_year_enabled = $1, practice_year_start_month = $2, practice_year_start_day = $3 WHERE id = $4',
    [!!enabled, month, day, accountId]
  );
}

export async function isSuperAdmin(accountId) {
  const { rows } = await pool.query('SELECT account_level FROM accounts WHERE id = $1', [accountId]);
  return rows.length > 0 && rows[0].account_level === 'super_admin';
}

// ---- Admin panel (ML-77: Super-admin-only account-level management) ----

export async function listAccountsForAdmin() {
  const { rows } = await pool.query(
    'SELECT id, first_name, surname, email, account_level, created_at FROM accounts ORDER BY created_at'
  );
  return rows.map(r => ({
    id: Number(r.id), firstName: r.first_name, surname: r.surname, email: r.email,
    accountLevel: r.account_level, createdAt: r.created_at
  }));
}

export async function setAccountLevel(accountId, level) {
  if (!ACCOUNT_LEVELS.includes(level)) { const e = new Error('Invalid account level'); e.status = 400; throw e; }
  const { rows } = await pool.query(
    'UPDATE accounts SET account_level = $1 WHERE id = $2 RETURNING id',
    [level, accountId]
  );
  if (!rows.length) { const e = new Error('Account not found'); e.status = 404; throw e; }
}
