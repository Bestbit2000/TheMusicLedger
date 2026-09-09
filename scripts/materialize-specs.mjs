// Writes every active test_cases.script row to tests/generated/tc_<id>.spec.ts
// (ML-29). Pure DB -> file, no AI call and no cost - the scripts themselves
// are written by Claude on request (see .claude/skills/backtest), not
// generated here. Each file starts with a comment mapping it back to its
// test_cases.id so report-run.mjs can record results against the right row.
//
// Usage: DATABASE_URL=<dev branch> node scripts/materialize-specs.mjs

import { readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set - point it at the dev branch (see docs/environments.md).');
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const dir = path.join(__dirname, '..', 'tests', 'generated');
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });

    // A test case can cover several features now (test_case_features,
    // ML-26/29 - see db/migrations/015_test_case_features.sql), so
    // feature_key is aggregated rather than a single joined column.
    const { rows } = await client.query(
      `SELECT tc.id, tc.script, COALESCE(string_agg(f.feature_key, ', ' ORDER BY f.feature_key), '') AS feature_keys
       FROM test_cases tc
       LEFT JOIN test_case_features tcf ON tcf.test_case_id = tc.id
       LEFT JOIN features f ON f.id = tcf.feature_id
       WHERE tc.is_active = true
       GROUP BY tc.id, tc.script`
    );

    for (const row of rows) {
      const fileContent = `// TEST_CASE_ID: ${row.id}\n// FEATURES: ${row.feature_keys}\n${row.script}`;
      writeFileSync(path.join(dir, `tc_${row.id}.spec.ts`), fileContent);
    }

    console.log(`Materialized ${rows.length} test spec(s) into ./tests/generated`);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
