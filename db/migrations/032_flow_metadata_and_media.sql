-- ML-179 Phase 1: Flow metadata + recordings/documents.
-- See docs/database-schema.md "Scores & metronome segments" for the "Flow" vs
-- "Score" naming note - this table stays named `scores` (kept as the natural
-- home for real notation later), but the product concept/UI/service layer is
-- "Flow" throughout.

ALTER TABLE scores
  ADD COLUMN composer TEXT,
  ADD COLUMN arranger TEXT,
  ADD COLUMN publisher TEXT,
  ADD COLUMN description TEXT;

-- One row per mp3/mp4 upload OR YouTube link, never both (score_recordings_type_shape).
-- Uploads go straight from the browser to Vercel Blob (see server/services/flows.js) -
-- blob_url/blob_pathname are only populated for type='upload'.
CREATE TABLE score_recordings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    score_id BIGINT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('upload', 'youtube')),
    title TEXT NOT NULL,
    blob_url TEXT,
    blob_pathname TEXT,
    file_size_bytes BIGINT,
    mime_type TEXT,
    youtube_video_id TEXT,
    youtube_thumbnail_url TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT score_recordings_type_shape CHECK (
        (type = 'upload' AND blob_url IS NOT NULL AND youtube_video_id IS NULL)
        OR (type = 'youtube' AND youtube_video_id IS NOT NULL AND blob_url IS NULL)
    )
);
CREATE INDEX idx_score_recordings_score ON score_recordings(score_id, order_index);

-- PDF/MusicXML/Sibelius/MuseScore score files - always a Blob upload, no link-only variant.
CREATE TABLE score_documents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    score_id BIGINT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    blob_url TEXT NOT NULL,
    blob_pathname TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_score_documents_score ON score_documents(score_id);
