// ML-79: "Create from file" - turns an uploaded score into a Flow's title/composer plus a set of
// ready-to-save blocks, the same shape createFlowBlock already accepts. Phase 1 (MusicXML/.mxl,
// parsed directly, no external dependency) landed first; Phase 2 adds PDF/scan import via OMR (an
// external Audiveris service this app doesn't host - see runOmr below) to turn a scan into
// MusicXML, which then runs through this exact same parser. There is deliberately only ever one
// parser in this app: OMR's whole job is to make a scan look like a MusicXML file, not to have its
// own separate structural understanding.
//
// The parser itself is musicXmlToFlow (flowMusicXmlReader.js, ML-204) - the same one the admin
// export/import between environments uses, so a MusicXML file from any source (a notation app,
// OMR, or this app's own export) goes through exactly one code path. This file is just the
// "get MusicXML out of whatever was uploaded" front end: .mxl unzipping and OMR for PDFs.
// Actual notes/pitches are still ignored - a Flow block is a metronome timing block, not notation.

import JSZip from 'jszip';
import pool from '../config/db.js';
import { withStatus } from './metronomeSetups.js';
import { createCustomTimeSignature } from './timeSignatures.js';
import { musicXmlToFlow } from './flowMusicXmlReader.js';

// Phase 2: a scan has no structure of its own to read - it has to go through an external OMR
// (Optical Music Recognition) service first, which turns it into MusicXML that then runs through
// the exact same musicXmlToFlow (flowMusicXmlReader.js) everything else does. This app never runs Audiveris
// itself (a Java OMR engine, no native REST API of its own per its own docs) - it's a subprocess/
// batch-CLI tool, which doesn't fit this app's Vercel serverless deployment (no JVM, no Docker, no
// persistent process). AUDIVERIS_SERVICE_URL points at a separate, independently-hosted wrapper
// service instead - see docs/third-party-providers.md for what's actually been verified/deployed.
//
// The contract is a real one (not a guess) - an async job API, matching the solfascribe-omr
// project (github.com/James-Aidoo/solfascribe-omr, MIT-licensed, self-hostable): submit the PDF as
// multipart, get a jobId back immediately, poll until it's done, then fetch the resulting
// MusicXML. This is a job queue rather than "one request, one response" on purpose - real OMR on a
// real scan takes real time (the reference service's own default timeout is 15 minutes), which
// doesn't fit inside a single HTTP round trip, let alone one Vercel function invocation. The poll
// loop below is still bounded (AUDIVERIS_POLL_TIMEOUT_MS) to stay inside whatever this app's own
// /flows/from-file function's own maxDuration is configured to - see docs/third-party-providers.md
// for why that number matters and how to raise it. A properly async version of OUR OWN
// /flows/from-file endpoint (return a job id, client polls) would remove that ceiling entirely -
// worth it if real scores routinely take longer than the platform allows, not built yet.
//
// withStatus is always given a 4xx here, on purpose, even where a "real" REST API might reach for
// 502/504 (upstream unavailable/timed out) - sendError (server/utils/httpErrors.js) only ever
// passes a withStatus message through to the client for status < 500; anything >= 500 is treated
// as an unexpected internal error and replaced with a generic fallback. Every message below is
// deliberately written to be read by the user, same convention as every other withStatus call in
// this codebase, so it has to stay under 500 to actually reach them.
async function runOmr(pdfBuffer) {
  const baseUrl = process.env.AUDIVERIS_SERVICE_URL;
  if (!baseUrl) {
    throw withStatus(422, "Score scanning isn't available yet - try a MusicXML/.mxl file instead, or add blocks manually.");
  }
  const authHeaders = process.env.AUDIVERIS_SERVICE_TOKEN
    ? { Authorization: `Bearer ${process.env.AUDIVERIS_SERVICE_TOKEN}` } : {};

  const form = new FormData();
  form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'score.pdf');
  let submitResponse;
  try {
    submitResponse = await fetch(`${baseUrl}/jobs`, { method: 'POST', headers: authHeaders, body: form });
  } catch {
    throw withStatus(422, "Couldn't reach the score-scanning service - try again shortly, or use a MusicXML/.mxl file instead.");
  }
  if (submitResponse.status !== 202) {
    const detail = await submitResponse.json().catch(() => null);
    throw withStatus(422, `Score scanning couldn't start${detail?.error ? `: ${detail.error}` : '.'}`);
  }
  const { jobId } = await submitResponse.json();

  const pollIntervalMs = 3000;
  const maxWaitMs = Number(process.env.AUDIVERIS_POLL_TIMEOUT_MS) || 50000;
  const deadline = Date.now() + maxWaitMs;
  let job;
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const statusResponse = await fetch(`${baseUrl}/jobs/${jobId}`, { headers: authHeaders }).catch(() => null);
    if (!statusResponse?.ok) {
      throw withStatus(422, 'Lost contact with the score-scanning service partway through - try again.');
    }
    job = await statusResponse.json();
    if (job.status === 'done' || job.status === 'failed') break;
    if (Date.now() > deadline) {
      // Best-effort - doesn't hold up the error response waiting to see if this succeeds.
      fetch(`${baseUrl}/jobs/${jobId}`, { method: 'DELETE', headers: authHeaders }).catch(() => {});
      throw withStatus(422, 'Score scanning is taking longer than this can wait for - try again in a few minutes, or use a MusicXML/.mxl file instead.');
    }
  }

  if (job.status === 'failed') {
    const reason = job.failure?.detail || job.failure?.class || 'unknown error';
    throw withStatus(422, `Score scanning couldn't read this file (${reason}) - try a clearer scan, or use a MusicXML/.mxl file instead.`);
  }
  if (!job.movements?.length) {
    throw withStatus(422, "Score scanning didn't find anything to import in this file.");
  }

  // Only the first movement - a multi-movement scan (several distinct pieces in one PDF) only
  // imports the first one, same "start simple" scope as Phase 1 only reading the first <part>.
  const fileResponse = await fetch(`${baseUrl}/jobs/${jobId}/files/${encodeURIComponent(job.movements[0].filename)}`, { headers: authHeaders });
  if (!fileResponse.ok) throw withStatus(422, "Couldn't retrieve the scanned score's MusicXML - try again.");
  const xmlText = await fileResponse.text();

  fetch(`${baseUrl}/jobs/${jobId}`, { method: 'DELETE', headers: authHeaders }).catch(() => {});
  return xmlText;
}

