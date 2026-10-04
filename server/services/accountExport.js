// ML-430: "Download my information" (Account -> My details) - everything the app holds that belongs
// to the member, as one JSON file. It answers the UK GDPR rights of access and of data portability
// without anyone having to ask. Read-only.
//
// Like deletion (accountDeletion.js), it asks the database what belongs to an account instead of
// keeping a list, so a table added later is included by default:
//   1. every table with a column that points at accounts(id) - the member's own rows;
//   2. the rows that hang off those (a piece's blocks and recordings, a session's parts, a quiz's
//      answers...) - followed down through tables that have no account column of their own, so
//      nobody else's rows can come along.
// Left out: sign-in secrets (SECRET_TABLES, and any column whose name says hash, secret or token).

import pool from '../config/db.js';

// Security material, not information to hand out in a file. What matters about them is summarised in `signIn`.
const SECRET_TABLES = new Set(['account_passwords', 'account_two_step', 'account_recovery_codes']);
const SECRET_COLUMN = /hash|secret|token/i;
// Rows that are the member's to see, but whose children belong to other people or to the app as a
// whole (a band's other members, who has read a notice): exported, not followed.
const NOT_FOLLOWED = new Set(['bands', 'band_members', 'notifications', 'security_review_runs']);
const MAX_DEPTH = 4;

const withStatus = (status, message) => Object.assign(new Error(message), { status });
const clean = (row) => Object.fromEntries(Object.entries(row).filter(([column]) => !SECRET_COLUMN.test(column)));

// Every single-column foreign key: { tbl, col, ref } - `tbl.col` points at `ref`.id
async function foreignKeys() {
  const { rows } = await pool.query(
    `SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, c.confrelid::regclass::text AS ref
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       JOIN pg_attribute r ON r.attrelid = c.confrelid AND r.attnum = c.confkey[1]
      WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1 AND r.attname = 'id'
      ORDER BY 1, 2`
  );
  return rows;
}

export async function exportMyAccount(accountId) {
  const account = (await pool.query('SELECT * FROM accounts WHERE id = $1', [accountId])).rows[0];
  if (!account || account.deleted_at) throw withStatus(404, 'Account not found.');

  const keys = await foreignKeys();
  const accountTables = new Set(keys.filter((k) => k.ref === 'accounts').map((k) => k.tbl));
  const data = {};
  const seen = new Map(); // table -> Set of ids already exported
  const add = (table, rows) => {
    if (!rows.length) return [];
    if (!seen.has(table)) { seen.set(table, new Set()); data[table] = []; }
    const fresh = rows.filter((row) => row.id === undefined || !seen.get(table).has(String(row.id)));
    for (const row of fresh) { if (row.id !== undefined) seen.get(table).add(String(row.id)); data[table].push(clean(row)); }
    return fresh;
  };

  // 1. The member's own rows
  let frontier = [];
  for (const link of keys.filter((k) => k.ref === 'accounts' && !SECRET_TABLES.has(k.tbl))) {
    const { rows } = await pool.query(`SELECT * FROM ${link.tbl} WHERE ${link.col} = $1 ORDER BY 1`, [accountId]);
    const fresh = add(link.tbl, rows);
    if (fresh.length && !NOT_FOLLOWED.has(link.tbl)) frontier.push({ table: link.tbl, ids: fresh.map((r) => r.id).filter((id) => id !== undefined) });
  }

  // 2. What hangs off them, through tables with no account column of their own
  for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
    const next = [];
    for (const { table, ids } of frontier) {
      if (!ids.length) continue;
      for (const child of keys.filter((k) => k.ref === table && !accountTables.has(k.tbl) && !SECRET_TABLES.has(k.tbl))) {
        const { rows } = await pool.query(`SELECT * FROM ${child.tbl} WHERE ${child.col} = ANY($1) ORDER BY 1`, [ids]);
        const fresh = add(child.tbl, rows);
        if (fresh.length) next.push({ table: child.tbl, ids: fresh.map((r) => r.id).filter((id) => id !== undefined) });
      }
    }
    frontier = next;
  }

  const [password, twoStep] = await Promise.all([
    pool.query('SELECT 1 FROM account_passwords WHERE account_id = $1', [accountId]),
    pool.query('SELECT enabled_at FROM account_two_step WHERE account_id = $1', [accountId])
  ]);

  return {
    app: 'The Music Ledger',
    exportedAt: new Date().toISOString(),
    about: 'Everything The Music Ledger holds that belongs to this account. "account" is your details; "data" has one list per kind of record, named as the app stores them. Recordings and documents are listed with the address of each file, not the files themselves. Passwords and sign-in codes are never included.',
    account: clean(account),
    signIn: { hasPassword: password.rows.length > 0, twoStepOn: !!(twoStep.rows[0] && twoStep.rows[0].enabled_at) },
    data
  };
}
