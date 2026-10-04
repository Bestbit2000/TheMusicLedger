import pool from '../config/db.js';
import { getAccountBands } from './bands.js';
import { sendSignupAlert } from './signupAlert.js';
import { deletedEmailHash } from './tokenVersions.js';

// The whole app has only ever dealt in email strings - this is the one place
// that resolves one to a real accounts.id, creating the row on first sight.
// ML-392: a new row is a sign-up (a first Google login) - the owner is emailed, with the device from
// `client` ({ userAgent, model }). ON CONFLICT: two first requests at once make one row and one email.
export async function getOrCreateAccount(email, firstName = '', surname = '', client = {}) {
  const existing = await pool.query('SELECT id FROM accounts WHERE email = $1', [email]);
  if (existing.rows.length) return existing.rows[0].id;

  // ML-430: an email whose account was deleted starts again as a fresh, empty account - but it takes
  // over the token number the deletion left, so sign-ins from before the deletion stay signed out.
  const marker = deletedEmailHash(email);
  const inserted = await pool.query(
    `INSERT INTO accounts (email, first_name, surname, token_version)
     VALUES ($1, $2, $3, COALESCE((SELECT token_version FROM deleted_account_markers WHERE email_hash = $4), 0))
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [email, firstName, surname, marker]
  );
  if (inserted.rows.length) await pool.query('DELETE FROM deleted_account_markers WHERE email_hash = $1', [marker]);
  if (!inserted.rows.length) return (await pool.query('SELECT id FROM accounts WHERE email = $1', [email])).rows[0].id;
  await sendSignupAlert({ firstName, surname, email, method: 'Google', ...client });
  return inserted.rows[0].id;
}

// ML-346 added teacher. Which features each type gets: Admin -> Feature access (server/services/features.js).
const ACCOUNT_LEVELS = ['super_admin', 'band_admin', 'premium_member', 'standard_member', 'beta_tester', 'teacher'];

// ML-345: an account's type, for its features - read on every request, so held for 30 seconds.
const levelCache = new Map();
export async function getAccountLevel(accountId) {
  const hit = levelCache.get(String(accountId));
  if (hit && Date.now() - hit.at < 30000) return hit.level;
  const { rows } = await pool.query('SELECT account_level FROM accounts WHERE id = $1', [accountId]);
  const level = rows.length ? rows[0].account_level : 'standard_member';
  levelCache.set(String(accountId), { level, at: Date.now() });
  return level;
}

export function forgetAccountLevel(accountId) {
  levelCache.delete(String(accountId));
}

function toProfile(row, bands) {
  return {
    id: Number(row.id),
    firstName: row.first_name,
    surname: row.surname,
    // ML-330: what the app calls you (home greeting, band members) - null = use the first name
    displayName: row.display_name || null,
    // ML-377: the chosen avatar (one of AVATAR_IDS) - null = your initials
    avatar: row.avatar || null,
    // ML-378: the tools on your home screen (ids from HOME_TOOL_IDS) - null = the default four
    homeTools: row.home_tools || null,
    // ML-387: the stats on your home screen (ids from HOME_STAT_IDS) - null = the default two
    homeStats: row.home_stats || null,
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
    'SELECT id, first_name, surname, display_name, avatar, home_tools, home_stats, email, account_level, created_at FROM accounts WHERE id = $1',
    [accountId]
  );
  if (!rows.length) { const e = new Error('Account not found'); e.status = 404; throw e; }
  return toProfile(rows[0], await getAccountBands(accountId));
}

// Email is Google-sourced (see server/config/passport.js) and never editable
// here - only the name fields the ticket calls out as fillable. Each field is
// optional (ML-330: the name and the display name are saved separately), so
// only the ones sent are changed. A blank display name clears it.
export const DISPLAY_NAME_MAX = 40;
// ML-377: the avatars you can choose (drawn in public/avatars.js - keep the two lists in step). null = initials.
export const AVATAR_IDS = ['cornet', 'euphonium', 'trombone', 'french-horn', 'saxophone', 'clarinet', 'flute',
  'snare-drum', 'metronome', 'music-stand', 'tuning-fork', 'headphones'];
// ML-378: the tools that can be on the home screen (the All tools page's data-tool ids - keep in step with
// public/index.html). The app shows up to four of the ones switched on; a tool that's off for a while stays
// chosen, so the list can hold more than four, but never more than there are tools.
export const HOME_TOOL_IDS = ['metronome', 'tuner', 'timer', 'warmups', 'scales', 'add-piece', 'prepare', 'rehearse', 'theory', 'skills', 'range'];
export function normaliseHomeTools(list) {
  if (list === null) return null;
  if (!Array.isArray(list)) { const e = new Error('Home tools must be a list.'); e.status = 400; throw e; }
  const unknown = list.find(id => !HOME_TOOL_IDS.includes(id));
  if (unknown !== undefined) { const e = new Error('Unknown tool.'); e.status = 400; throw e; }
  return [...new Set(list)];
}
// ML-387: the stats that can be on the home screen (the Stats page's data-stat ids - keep in step with
// public/index.html). As with the tools, the list can hold more than the account type's limit shows.
export const HOME_STAT_IDS = ['time_week', 'time_month', 'time_year', 'streak_current', 'streak_longest', 'sessions_week', 'sessions_month', 'concert', 'theory_last', 'tools_last'];
export function normaliseHomeStats(list) {
  if (list === null) return null;
  if (!Array.isArray(list)) { const e = new Error('Home stats must be a list.'); e.status = 400; throw e; }
  const unknown = list.find(id => !HOME_STAT_IDS.includes(id));
  if (unknown !== undefined) { const e = new Error('Unknown stat.'); e.status = 400; throw e; }
  return [...new Set(list)];
}
export async function updateAccountProfile(accountId, { firstName, surname, displayName, avatar, homeTools, homeStats } = {}) {
  const sets = [];
  const values = [];
  const add = (column, value) => { values.push(value); sets.push(`${column} = $${values.length}`); };
  if (firstName !== undefined) add('first_name', String(firstName ?? '').trim());
  if (surname !== undefined) add('surname', String(surname ?? '').trim());
  if (displayName !== undefined) {
    const name = String(displayName ?? '').trim();
    if (name.length > DISPLAY_NAME_MAX) { const e = new Error(`Display name can be up to ${DISPLAY_NAME_MAX} characters.`); e.status = 400; throw e; }
    add('display_name', name || null);
  }
  if (avatar !== undefined) {
    if (avatar !== null && !AVATAR_IDS.includes(avatar)) { const e = new Error('Unknown avatar.'); e.status = 400; throw e; }
    add('avatar', avatar);
  }
  if (homeTools !== undefined) add('home_tools', normaliseHomeTools(homeTools));
  if (homeStats !== undefined) add('home_stats', normaliseHomeStats(homeStats));
  if (!sets.length) return;
  values.push(accountId);
  await pool.query(`UPDATE accounts SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
}

// ML-330: the name to show for an account - its display name, else first + last name, else email.
export function accountDisplayName(row) {
  return row.display_name || [row.first_name, row.surname].filter(Boolean).join(' ') || row.email || null;
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
  // ML-355 batch 3: how each account logs in - password or not, two-step on, locked, last password login.
  const { rows } = await pool.query(
    `SELECT a.id, a.first_name, a.surname, a.email, a.account_level, a.created_at,
            p.account_id IS NOT NULL AS has_password, p.last_login_at, p.locked_until AS password_locked_until,
            t.enabled_at AS two_step_enabled_at, t.locked_until AS two_step_locked_until
       FROM accounts a
       LEFT JOIN account_passwords p ON p.account_id = a.id
       LEFT JOIN account_two_step t ON t.account_id = a.id
      WHERE a.deleted_at IS NULL -- ML-430: a deleted account is nobody's any more
      ORDER BY a.created_at`
  );
  const lockedUntil = (...times) => times.filter(t => t && new Date(t) > new Date()).sort().pop() || null;
  return rows.map(r => ({
    id: Number(r.id), firstName: r.first_name, surname: r.surname, email: r.email,
    accountLevel: r.account_level, createdAt: r.created_at,
    hasPassword: r.has_password, lastPasswordLoginAt: r.last_login_at,
    twoStepOn: !!r.two_step_enabled_at,
    lockedUntil: lockedUntil(r.password_locked_until, r.two_step_locked_until)
  }));
}

export async function setAccountLevel(accountId, level) {
  if (!ACCOUNT_LEVELS.includes(level)) { const e = new Error('Invalid account level'); e.status = 400; throw e; }
  const { rows } = await pool.query(
    'UPDATE accounts SET account_level = $1 WHERE id = $2 RETURNING id',
    [level, accountId]
  );
  if (!rows.length) { const e = new Error('Account not found'); e.status = 404; throw e; }
  levelCache.delete(String(accountId)); // this server sees the change at once; others within 30 seconds
}

// ML-356: display and reading preferences (accounts.display_prefs) - they follow the account to every
// device. Only these keys and values are kept; anything else is dropped. {} = nothing chosen yet.
export const DISPLAY_PREF_CHOICES = {
  darkMode: [true, false],
  dyslexia: [true, false],                       // 'Increased spacing': more line / letter / word spacing, no italics
  font: ['standard', 'lexend', 'opendyslexic'],
  background: ['standard', 'cream', 'blue', 'green', 'yellow', 'peach'], // ML-359: + soft yellow, peach
  textSize: ['standard', 'large', 'larger']
};
export async function getDisplayPrefs(accountId) {
  const { rows } = await pool.query('SELECT display_prefs FROM accounts WHERE id = $1', [accountId]);
  return rows[0]?.display_prefs || {};
}
export async function saveDisplayPrefs(accountId, prefs) {
  const clean = {};
  for (const [key, allowed] of Object.entries(DISPLAY_PREF_CHOICES)) {
    if (prefs && key in prefs) {
      if (!allowed.includes(prefs[key])) { const e = new Error(`Unknown ${key} setting.`); e.status = 400; throw e; }
      clean[key] = prefs[key];
    }
  }
  // Merged, so one screen can save one setting without resending the others.
  const { rows } = await pool.query(
    'UPDATE accounts SET display_prefs = display_prefs || $2::jsonb WHERE id = $1 RETURNING display_prefs',
    [accountId, JSON.stringify(clean)]);
  return rows[0]?.display_prefs || {};
}
