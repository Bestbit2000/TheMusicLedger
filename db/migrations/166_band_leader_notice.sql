-- ML-648: someone made a band leader (or not any more) is told in the app - one more kind of app-made notice,
-- for the one member (server/services/autoNotices.js noticeBandLeader). details holds { bandId, on }. It is one of
-- the "Changes in a band" notices a member can switch off. The email that goes with it is in emailCatalogue.js.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check
    CHECK (kind IN ('band_invite', 'band_level', 'band_removed', 'band_news', 'piece_deleted', 'band_notice', 'band_leader'));
