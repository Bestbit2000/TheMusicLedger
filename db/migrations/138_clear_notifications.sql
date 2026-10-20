-- ML-556: a member can clear a notification out of their list - one at a time, or all of them. Cleared is
-- for good (owner, 20 October 2026: members don't need a history of every notice), and it is kept on the
-- account like reading is, so it doesn't come back on another device.
--
-- Kept on the member's notification_reads row rather than a table of its own: clearing a notification also
-- reads it (so the red dot and Admin's "Read by N of M" still count it), and the row already goes when the
-- account is deleted (docs/account-deletion.md - not a kept table) or the notification is. NULL = still in
-- the list. The notification itself is untouched - Withdraw, Delete and the read count work as before.
ALTER TABLE notification_reads ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ;
