-- ML-470: the reviews that come round (Admin -> Security -> Reviews): the data protection assessment,
-- the Children's Code self-assessment and impact assessment, and the data breach plan walk-through.
-- Each time one is looked at, "Mark as reviewed" adds a line here - the day, who, and a note of what
-- was checked or changed. Lines are only ever added: this table is the audit trail. Which reviews
-- there are, and how often each comes round, is in the code (server/services/reviewRules.js).
--
-- reviewed_by is the reviewer's name as it was that day, as text - not an account id: it is the
-- business's record of who looked, it must outlive the account, and so this table has no account
-- column (docs/account-deletion.md).
CREATE TABLE review_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    review_key TEXT NOT NULL,
    reviewed_on DATE NOT NULL DEFAULT CURRENT_DATE,
    reviewed_by TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_review_log_key ON review_log (review_key, reviewed_on DESC);

-- All three were first written on 6 October 2026 (ML-221), each with a review date a year on.
INSERT INTO review_log (review_key, reviewed_on, reviewed_by, note) VALUES
    ('data-protection', DATE '2026-10-06', 'The owner, with Claude Code', 'First written (ML-221): the UK GDPR assessment, the record of processing and the legitimate interests assessment.'),
    ('childrens-code', DATE '2026-10-06', 'The owner, with Claude Code', 'First written (ML-221): the Children''s Code self-assessment and the data protection impact assessment.'),
    ('breach-plan', DATE '2026-10-06', 'The owner, with Claude Code', 'First written (ML-221): the data breach response plan.');
