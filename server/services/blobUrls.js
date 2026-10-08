// ML-231: is this address a file that was uploaded for THIS piece? Pure - tested in blobUrls.test.js.
//
// After an upload the browser tells the server the file's address, and the server keeps it. That
// address is the member's word, so before it is kept it must be:
//   - https, in a Vercel Blob public store, with no user name, password or port;
//   - under this piece's own folder (flows/<piece id>/...), or the import folder (flows/from-file/...)
//     that "Create from file" uploads to before the piece exists.
// So a file uploaded for one piece can't be attached to another, and nothing that isn't a stored file
// can be attached at all. (The name the upload was asked for and the name it was given differ - the
// store adds a random ending - so the two are not compared.)
const STORE_HOST = '.public.blob.vercel-storage.com';

// The path inside the store of an address that is safe to keep, or null.
function storedPath(blobUrl) {
  let url;
  try { url = new URL(String(blobUrl)); } catch { return null; }
  if (url.protocol !== 'https:' || !url.hostname.endsWith(STORE_HOST) || url.hostname.length <= STORE_HOST.length) return null;
  if (url.username || url.password || url.port || url.search || url.hash) return null;
  let path;
  try { path = decodeURIComponent(url.pathname.slice(1)); } catch { return null; }
  if (path.includes('..') || path.includes('//') || path.includes('\\')) return null;
  return path;
}

export function isPieceFileUrl(blobUrl, scoreId) {
  const path = storedPath(blobUrl);
  if (path === null) return false;
  const id = Number(scoreId);
  if (!Number.isInteger(id) || id <= 0) return false;
  return path.startsWith(`flows/${id}/`) || path.startsWith('flows/from-file/');
}

// ML-489: a whole rehearsal recording, uploaded to the Recordings tool before it is on any piece. It
// goes in the member's own folder (recordings/<account id>/...), so one member can never keep - and
// then delete - a file another member uploaded.
export function isRehearsalFileUrl(blobUrl, accountId) {
  const path = storedPath(blobUrl);
  if (path === null) return false;
  const id = Number(accountId);
  if (!Number.isInteger(id) || id <= 0) return false;
  return path.startsWith(`recordings/${id}/`);
}
// ML-489: the biggest rehearsal recording - 100 MB (the owner, 7 Oct 2026), about three hours at a
// phone recorder's ordinary setting. Only in the Recordings tool; a recording put straight on a piece
// stays at MAX_PIECE_FILE_BYTES. Enforced by the file store (the upload token) and checked when kept.
export const MAX_REHEARSAL_FILE_BYTES = 100 * 1024 * 1024;

// ML-476: the biggest recording or document a member can add to a piece - 25 MB (the owner, 6 Oct 2026:
// the file store fills fast; a band piece needs only one copy, and a copy of a piece never carries its
// files). About 25 minutes of MP3. Enforced by the file store itself (the upload token), checked again
// when the file is attached, and said on the upload buttons (MAX_PIECE_FILE_MB in app.js).
export const MAX_PIECE_FILE_BYTES = 25 * 1024 * 1024;
