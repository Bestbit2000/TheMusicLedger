-- ML-324: Challenges are taken out. Practice sessions (ML-320) replaced them completely, and the owner
-- wants none of their history kept (12 Oct 2026): "I don't need any history for the challenges, it can
-- all be deleted."
--
-- The three tables hold only the challenges themselves, their tasks and the time logged against a task.
-- Nothing else points at them: practice sessions, statistics and streaks are in `sessions` and are not
-- touched.
--
-- THIS DELETES DATA AND CANNOT BE UNDONE.

DROP TABLE IF EXISTS challenge_logs;
DROP TABLE IF EXISTS challenge_items;
DROP TABLE IF EXISTS challenges;

-- The feature switch goes with it (its row in feature_access goes too, where that table refers to it).
DELETE FROM feature_access WHERE feature_id IN (SELECT id FROM features WHERE feature_key = 'challenges');
DELETE FROM features WHERE feature_key = 'challenges';
