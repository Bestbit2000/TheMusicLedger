// ML-377: the avatars (public/avatars.js) - the drawings match the ids the server accepts, and the
// initials fall back sensibly. Loaded with vm, exactly as the browser loads it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/avatars.js', import.meta.url), 'utf8'), sandbox);
const A = sandbox.self.Avatars;

test('every avatar the app draws is one the server accepts, and the other way round', () => {
    const src = fs.readFileSync(new URL('../services/accounts.js', import.meta.url), 'utf8');
    const ids = JSON.parse(/AVATAR_IDS = (\[[^\]]*\])/.exec(src)[1].replace(/'/g, '"'));
    assert.equal(A.LIST.map(a => a.id).join(), ids.join());
    assert.equal(ids.length, 12);
});

test('initials: first name and surname, else one name, else the email', () => {
    assert.equal(A.initials({ firstName: 'andrew', surname: 'storey', email: 'x@y.z' }), 'AS');
    assert.equal(A.initials({ firstName: 'Andrew', surname: '', email: 'x@y.z' }), 'A');
    assert.equal(A.initials({ firstName: '', surname: '', displayName: 'Drew', email: 'x@y.z' }), 'D');
    assert.equal(A.initials({ firstName: '', surname: '', email: 'bob@example.com' }), 'B');
});

test('the circle holds the drawing, or the initials when none is chosen (or it is unknown)', () => {
    assert.match(A.inner({ avatar: 'euphonium' }), /^<svg viewBox="0 0 48 48"/);
    assert.match(A.inner({ avatar: null, firstName: 'Andrew', surname: 'Storey' }), /avatar-initials[^>]*>AS</);
    assert.match(A.inner({ avatar: 'banjo', firstName: 'Andrew', surname: 'Storey' }), />AS</);
    assert.equal(A.label({ avatar: 'french-horn' }), 'Your avatar: French horn');
    assert.equal(A.label({ firstName: 'Andrew', surname: 'Storey' }), 'Your avatar: your initials, A S');
});
