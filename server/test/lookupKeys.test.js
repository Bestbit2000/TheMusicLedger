// ML-609: the app decides things by an instrument's keys (instruments.code, family_key, scale_lists) - never by
// the words shown (its name, or its family as "Brass" / "Woodwind"), which can be renamed or translated. This test
// fails if a lookup on those words comes back into the app or the server.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../../', import.meta.url);
const files = (dir) => fs.readdirSync(new URL(dir, root)).filter(f => f.endsWith('.js')).map(f => path.posix.join(dir, f));
const SOURCES = [...files('public/'), ...files('server/services/'), ...files('server/routes/')];
// A family's words compared or listed as values that decide something
const FAMILY_WORDS = /\.family\s*(===|!==|==|!=)\s*['"`]|includes\(\s*\w+\.family\s*\)|\.has\(\s*'(Brass|Woodwind|Percussion|Keyboard|Strings)'\s*\)|\[\s*'(Brass|Woodwind)'\s*,\s*'(Brass|Woodwind|Percussion|Keyboard|Strings)'/;
// An instrument's name tested with a pattern, or handed to the scale-list lookup
const NAME_LOOKUP = /groupFor\(\s*\w+\.name\b|\/[^/\n]*(cornet|trumpet|euphonium|baritone|tuba|trombone|clarinet|saxophone|flute|oboe|bassoon)[^/\n]*\/i?\.test\(/i;

describe('lookups use keys, not the words on screen (ML-609)', () => {
  for (const file of SOURCES) {
    test(file, () => {
      const lines = fs.readFileSync(new URL(file, root), 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        assert.ok(!FAMILY_WORDS.test(code), `${file}:${i + 1} decides by a family's words - use familyKey / family_key: ${line.trim().slice(0, 120)}`);
        assert.ok(!NAME_LOOKUP.test(code), `${file}:${i + 1} looks an instrument up by its name - use its code or scaleLists: ${line.trim().slice(0, 120)}`);
      });
    });
  }
});
