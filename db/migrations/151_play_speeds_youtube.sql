-- ML-596: one list of play speeds for the whole app (Admin -> Playback speeds) - the metronome, a recording, a
-- YouTube video and Warm-ups all offer it. YouTube's player only plays at its own speeds (usually 25% to 200% in
-- 25s - each video says which, getAvailablePlaybackRates), and the list had only 50%, 100% and 150% of them, so
-- the two between are added. A video offers the speeds on this list that it can play (owner, 23 Oct 2026).
INSERT INTO playback_speed_options (percent) VALUES (75), (125)
ON CONFLICT (percent) DO NOTHING;
