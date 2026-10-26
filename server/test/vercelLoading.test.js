// Vercel's own module loader can't require() a package that is ES-module only - Node 24 on a developer's machine can,
// so a package like that works locally and takes the whole live server down (sandbox, 26 Oct 2026: sanitize-html
// 2.18.1 requires htmlparser2 12, which is ES-module only; server/package.json's "overrides" holds it at 10, which
// ships a require() build). This loads the packages that have bitten, the way Vercel does.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const loads = (code) => spawnSync(process.execPath, ['--no-experimental-require-module', '--input-type=module', '-e', code], {
  cwd: new URL('..', import.meta.url), encoding: 'utf8'
});

test('sanitize-html loads without require() of an ES module, and still cleans', () => {
  const out = loads("const s = (await import('sanitize-html')).default; process.stdout.write(s('<b>ok</b><script>x</script>'));");
  assert.equal(out.stderr.includes('ERR_REQUIRE_ESM'), false, out.stderr);
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout, '<b>ok</b>');
});
