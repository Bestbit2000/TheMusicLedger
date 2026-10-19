// ML-246: reads a piece's structure from a photo or a PDF of the music. A vision model is shown the pages
// and answers with what is printed - bars, time signatures, speeds, rehearsal marks, repeats, signs and
// pauses, by the bar numbers on the music. No notes or pitches: a piece here is rhythm and structure only,
// which is why this is asked of a model and not of a music-scanning (OMR) engine - see
// docs/piece-from-photo.md for the trial behind that.
//
// The call goes through Vercel AI Gateway (the same Vercel account as the hosting; the register entry
// `vercel-ai-gateway` has its terms). The pages are sent with zero data retention asked for, and nothing
// is kept here either: this file never writes the file or the answer anywhere.
//
// What comes back is somebody else's text. It is parsed, then every field is checked by
// PieceRead.normalise (public/pieceRead.js) before anything uses it; the rating shown to the member is
// worked out by PieceRead.rate from checks, not taken on the model's word.

import fs from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

// The same shape as every service's withStatus (a 4xx whose message is written for the member), made here
// so that this file needs no database: it stores nothing, and the trial script runs it on its own.
function withStatus(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// The rules are shared with the browser (public/pieceRead.js, public/pieceOutline.js), loaded with vm like
// flows.js loads the journey engine.
const sandbox = { self: {} };
for (const file of ['pieceOutline.js', 'pieceRead.js']) {
  vm.runInNewContext(fs.readFileSync(new URL(`../../public/${file}`, import.meta.url), 'utf8'), sandbox);
}
export const PieceRead = sandbox.self.PieceRead;
export const PieceOutline = sandbox.self.PieceOutline;

const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
// The model the trial was run with (10 Oct 2026). PIECE_READER_MODEL changes it without a release - a
// cheaper one can be tried against the same test pieces with scripts/piece-read-trial.mjs.
const DEFAULT_MODEL = 'anthropic/claude-opus-5.5';
export const MAX_READ_FILES = 12;
export const MAX_READ_BYTES = 24 * 1024 * 1024;

// What kind of file this is, from its first bytes - never from the name or what the browser said.
export function mediaTypeOf(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer.toString('ascii', 0, 4) === '%PDF') return 'application/pdf';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const nullable = (type) => ({ type: [type, 'null'] });
const object = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const list = (properties) => ({ type: 'array', items: object(properties) });
const int = { type: 'integer' };
const sure = { type: 'string', enum: ['high', 'medium', 'low'] };

// The answer's shape. `systems` comes first on purpose: the model counts the bars line by line before it
// says anything else, and that count is what the rating checks the total against.
export const READ_SCHEMA = object({
  pieces: list({
    title: { type: 'string' },
    movement: nullable('string'),
    composer: nullable('string'),
    arranger: nullable('string'),
    publisher: nullable('string'),
    part: nullable('string'),
    numbersAt: { type: 'string', enum: ['start', 'end', 'none'] },
    systems: list({ page: int, firstBar: int, bars: int, anchored: { type: 'boolean' }, sure }),
    tail: list({ bar: int, bars: int, what: { type: 'string' } }),
    numberClashes: list({ printed: { type: 'string' }, bar: int }),
    freeBars: list({ bar: int, text: nullable('string') }),
    bars: int,
    pickupBeats: nullable('number'),
    endSeen: { type: 'boolean' },
    cropped: { type: 'boolean' },
    pagesMissing: { type: 'boolean' },
    time: list({ bar: int, beats: int, beatType: int }),
    speeds: list({ bar: int, bpm: nullable('integer'), note: { type: ['string', 'null'], enum: [...PieceRead.NOTE_VALUES, null] }, text: nullable('string'), handwritten: { type: 'boolean' } }),
    ramps: list({ from: int, to: int, kind: { type: 'string', enum: ['slower', 'faster'] }, text: nullable('string') }),
    marks: list({ bar: int, label: { type: 'string' } }),
    repeats: list({ from: int, to: int, times: int, firstEndingFrom: nullable('integer'), lastEndingTo: nullable('integer') }),
    signs: list({ sign: { type: 'string', enum: PieceRead.SIGN_KEYS }, bar: int }),
    pauses: list({ bar: int, beat: int, kind: { type: 'string', enum: ['pause', 'break'] } }),
    special: list({ from: int, to: int, text: { type: 'string' } }),
    doubts: list({ from: nullable('integer'), to: nullable('integer'), level: sure, note: { type: 'string' } })
  })
});

export const READ_PROMPT = `You read the STRUCTURE of printed band and ensemble music from photos or a PDF of one player's part. You do not read the notes or pitches. Your answer is used to set up a practice metronome for the piece, so the bar count, the time signatures and the order the bars are played in matter most.

Report only what is printed on the page. Do not use anything you know about the piece to fill a gap. Where you cannot see something clearly, say so in "doubts"; never guess silently.

HOW TO COUNT
- Number the bars as the music does. Use the printed bar numbers (at the start of a line, or boxed over a bar) to anchor your count. A multi-bar rest counts as the number printed on it. First and second time bars are each counted once, in the order they are printed.
- Work line by line and fill in "systems" first: for each line of music, the page it is on, the number of its first bar, how many bars it holds, "anchored" true only when a bar number is PRINTED at the start of that line or over a bar in it (a boxed bar-number rehearsal mark counts; a letter does not; a number you worked out yourself does not), and how sure you are of that line's barlines.
- First find how this part prints its bar numbers and say so in "numbersAt": "start" when a number at the left of a line is the number of that line's FIRST bar, "end" when a number at the right-hand end of a line is the number of that line's LAST bar (some parts, often hand-copied ones, do this), "none" when no bar numbers are printed. Use them accordingly.
- Count barlines, not groups of notes. Bars on one line can be very different widths: a bar of sixteen semiquavers is one bar however long it looks, and three bars of long notes can take less room than that. A beam or a slur never crosses out a barline.
- Each line must start on the bar after the last bar of the line before. If a printed number disagrees with your count, count the bars before it again, barline by barline. If it still disagrees, KEEP YOUR COUNT of the bars that are really on the page (music is sometimes misprinted, and the metronome has to play the bars that are there), put any rehearsal mark on the bar it really sits on with its printed label, and report it in "numberClashes": the printed number and the bar you counted it to be on. The exception is an edition that simply numbers differently: if the printed numbers are out by the same amount from the very first one (most often by one, because the edition counts a pickup as bar 1), follow the printed numbering for the whole piece, count the pickup as bar 1 with "pickupBeats" null, and report no clashes.
- "tail": the end of the piece is where a miscount is most likely, because no later printed number can catch it. So list one by one every bar of the last line - and of every line after the last line that has a printed bar number, if that is earlier: the bar's number, "bars" 1, and a few words on what is in it ("sixteen semiquavers", "semibreve with a pause", "1st-time bar, minim and rest"). A multi-bar rest is one entry: the number of its first bar and "bars" the number printed on it. Do this by looking at the barlines again, not from the number you gave in "systems"; then make "systems" and "bars" agree with it.
- A bar with no set length - marked Senza tempo, ad lib., cadenza, or free time - goes in "freeBars" with its printed words. Count it as one bar and leave the time signature as it was.
- "bars" is the number of the last bar. "endSeen" is true only if you can see the final (thin-thick) barline. "cropped" is true if an edge of any page is cut off so that music may be missing. "pagesMissing" is true only when the printed page numbers skip a page or a line breaks off part-way through a bar - not merely because the final barline is out of sight.
- If there is a pickup (anacrusis) before bar 1, give its length in beats in "pickupBeats" and do not count it as a bar.

WHAT TO REPORT
- time: the time signature at bar 1, then every change, each as the bar it starts on. Common time is 4/4, cut time is 2/2. Ignore a courtesy signature at the end of a line (it belongs to the next bar).
- speeds: every tempo mark, at the bar it starts on. "bpm" is the printed metronome number (for a range such as 132-138, the lower number) or null when only words are printed. "note" is the note the number counts (crotchet, dotted-crotchet, minim...) or null. "text" is the printed words (Allegro, Slower, Tempo I). Set "handwritten" true when the number is written in by hand and not printed.
- ramps: every rit., rall., allarg. (slower) or accel. (faster), from the bar it starts in to the last bar before the next tempo mark.
- marks: every rehearsal mark - a boxed or circled bar number, or a letter - with the bar it sits on. A boxed bar number's label is the number itself. Section titles and words like "Soli" are not rehearsal marks.
- repeats: each repeated passage, "from" its first bar "to" the bar that has the end-repeat sign at its end, and how many times it is played (2 unless the music says otherwise). When there are 1st and 2nd time bars, "to" is still the bar with the end-repeat sign (the last bar under the 1st-time bracket), "firstEndingFrom" is the first bar under the 1st-time bracket and "lastEndingTo" is the last bar under the final bracket; otherwise both are null. Example: start-repeat at bar 129, 1st-time bracket over bars 131-132 with the end-repeat sign after 132, 2nd-time bracket over bars 133-134 gives from 129, to 132, firstEndingFrom 131, lastEndingTo 134.
- signs: segno (the bar the sign is on - look at which side of the barline it sits), coda (the first bar of the Coda), toCoda (the bar that ends with "To Coda"), ds, dsCoda, dc, dcCoda (the bar the instruction comes at the end of), fine (the bar Fine comes at the end of; a pause over a final-looking barline in the middle of a piece that ends with D.C. or D.S. is its Fine - say so in "doubts").
- pauses: every fermata ("pause") and caesura or G.P. ("break"), with its bar and the beat it is on (1 when it is over a whole-bar note or rest). An accent or marcato sign is not a pause.
- special: only a printed instruction that says which time through some bars are played, such as "Play on D.S. only", "2nd time only" or "Tacet 1st time", with the bars it covers and its exact words. Cues, "Play", "Soli", "Solo", "Tutti" and section titles do not belong here.
- doubts: only what the player should check - something you could not settle that may make a bar number, the bar count or the order of play wrong. Give the bars, "low" if you think it more likely wrong than right and "medium" otherwise, and one short plain sentence. Do not list things you ignored or things you are confident about. A missing final barline is already covered by "endSeen".

THINGS TO IGNORE
- Pencil and pen marks made by a player (OMIT, circles, breath marks, written-in bar numbers used only to check your count) - except a handwritten speed, which goes in "speeds" with "handwritten" true.
- Cue notes, dynamics, articulation, key signatures, lyrics, fingerings and band stamps.
- A Coda or passage printed twice for convenience counts once.

MORE THAN ONE PIECE
If the pages hold several pieces, or one piece in several movements, give each as its own entry in "pieces", in page order, with bars counted from 1 in each unless the printed numbers carry on. For a movement, "title" is the whole work and "movement" is the movement's own name. "part" is the instrument the part is for.`;

// Which prompt a read was made with: changes whenever the prompt or the answer's shape does, so a test
// read again later can say what it was read with (Admin -> Photo reads).
export const READ_VERSION = createHash('sha256').update(READ_PROMPT + JSON.stringify(READ_SCHEMA)).digest('hex').slice(0, 10);
export const readerModel = () => process.env.PIECE_READER_MODEL || DEFAULT_MODEL;

function gatewayKey() {
  return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || null;
}

export function pieceReaderConfigured() {
  return !!gatewayKey();
}

function filePart(buffer, mediaType) {
  const data = buffer.toString('base64');
  if (mediaType === 'application/pdf') return { type: 'file', file: { data, media_type: mediaType, filename: 'music.pdf' } };
  return { type: 'image_url', image_url: { url: `data:${mediaType};base64,${data}` } };
}

// The JSON in the model's answer. With a schema asked for it is the whole message; the fallback is for a
// model that wraps it in words anyway.
export function parseAnswer(text) {
  const s = String(text || '');
  try { return JSON.parse(s); } catch { /* try the outermost braces */ }
  const from = s.indexOf('{'), to = s.lastIndexOf('}');
  if (from >= 0 && to > from) { try { return JSON.parse(s.slice(from, to + 1)); } catch { /* not JSON */ } }
  return null;
}

// buffers: the pages, in order - one PDF, or one or more photos. Returns
//   { pieces: [{ read, about, outline, sigs, rating }], whole, model, usage: { inputTokens, outputTokens }, ms }
// whole (ML-529) is the same shape: the pieces put together as one piece in movements, when they look like
// the movements of one work - or null.
// where read is the checked answer, outline is ready for Quick entry (time signatures as "3/4" keys, with
// `sigs` saying what each is, for the caller to turn into the account's own) and rating is
// { level, checks }. Throws withStatus 4xx with a message for the member; nothing is stored.
export async function readPieceFromFiles(buffers, { fetchImpl = fetch } = {}) {
  const key = gatewayKey();
  if (!key) throw withStatus(422, "Reading a piece from a photo isn't set up here yet.");
  const files = (buffers || []).filter(Boolean);
  if (!files.length) throw withStatus(422, 'There is no photo or PDF to read.');
  if (files.length > MAX_READ_FILES) throw withStatus(413, `That is more than ${MAX_READ_FILES} photos - send the piece in fewer, or as one PDF.`);
  if (files.reduce((n, b) => n + b.length, 0) > MAX_READ_BYTES) throw withStatus(413, 'Those files are larger than this can read in one go.');
  const parts = files.map(buffer => {
    const mediaType = mediaTypeOf(buffer);
    if (!mediaType) throw withStatus(422, 'That file is not a photo (JPEG, PNG or WebP) or a PDF.');
    return filePart(buffer, mediaType);
  });
  if (parts.filter(p => p.type === 'file').length > 1 || (parts.some(p => p.type === 'file') && parts.length > 1)) {
    throw withStatus(422, 'Send one PDF, or photos - not both together.');
  }

  const model = readerModel();
  const started = Date.now();
  let response;
  try {
    response = await fetchImpl(GATEWAY_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      // 4 and a half minutes: the server function is allowed 5 (vercel.json). 110 seconds was enough for the
      // 2 to 4 page test pieces and not for the first long part tried on production (12 Oct 2026).
      signal: AbortSignal.timeout(Number(process.env.PIECE_READER_TIMEOUT_MS) || 270000),
      body: JSON.stringify({
        model,
        stream: false,
        max_tokens: 32000,
        // PIECE_READER_EFFORT (low / medium / high): how hard a model that can reason works at the count.
        ...(process.env.PIECE_READER_EFFORT ? { reasoning: { effort: process.env.PIECE_READER_EFFORT } } : {}),
        messages: [
          { role: 'system', content: READ_PROMPT },
          { role: 'user', content: [...parts, { type: 'text', text: 'Read the structure of the music on these pages.' }] }
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'piece_read', description: 'The structure of the music on the pages', schema: READ_SCHEMA } },
        // Only providers that have agreed not to keep or train on what is sent.
        providerOptions: { gateway: { zeroDataRetention: true } }
      })
    });
  } catch (err) {
    throw withStatus(422, err?.name === 'TimeoutError' ? 'Reading the music took longer than the four and a half minutes it is given. Send the piece in two halves, or fewer pages at a time.' : "Couldn't reach the reader - try again shortly.");
  }
  if (!response.ok) {
    // The gateway's own message can name the account or the key, so only its status is passed on.
    console.error('pieceReader: gateway answered', response.status, (await response.text().catch(() => '')).slice(0, 300));
    throw withStatus(422, response.status === 429 ? 'The reader is busy - try again in a minute.' : "The reader couldn't take that file - try again, or enter the piece by hand.");
  }
  const answer = await response.json().catch(() => null);
  const choice = answer?.choices?.[0];
  if (choice?.finish_reason === 'length') throw withStatus(422, 'That is more music than can be read in one go. Send the piece in two halves, or fewer pages at a time.');
  const raw = parseAnswer(choice?.message?.content);
  const { pieces } = PieceRead.normalise(raw, PieceOutline.MAX_BARS);
  if (!pieces.length) throw withStatus(422, "Couldn't find a piece of music on that - try a clearer photo, or enter the piece by hand.");

  const asRead = (read) => {
    const fitted = PieceRead.fit(read);
    return { read, about: fitted.about, outline: fitted.o, sigs: fitted.sigs, rating: PieceRead.rate(read, fitted) };
  };
  return {
    pieces: pieces.map(asRead),
    whole: PieceRead.looksLikeOneWork(pieces) ? asRead(PieceRead.join(pieces)) : null,
    model,
    usage: { inputTokens: Number(answer?.usage?.prompt_tokens) || 0, outputTokens: Number(answer?.usage?.completion_tokens) || 0 },
    ms: Date.now() - started
  };
}
