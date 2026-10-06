-- ML-472: a teacher belongs to the member who typed the name in. Until now `tutors` was one list
-- shared by every member: anyone could rename or delete a teacher for everyone, and every member was
-- sent every other member's teacher names (found by the site security review, ML-231).
-- ML-467: a teacher is a name only. first_name, surname and email were never written by the app; they
-- go, so nothing can start collecting a non-member's details without a migration to say so.
--
-- Who gets the rows that are there now:
--   1. a teacher used in lessons goes to the member whose lessons they are. If more than one member
--      has lessons with the same row, each gets a row of their own and their lessons point at it;
--   2. a teacher no lesson uses can't be traced to anyone. Only the owner has used the app so far, so
--      it goes to the oldest super admin account (and is removed if there is none).
-- tutor_account_links and progress_view_grants (a teacher who is also a member - not in use) point at a
-- tutors row and need no change: the row they point at now has an owner.

ALTER TABLE tutors ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;

-- 1. Used in lessons: the first member (lowest id) keeps the row itself...
UPDATE tutors t
   SET account_id = u.account_id
  FROM (SELECT tutor_id, min(account_id) AS account_id FROM sessions WHERE tutor_id IS NOT NULL GROUP BY tutor_id) u
 WHERE u.tutor_id = t.id;

-- ...and every other member who used it gets a copy, with their lessons moved onto it.
WITH extra AS (
    SELECT DISTINCT s.tutor_id, s.account_id
      FROM sessions s JOIN tutors t ON t.id = s.tutor_id
     WHERE s.account_id <> t.account_id
), made AS (
    INSERT INTO tutors (display_name, active, account_id)
    SELECT t.display_name, t.active, e.account_id FROM extra e JOIN tutors t ON t.id = e.tutor_id
    RETURNING id, display_name, account_id
)
UPDATE sessions s
   SET tutor_id = m.id
  FROM made m, tutors old
 WHERE old.id = s.tutor_id AND old.display_name = m.display_name
   AND s.account_id = m.account_id AND old.account_id <> s.account_id;

-- 2. Used by nobody: to the oldest super admin, or gone.
UPDATE tutors
   SET account_id = (SELECT id FROM accounts WHERE account_level = 'super_admin' AND deleted_at IS NULL ORDER BY id LIMIT 1)
 WHERE account_id IS NULL;
DELETE FROM tutors WHERE account_id IS NULL;

-- One row per member per name (the shared list could hold the same name twice): lessons move to the
-- oldest row, the others go.
UPDATE sessions s
   SET tutor_id = k.keep_id
  FROM tutors t
  JOIN (SELECT account_id, display_name, min(id) AS keep_id FROM tutors GROUP BY account_id, display_name) k
    ON k.account_id = t.account_id AND k.display_name = t.display_name
 WHERE s.tutor_id = t.id AND t.id <> k.keep_id;
DELETE FROM tutors t
 USING (SELECT account_id, display_name, min(id) AS keep_id FROM tutors GROUP BY account_id, display_name) k
 WHERE k.account_id = t.account_id AND k.display_name = t.display_name AND t.id <> k.keep_id;

ALTER TABLE tutors
    ALTER COLUMN account_id SET NOT NULL,
    DROP COLUMN first_name,
    DROP COLUMN surname,
    DROP COLUMN email,
    ADD CONSTRAINT tutors_account_name_unique UNIQUE (account_id, display_name);
