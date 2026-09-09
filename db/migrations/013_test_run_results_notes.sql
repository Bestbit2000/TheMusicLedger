-- root_cause_analysis was too narrow a name - the admin panel (ML-26) needs
-- to show "what did Claude do about this failure", which includes things
-- like "fixed the test" or "confirmed expected", not just a diagnosis.
ALTER TABLE test_run_results RENAME COLUMN root_cause_analysis TO notes;
