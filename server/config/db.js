// Postgres connection pool for the running app. Separate from db/migrate.js,
// which is a standalone script - nothing in server/ imported `pg` before this
// (see docs/sheets-to-database-cutover.md).

import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set - see docs/environments.md for which Neon branch each environment should point at.');
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export default pool;
