// Release notes (docs/release-process.md, "Release notes: one line per issue"): one "We ..." line per issue for
// members - or, since 29 Oct 2026 (the owner), an issue marked internal only, which members never see.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteProblem, isInternal, noteKind, changesForMembers, BEHIND_THE_SCENES } from '../../scripts/releaseNotes.mjs';

test('a line for members starts "We", ends with a full stop and names no Jira issue', () => {
  assert.equal(noteProblem('We made the app quicker.'), null);
  assert.match(noteProblem('Made the app quicker.'), /We /);
  assert.match(noteProblem(undefined), /no line/);
});

test('an internal change is marked, with why - and is never shown', () => {
  const internal = { internal: true, why: 'Admin -> Costs and usage only' };
  assert.equal(noteProblem(internal), null);
  assert.equal(isInternal(internal), true);
  assert.equal(noteKind(internal), 'internal');
  assert.equal(noteKind('We made the app quicker.'), 'members');
  assert.match(noteProblem({ internal: true }), /why/, 'it has to say why, so it is a choice and not a gap');
  assert.match(noteProblem({ internal: true, why: '  ' }), /why/);
});

test('About -> Release history shows only the changes for members; an all-internal release says so in one line', () => {
  const notes = { 'ML-1': 'We made the app quicker.', 'ML-2': { internal: true, why: 'Admin only' } };
  const shown = changesForMembers([{ key: 'ML-1', summary: 'We made the app quicker.' }, { key: 'ML-2', summary: 'Jira words' }], notes);
  assert.deepEqual(shown.map((c) => c.key), ['ML-1']);
  const onlyInternal = changesForMembers([{ key: 'ML-2', summary: 'Jira words' }], notes);
  assert.deepEqual(onlyInternal.map((c) => c.summary), [BEHIND_THE_SCENES]);
  assert.deepEqual(changesForMembers([], notes), []);
});

test('every entry in release-notes.json is a usable line or a marked internal change', async () => {
  const { loadReleaseNotes } = await import('../../scripts/releaseNotes.mjs');
  const notes = loadReleaseNotes();
  const internal = Object.entries(notes).filter(([, n]) => isInternal(n));
  for (const [key, n] of internal) assert.equal(noteProblem(n), null, `${key} is internal but has no why`);
});
