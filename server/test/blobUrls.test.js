// ML-231: a stored file's address is only kept if it is a file uploaded for that piece
// (server/services/blobUrls.js). Pure. The addresses are in the shapes the store really gives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPieceFileUrl } from '../services/blobUrls.js';

const STORE = 'https://abc123xyz.public.blob.vercel-storage.com';

test('a recording or document uploaded for the piece is accepted - with spaces, and with the store\'s random ending', () => {
  assert.equal(isPieceFileUrl(`${STORE}/flows/9/recordings/Tristans%20Zebra-U9h24FMMc9tE9ek2ZHY5hF6ycigUhm.mp3`, 9), true);
  assert.equal(isPieceFileUrl(`${STORE}/flows/10/documents/Wallace%20and%20gromit-fzf49QjJKxY1Muf0ECgXLSykNQlxNw.pdf`, 10), true);
  assert.equal(isPieceFileUrl(`${STORE}/flows/10/documents/plain.pdf`, '10'), true);
});

test('a file from "Create from file" is accepted for the piece it made', () => {
  assert.equal(isPieceFileUrl(`${STORE}/flows/from-file/1790525229901-Teddy%20Bears%20Picnic-AeWFxdsUno951vi759dzm7kn7IEwGg.musicxml`, 68), true);
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