// .mxl is just a zip container (a compressed MusicXML - META-INF/container.xml points at the
// real root entry, same idea as a .docx/.xlsx being a zip of XML parts). "PK" magic bytes are
// enough to tell the two apart without trusting the browser-reported mimeType, which is
// unreliable for both (see the upload-token route's own comment on this).
export async function extractMusicXmlText(buffer) {
  const isZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZip) return buffer.toString('utf8');

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
  return entry.async('string');
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
// bytes (already in Blob by the time this runs - see the route) and gets back everything needed
// to create the flow: its metadata and any import warnings (musicXmlToFlow's own shape, minus
// blocks), a resolved, ready-for-createFlowBlock
// block list, and - only for a PDF/scan, where OMR had to run first - the MusicXML that OMR
// produced (omrXmlText), so the route can save that too ("store it anyway, may reuse it for
// dynamics later" per the request) rather than throwing away the one clean structured artifact a
// scan gets turned into. Throws (withStatus 422/502/503) on anything that isn't parseable, or
// isn't parseable yet - the route never creates a flow/attaches a document for a file this
// couldn't make sense of.
export async function importScoreFromFile(accountId, buffer) {
  const isPdf = buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF';
  const xmlText = isPdf ? await runOmr(buffer) : await extractMusicXmlText(buffer);

  const { blocks: rawBlocks, ...flow } = musicXmlToFlow(xmlText);
  const blocks = await resolveBlocksForAccount(accountId, rawBlocks);
  return { flow, blocks, omrXmlText: isPdf ? xmlText : null };
}
