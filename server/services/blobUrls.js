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

export function isPieceFileUrl(blobUrl, scoreId) {
  let url;
  try { url = new URL(String(blobUrl)); } catch { return false; }
  if (url.protocol !== 'https:' || !url.hostname.endsWith(STORE_HOST) || url.hostname.length <= STORE_HOST.length) return false;
  if (url.username || url.password || url.port || url.search || url.hash) return false;
  let path;
  try { path = decodeURIComponent(url.pathname.slice(1)); } catch { return false; }
  if (path.includes('..') || path.includes('//') || path.includes('\\')) return false;
  const id = Number(scoreId);
  if (!Number.isInteger(id) || id <= 0) return false;
  return path.startsWith(`flows/${id}/`) || path.startsWith('flows/from-file/');
}

// ML-476: the biggest recording or document a member can add to a piece - 25 MB (the owner, 6 Oct 2026:
// the file store fills fast; a band piece needs only one copy, and a copy of a piece never carries its
// files). About 25 minutes of MP3. Enforced by the file store itself (the upload token), checked again
// when the file is attached, and said on the upload buttons (MAX_PIECE_FILE_MB in app.js).
export const MAX_PIECE_FILE_BYTES = 25 * 1024 * 1024;
