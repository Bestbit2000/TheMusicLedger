-- ML-530: a practice list can hold one movement of a piece in movements (a concert that plays only one). NULL is
-- the whole piece, as every list piece was before. It is the movement's number, not its bars, so editing the
-- piece moves it with the music; a number the piece no longer has reads as the whole piece. The list's forecast
-- and its sessions count only that movement's bars, and its piece opens on that movement's path.

ALTER TABLE practice_list_scores ADD COLUMN IF NOT EXISTS movement_number SMALLINT
    CHECK (movement_number IS NULL OR (movement_number >= 1 AND movement_number <= 99));
