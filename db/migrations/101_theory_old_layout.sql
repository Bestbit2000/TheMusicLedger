-- ML-438: the Keys quiz answers on the note keyboard (every key in the same place, a second tap for Major /
-- Minor on some scales) in place of four shuffled choices - which is harder, so results from before aren't
-- like for like. Owner's decision (5 Oct 2026): nothing is deleted; a set of options' old rounds stay as its
-- history and best only until a round is played on the new layout, and from then on only the new ones count
-- (server/services/theoryPractice.js, CURRENT_LAYOUT). Mixed deals Keys questions too, so its rounds are marked
-- the same way. Every round saved from now on is on the new layout (the default).

ALTER TABLE theory_quiz_attempts ADD COLUMN IF NOT EXISTS old_layout BOOLEAN NOT NULL DEFAULT false;

UPDATE theory_quiz_attempts SET old_layout = true WHERE quiz_id IN ('keys', 'mixed');
