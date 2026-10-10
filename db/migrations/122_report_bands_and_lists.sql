-- ML-510 / ML-511: the last two things one member can show another that could not be reported or
-- taken down - a band's name and a band's practice list (docs/online-safety-assessment.md, actions 5
-- and 6).

-- 1. "Report this" for a band's name ('band': target_id is the band's shared space, a bands row of kind
--    'group') and for a band's practice list ('list': target_id is the practice_lists row). As for a
--    piece, title and band_name are kept as they were that day.
ALTER TABLE content_reports
    DROP CONSTRAINT content_reports_kind_check,
    ADD CONSTRAINT content_reports_kind_check CHECK (kind IN ('piece', 'band', 'list'));

-- 2. The owner's record of what he did about it. 'list': a band's practice list was removed. 'band': a
--    band was renamed - it can't be removed, its music hangs off it - and title is the name it had.
ALTER TABLE recording_removals
    DROP CONSTRAINT recording_removals_kind_check,
    ADD CONSTRAINT recording_removals_kind_check CHECK (kind IN ('rehearsal', 'piece', 'video', 'document', 'score', 'list', 'band'));
