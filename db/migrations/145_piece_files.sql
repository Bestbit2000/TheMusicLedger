-- ML-579: the owner's rule (22 Oct 2026) - "free to practise, more with Premium". Adding pieces is free for
-- everyone; putting a stored file on a piece (a document, or a recording file - not a YouTube link) is free on a
-- band's piece for whoever may change its music, and on your own pieces needs this switch (assertCanAddFiles in
-- server/services/flows.js). On for Premium, Beta tester, Teacher and Band admin; off for Standard. Super admin
-- always has everything.
--
-- Switching Add a piece and My music on for Standard (flow_create, flow_manage) is NOT done here: it is done on
-- Admin -> Feature access once this release is live, so Standard never has My music before this gate exists.
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('piece_files', 'Files on a piece', 'Putting a stored file on your own piece - a PDF, MuseScore, Sibelius or MusicXML part, or a recording file (ML-579). Files on a band''s piece are free for its organisers and anyone they let change its music, and a YouTube link is free for everyone; files already on a piece can always be seen and played.', true)
ON CONFLICT (feature_key) DO NOTHING;

INSERT INTO feature_access (feature_id, account_level, enabled)
SELECT f.id, t.level, t.on_
  FROM features f
  CROSS JOIN (VALUES ('standard_member', false), ('premium_member', true), ('beta_tester', true), ('teacher', true), ('band_admin', true)) AS t(level, on_)
 WHERE f.feature_key = 'piece_files'
ON CONFLICT (feature_id, account_level) DO NOTHING;
