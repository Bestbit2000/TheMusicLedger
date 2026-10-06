#!/usr/bin/env node
// ML-267: the legal check on release. Fails (exit 1) when the app depends on someone who isn't in
// the register (server/thirdParties/register.js) - an npm package, an outside web address, a font -
// or when something a licence asks of us has gone missing (a licence file, a disclaimer).
//
//   npm run third-party-audit            errors and warnings
//   npm run third-party-audit -- --quiet errors only (used by the release gate)
//
// The rules are in server/thirdParties/audit.js; the process is in docs/third-party-providers.md.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import register from '../server/thirdParties/register.js';
import { auditThirdParties } from '../server/thirdParties/audit.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUIET = process.argv.includes('--quiet');

const { errors, warnings } = auditThirdParties({ root: ROOT, register });

if (!QUIET) {
  const byHand = register.entries.flatMap((e) => (e.asks || []).filter((a) => !a.check).map((a) => `${e.name}: ${a.text}`));
  // ML-469: what is signed is the owner's record on the site, which this script can't read - so it is asked by hand
  for (const e of register.entries.filter((x) => x.personalData && x.status !== 'not_in_use')) {
    byHand.push(`${e.name}: it handles members' information - Admin -> Third parties shows a data processing agreement and a transfer safeguard recorded for it (or "not needed").`);
  }
  console.log(`Third parties: ${register.entries.length} in the register.`);
  if (byHand.length) {
    console.log(`\nCheck by hand before a release (${byHand.length}):`);
    for (const line of byHand) console.log(`  - ${line}`);
  }
  if (warnings.length) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings) console.log(`  W ${w}`);
  }
}
if (errors.length) {
  console.log(`\nThird-party audit: ${errors.length} error(s)`);
  for (const e of errors) console.log(`  E ${e}`);
  process.exit(1);
}
if (!QUIET) console.log('\nThird-party audit: 0 errors');
