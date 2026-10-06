// ML-474: the content security policy allows no script written in a page - so there must be none.
// These read the real files on every release: an onclick="..." (or any on...= attribute), a
// <script> with its code in the page, or a javascript: address would be stopped by the browser once
// the policy is enforced, and something in the app would quietly stop working.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CSP, cspValue, securityHeaders, headerFindings } from '../middleware/securityHeaders.js';

const PUBLIC = new URL('../../public/', import.meta.url);
const files = (ext) => fs.readdirSync(PUBLIC).filter((f) => f.endsWith(ext));
const read = (name) => fs.readFileSync(new URL(name, PUBLIC), 'utf8');
// An event attribute inside a tag: <button onclick="...">, in a page or in markup a script builds
const HANDLER = /<[a-zA-Z][^<>]*?\s(on[a-z]+)\s*=\s*["'`\\]/g;
const withoutComments = (text) => text.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('no script is written in a page', () => {
  test('no page has an inline event handler', () => {
    for (const name of files('.html')) {
      const found = [...withoutComments(read(name)).matchAll(HANDLER)].map((m) => m[1]);
      assert.deepEqual(found, [], `${name} has an inline handler - use data-act (CLICK_ACTIONS in app.js) or a listener`);
    }
  });

  test('no script builds markup with an inline event handler', () => {
    for (const name of files('.js')) {
      const found = [...withoutComments(read(name)).matchAll(HANDLER)].map((m) => m[0].slice(0, 80));
      assert.deepEqual(found, [], `${name} builds markup with an inline handler - use data-act (CLICK_ACTIONS in app.js) or a listener`);
    }
  });

  test('every <script> in a page loads a file', () => {
    for (const name of files('.html')) {
      for (const tag of withoutComments(read(name)).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
        assert.ok(/\ssrc\s*=/.test(tag[1]), `${name} has a <script> with no src`);
        assert.equal(tag[2].trim(), '', `${name} has a <script> with code in the page`);
      }
    }
  });

  test('nothing uses a javascript: address, eval or new Function', () => {
    for (const name of [...files('.html'), ...files('.js')]) {
      const text = withoutComments(read(name));
      assert.ok(!/["'`]javascript:/i.test(text), `${name} uses a javascript: address`);
      if (name.endsWith('.js')) assert.ok(!/\beval\s*\(|\bnew Function\s*\(/.test(text), `${name} uses eval or new Function`);
    }
  });

  test('every data-act in the app is an action the table knows, and every action is used', () => {
    const app = read('app.js');
    const table = app.slice(app.indexOf('const CLICK_ACTIONS = {'), app.indexOf('const actBound'));
    const known = new Set([...table.matchAll(/^\s*'([a-z-]+)':/gm)].map((m) => m[1]));
    assert.ok(known.size >= 25, `only ${known.size} actions were found - the reader has stopped understanding the table`);
    const used = new Set();
    for (const name of ['index.html', 'app.js']) for (const m of read(name).matchAll(/data-act="([a-z-]+)"/g)) used.add(m[1]);
    assert.deepEqual([...used].filter((a) => !known.has(a)).sort(), [], 'a data-act names an action that is not in CLICK_ACTIONS');
    assert.deepEqual([...known].filter((a) => !used.has(a)).sort(), [], 'an action in CLICK_ACTIONS is not used any more');
  });
});

describe('the policy itself', () => {
  test('allows no inline script', () => {
    assert.ok(!CSP['script-src'].includes("'unsafe-inline'"));
    assert.ok(!CSP['script-src'].includes("'unsafe-eval'"));
    assert.ok(!/script-src[^;]*unsafe/.test(cspValue()));
  });

  test('once enforced, the review has nothing to say about it', () => {
    const live = { 'strict-transport-security': 'max-age=63072000', ...securityHeaders({ enforceCsp: true }) };
    const csp = headerFindings(live).find((f) => f.text.startsWith('content-security-policy'));
    assert.deepEqual(csp, { ok: true, level: 'warn', text: 'content-security-policy: enforced' });
    const reportOnly = headerFindings({ 'strict-transport-security': 'max-age=63072000', ...securityHeaders({ enforceCsp: false }) }).find((f) => f.text.startsWith('content-security-policy'));
    assert.equal(reportOnly.ok, false);
  });
});
