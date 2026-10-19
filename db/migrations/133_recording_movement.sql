-- ML-531: a recording of one movement. A piece in movements can have a recording (or a YouTube video, or a cut from
-- the Recordings tool) of just one of its movements: its start mark is that movement's first bar, and its places and
-- bar marks follow that movement's journey (FlowJourney.journeyPlaces with movement). NULL is the whole piece, as
-- every recording was before. The movement's number, not its bars - a number the piece no longer has reads as the
-- whole piece. Changing it clears the recording's marks, which were counted from a different first bar.

ALTER TABLE score_recordings ADD COLUMN IF NOT EXISTS movement_number SMALLINT
    CHECK (movement_number IS NULL OR (movement_number >= 1 AND movement_number <= 99));
