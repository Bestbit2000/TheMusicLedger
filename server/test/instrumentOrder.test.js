// ML-331: the instrument picker's order - families in FAMILY_ORDER (Brass first), then A-Z inside each
// family by the instrument itself, ignoring the key in front of its name ("B♭ ", "E♭ / D ", "EE♭ ").
// Pure: the pool is created but never queried.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
const { instrumentSortName, compareInstruments } = await import('../services/instruments.js');

describe('instrumentSortName', () => {
  test('drops a key prefix', () => {
    assert.equal(instrumentSortName('B♭ Cornet'), 'Cornet');
    assert.equal(instrumentSortName('E♭ / D Trumpet'), 'Trumpet');
    assert.equal(instrumentSortName('EE♭ Contrabass Saxophone'), 'Contrabass Saxophone');
    assert.equal(instrumentSortName('F / E♭ Mellophone'), 'Mellophone');
    assert.equal(instrumentSortName('A Clarinet'), 'Clarinet');
  });
  test('leaves names without one alone', () => {
    assert.equal(instrumentSortName('Alto Flute'), 'Alto Flute');
    assert.equal(instrumentSortName('Concert Harp'), 'Concert Harp');
    assert.equal(instrumentSortName('Piccolo Trumpet'), 'Piccolo Trumpet');
  });
});

describe('compareInstruments', () => {
  test('Brass first, then A-Z inside the family', () => {
    const list = [
      { family: 'Woodwind', name: 'Oboe' },
      { family: 'Brass', name: 'E♭ Soprano Cornet' },
      { family: 'Brass', name: 'B♭ Cornet' },
      { family: 'Brass', name: 'B♭ Baritone Horn' },
      { family: 'Woodwind', name: 'Alto Flute' },
      { family: 'Brass', name: 'Alto Trombone' }
    ].sort(compareInstruments);
    assert.deepEqual(list.map(i => i.name), ['Alto Trombone', 'B♭ Baritone Horn', 'B♭ Cornet', 'E♭ Soprano Cornet', 'Alto Flute', 'Oboe']);
  });
});
