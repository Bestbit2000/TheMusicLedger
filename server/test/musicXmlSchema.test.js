// ML-204: every MusicXML file the writer produces must validate against the official MusicXML 4.0
// XSD (vendored in ./schema - see its README), not just be well-formed XML. Covers both a fresh
// render of each fixture and the committed files exported from dev.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { flowToMusicXml, musicXmlFileName } from '../services/flowMusicXml.js';
import { flowFixtures, fixtureBlocksAsDtos, fixtureFlow } from './fixtures/flowFixtures.js';
import { assertValidMusicXml } from './helpers/musicXmlSchema.js';

test('every fixture renders to schema-valid MusicXML 4.0', async () => {
  for (const fixture of flowFixtures) {
    await assertValidMusicXml(flowToMusicXml(fixtureFlow(fixture), fixtureBlocksAsDtos(fixture)), fixture.title);
  }
});

test('the committed fixture files are schema-valid MusicXML 4.0', async () => {
  for (const fixture of flowFixtures) {
    const xml = fs.readFileSync(new URL(`./fixtures/musicxml/${musicXmlFileName(fixture.title)}`, import.meta.url), 'utf8');
    await assertValidMusicXml(xml, fixture.title);
  }
});

test('the validator really does reject invalid MusicXML', async () => {
  const fixture = flowFixtures[0];
  const broken = flowToMusicXml(fixtureFlow(fixture), fixtureBlocksAsDtos(fixture)).replace('<voice>1</voice>', '<bogus/><voice>1</voice>');
  await assert.rejects(assertValidMusicXml(broken, 'broken'));
});
