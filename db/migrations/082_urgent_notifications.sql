-- ML-167: an urgent notice - one that interrupts. A normal notification waits in the ☰ menu's
-- Notifications screen (red dot); an urgent one also pops up over whatever the player is doing, straight
-- away if the app is open (it checks every minute while it's on screen) or the moment they next open it,
-- until they tap "Got it" (which marks it read). Scheduling, expiry and withdrawing work as before.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS urgent BOOLEAN NOT NULL DEFAULT false;
