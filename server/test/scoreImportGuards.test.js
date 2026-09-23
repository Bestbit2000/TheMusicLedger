// ML-192 (OMR security review): the guards "Create from file" puts in front of everything it reads -
// the uploaded file's URL, the size of every body it holds in memory, and what an .mxl unzips to.
// The same checks run live from Admin -> Security (server/services/securityReview.js), so a
// regression shows up there as well as here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

// scoreImport.js imports the DB pool, which refuses to load without a connection string. Nothing
// here queries it, so any well-formed value will do.
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
const { isOwnBlobUrl, readCappedBody, extractMusicXmlText, MAX_MUSICXML_BYTES } = await import('../services/scoreImport.js');

const STORE = 'https://abc123xyz.public.blob.vercel-storage.com';

test('isOwnBlobUrl accepts this app\'s own Blob store at the uploaded pathname', () => {
  assert.equal(isOwnBlobUrl(`${STORE}/flows/from-file/1-score-Ab12.pdf`, 'flows/from-file/1-score-Ab12.pdf'), true);
  assert.equal(isOwnBlobUrl(`${STORE}/flows/from-file/1-my%20score-Ab12.mxl`, 'flows/from-file/1-my score-Ab12.mxl'), true);
});

test('isOwnBlobUrl refuses anything else (server-side request forgery)', () => {
  const pathname = 'flows/from-file/1-score.pdf';
  for (const url of [
    'http://169.254.169.254/latest/meta-data/',
    'http://localhost:3000/api/admin/accounts',
    `http://abc123xyz.public.blob.vercel-storage.com/${pathname}`, // not https
    `https://evil.example/${pathname}`,
    `https://public.blob.vercel-storage.com.evil.example/${pathname}`,
    `https://user:pass@abc123xyz.public.blob.vercel-storage.com/${pathname}`,
    `https://abc123xyz.public.blob.vercel-storage.com:8443/${pathname}`,
    `${STORE}/some/other/file.pdf`, // right store, not the file that was uploaded
    'not a url',
    ''
  ]) {
    assert.equal(isOwnBlobUrl(url, pathname), false, url);
  }
  assert.equal(isOwnBlobUrl(`${STORE}/${pathname}`, undefined), false);
});

test('readCappedBody refuses an oversized body by header and by real length', async () => {
  const big = new Response('x'.repeat(11), { headers: { 'content-length': '11' } });
  await assert.rejects(readCappedBody(big, 10, 'too big'), (e) => e.status === 413 && e.message === 'too big');
  // A lying (or absent) Content-Length doesn't get past the real byte count.
  const lying = new Response('x'.repeat(11));
  await assert.rejects(readCappedBody(lying, 10, 'too big'), /too big/);
  const ok = await readCappedBody(new Response('hello'), 10, 'too big');
  assert.equal(ok.toString(), 'hello');
});

test('extractMusicXmlText refuses an .mxl that unpacks past the cap (zip bomb)', async () => {
  const zip = new JSZip();
  // Highly compressible: ~21 MB of one character deflates to a few KB.
  zip.file('score.musicxml', 'a'.repeat(MAX_MUSICXML_BYTES + 1024));
  const bomb = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  assert.ok(bomb.length < 1024 * 1024, 'fixture should be small on the wire');
  await assert.rejects(extractMusicXmlText(bomb), /unpacks to more than/);
});

test('extractMusicXmlText refuses a zip bomb whose header lies about its size', async () => {
  const zip = new JSZip();
  zip.file('score.musicxml', 'a'.repeat(MAX_MUSICXML_BYTES + 1024));
  const bomb = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  // Rewrite the uncompressed-size field in the local header (offset 22) and the central directory
  // entry (offset 24) to claim 100 bytes - the declared-size check alone would let this through.
  for (const [signature, offset] of [[0x04034b50, 22], [0x02014b50, 24]]) {
    for (let i = 0; i + 4 <= bomb.length; i++) {
      if (bomb.readUInt32LE(i) === signature) { bomb.writeUInt32LE(100, i + offset); break; }
    }
  }
  const loaded = await JSZip.loadAsync(bomb);
  assert.equal(loaded.file('score.musicxml')._data.uncompressedSize, 100, 'fixture should declare a small size');
  await assert.rejects(extractMusicXmlText(bomb), (e) => e.status === 413);
});

test('extractMusicXmlText still reads a normal .mxl and plain MusicXML', async () => {
  const xml = '<?xml version="1.0"?><score-partwise version="4.0"><part-list/></score-partwise>';
  const zip = new JSZip();
  zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="score.musicxml"/></rootfiles></container>');
  zip.file('score.musicxml', xml);
  assert.equal(await extractMusicXmlText(await zip.generateAsync({ type: 'nodebuffer' })), xml);
  assert.equal(await extractMusicXmlText(Buffer.from(xml)), xml);
});
