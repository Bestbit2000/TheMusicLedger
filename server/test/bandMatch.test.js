// ML-625: unit tests for "Did you mean...?" on the Ask to join form (public/bandMatch.js) - the bands a typed
// name most likely means, by spelling alone. Loaded with vm, like practicePlan.test.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/bandMatch.js', import.meta.url), 'utf8'), sandbox);
const BM = sandbox.self.BandMatch;
const suggest = (typed, labels) => JSON.parse(JSON.stringify(BM.suggest(typed, labels)));

const DIRECTORY = [
    'Cobham Brass Band (Cobham)',
    'Cobham Training Band (Cobham)',
    'Woking Wind Orchestra (Woking)',
    'West Surrey Wind Band (Woking)',
    'Guildford Concert Band (Guildford)',
    'Farnham Concert Band (Farnham)',
    'Lewes Brass (Lewes)',
    'Epsom Symphonic Winds (Epsom)'
];

describe('Did you mean', () => {
    test('a town typed on its own finds the bands there (the Cobham request, 27 Oct 2026)', () => {
        assert.deepEqual(suggest('Cobham', DIRECTORY), ['Cobham Brass Band (Cobham)', 'Cobham Training Band (Cobham)']);
    });
    test('capitals, punctuation and the common words do not count', () => {
        assert.deepEqual(suggest('the woking wind orchestra!', DIRECTORY).slice(0, 1), ['Woking Wind Orchestra (Woking)']);
        assert.deepEqual(suggest('Guildford Band', DIRECTORY), ['Guildford Concert Band (Guildford)']);
    });
    test('a slip of a letter, or the start of a word, still finds it', () => {
        assert.deepEqual(suggest('Cobam', DIRECTORY).slice(0, 1), ['Cobham Brass Band (Cobham)']);
        assert.deepEqual(suggest('Farnam concert', DIRECTORY), ['Farnham Concert Band (Farnham)']);
        assert.deepEqual(suggest('Guild', DIRECTORY), ['Guildford Concert Band (Guildford)']);
    });
    test('the town counts as much as the name', () => {
        assert.deepEqual(suggest('Woking', DIRECTORY), ['Woking Wind Orchestra (Woking)', 'West Surrey Wind Band (Woking)']);
    });
    test('the best match comes first', () => {
        assert.equal(suggest('Cobham training', DIRECTORY)[0], 'Cobham Training Band (Cobham)');
    });
    test('half the words is enough - "None of these" is always there', () => {
        assert.deepEqual(suggest('Cobham Silver Band', DIRECTORY), ['Cobham Brass Band (Cobham)', 'Cobham Training Band (Cobham)']);
    });
    test('"Silver" (and "District") say what kind of band, so they bring in no other band', () => {
        const withSilver = [...DIRECTORY, 'Sandhurst Silver Band (Sandhurst)', 'Camberley and District Silver Band (Frimley)'];
        assert.deepEqual(suggest('Cobham Silver', withSilver), ['Cobham Brass Band (Cobham)', 'Cobham Training Band (Cobham)']);
        assert.deepEqual(suggest('Camberley District', withSilver), ['Camberley and District Silver Band (Frimley)']);
    });
    test('a "The" at the front of the directory name does not count', () => {
        assert.deepEqual(suggest('Cobham', ['The Cobham Band (Cobham)', 'The Cobham Training Band (Cobham)']), ['The Cobham Band (Cobham)', 'The Cobham Training Band (Cobham)']);
    });
    test('nothing when it already is a band - the name or "Name (Town)" - as the server matches it', () => {
        assert.deepEqual(suggest('Lewes Brass', DIRECTORY), []);
        assert.deepEqual(suggest('lewes brass (lewes)', DIRECTORY), []);
    });
    test('nothing when nothing is close, or only common words were typed', () => {
        assert.deepEqual(suggest('Horsham Borough Band', DIRECTORY), []);
        assert.deepEqual(suggest('brass band', DIRECTORY), []);
        assert.deepEqual(suggest('', DIRECTORY), []);
    });
    test('short words are not stretched into others', () => {
        assert.deepEqual(suggest('Ep', DIRECTORY), []); // under 3 letters is never "the start of" a word
        assert.deepEqual(suggest('Lew', DIRECTORY), ['Lewes Brass (Lewes)']);
    });
    test('never more than five', () => {
        const many = Array.from({ length: 9 }, (_, i) => `Cobham Band ${i + 1} (Cobham)`);
        assert.equal(suggest('Cobham', many).length, BM.MAX);
    });
});
