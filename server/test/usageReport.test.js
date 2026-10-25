// ML-22: the sums behind Admin -> Usage -> Heat map, a tool's buttons and Quiet corners
// (server/services/usageReportRules.js). Pure - no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { weekStarts, splitTap, heatmap, toolButtons, quiet, nameLabel, whereLabel } from '../services/usageReportRules.js';
import { buttonsFile } from '../../scripts/usage-buttons.mjs';

test('the weeks are the Mondays of the last n weeks, this week last', () => {
  assert.deepEqual(weekStarts('2026-10-25', 3), ['2026-10-05', '2026-10-12', '2026-10-19']); // a Sunday
  assert.deepEqual(weekStarts('2026-10-19', 2), ['2026-10-12', '2026-10-19']);              // a Monday
});

test('a tap is where it was pressed and the button\'s name', () => {
  assert.deepEqual(splitTap('scalesView #scalesPlayBtn'), { where: 'scalesView', name: '#scalesPlayBtn' });
  assert.deepEqual(splitTap('scalesView>flowChoiceModal data-choice-idx'), { where: 'scalesView>flowChoiceModal', name: 'data-choice-idx' });
});

test('tools started: a count per week, finished as a share, members the most in one day', () => {
  const weeks = ['2026-10-12', '2026-10-19'];
  const lines = [
    { day: '2026-10-13', kind: 'use', item: 'metronome', started: 3, finished: 2, members: 2 },
    { day: '2026-10-20', kind: 'use', item: 'metronome', started: 5, finished: 4, members: 3 },
    { day: '2026-10-01', kind: 'use', item: 'metronome', started: 9, finished: 9, members: 9 },  // before the weeks shown
    { day: '2026-10-20', kind: 'use', item: 'plan:standard', started: 2, finished: 0, members: 1 }
  ];
  const h = heatmap({ kind: 'use', lines, history: [{ day: '2026-10-14', item: 'theory', started: 4, members: 2 }], weeks, views: [] });
  const metronome = h.groups.find((g) => g.name === 'Everyday').rows.find((r) => r.key === 'metronome');
  assert.deepEqual(metronome.cells, [3, 5]);
  assert.equal(metronome.started, 8);
  assert.equal(metronome.finished, 75);
  assert.equal(metronome.members, 3);
  assert.equal(metronome.tool, 'Metronome (Quick Play)');
  const plan = h.groups.find((g) => g.name === 'Practice sessions').rows.find((r) => r.key === 'plan:standard');
  assert.equal(plan.finished, null);             // a plan is only ever picked
  const theory = h.groups.find((g) => g.name === 'Practise and learn').rows.find((r) => r.key === 'history:theory');
  assert.equal(theory.started, 4);
  assert.equal(theory.history, true);
  const tuner = h.groups.find((g) => g.name === 'Everyday').rows.find((r) => r.key === 'tuner');
  assert.equal(tuner.started, 0);                 // every tool has a row, used or not
});

test('buttons pressed are a row per tool, by the screen they were pressed on', () => {
  const lines = [
    { day: '2026-10-20', kind: 'tap', item: 'scalesView #scalesPlayBtn', started: 4, members: 1 },
    { day: '2026-10-20', kind: 'tap', item: 'scalesView>flowChoiceModal data-choice-idx', started: 2, members: 1 },
    { day: '2026-10-20', kind: 'tap', item: 'tunerView #topBackBtn', started: 1, members: 1 }
  ];
  const rows = heatmap({ kind: 'tap', lines, weeks: ['2026-10-19'], views: [] }).groups[0].rows;
  assert.equal(rows.find((r) => r.key === 'Scales').started, 6);
  assert.equal(rows.find((r) => r.key === 'Tuner').started, 1);
});

test('a tool\'s buttons: most pressed first, words from the list, and the ones never pressed', () => {
  const buttons = [
    { group: 'Scales', where: 'scalesView', name: '#scalesPlayBtn', label: 'Play', html: true },
    { group: 'Scales', where: 'scalesView', name: '#scalesMuteBtn', label: '', html: true },
    { group: 'Scales', where: 'scalesTile()', name: 'data-option', label: '', html: false },
    { group: 'Menu, notices and the rest', where: 'top bar', name: '#topBackBtn', label: '', html: true }
  ];
  const taps = [
    { item: 'scalesView #scalesPlayBtn', place: 'own', started: 3, members: 1 },
    { item: 'scalesView #scalesPlayBtn', place: 'session', started: 1, members: 2 },
    { item: 'scalesView #topBackBtn', place: 'own', started: 2, members: 1 },
    { item: 'scalesSizeModal data-option=small', place: 'own', started: 1, members: 1 }
  ];
  const t = toolButtons({ tool: 'Scales', taps, buttons });
  assert.deepEqual(t.rows.map((r) => [r.label, r.pressed, r.inSession, r.members]), [['Play', 4, 25, 2], ['Back (top bar)', 2, 0, 1], ['Option: small', 1, 0, 1]]);
  assert.deepEqual(t.never.map((b) => b.label), ['Scales mute']);  // the tile was pressed (a built button matches by its name)
  assert.equal(t.buttons, 3);
});

test('quiet corners: only features switched on for members, used less than the limit', () => {
  const features = [
    { key: 'tuning_fork', name: 'Tuning fork', enabled: true, levels: ['Standard member'] },
    { key: 'metronome', name: 'Metronome', enabled: true, levels: ['Standard member'] },
    { key: 'piece_movements', name: 'A piece in movements', enabled: true, levels: [] },  // super admin only: waiting, not quiet
    { key: 'tuner', name: 'Tuner', enabled: false, levels: ['Standard member'] }       // not live
  ];
  const q = quiet({
    features, uses: new Map([['tuning-fork', 1], ['metronome', 40]]), viewsOpened: new Map([['tuningForkView', 2], ['scalesView', 1]]),
    taps: [{ item: 'scalesView #scalesPlayBtn' }],
    buttons: [{ group: 'Scales', where: 'scalesView', name: '#scalesPlayBtn', label: 'Play', html: true }, { group: 'Scales', where: 'scalesView', name: '#scalesMuteBtn', label: 'Mute', html: true }],
    views: ['scalesView', 'tuningForkView', 'rangeView'], below: 5
  });
  assert.deepEqual(q.features.map((f) => [f.key, f.uses]), [['tuning_fork', 3]]);
  assert.deepEqual(q.tools, [{ tool: 'Scales', never: 1, of: 2, labels: ['Scales → Mute'] }]);
  assert.deepEqual(q.screens, ['Range']);
});

test('a button with no words is named from its name; where it is, in words', () => {
  assert.equal(nameLabel('#topBackBtn'), 'Back (top bar)');
  assert.equal(nameLabel('#scalesBpmMinus'), 'Scales bpm minus');
  assert.equal(nameLabel('data-option=up'), 'Option: up');
  assert.equal(whereLabel('scalesSpeedModal'), 'Scales speed');
  assert.equal(whereLabel('scalesView>flowChoiceModal'), 'Scales → Flow choice');
  assert.equal(whereLabel('scalesRenderChoose()'), 'Scales choose (a list)');
});

test('the button list the page reads is up to date (node scripts/usage-buttons.mjs)', () => {
  const saved = JSON.parse(fs.readFileSync(new URL('../usage/buttons.json', import.meta.url), 'utf8'));
  assert.deepEqual(saved, JSON.parse(JSON.stringify(buttonsFile())), 'run node scripts/usage-buttons.mjs and commit server/usage/buttons.json');
});
