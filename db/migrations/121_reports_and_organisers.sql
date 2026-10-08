-- ML-506 / ML-507: three things the Children's Code and Online Safety Act run-throughs asked for
-- (docs/childrens-code-assessment.md, docs/online-safety-assessment.md).

-- 1. An organiser is an adult. Before a member sets up sharing for a band or invites someone to one,
--    they confirm once that they are 18 or over and responsible for the band. No proof is asked for;
--    the day is kept. The member's own information: in the download, cleared on deletion, to be named
--    in the privacy policy.
ALTER TABLE accounts ADD COLUMN organiser_adult_confirmed_on DATE;

-- 2. "Report this": a member can report a piece their band shares - its bars, recordings, documents
--    and links go with it - or a public piece. It goes to the owner, who deals with it on Admin ->
--    Shared music. title and band_name are kept as they were that day, so the report still reads
--    after the thing has gone; reported_by is SET NULL when that account is deleted (the report
--    stays as the app's record of what was done).
CREATE TABLE content_reports (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reported_by_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('piece')),
    target_id BIGINT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    band_name TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    closed_by TEXT NOT NULL DEFAULT '',
    outcome TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_content_reports_open ON content_reports (created_at DESC) WHERE closed_at IS NULL;

-- 3. The owner can take down more than a recording: a document, or a whole piece a band shares. And
--    two more reasons: a member reported it; it breaks the terms.
ALTER TABLE recording_removals
    DROP CONSTRAINT recording_removals_kind_check,
    ADD CONSTRAINT recording_removals_kind_check CHECK (kind IN ('rehearsal', 'piece', 'video', 'document', 'score')),
    DROP CONSTRAINT recording_removals_reason_check,
    ADD CONSTRAINT recording_removals_reason_check CHECK (reason IN ('person', 'copyright', 'reported', 'terms', 'other'));
