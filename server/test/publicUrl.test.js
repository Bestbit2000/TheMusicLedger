// ML-231: fetching a web address a member typed, safely (server/utils/publicUrl.js). No network:
// the name lookup and the fetch are stand-ins.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicAddress, checkUrlShape, assertPublicUrl, publicSiteAnswers } from '../utils/publicUrl.js';

const lookupTo = (...addresses) => async () => addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
const answer = (status, location) => ({ status, ok: status >= 200 && status < 300, headers: { get: (h) => (h === 'location' ? location || null : null) }, body: { cancel: async () => {} } });

describe('which addresses are on the public internet', () => {
  test('ordinary addresses are', () => {
    for (const a of ['8.8.8.8', '93.184.216.34', '172.15.0.1', '172.32.0.1', '192.167.1.1', '2606:4700:4700::1111']) assert.equal(isPublicAddress(a), true, a);
  });
  test('this machine, private networks, link-local and metadata addresses are not', () => {
    for (const a of ['127.0.0.1', '127.8.8.8', '0.0.0.0', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '224.0.0.1', '255.255.255.255',
      '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:169.254.169.254']) assert.equal(isPublicAddress(a), false, a);
  });
  test('something that is not an address is not', () => {
    assert.equal(isPublicAddress('example.com'), false);
    assert.equal(isPublicAddress(''), false);
  });
});

describe('the shape of the address', () => {
  test('http and https on the ordinary ports', () => {
    assert.equal(checkUrlShape('https://www.cobhamband.co.uk/').hostname, 'www.cobhamband.co.uk');
    assert.equal(checkUrlShape('http://example.org:80/a').hostname, 'example.org');
  });
  test('anything else is refused before any lookup', () => {
    for (const u of ['ftp://example.org/', 'file:///etc/passwd', 'https://user:pass@example.org/', 'https://example.org:8080/', 'http://localhost/', 'http://app.localhost/',
      'http://printer.local/', 'http://db.internal/', 'http://127.0.0.1/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data/', 'http://10.1.2.3/', 'not a url']) {
      assert.throws(() => checkUrlShape(u), (e) => e.status === 400, u);
    }
  });
});

describe('a name is only public if everything it resolves to is', () => {
  test('a public name passes', async () => {
    assert.equal((await assertPublicUrl('https://example.org/', { lookup: lookupTo('93.184.216.34') })).hostname, 'example.org');
  });
  test('a name that points at a private address is refused - even if one of its addresses is public', async () => {
    await assert.rejects(assertPublicUrl('https://sneaky.example/', { lookup: lookupTo('10.0.0.5') }), /not on the public internet/);
    await assert.rejects(assertPublicUrl('https://sneaky.example/', { lookup: lookupTo('93.184.216.34', '127.0.0.1') }), /not on the public internet/);
    await assert.rejects(assertPublicUrl('https://sneaky.example/', { lookup: lookupTo('::ffff:169.254.169.254') }), /not on the public internet/);
  });
  test('a name that can not be found is refused', async () => {
    await assert.rejects(assertPublicUrl('https://nowhere.example/', { lookup: async () => { throw new Error('ENOTFOUND'); } }), /couldn't be found/);
  });
});

describe('does a public site answer?', () => {
  const lookup = async (host) => (host === 'inside.example' ? [{ address: '10.0.0.5', family: 4 }] : [{ address: '93.184.216.34', family: 4 }]);
  test('yes for a 200, no for an error or no answer - and never more than that', async () => {
    assert.equal(await publicSiteAnswers('https://example.org/', { lookup, fetchImpl: async () => answer(200) }), true);
    assert.equal(await publicSiteAnswers('https://example.org/', { lookup, fetchImpl: async () => answer(404) }), false);
    assert.equal(await publicSiteAnswers('https://example.org/', { lookup, fetchImpl: async () => { throw new Error('timeout'); } }), false);
  });
  test('a redirect is followed by hand, and each hop is checked', async () => {
    const seen = [];
    const hops = { 'https://example.org/': answer(301, 'https://www.example.org/home'), 'https://www.example.org/home': answer(200) };
    assert.equal(await publicSiteAnswers('https://example.org/', { lookup, fetchImpl: async (u, o) => { seen.push([u, o.redirect]); return hops[u]; } }), true);
    assert.deepEqual(seen, [['https://example.org/', 'manual'], ['https://www.example.org/home', 'manual']]);
  });
  test('a redirect to a private address is refused, and that address is never fetched', async () => {
    const fetched = [];
    const fetchImpl = async (u) => { fetched.push(u); return answer(302, 'http://169.254.169.254/latest/meta-data/'); };
    await assert.rejects(publicSiteAnswers('https://example.org/', { lookup, fetchImpl }), /not on the public internet/);
    assert.deepEqual(fetched, ['https://example.org/']);
    const toName = async (u) => { fetched.push(u); return answer(302, 'https://inside.example/'); };
    await assert.rejects(publicSiteAnswers('https://example.org/x', { lookup, fetchImpl: toName }), /not on the public internet/);
    assert.ok(!fetched.includes('https://inside.example/'));
  });
  test('an endless chain of redirects gives up', async () => {
    let n = 0;
    assert.equal(await publicSiteAnswers('https://example.org/', { lookup, maxRedirects: 3, fetchImpl: async () => { n += 1; return answer(302, `https://example.org/${n}`); } }), false);
    assert.equal(n, 4);
  });
  test('a private address is refused before anything is fetched', async () => {
    let fetched = false;
    await assert.rejects(publicSiteAnswers('http://127.0.0.1/', { lookup, fetchImpl: async () => { fetched = true; return answer(200); } }), /not on the public internet/);
    assert.equal(fetched, false);
  });
});
