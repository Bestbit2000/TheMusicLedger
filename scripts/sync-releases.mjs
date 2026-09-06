import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY } = process.env;

if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) {
  console.error(
    'Missing Jira config. Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN and JIRA_PROJECT_KEY in .env (see .env.example).'
  );
  process.exit(1);
}

const auth = {
  username: JIRA_EMAIL,
  password: JIRA_API_TOKEN
};

// New-feature-shaped issue types are grouped as "New", everything else
// (Bug) as "Fixes" - keeps the changelog readable without hardcoding every
// possible Jira issue type name.
const FIX_TYPES = new Set(['Bug']);

async function fetchReleasedVersions() {
  const { data } = await axios.get(
    `${JIRA_BASE_URL}/rest/api/3/project/${JIRA_PROJECT_KEY}/versions`,
    { auth }
  );
  return data
    .filter(v => v.released && v.releaseDate)
    // Releases cut on the same day tie on releaseDate alone; break ties by
    // Jira's version id (higher id = created later) so the most recent
    // release is reliably first, not whatever order the API happens to return.
    .sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate) || Number(b.id) - Number(a.id));
}

async function fetchChangesForVersion(versionName) {
  const jql = `project = ${JIRA_PROJECT_KEY} AND fixVersion = "${versionName}"`;
  const { data } = await axios.get(`${JIRA_BASE_URL}/rest/api/3/search/jql`, {
    auth,
    params: { jql, fields: 'summary,issuetype', maxResults: 100 }
  });

  return data.issues
    .filter(issue => !issue.fields.issuetype.subtask)
    .map(issue => ({
      key: issue.key,
      type: FIX_TYPES.has(issue.fields.issuetype.name) ? 'Fixes' : 'New',
      summary: issue.fields.summary
    }));
}

async function main() {
  const versions = await fetchReleasedVersions();
  const releases = [];

  for (const version of versions) {
    const changes = await fetchChangesForVersion(version.name);
    releases.push({ version: version.name, date: version.releaseDate, changes });
  }

  const outPath = path.join(__dirname, '..', 'public', 'releases.json');
  fs.writeFileSync(outPath, JSON.stringify(releases, null, 2) + '\n');

  console.log(`Wrote ${releases.length} release(s) to public/releases.json:`);
  releases.forEach(r => console.log(`  ${r.version} (${r.date}) - ${r.changes.length} change(s)`));
}

main().catch(err => {
  console.error('Sync failed:', err.response?.data || err.message);
  process.exit(1);
});
