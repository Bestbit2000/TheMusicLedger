-- ML-532: the Recordings tool takes a YouTube video as well as an uploaded file - a whole concert, or a whole film
-- score - given to pieces (or movements, ML-531) with a start and end each, as an upload is. A video stores no file
-- here, so blob_url is empty for it and youtube_video_id holds the video; exactly one of the two is set. It does
-- not count against the recordings limit (only stored files do). A cut of it on a piece is an ordinary YouTube
-- recording (score_recordings type youtube) that remembers which entry it came from (rehearsal_recording_id).

ALTER TABLE rehearsal_recordings ALTER COLUMN blob_url DROP NOT NULL;
ALTER TABLE rehearsal_recordings ALTER COLUMN blob_pathname DROP NOT NULL;
ALTER TABLE rehearsal_recordings ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;
ALTER TABLE rehearsal_recordings ADD CONSTRAINT rehearsal_recordings_one_source CHECK ((blob_url IS NULL) <> (youtube_video_id IS NULL));
