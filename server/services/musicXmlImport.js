// ML-79: "Import from MusicXML" - turns an uploaded MusicXML/.mxl file into a Flow's title/composer
// plus a set of ready-to-save blocks, the same shape createFlowBlock already accepts. Parsed
// directly, no external dependency.
//
// The parser itself is musicXmlToFlow (flowMusicXmlReader.js, ML-204) - the same one the admin
// export/import between environments uses, so a MusicXML file from any source (a notation app or
// this app's own export) goes through exactly one code path. This file is just the "get MusicXML
// out of whatever was uploaded" front end: .mxl unzipping, plus the capped-read and own-store
// guards that "A piece from a photo or PDF" (pieceReads.js, ML-246) uses as well.
// Actual notes/pitches are still ignored - a Flow block is a metronome timing block, not notation.
//
// ML-543 (owner's decision, 20 Oct 2026): this was scoreImport.js, which also sent a PDF/scan to an
// outside music-scanning service (solfascribe-omr) to be turned into MusicXML. That import was
// never useful and is removed; a photo or PDF of a part is read by ML-246 instead.

import JSZip from 'jszip';
import pool from '../config/db.js';
import { withStatus } from './metronomeSetups.js';
import { createCustomTimeSignature } from './timeSignatures.js';
import { musicXmlToFlow } from './flowMusicXmlReader.js';
import { ownStoreHost } from './blobUrls.js';

// ML-192: every byte this front end reads comes from somewhere a user controls, so each read is
// capped before it's held in memory.
// - MAX_SCORE_FILE_BYTES: the uploaded file itself (also the Blob upload token's own limit - see
//   the upload-token route).
// - MAX_MUSICXML_BYTES: one MusicXML document once it's text - an .mxl's unzipped root entry. A real
//   score is well under 1 MB; 20 MB leaves huge headroom while stopping a small zip that expands to
//   gigabytes (a "zip bomb") from taking the function down.
export const MAX_SCORE_FILE_BYTES = 40 * 1024 * 1024;
export const MAX_MUSICXML_BYTES = 20 * 1024 * 1024;

// The only place /flows/from-file (and /piece-read) may fetch an uploaded file from: this app's own
// Vercel Blob store, at exactly the pathname the upload returned. Before ML-192 the route fetched
// whatever blobUrl the browser sent - a server-side request forgery hole (any signed-in user could
// make the server request any URL, internal or not, and have the response parsed and attached to a flow).
const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';

export function isOwnBlobUrl(blobUrl, blobPathname) {
  let url;
  try {
    url = new URL(blobUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith(BLOB_HOST_SUFFIX)) return false;
  const own = ownStoreHost(); // ML-551: this app's store only
  if (own && url.hostname !== own) return false;
  if (url.username || url.password || url.port) return false;
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname.slice(1));
  } catch {
    return false;
  }
  return typeof blobPathname === 'string' && pathname === blobPathname;
}

// Reads a fetch Response body with a hard size cap - the Content-Length header first (cheap, but
// optional and the sender's to choose), then the real byte count.
export async function readCappedBody(response, maxBytes, tooLargeMessage) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw withStatus(413, tooLargeMessage);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) throw withStatus(413, tooLargeMessage);
  return buffer;
}

