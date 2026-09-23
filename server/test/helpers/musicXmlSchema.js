// Validates a MusicXML string against the official MusicXML 4.0 XSD vendored in ../schema (see
// its README) - shared by every test that writes MusicXML (ML-204).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateXML } from 'xmllint-wasm';

const schemaFile = (name) => ({ fileName: name, contents: fs.readFileSync(new URL(`../schema/${name}`, import.meta.url), 'utf8') });
const SCHEMA = [schemaFile('musicxml.xsd')];
const PRELOAD = [schemaFile('xlink.xsd'), schemaFile('xml.xsd')];

export async function assertValidMusicXml(xml, label) {
  // The DOCTYPE is dropped only so xmllint doesn't try to fetch the DTD over the network.
  const contents = xml.replace(/<!DOCTYPE[^>]*>/, '');
  const result = await validateXML({ xml: [{ fileName: `${label}.musicxml`, contents }], schema: SCHEMA, preload: PRELOAD });
  assert.ok(result.valid, `${label} is not valid MusicXML 4.0:\n${result.errors.slice(0, 5).map(e => e.rawMessage).join('\n')}`);
}
