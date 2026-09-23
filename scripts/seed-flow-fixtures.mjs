// ML-204: creates the fixture flows (server/test/fixtures/flowFixtures.js) on dev/sandbox, owned
// by the given account, through the real service layer - same validation the block editor's own
// saves go through - so they can be opened in the app, exported to MusicXML, and re-imported.
//
//   node --env-file=.env scripts/seed-flow-fixtures.mjs --account 3
//
// Re-running replaces them: any flow owned by that account whose title starts with the fixture
// prefix is deleted first. Refuses to run unless NEON_BRANCH is dev or sandbox (see
// docs/environments.md) - fixtures never belong on production.

import { flowFixtures, FIXTURE_TITLE_PREFIX } from '../server/test/fixtures/flowFixtures.js';

const branch = process.env.NEON_BRANCH;
if (!['dev', 'sandbox'].includes(branch)) {
  console.error(`Refusing to run: NEON_BRANCH is "${branch || '(unset)'}" - only dev or sandbox.`);
  process.exit(1);
}
const accountArg = process.argv.indexOf('--account');
const accountId = accountArg > -1 ? Number(process.argv[accountArg + 1]) : NaN;
if (!Number.isInteger(accountId)) {
  console.error('Usage: node --env-file=.env scripts/seed-flow-fixtures.mjs --account <accountId>');
  process.exit(1);
}

const { default: pool } = await import('../server/config/db.js');
const { createFlow, updateFlowMetadata, addYouTubeRecording, deleteFlow } = await import('../server/services/flows.js');
const { createFlowBlock } = await import('../server/services/flowBlocks.js');
const { resolveBlocksForAccount } = await import('../server/services/scoreImport.js');

try {
  const { rows: existing } = await pool.query(
    'SELECT id, title FROM scores WHERE owner_account_id = $1 AND title LIKE $2',
    [accountId, `${FIXTURE_TITLE_PREFIX}%`]
  );
  for (const row of existing) {
    await deleteFlow(accountId, row.id);
    console.log(`deleted  #${row.id} ${row.title}`);
  }

  for (const fixture of flowFixtures) {
    const flow = await createFlow(accountId, { name: fixture.title });
    await updateFlowMetadata(accountId, flow.id, {
      composer: fixture.composer || null, arranger: fixture.arranger || null,
      publisher: fixture.publisher || null, description: fixture.description || null
    });
    for (const y of fixture.youtube || []) await addYouTubeRecording(accountId, flow.id, y);
    // Sequential - createFlowBlock assigns order_index as "current max + 1".
    for (const block of await resolveBlocksForAccount(accountId, fixture.blocks)) {
      await createFlowBlock(accountId, flow.id, block);
    }
    console.log(`created  #${flow.id} ${fixture.title} (${fixture.blocks.length} blocks)`);
  }
} finally {
  await pool.end();
}
