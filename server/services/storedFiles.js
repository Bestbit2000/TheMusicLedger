// Security re-check 21 Oct 2026: a file kept after an upload has its size and type read from the file store,
// not taken from what the browser said. The store's upload token already holds an upload to its limits (size
// and type); this makes what is kept - and shown on Admin -> Recordings - match what is really stored.
import { head } from '@vercel/blob';

export async function storedFileFacts(blobUrl) {
  let facts;
  try {
    facts = await head(String(blobUrl));
  } catch {
    throw Object.assign(new Error("Couldn't check the uploaded file - try uploading it again."), { status: 422 });
  }
  return { sizeBytes: Number(facts.size) || null, contentType: facts.contentType || null };
}