// .mxl is just a zip container (a compressed MusicXML - META-INF/container.xml points at the
// real root entry, same idea as a .docx/.xlsx being a zip of XML parts). "PK" magic bytes are
// enough to tell the two apart without trusting the browser-reported mimeType, which is
// unreliable for both (see the upload-token route's own comment on this).
export async function extractMusicXmlText(buffer) {
  const isZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZip) {
    if (buffer.length > MAX_MUSICXML_BYTES) throw withStatus(413, 'That MusicXML file is larger than this app accepts.');
    return buffer.toString('utf8');
  }

  const zip = await JSZip.loadAsync(buffer).catch(() => { throw withStatus(422, "That .mxl file doesn't look like a valid compressed score."); });
  const container = await zip.file('META-INF/container.xml')?.async('string');
  let rootPath = null;
  if (container) {
    const match = container.match(/<rootfile[^>]*full-path="([^"]+)"/);
    rootPath = match?.[1] || null;
  }
  // Falls back to "the first .xml/.musicxml entry that isn't the container manifest itself" -
  // some exporters omit META-INF/container.xml even though the format calls for it.
  const entry = (rootPath && zip.file(rootPath))
    || Object.values(zip.files).find(f => !f.dir && /\.(musicxml|xml)$/i.test(f.name) && !f.name.includes('META-INF'));
  if (!entry) throw withStatus(422, "Couldn't find a MusicXML file inside this .mxl archive.");
  // Zip-bomb guard (ML-192). First the size the archive declares for this entry (JSZip keeps it on
  // the internal _data - no public accessor), which refuses an honest oversized file without
  // inflating anything. But that header is the sender's to write, so the entry is then inflated as
  // a stream and abandoned the moment it passes the cap - a forged small size can't get past that.
  const tooBig = () => withStatus(413, 'That .mxl file unpacks to more than this app accepts.');
  const declaredSize = entry._data?.uncompressedSize;
  if (typeof declaredSize === 'number' && declaredSize > MAX_MUSICXML_BYTES) throw tooBig();
  const bytes = await new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    const stream = entry.internalStream('uint8array');
    stream
      .on('data', (chunk) => {
        total += chunk.length;
        if (total > MAX_MUSICXML_BYTES) {
          stream.pause();
          reject(tooBig());
          return;
        }
        chunks.push(chunk);
      })
      .on('error', () => reject(withStatus(422, "That .mxl file doesn't look like a valid compressed score.")))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .resume();
  });
  return bytes.toString('utf8');
}

// Resolves each block's {numerator, denominator} into the timeSignatureId/accountTimeSignatureId
// pair createFlowBlock expects - the public catalog first, falling back to (idempotently)
// creating one of the account's own custom signatures, exactly what the manual block-editor's own
// time signature picker does when you type in a signature that isn't a preset.
export async function resolveBlocksForAccount(accountId, blocks) {
  const cache = new Map();
  const resolved = [];
  for (const block of blocks) {
    const { numerator, denominator } = block.timeSignature;
    const key = `${numerator}/${denominator}`;
    if (!cache.has(key)) {
      const { rows } = await pool.query(
        'SELECT id FROM time_signature_options WHERE numerator = $1 AND denominator = $2 AND active = true LIMIT 1',
        [numerator, denominator]
      );
      if (rows.length) {
        cache.set(key, { timeSignatureId: Number(rows[0].id), accountTimeSignatureId: null });
      } else {
        const custom = await createCustomTimeSignature(accountId, numerator, denominator);
        cache.set(key, { timeSignatureId: null, accountTimeSignatureId: custom.id });
      }
    }
    const { timeSignature, ...rest } = block;
    resolved.push({ ...rest, ...cache.get(key) });
  }
  return resolved;
}

// The whole pass, front to back - what the /flows/from-file route calls. Takes the raw uploaded
// MusicXML/.mxl bytes (already in Blob by the time this runs - see the route) and gets back
// everything needed to create the flow: its metadata and any import warnings (musicXmlToFlow's own
// shape, minus blocks) and a resolved, ready-for-createFlowBlock block list. Throws (withStatus
// 413/422) on anything that isn't parseable - the route never creates a flow/attaches a document
// for a file this couldn't make sense of.
export async function importMusicXmlFile(accountId, buffer) {
  const xmlText = await extractMusicXmlText(buffer);
  const { blocks: rawBlocks, ...flow } = musicXmlToFlow(xmlText);
  const blocks = await resolveBlocksForAccount(accountId, rawBlocks);
  return { flow, blocks };
}
