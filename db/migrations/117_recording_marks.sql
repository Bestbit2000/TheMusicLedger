-- ML-488 (the rehearsal score, step C): the piece's bars mapped onto a recording or a YouTube video.
-- A mark says "this bar is at this time in the recording", made by ear. From a few of them and the
-- piece's own speeds and pauses the app works out where every bar is (FlowJourney.recordingMap,
-- public/flowJourney.js), so a player can repeat any bars of the band's recording without hunting
-- for the place. See docs/rehearsal-score.md.
--
--   place        the bar's position in the order the piece is played (0-based, the lead-in bar left
--                out). A bar inside a repeat has two places, so a bar number alone is not enough.
--   bar_number   the piece's bar number at that place when the mark was made, and
--   pass         which time through it was - kept so a mark is dropped, not misused, if the piece's
--                bars are changed under it later.
--   at_ms        where that bar begins, in milliseconds from the start of the recording.
--
-- No account column: a map belongs to the recording on the piece, and goes when the recording or the
-- piece goes (docs/account-deletion.md). A copy of a piece takes no recordings, so no map either.
CREATE TABLE score_recording_marks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recording_id BIGINT NOT NULL REFERENCES score_recordings(id) ON DELETE CASCADE,
    place INTEGER NOT NULL CHECK (place >= 0),
    bar_number INTEGER NOT NULL CHECK (bar_number >= 1),
    pass INTEGER NOT NULL DEFAULT 1 CHECK (pass >= 1),
    at_ms INTEGER NOT NULL CHECK (at_ms >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (recording_id, place)
);

-- A new feature is Super admin only until it is switched on for account types (Admin -> Feature access).
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('rehearsal_score', 'Rehearsal score', 'On the play screen, a recording or a YouTube video follows the piece''s bars: repeat any bars, start from a bar, play it slower. Whoever can change the piece marks where a few bars fall and the rest is worked out from the piece''s speeds and pauses.', true)
ON CONFLICT (feature_key) DO NOTHING;
