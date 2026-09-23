// ML-204: exports flows from whichever branch DATABASE_URL points at to .musicxml files - the
// command-line counterpart of the admin Flows page's Export (same flowTransfer.js code path).
//
//   node --env-file=.env scripts/export-flow-musicxml.mjs --out <dir> <flowId> [<flowId> ...]
//   node --env-file=.env scripts/export-flow-musicxml.mjs --out <dir> --fixtures --account 3

import fs from 'node:fs';
import path from 'node:path';
import { FIXTURE_TITLE_PREFIX } from '../server/test/fixtures/flowFixtures.js';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i > -1 ? args.splice(i, 2)[1] : null; };
const outDir = flag('--out');
const account = flag('--account');
const fixturesIdx = args.indexOf('--fixtures');
const fixturesOnly = fixturesIdx > -1;
if (fixturesOnly) args.splice(fixturesIdx, 1);
if (!outDir || (!fixturesOnly && !args.length) || (fixturesOnly && !account)) {
  console.error('Usage: export-flow-musicxml.mjs --out <dir> <flowId...>  |  --out <dir> --fixtures --account <id>');
  process.exit(1);
}

const { default: pool } = await import('../server/config/db.js');
const { exportFlowAsMusicXml, musicXmlFileName } = await import('../server/services/flowTransfer.js');
const appVersion = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

try {
  let ids = args.map(Number);
  if (fixturesOnly) {
    const { rows } = await pool.query(
      'SELECT id FROM scores WHERE owner_account_id = $1 AND title LIKE $2 ORDER BY title',
      [Number(account), `${FIXTURE_TITLE_PREFIX}%`]
    );
    ids = rows.map(r => Number(r.id));
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (const id of ids) {
    const { flow, xml } = await exportFlowAsMusicXml(id, { appVersion });
    const file = path.join(outDir, musicXmlFileName(flow.title, id));
    fs.writeFileSync(file, xml);
    console.log(`#${id} -> ${file}`);
  }
} finally {
  await pool.end();
}
