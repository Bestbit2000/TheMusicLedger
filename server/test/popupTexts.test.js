// ML-618 stage 4: the message each of the owner's pop-ups starts with (server/services/popupTexts.js) - the built-in
// parts are the words the pop-ups used before, the checks a changed part must pass, and that the pop-ups read them
// rather than carrying words of their own. Pure: the pool is never queried.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
const { POPUPS, checkPart, partLabel } = await import('../services/popupTexts.js');
const { ACTION_REASONS } = await import('../services/accountClosing.js');
const { REMOVAL_REASONS } = await import('../services/recordingRemovals.js');
const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

// As the pop-ups put them together (public/admin.js, popupPart / popupMessage)
const part = (key, fills = {}) => key.split('.').slice(1).join('.') in POPUPS[key.split('.')[0]].parts
  ? POPUPS[key.split('.')[0]].parts[key.split('.').slice(1).join('.')].replace(/\{([^{}]*)\}/g, (all, n) => fills[n] ?? all) : '';
const message = (parts) => parts.filter((p) => p !== '').join('\n\n');

describe('the built-in starting messages', () => {
  test('every part passes its own checks', () => {
    for (const [key, p] of Object.entries(POPUPS)) {
      for (const [name, text] of Object.entries(p.parts)) assert.equal(checkPart(key, name, text), null, `${key}.${name}`);
    }
  });
  test('a warning reads as it did before', () => {
    assert.equal(message([part('warn.opening'), part('warn.why.shared'), part('warn.next'), part('warn.closing')]),
      'This is a warning about your Notably Better account.\n\nWhy: something you shared in the app breaks the terms of use, which say what may be shared.\n\nWhat to do next: please read the terms of use (notablybetter.com/terms.html) and keep to them. If it happens again we may close your account.\n\nIf you think this is a mistake, or have a question, email hello@notablybetter.com.');
  });
  test('a removal reads as it did before', () => {
    assert.equal(message([part('remove.opening', { what: 'the recording "Rehearsal 3"', 'where from': ' It has come off the piece X.' }), part('remove.why.person'), part('remove.next.person'), part('remove.closing')]),
      'We have removed the recording "Rehearsal 3" from Notably Better. It has come off the piece X. Nothing else of yours has changed.\n\nWhy: someone who is in it asked us to remove it. Anyone in a recording can ask for that, and when they do we have to remove it everywhere.\n\nWhat to do next: please don\'t upload it again. You are welcome to add a different recording, as long as everyone in it knows it is being shared.\n\nIf you think this is a mistake, or have a question, email hello@notablybetter.com.');
  });
  test('"Another reason" leaves "Why: " to type after', () => {
    for (const key of Object.keys(POPUPS)) assert.equal(POPUPS[key].parts['why.other'], 'Why: ', key);
  });
  test('every reason a pop-up offers has its own "Why" line', () => {
    for (const r of Object.keys(ACTION_REASONS)) { assert.ok(POPUPS.warn.parts[`why.${r}`], `warn ${r}`); assert.ok(POPUPS.close.parts[`why.${r}`], `close ${r}`); }
    for (const r of Object.keys(REMOVAL_REASONS)) { assert.ok(POPUPS.remove.parts[`why.${r}`], r); assert.ok(POPUPS.remove.parts[`next.${r}`], r); }
    for (const k of ['remove_list', 'remove_logo']) for (const r of Object.keys(REMOVAL_REASONS).filter((x) => x !== 'person')) assert.ok(POPUPS[k].parts[`why.${r}`], `${k} ${r}`);
    for (const r of ['reported', 'terms', 'other']) assert.ok(POPUPS.rename.parts[`why.${r}`], r);
  });
  test('each part says what it is on the page', () => {
    assert.equal(partLabel(POPUPS.remove, 'why.person'), 'Why - Someone in it asked for it to be removed');
    assert.equal(partLabel(POPUPS.remove_list, 'next'), 'What to do next (every reason but "Another reason")');
    assert.equal(partLabel(POPUPS.warn, 'opening'), 'First line');
  });
});

describe('checkPart', () => {
  test('the first line keeps what happened, and only its own fill-ins', () => {
    assert.match(checkPart('remove', 'opening', 'We have removed something.'), /needs \{what\}/);
    assert.match(checkPart('remove', 'opening', 'We removed {what} on {date}.'), /\{date\} isn't a fill-in/);
    assert.match(checkPart('warn', 'opening', ''), /can't be empty/);
  });
  test('fill-ins only in the first line; brackets closed; not too long', () => {
    assert.match(checkPart('remove', 'why.person', 'Why: {what} was asked about.'), /only go in the first line/);
    assert.match(checkPart('rename', 'next', 'What next: {'), /isn't closed/);
    assert.match(checkPart('warn', 'closing', 'x'.repeat(801)), /up to 800/);
    assert.equal(checkPart('warn', 'closing', ''), null, 'an empty part is left out');
  });
  test('only the parts and pop-ups there are', () => {
    assert.match(checkPart('warn', 'why.nonsense', 'x'), /no such part/);
    assert.throws(() => checkPart('nope', 'opening', 'x'), /no such pop-up/);
  });
});

describe('from the source', () => {
  test('the pop-ups carry no starting words of their own - they read them', () => {
    const admin = read('public/admin.js');
    for (const words of ['This is a warning about your Notably Better account.', 'Why: someone who is in it asked us to remove it', 'We have changed the name of your band', 'What to do next: you are welcome to add a different logo']) {
      assert.ok(!admin.includes(words), `public/admin.js still has "${words}"`);
    }
    assert.match(admin, /await loadPopupTexts\(\)/);
  });
  test('the routes are super admins only, behind the admin check', () => {
    const routes = read('server/routes/admin.js');
    for (const route of ["get('/popup-texts'", "put('/popup-texts/:key'", "delete('/popup-texts/:key'"]) {
      assert.match(routes, new RegExp(`router\\.${route.replace(/[()/:.-]/g, (c) => `\\${c}`)}, requireAuth, resolveAccount, requireSuperAdmin, requireAdminCheck,`), route);
    }
  });
});
