#!/usr/bin/env node
// ML-267: keeps a copy of every npm package's licence in public/licences/npm/, so Admin -> Third
// parties can show the exact text we were given. Run after adding or upgrading a package:
//
//   npm run third-party-licences
//
// Copies the LICENSE file out of node_modules for every package named in package.json and
// server/package.json. Prints the `licenceFile` line for the register, and says which packages
// ship no licence file (those need `noLicenceFile` in the register instead).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPackages } from '../server/thirdParties/audit.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'public/licences/npm';

export const licenceFileName = (pkg) => `${pkg.replace(/^@/, '').replace(/\//g, '__')}.txt`;

fs.mkdirSync(path.join(ROOT, OUT), { recursive: true });
let copied = 0;
for (const name of [...findPackages(ROOT).keys()].sort()) {
  const dir = ['server/node_modules', 'node_modules'].map((b) => path.join(ROOT, b, name)).find((d) => fs.existsSync(d));
  if (!dir) { console.log(`  ? ${name}: not installed - run npm install first`); continue; }
  const file = fs.readdirSync(dir).find((f) => /^licen[sc]e/i.test(f));
  if (!file) { console.log(`  - ${name}: ships no licence file`); continue; }
  const text = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n');
  fs.writeFileSync(path.join(ROOT, OUT, licenceFileName(name)), text);
  copied += 1;
  console.log(`  ✓ ${name}: licenceFile: '${OUT}/${licenceFileName(name)}'`);
}
console.log(`\n${copied} licence(s) copied to ${OUT}/`);
