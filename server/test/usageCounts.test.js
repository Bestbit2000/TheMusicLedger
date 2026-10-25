// ML-22: usage counts - every button has a name a tap is counted by, the naming rule, and which counts the
// server takes (public/usage.js, server/services/usageRules.js, docs/usage-stats.md). Pure - no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Usage, cleanRows, whoFor } from '../services/usageRules.js';
import { items } from '../../scripts/usage-buttons.mjs';

test('every button in the app has a name a tap can be counted by', () => {
  const unnamed = items.filter((it) => !it.name).map((it) => `${it.where}: ${it.label}`);
  assert.deepEqual(unnamed, [], 'give each an id, a data-* attribute, or data-count="..." (docs/usage-stats.md, "Every button")');
  assert.ok(items.length > 500, 'the button list was read');
});

test('a button is counted by its id, its action, a data attribute or data-count - never its words', () => {
  assert.equal(Usage.buttonName([['type', 'button'], ['id', 'scalesPlayBtn']]), '#scalesPlayBtn');
  assert.equal(Usage.buttonName([['data-act', 'view-menu'], ['data-arg', 'statsHomeView']]), 'view-menu(statsHomeView)');
  assert.equal(Usage.buttonName([['data-setup', 'next']]), 'data-setup=next');
  assert.equal(Usage.buttonName([['data-setup', 'inst:44']]), 'data-setup');           // a value with an id in it is left off
  assert.equal(Usage.buttonName([['id', 'row-12']]), '#row-N');                       // every row of a list is one button
  assert.equal(Usage.buttonName([['data-count', 'pb-option'], ['data-pb-speed', '80']]), 'data-pb-speed'); // data-count only without another
  assert.equal(Usage.buttonName([['data-count', 'keep-account'], ['data-modal-x', '']]), 'keep-account');
  assert.equal(Usage.buttonName([['class', 'modal-close-x']], true), 'close (X)');
  assert.equal(Usage.buttonName([['class', 'btn-submit'], ['aria-label', 'Save Concerto in D']]), null);
});

test('the server takes only well-formed counts, one row per item', () => {
  const rows = cleanRows([
    { k: 'use', i: 'metronome', p: 'own', s: 1, f: 1, m: 1 },
    { k: 'use', i: 'metronome', p: 'own', s: 2, f: 0, m: 1 },     // the same item again: added up
    { k: 'tap', i: 'scalesView #scalesPlayBtn', p: 'session', s: 3 },
    { k: 'view', i: 'scalesView', p: 'own', s: 1 },
    { k: 'use', i: 'not-a-tool', p: 'own', s: 1 },                 // not on the list
    { k: 'view', i: 'Concerto in D', p: 'own', s: 1 },             // not a screen
    { k: 'tap', i: 'scalesView <b>x</b>', p: 'own', s: 1 },        // not a name
    { k: 'tap', i: 'scalesView #x', p: 'elsewhere', s: 1 },        // not a place
    { k: 'tap', i: 'scalesView #y', p: 'own', s: -4 },             // nothing to add
    { k: 'tap', i: 'scalesView #z', p: 'own', s: 99999 }           // capped
  ]);
  assert.deepEqual(rows, [
    { kind: 'use', item: 'metronome', place: 'own', started: 3, finished: 1, members: 1 },
    { kind: 'tap', item: 'scalesView #scalesPlayBtn', place: 'session', started: 3, finished: 0, members: 0 },
    { kind: 'view', item: 'scalesView', place: 'own', started: 1, finished: 0, members: 0 },
    { kind: 'tap', item: 'scalesView #z', place: 'own', started: 500, finished: 0, members: 0 }
  ]);
  assert.throws(() => cleanRows(new Array(301).fill({ k: 'view', i: 'mainView', p: 'own', s: 1 })), /Too many/);
  assert.throws(() => cleanRows('nonsense'), /Too many/);
});

test('the owner and the test accounts are kept apart from members', () => {
  assert.equal(whoFor('someone@example.com', 'standard'), 'member');
  assert.equal(whoFor('owner@example.com', 'super_admin'), 'admin');
  assert.equal(whoFor('local-dev@themusicledger.local', 'beta_tester'), 'test');
});

test('every use the app counts is one the server takes', () => {
  for (const item of Object.keys(Usage.USES)) assert.equal(cleanRows([{ k: 'use', i: item, p: 'own', s: 1 }]).length, 1, item);
});
