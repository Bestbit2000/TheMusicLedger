-- Fix: the Intervals and Chords quizzes (ML-309 C, release 0.31.0) could never save a round - the
-- theory_quiz_attempts.quiz_id CHECK still listed only the quizzes from 052/053, so every Intervals or
-- Chords round failed ("Couldn't save this round") on every environment, production included.
-- server/test/theoryQuizIds.test.js now fails if a quiz is added to public/theoryEngine.js without
-- widening this check.

ALTER TABLE theory_quiz_attempts DROP CONSTRAINT theory_quiz_attempts_quiz_id_check;
ALTER TABLE theory_quiz_attempts ADD CONSTRAINT theory_quiz_attempts_quiz_id_check
    CHECK (quiz_id IN ('noteNames', 'keys', 'symbols', 'intervals', 'chords', 'mixed', 'weakSpots'));
