-- ML-356: display and reading preferences, saved on the account so they follow the person to every
-- device: dark mode (was per device only), dyslexia-friendly reading (more line, letter and word
-- spacing, no italics), the reading font (standard, Lexend or OpenDyslexic), the background colour and
-- the text size. JSON so a new preference needs no migration; server/services/accounts.js checks the
-- keys and values. {} = nothing chosen yet (the device's own dark mode is kept and saved on first use).

ALTER TABLE accounts ADD COLUMN display_prefs JSONB NOT NULL DEFAULT '{}';
