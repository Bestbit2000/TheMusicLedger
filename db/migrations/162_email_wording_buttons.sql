-- ML-618: every email the app sends is on Admin -> Email wording now, and some have no button (an alert to the
-- owner, the retention deletion email...). Their saved wording keeps no button's words: button may be empty.
ALTER TABLE email_wording ALTER COLUMN button DROP NOT NULL;
ALTER TABLE email_wording DROP CONSTRAINT IF EXISTS email_wording_button_check;
ALTER TABLE email_wording ADD CONSTRAINT email_wording_button_check CHECK (button IS NULL OR char_length(button) BETWEEN 1 AND 30);
