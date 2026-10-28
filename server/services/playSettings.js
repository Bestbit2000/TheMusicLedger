// ML-627: what a member chose to see and hear on a piece's play screen, cleaned before it is kept - only the four
// known keys, and the recording must be one of the piece's own (or none). Kept by savePlaySettings (flows.js) in
// piece_play_settings. docs/rehearsal-score.md, "Playing along".
export function cleanPlaySettings(data, recordingIds) {
  const src = data && typeof data === 'object' ? data : {};
  const recordingId = src.recordingId === null || src.recordingId === undefined ? null : Number(src.recordingId);
  return {
    see: src.see !== false,
    hear: src.hear !== false,
    along: src.along === true,
    recordingId: Number.isInteger(recordingId) && recordingIds.includes(recordingId) ? recordingId : null
  };
}
