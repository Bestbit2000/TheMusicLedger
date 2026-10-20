-- ML-495: a notice can also be shown as a banner - a strip across the top of every screen while it is live,
-- for a planned outage ("the app will be unavailable on Saturday from 8 to 9"). It uses the notice's own
-- publish and expiry times, so it comes and goes by itself. It reaches everyone, signed in or not (owner,
-- 8 Oct 2026: on the sign-in screen too), whatever their account type has switched on - so only a notice for
-- everyone (audience 'all') can be a banner, never one for named members.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS banner BOOLEAN NOT NULL DEFAULT false;
