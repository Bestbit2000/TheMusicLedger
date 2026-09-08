-- Sheets-to-database cutover: "organisations" become bands. bands had no
-- archive/unarchive concept until now - adding one so the existing Settings
-- screen behaviour (archive an org still referenced in history, rather than
-- delete it outright) carries over unchanged. Mirrors tutors.active.
-- See docs/sheets-to-database-cutover.md.

ALTER TABLE bands ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;
