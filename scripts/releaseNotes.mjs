// The line a member reads for each Jira issue on About -> Release history.
// A Jira summary is written for whoever does the work ("Rehearsal score, step
// B: ..."), so it is not what goes in the app: release-notes.json holds one
// line per issue, written for a member, and sync-releases puts that in
// public/releases.json instead. The rule for writing one is in
// docs/release-process.md ("Release notes: one line per issue").

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTES_PATH = path.join(__dirname, '..', 'release-notes.json');

// Releases before this one went out with their Jira summaries and keep them
// until a line is written; from here on a release can't be cut without one.
export const NOTES_REQUIRED_FROM = '0.51.0';
export const NOTE_MAX_LENGTH = 180;

export function loadReleaseNotes() {
  return JSON.parse(fs.readFileSync(NOTES_PATH, 'utf8'));
}

export function needsNotes(version) {
  const a = version.split('.').map(Number);
  const b = NOTES_REQUIRED_FROM.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return true;
}

// The owner, 29 Oct 2026: a change no member would ever notice - an admin-only page, the build, tooling - gets no
// public line. Its entry says so instead, with why: { "internal": true, "why": "Admin -> Costs and usage only" }.
// It is still checked (so nothing is left out by accident) but it is not shown on About -> Release history.
export const isInternal = (note) => !!note && typeof note === 'object' && note.internal === true;
// What the line is for each kind of entry - for the list cut-release prints
export const noteKind = (note) => (isInternal(note) ? 'internal' : 'members');

// Returns what is wrong with a line, or null if it is fine.
export function noteProblem(note) {
  if (isInternal(note)) {
    return typeof note.why === 'string' && note.why.trim() ? null : 'is marked internal but doesn\'t say why ("why": "...")';
  }
  if (typeof note !== 'string' || !note.trim()) return 'has no line in release-notes.json';
  if (!note.startsWith('We ')) return 'must start with "We "';
  if (!/[.!]$/.test(note)) return 'must end with a full stop';
  if (/[\r\n]/.test(note)) return 'must be one line';
  if (note.length > NOTE_MAX_LENGTH) return `is ${note.length} characters (the most is ${NOTE_MAX_LENGTH})`;
  if (/\bML-\d+/.test(note)) return 'must not name a Jira issue';
  return null;
}

export function problemsFor(issueKeys, notes = loadReleaseNotes()) {
  return issueKeys
    .map(key => ({ key, problem: noteProblem(notes[key]) }))
    .filter(p => p.problem);
}

export function printProblems(problems) {
  problems.forEach(p => console.error(`  ${p.key} ${p.problem}`));
  console.error('');
  console.error('Write one line per issue in release-notes.json: what changed for a member, starting "We ...".');
  console.error('Is it internal only (an admin page, the build, tooling - nothing a member would notice)? Then mark it');
  console.error('instead: "ML-123": { "internal": true, "why": "Admin -> Costs and usage only" } - it is not shown to members.');
  console.error('See "Release notes: one line per issue" in docs/release-process.md.');
}

// Said every time the notes are checked, so each issue's choice is looked at: for members, or internal only
export function printKinds(issueKeys, notes = loadReleaseNotes()) {
  const forMembers = issueKeys.filter((k) => noteKind(notes[k]) === 'members');
  const internal = issueKeys.filter((k) => noteKind(notes[k]) === 'internal');
  console.log('Release notes - check each is right:');
  console.log(`  For members (shown on About -> Release history): ${forMembers.length ? forMembers.join(', ') : 'none'}`);
  console.log(`  Internal only (not shown): ${internal.length ? internal.map((k) => `${k} (${notes[k].why})`).join(', ') : 'none'}`);
  console.log('  A change only you see (admin pages, costs, tooling) is internal; anything a member could notice is for members.');
}

// What About -> Release history shows for a release: its changes for members. A release that was all internal still
// shows, with one line saying so, so its version number isn't a blank.
export const BEHIND_THE_SCENES = 'We made some improvements behind the scenes.';
export function changesForMembers(changes, notes = loadReleaseNotes()) {
  const shown = changes.filter((c) => !isInternal(notes[c.key]));
  return shown.length || !changes.length ? shown : [{ key: null, type: 'Fixes', summary: BEHIND_THE_SCENES }];
}
