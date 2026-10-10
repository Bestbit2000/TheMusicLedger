// Automates the Jira side of "cut a release": tags the given issues with a
// Fix Version (creating it if it doesn't exist) - once each has its line in
// release-notes.json - transitions each issue to
// Released, marks the Version released, and bumps the root package.json
// version to match. Deliberately does NOT run sync-releases or commit/push -
// review `public/releases.json` after regenerating it, and commit/push
// deliberately. See docs/release-process.md for the full checklist this is
// one step of.
//
// Usage: node scripts/cut-release.mjs <version> <ISSUE-1> [ISSUE-2 ...]
// Example: node scripts/cut-release.mjs 0.4.1 ML-37

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import { problemsFor, printProblems } from './releaseNotes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY } = process.env;

if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) {
  console.error(
    'Missing Jira config. Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN and JIRA_PROJECT_KEY in .env (see .env.example).'
  );
  process.exit(1);
}

const auth = { username: JIRA_EMAIL, password: JIRA_API_TOKEN };

const [, , version, ...issueKeys] = process.argv;

if (!version || issueKeys.length === 0) {
  console.error('Usage: node scripts/cut-release.mjs <version> <ISSUE-1> [ISSUE-2 ...]');
  console.error('Example: node scripts/cut-release.mjs 0.4.1 ML-37');
  process.exit(1);
}

// Checked before anything is changed in Jira: every issue needs its line for
// the app's release history (docs/release-process.md).
const noteProblems = problemsFor(issueKeys);
if (noteProblems.length) {
  console.error('Nothing was changed. These issues have no usable release note:');
  printProblems(noteProblems);
  process.exit(1);
}

async function findOrCreateVersion() {
  const { data } = await axios.get(
    `${JIRA_BASE_URL}/rest/api/3/project/${JIRA_PROJECT_KEY}/versions`,
    { auth }
  );
  const existing = data.find((v) => v.name === version);
  if (existing) return existing;

  const { data: created } = await axios.post(
    `${JIRA_BASE_URL}/rest/api/3/version`,
    { name: version, project: JIRA_PROJECT_KEY },
    { auth }
  );
  return created;
}

async function tagIssue(issueKey) {
  await axios.put(
    `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}`,
    { fields: { fixVersions: [{ name: version }] } },
    { auth }
  );
}

async function transitionToReleased(issueKey) {
  const { data } = await axios.get(
    `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/transitions`,
    { auth }
  );
  const releasedTransition = data.transitions.find((t) => t.name === 'Released');
  if (!releasedTransition) {
    console.warn(`  (no "Released" transition available for ${issueKey} right now - left as-is)`);
    return;
  }
  await axios.post(
    `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/transitions`,
    { transition: { id: releasedTransition.id } },
    { auth }
  );
}

async function markVersionReleased(versionId) {
  const releaseDate = new Date().toISOString().slice(0, 10);
  await axios.put(
    `${JIRA_BASE_URL}/rest/api/3/version/${versionId}`,
    { released: true, releaseDate },
    { auth }
  );
}

function bumpPackageVersion() {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

async function main() {
  console.log(`Cutting release ${version} for: ${issueKeys.join(', ')}`);

  const ver = await findOrCreateVersion();
  console.log(`Using Jira Version "${ver.name}" (id ${ver.id})`);

  for (const key of issueKeys) {
    console.log(`Tagging ${key} with Fix Version ${version}...`);
    await tagIssue(key);
    console.log(`Transitioning ${key} to Released...`);
    await transitionToReleased(key);
  }

  console.log('Marking the Jira Version released...');
  await markVersionReleased(ver.id);

  console.log(`Bumping package.json version to ${version}...`);
  bumpPackageVersion();

  console.log('');
  console.log('Done. Next steps:');
  console.log('  1. npm run sync-releases   (regenerates public/releases.json)');
  console.log('  2. Review the diff, then commit both package.json and public/releases.json');
  console.log(`  3. git commit -m "Cut release ${version}: <short description>"`);
  console.log('  4. git push origin main');
  console.log('');
  console.log('Before it goes out: does anything in this release need telling to members (their information,');
  console.log('something that works differently, something they must do)? If so, write the notice on');
  console.log('Admin -> Notifications; if not, say "no notice needed" in the Jira issue. docs/release-process.md');
  console.log('');
  console.log('And: does this release change what one member can show another, or let members contact each');
  console.log('other? If so, the Online Safety Act run-through (docs/online-safety-assessment.md) is done again');
  console.log('first, and the Children\'s Code self-assessment is checked. Say which in the Jira issue.');
}

main().catch((err) => {
  console.error('cut-release failed:', err.response?.data || err.message);
  process.exit(1);
});
