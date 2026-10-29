-- ML-657 part 2: what the browser's instant checks said about the photos that were read anyway - [{ page, kinds }],
-- kinds from 'small', 'blurred', 'dark', 'faint', 'sideways' (public/pageCheck.js) - so Admin -> Photo reads can show
-- whether a warning was right (did that read then come back with page problems?). Null when nothing was said.
ALTER TABLE piece_reads ADD COLUMN IF NOT EXISTS page_warnings JSONB;
