-- ML-463: an important notice - one a member should not find out about by accident, such as a change
-- to how their information is used (the privacy policy promises: "If the change matters to how your
-- information is used, we will also tell you in the app"). A normal notification waits behind the red
-- dot on the menu; an urgent one (ML-167) interrupts whatever the player is doing. An important one
-- is shown the next time the member opens the app, before anything else, under "Before you
-- continue...", and they carry on once they have read it ("Got it").
--
-- It is acknowledged on the account (notification_reads, as reading is), so each member sees each one
-- once, on whichever device they open first, and it stays in the notification centre afterwards.
-- Unlike the centre, it does not depend on the "notifications" feature: every member must see it.
--
-- policy_link: the pop-up also offers "Read the privacy policy" (the app's own page - no other
-- address can be put in a notice).
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS important BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS policy_link BOOLEAN NOT NULL DEFAULT false;
