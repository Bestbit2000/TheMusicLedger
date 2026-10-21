// ML-231: a stored file's address is only kept if it is a file uploaded for that piece
// (server/services/blobUrls.js). Pure. The addresses are in the shapes the store really gives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPieceFileUrl, isBandLogoFileUrl, isRehearsalFileUrl, ownStoreHost } from '../services/blobUrls.js';

const STORE = 'https://abc123xyz.public.blob.vercel-storage.com';

test('a recording or document uploaded for the piece is accepted - with spaces, and with the store\'s random ending', () => {
  assert.equal(isPieceFileUrl(`${STORE}/flows/9/recordings/Tristans%20Zebra-U9h24FMMc9tE9ek2ZHY5hF6ycigUhm.mp3`, 9), true);
  assert.equal(isPieceFileUrl(`${STORE}/flows/10/documents/Wallace%20and%20gromit-fzf49QjJKxY1Muf0ECgXLSykNQlxNw.pdf`, 10), true);
  assert.equal(isPieceFileUrl(`${STORE}/flows/10/documents/plain.pdf`, '10'), true);
});

test('a file from "Import from MusicXML" is accepted for the piece it made - only from the importer\'s own folder', () => {
  assert.equal(isPieceFileUrl(`${STORE}/flows/from-file/7/1790525229901-Teddy%20Bears%20Picnic-AeWFxdsUno951vi759dzm7kn7IEwGg.musicxml`, 68, 7), true);
  assert.equal(isPieceFileUrl(`${STORE}/flows/from-file/8/1790525229901-Teddy-Ae.musicxml`, 68, 7), false); // another member's upload
  assert.equal(isPieceFileUrl(`${STORE}/flows/from-file/1790525229901-Teddy-Ae.musicxml`, 68, 7), false); // the old shared folder
  assert.equal(isPieceFileUrl(`${STORE}/flows/from-file/7/x.musicxml`, 68), false); // no member given
});

test('another piece\'s file is refused', () => {
  assert.equal(isPieceFileUrl(`${STORE}/flows/9/recordings/a-xyz.mp3`, 10), false);
  assert.equal(isPieceFileUrl(`${STORE}/flows/91/recordings/a-xyz.mp3`, 9), false); // 9 is not 91
  assert.equal(isPieceFileUrl(`${STORE}/flows/9/../10/documents/a.pdf`, 9), false);
});

test('anything that is not a stored file is refused', () => {
  for (const u of [
    'javascript:alert(1)',
    "https://abc.public.blob.vercel-storage.com/flows/9/x.pdf');alert(1);//",
    'http://abc123xyz.public.blob.vercel-storage.com/flows/9/a.pdf',
    'https://public.blob.vercel-storage.com/flows/9/a.pdf',
    'https://.public.blob.vercel-storage.com/flows/9/a.pdf',
    'https://evil.example/flows/9/a.pdf',
    'https://abc123xyz.public.blob.vercel-storage.com.evil.example/flows/9/a.pdf',
    'https://user:pw@abc123xyz.public.blob.vercel-storage.com/flows/9/a.pdf',
    'https://abc123xyz.public.blob.vercel-storage.com:8443/flows/9/a.pdf',
    `${STORE}/flows/9/a.pdf?x=1`,
    `${STORE}/other/9/a.pdf`,
    `${STORE}/flows/9`,
    `${STORE}/flows/%E0%A4%A/a.pdf`,
    '', null, undefined, 42
  ]) {
    assert.equal(isPieceFileUrl(u, 9), false, String(u));
  }
});

test('a piece id that is not a whole positive number is refused', () => {
  for (const id of [0, -1, 1.5, 'abc', null, undefined]) assert.equal(isPieceFileUrl(`${STORE}/flows/9/a.pdf`, id), false, String(id));
});

