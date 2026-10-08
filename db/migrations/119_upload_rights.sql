-- ML-278: before a member's first upload of music - a recording, a score or a part - they confirm that
-- they have the right to upload it and that the people in a recording know it is being shared. The
-- terms of use already say "only add recordings, scores and parts you have the right to use"; this
-- puts it in front of them at the moment it matters, once, and keeps the day they agreed.
--
-- A date on the account, so it is the member's own information: it is in "Download my information",
-- named in the privacy policy, and cleared when the account is deleted (accountDeletion.js).
ALTER TABLE accounts ADD COLUMN upload_rights_confirmed_on DATE;
