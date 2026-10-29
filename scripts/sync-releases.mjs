import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import { loadReleaseNotes, needsNotes, noteProblem, printProblems, isInternal, changesForMembers } from './releaseNotes.mjs';
const RELEASE_NOTES = loadReleaseNotes();

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
    // A sub-task shows only when it has its own line in release-notes.json (owner, 21 Oct 2026: 0.65.0 was
    // mostly the notification sub-tasks of ML-381). Older releases' sub-tasks have no line, so they stay out.
    .filter(issue => !issue.fields.issuetype.subtask || RELEASE_NOTES[issue.key] !== undefined)
    .map(issue => ({
      key: issue.key,
      type: FIX_TYPES.has(issue.fields.issuetype.name) ? 'Fixes' : 'New',
      summary: issue.fields.summary
    }));
}

// What a member reads is the line in release-notes.json, not the Jira summary.
// A release from NOTES_REQUIRED_FROM on must have a line for every issue;
// older ones keep the Jira summary until a line is written for them.
function applyReleaseNotes(releases) {
  const notes = loadReleaseNotes();
  const problems = [];
  for (const release of releases) {
    for (const change of release.changes) {
      const problem = noteProblem(notes[change.key]);
      if (!problem) { if (!isInternal(notes[change.key])) change.summary = notes[change.key]; }
      else if (needsNotes(release.version) || notes[change.key] !== undefined) {
        problems.push({ key: `${change.key} (${release.version})`, problem });
      }
    }
    // The owner, 29 Oct 2026: a change marked internal (admin-only, tooling) isn't shown to members
    release.changes = changesForMembers(release.changes, notes);
  }
  return problems;
}

async function main() {
  const versions = await fetchReleasedVersions();
  const releases = [];

  for (const version of versions) {
    const changes = await fetchChangesForVersion(version.name);
    releases.push({ version: version.name, date: version.releaseDate, changes });
  }

  const problems = applyReleaseNotes(releases);
  if (problems.length) {
    console.error('public/releases.json was NOT written - these issues have no usable release note:');
    printProblems(problems);
    process.exit(1);
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