// ML-489: a rehearsal recording is kept only from the member's own folder in the store
test('a rehearsal recording has to be in the member\'s own recordings folder', async () => {
  const { isRehearsalFileUrl } = await import('../services/blobUrls.js');
  const STORE_URL = 'https://abc123.public.blob.vercel-storage.com';
  assert.equal(isRehearsalFileUrl(`${STORE_URL}/recordings/7/Rehearsal%202%20Oct-U9h24FMMc9tE9ek2ZHY5hF6ycigUhm.m4a`, 7), true);
  assert.equal(isRehearsalFileUrl(`${STORE_URL}/recordings/7/x.m4a`, '7'), true);
  assert.equal(isRehearsalFileUrl(`${STORE_URL}/recordings/8/x.m4a`, 7), false);      // someone else's folder
  assert.equal(isRehearsalFileUrl(`${STORE_URL}/recordings/70/x.m4a`, 7), false);     // 70 is not 7
  assert.equal(isRehearsalFileUrl(`${STORE_URL}/flows/7/recordings/x.m4a`, 7), false); // a piece's file, not a rehearsal
  assert.equal(isRehearsalFileUrl(`${STORE_URL}/recordings/7/../8/x.m4a`, 7), false);
  assert.equal(isRehearsalFileUrl('https://evil.example.com/recordings/7/x.m4a', 7), false);
  assert.equal(isRehearsalFileUrl(`http://abc123.public.blob.vercel-storage.com/recordings/7/x.m4a`, 7), false);
  assert.equal(isRehearsalFileUrl(`${STORE_URL}/recordings/7/x.m4a?x=1`, 7), false);
  assert.equal(isRehearsalFileUrl('javascript:alert(1)', 7), false);
  assert.equal(isRehearsalFileUrl(`${STORE_URL}/recordings/7/x.m4a`, 0), false);
  assert.equal(isRehearsalFileUrl(`${STORE_URL}/recordings/7/x.m4a`, 'abc'), false);
});

// ML-534: a band's logo is only kept - and only ever deleted - in that band's own folder
test('a band logo is accepted in its own band\'s folder, and nowhere else', async () => {
  const { isBandLogoFileUrl } = await import('../services/blobUrls.js');
  assert.equal(isBandLogoFileUrl(`${STORE}/band-logos/12/logo-AeWFxdsUno951vi759dzm7kn7IEwGg.png`, 12), true);
  assert.equal(isBandLogoFileUrl(`${STORE}/band-logos/12/logo.webp`, '12'), true);
  assert.equal(isBandLogoFileUrl(`${STORE}/band-logos/13/logo.png`, 12), false); // another band's
  assert.equal(isBandLogoFileUrl(`${STORE}/band-logos/120/logo.png`, 12), false); // not a prefix of another id
  assert.equal(isBandLogoFileUrl(`${STORE}/flows/12/recordings/a.png`, 12), false);
  assert.equal(isBandLogoFileUrl('https://example.com/band-logos/12/logo.png', 12), false); // not the file store
  assert.equal(isBandLogoFileUrl('/icons/icon-192.png', 12), false);
  assert.equal(isBandLogoFileUrl(`${STORE}/band-logos/12/logo.png`, 0), false);
  assert.equal(isBandLogoFileUrl(null, 12), false);
});

test('ML-551: with the upload key set, only a file in this app\'s own store is accepted - not another Vercel customer\'s', () => {
  const saved = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_AbC123XyZ_notarealsecret';
  try {
    assert.equal(ownStoreHost(), 'abc123xyz.public.blob.vercel-storage.com');
    assert.equal(isPieceFileUrl(`${STORE}/flows/9/recordings/a-xyz.mp3`, 9), true);
    const theirs = 'https://someoneelse99.public.blob.vercel-storage.com';
    assert.equal(isPieceFileUrl(`${theirs}/flows/9/recordings/a-xyz.mp3`, 9), false);
    assert.equal(isBandLogoFileUrl(`${theirs}/band-logos/4/logo.png`, 4), false);
    assert.equal(isRehearsalFileUrl(`${theirs}/recordings/7/rehearsal.mp3`, 7), false);
  } finally {
    if (saved === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = saved;
  }
  assert.equal(ownStoreHost(''), null);
});
