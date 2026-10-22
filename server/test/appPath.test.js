// ML-242: the front door is the public page and the app lives at /app (server/utils/appPath.js). Links into
// the app are built in one place; a front-door link made for the app before the move is forwarded; and the
// pieces that carry the move (the server's routes, the sign-in hand-back, the public page's hop, the
// installed app and the offline copy) are checked from the source so none of them can be lost.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APP_PATH, APP_LINK_KEYS, appLink, forwardToApp } from '../utils/appPath.js';

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('appLink', () => {
  test('the app is at /app on the given address, with or without a trailing slash', () => {
    assert.equal(APP_PATH, '/app');
    assert.equal(appLink('https://notablybetter.com'), 'https://notablybetter.com/app');
    assert.equal(appLink('https://notablybetter.com/', '?invite=abc'), 'https://notablybetter.com/app?invite=abc');
  });
});

describe('forwardToApp', () => {
  test('a link the app reads goes on to /app', () => {
    for (const key of ['invite', 'reset', 'band-invite', 'change-email', 'flow', 'preview', 'authToken']) {
      assert.equal(forwardToApp({ [key]: 'x' }), true, key);
    }
  });
  test('the public page itself, or anything else in the address, stays', () => {
    assert.equal(forwardToApp({}), false);
    assert.equal(forwardToApp({ utm_source: 'band-newsletter' }), false);
  });
});

describe('the move, from the source', () => {
  test('the server sends the front door to the public page and /app to the app, before the files', () => {
    const src = read('server/app.js');
    assert.match(src, /app\.get\('\/', \(req, res\) => \{\s+if \(forwardToApp\(req\.query\)\)/);
    assert.match(src, /res\.sendFile\(path\.join\(publicPath, 'index\.html'\)\)/);
    assert.match(src, /res\.sendFile\(path\.join\(publicPath, 'app\.html'\)\)/);
    assert.match(src, /app\.get\(APP_PATH,/);
    assert.match(src, /express\.static\(publicPath, \{ index: false \}\)/, 'index.html must not answer for the front door');
    assert.ok(src.indexOf("app.get('/',") < src.indexOf('express.static(publicPath'));
  });
  test('a sign-in comes back to the app, not the public page', () => {
    const src = read('server/routes/auth.js');
    assert.match(src, /const handBack = [^\n]*\n\s+`\$\{appLink\(/);
    assert.match(src, /const closedPage = [^\n]*appLink\(/);
  });
  test('no email builds a link to the front door for the app', () => {
    for (const file of ['passwordAuth.js', 'emailChange.js', 'bands.js']) {
      assert.doesNotMatch(read(`server/services/${file}`), /\}\/\?(invite|reset|band-invite|change-email)=/, file);
    }
  });
  test('the public page moves on a signed-in device first, and a sign-in hand-back', () => {
    const page = read('public/index.html');
    assert.ok(page.indexOf('<script src="public-hop.js"></script>') < page.indexOf('<body'), 'in the head, before anything draws');
    const hop = read('public/public-hop.js');
    assert.match(hop, /#\(authToken=\|closed\)/);
    assert.match(hop, /localStorage\.getItem\('authToken'\)/);
    assert.match(read('public/app.js'), /localStorage\.setItem\('authToken', token\)/, 'the key the hop reads is the one the app writes');
  });
  test('on Vercel the front door is public/index.html, so it must be the public page and the hop must forward old links', () => {
    assert.match(read('public/index.html'), /class="public-body"/, 'index.html is the public page');
    assert.match(read('public/app.html'), /class="app-shell"/, 'app.html is the app');
    const keys = read('public/public-hop.js').match(/var APP_LINK_KEYS = (\[[^\]]*\])/);
    assert.ok(keys, 'the hop lists the links it forwards');
    assert.deepEqual(JSON.parse(keys[1].replace(/'/g, '"')), APP_LINK_KEYS, 'the hop and appPath.js forward the same links');
  });
  test('the installed app and the offline copy open /app', () => {
    assert.equal(JSON.parse(read('public/manifest.json')).start_url, '/app');
    const sw = read('public/sw.js');
    assert.match(sw, /const APP_SHELL = \['\/app',/);
    assert.match(sw, /caches\.match\('\/app'\)/);
  });
});
