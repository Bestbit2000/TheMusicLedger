-- ML-390: stepped practice sessions.
--
-- 1. Your own plans ("Build my plan") are a whole row of blocks. practice_templates.blocks holds it; a plan
--    saved before ML-390 has no blocks and keeps its opening blocks + focus (lead_blocks, focus).
-- 2. The 30-second rest between blocks shows one message at a time (why we stop, breathing, loosening up,
--    thinking like a musician, facts, looking after yourself, kind words). They live here so a super
--    admin can change them on Admin -> Rest messages without a release. audience: 'all', 'brass' (lip
--    messages - brass players only) or 'wind' (breath and air - brass and woodwind players).
--    icon is a Material Symbols name; breathing ones show the breathing circle instead.
-- 3. Each player's deck (account_rest_decks): the messages still to come, shuffled, so every message is
--    shown once before any comes round again - kept on the account, so it carries on from session to
--    session and device to device. The rules are PracticePlan.drawRest (public/practicePlan.js).
ALTER TABLE practice_templates ADD COLUMN IF NOT EXISTS blocks TEXT[];
ALTER TABLE practice_templates DROP CONSTRAINT IF EXISTS practice_templates_blocks_check;
ALTER TABLE practice_templates ADD CONSTRAINT practice_templates_blocks_check
    CHECK (blocks IS NULL OR (blocks <@ ARRAY['warmup', 'scales', 'skills', 'rehearsal']::text[] AND cardinality(blocks) BETWEEN 1 AND 24));

CREATE TABLE IF NOT EXISTS rest_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('why', 'breathe', 'body', 'think', 'fact', 'care', 'kind')),
    icon TEXT NOT NULL DEFAULT 'self_improvement' CHECK (icon ~ '^[a-z0-9_]{1,40}$'),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 240),
    audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'brass', 'wind')),
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS account_rest_decks (
    account_id BIGINT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    remaining BIGINT[] NOT NULL DEFAULT '{}',
    last_kind TEXT,
    since_breath SMALLINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The first 80 (owner-approved on the ML-390 design page, 2026-09-30). Seeded once: an empty table only,
-- so a re-run never brings back ones a super admin has deleted.
INSERT INTO rest_messages (kind, icon, title, body, audience, sort_order)
SELECT v.kind, v.icon, v.title, v.body, v.audience, v.sort_order FROM (VALUES
    ('why', 'music_off', 'Rest is part of the music', 'Music has rests, and so does practice. These 30 seconds count too.', 'all', 10),
    ('why', 'save', 'Your brain is saving it', 'While you rest, your brain files away what you just played. Stopping helps it stick.', 'all', 20),
    ('why', 'sentiment_calm', 'Fresh lips, better notes', 'Resting your lips now means a clearer sound in the next block.', 'brass', 30),
    ('why', 'repeat', 'Little and often wins', 'Lots of short, focused goes beat one long, tired one.', 'all', 40),
    ('why', 'battery_charging_full', 'Stop before you''re tired', 'Tired muscles make mistakes. Stopping now means you practise it right, not wrong.', 'all', 50),
    ('why', 'hearing', 'Reset your ears', 'A little silence helps you hear your sound freshly when you start again.', 'all', 60),
    ('why', 'theater_comedy', 'Stopping is a skill', 'Concerts have waits between pieces. Practise being calm in the gaps.', 'all', 70),
    ('why', 'diamond', 'Good beats long', 'Five good minutes are worth more than twenty sloppy ones.', 'all', 80),
    ('why', 'savings', 'Save it, don''t spend it', 'Pushing on when you''re tired uses up energy you''ll need for the next bit.', 'all', 90),
    ('why', 'workspace_premium', 'Top players do this', 'Lots of the best musicians practise in short blocks with breaks in between.', 'all', 100),
    ('why', 'ac_unit', 'Let it settle', 'Like a snow globe: give it a moment and everything settles into place.', 'all', 110),
    ('why', 'space_bar', 'The gap bar, but bigger', 'You leave a bar''s gap between goes. This is the same idea, just longer.', 'all', 120),
    ('breathe', 'air', 'Smell the flower, blow out the candle', 'Breathe in through your nose as the circle grows. Blow out slowly as it shrinks.', 'all', 130),
    ('breathe', 'air', 'Balloon tummy', 'Breathe in and let your tummy fill up like a balloon. Let it go down slowly.', 'all', 140),
    ('breathe', 'air', 'In for 4, out for 6', 'Count 4 as the circle grows, and 6 as it shrinks. Three times.', 'all', 150),
    ('breathe', 'air', 'The breath you play with', 'Hand on your tummy. Breathe in so your hand moves, not your shoulders.', 'wind', 160),
    ('breathe', 'air', 'Cool in, warm out', 'Feel the air go in cool and come out warm. Three slow breaths.', 'all', 170),
    ('breathe', 'air', 'Sigh it out', 'Big breath in, then a long, loud sigh out. Do it three times.', 'all', 180),
    ('breathe', 'air', 'Hiss like a snake', 'Breathe in, then let the air out on a long, steady "ssss". Steady air makes steady notes.', 'wind', 190),
    ('breathe', 'air', 'Count your breaths', 'Three slow breaths, following the circle. Count each one.', 'all', 200),
    ('breathe', 'air', 'Grow and shrink', 'Breathe in as the circle grows, and out as it shrinks. That''s all.', 'all', 210),
    ('breathe', 'air', 'Quiet shoulders', 'Breathe in without lifting your shoulders. Let them stay low and soft.', 'all', 220),
    ('breathe', 'air', 'Float a feather', 'Imagine a feather just in front of you. Keep it floating with a slow, gentle breath out.', 'all', 230),
    ('breathe', 'air', 'Fill from the bottom', 'Like filling a glass: tummy first, then ribs, then chest. Out slowly.', 'all', 240),
    ('body', 'keyboard_double_arrow_down', 'Shoulder drop', 'Lift your shoulders up to your ears, hold... and let them drop.', 'all', 250),
    ('body', 'waving_hand', 'Floppy hands', 'Shake your hands loosely, like you''re drying them.', 'all', 260),
    ('body', 'mood', 'Horse lips', 'Take the mouthpiece away and flap your lips gently, like a horse. Brrrr.', 'brass', 270),
    ('body', 'sentiment_neutral', 'Loose jaw', 'Let your jaw hang a little open. Wiggle it gently side to side.', 'all', 280),
    ('body', 'visibility', 'Look far away', 'Look at something far away, out of a window if you can. Your eyes get a rest.', 'all', 290),
    ('body', 'back_hand', 'Finger stretch', 'Spread your fingers wide, then make soft fists. Three times.', 'all', 300),
    ('body', 'accessibility_new', 'Neck tilt', 'Slowly tilt your head to one side, then the other. Gently does it.', 'all', 310),
    ('body', 'sports_gymnastics', 'Reach for the sky', 'Stand up, reach up tall, then let your arms flop down.', 'all', 320),
    ('body', 'footprint', 'Wiggle your toes', 'Wiggle your toes, then press your feet flat into the floor.', 'all', 330),
    ('body', 'autorenew', 'Wrist circles', 'Circle your wrists slowly one way, then the other.', 'all', 340),
    ('body', 'front_hand', 'Put it down', 'Put your instrument down safely. Your arms need a rest too.', 'all', 350),
    ('body', 'sentiment_very_satisfied', 'Scrunch and let go', 'Scrunch your face up tight... then let it all go.', 'all', 360),
    ('body', 'sentiment_content', 'Soft tongue', 'Let your tongue rest at the bottom of your mouth. Nice and floppy.', 'all', 370),
    ('body', 'bedtime', 'Close your eyes', 'Close your eyes for three slow breaths.', 'all', 380),
    ('think', 'record_voice_over', 'Hear it first', 'Play the next bit in your head at the right speed.', 'all', 390),
    ('think', 'mic', 'Hum it', 'Hum the tricky bar quietly. If you can sing it, you can play it.', 'all', 400),
    ('think', 'touch_app', 'Tap it out', 'Tap the next bit''s rhythm on your knee.', 'all', 410),
    ('think', 'thumb_up', 'One good thing', 'What went well just now? Remember it.', 'all', 420),
    ('think', 'target', 'One thing to change', 'Pick one thing to do better next time. Just one.', 'all', 430),
    ('think', 'movie', 'Picture it perfect', 'Imagine playing the next bit smoothly, right to the end.', 'all', 440),
    ('think', 'timer', 'Count it in', 'Count four beats in your head at the next speed.', 'all', 450),
    ('think', 'search', 'Where did it wobble?', 'Was it the same bar every time? That''s the one to focus on.', 'all', 460),
    ('think', 'piano', 'Silent fingers', 'Move your fingers through the tricky notes without playing. Your lips still get their rest.', 'all', 470),
    ('think', 'hearing', 'Listen to the quiet', 'What can you hear in the room right now? Listening is part of music.', 'all', 480),
    ('think', 'abc', 'Say the notes', 'Say the note names of the tricky bit out loud.', 'all', 490),
    ('think', 'auto_stories', 'What''s the story?', 'What is this piece about? Happy, sad, marching, dancing? Play it like that.', 'all', 500),
    ('fact', 'schedule', 'Tempo means time', 'Tempo is the Italian word for time. Lots of music words are Italian.', 'all', 510),
    ('fact', 'directions_walk', 'Andante means walking', 'Andante comes from the Italian for "to walk". A walking speed.', 'all', 520),
    ('fact', 'front_hand', 'The pause sign', 'Fermata, the sign that says "hold this note", comes from the Italian for "stop".', 'all', 530),
    ('fact', 'history_edu', 'The oldest instruments', 'The oldest instruments ever found are flutes made from bone, about 40,000 years old.', 'all', 540),
    ('fact', 'av_timer', '1815', 'Johann Maelzel patented the metronome in 1815. Every click you hear goes back to him.', 'all', 550),
    ('fact', 'library_music', 'Beethoven''s speeds', 'Beethoven was one of the first composers to write metronome speeds on his music.', 'all', 560),
    ('fact', 'science', 'What brass is', 'Brass is a mix of two metals: copper and zinc.', 'all', 570),
    ('fact', 'straighten', 'Seven positions', 'A trombone slide has seven positions. Each one makes the tube longer.', 'all', 580),
    ('fact', 'person', 'Mr Sax', 'The saxophone was invented by Adolphe Sax in the 1840s. It''s named after him.', 'all', 590),
    ('fact', 'straighten', 'Longer than you think', 'Straightened out, a cornet''s tube is well over a metre long, about the same as a trumpet''s.', 'all', 600),
    ('fact', 'piano', '88 keys', 'A piano has 88 keys: 52 white and 36 black.', 'all', 610),
    ('fact', 'emoji_events', 'Contests since 1860', 'Brass bands were competing at Crystal Palace in London as long ago as 1860.', 'all', 620),
    ('care', 'water_drop', 'Sip of water', 'Have a sip of water. Playing is thirsty work.', 'all', 630),
    ('care', 'healing', 'Nothing should hurt', 'If anything hurts, stop playing and tell someone.', 'all', 640),
    ('care', 'accessibility', 'Sit or stand tall', 'Tall back, feet flat, shoulders soft. Ready for the next block.', 'all', 650),
    ('care', 'light_mode', 'Can you see the music?', 'Good light on your music means less squinting.', 'all', 660),
    ('care', 'height', 'Music at eye level', 'Put your music at eye level so you don''t look down while you play.', 'all', 670),
    ('care', 'window', 'Fresh air', 'If the room feels stuffy, open a window for a moment.', 'all', 680),
    ('care', 'pan_tool', 'Warm hands', 'Cold fingers are slow fingers. Rub your hands together.', 'all', 690),
    ('care', 'remove_red_eye', 'Blink', 'Blink a few times and look away from the screen.', 'all', 700),
    ('kind', 'lightbulb', 'Mistakes are clues', 'Mistakes show you exactly what to practise.', 'all', 710),
    ('kind', 'speed', 'Slow is smooth', 'Slow is smooth, and smooth becomes fast.', 'all', 720),
    ('kind', 'check_circle', 'You turned up', 'Starting is the hardest bit, and you''ve already done it.', 'all', 730),
    ('kind', 'escalator_warning', 'Everyone starts somewhere', 'Every great player started exactly where you are.', 'all', 740),
    ('kind', 'trending_up', 'Quiet progress', 'You might not feel it today, but you are getting better.', 'all', 750),
    ('kind', 'handshake', 'Be kind to you', 'Talk to yourself the way you would to a friend.', 'all', 760),
    ('kind', 'stairs', 'One block at a time', 'Tricky bars become easy bars, one block at a time.', 'all', 770),
    ('kind', 'star', 'A little better', 'You don''t need to be perfect, just a little better than last time.', 'all', 780),
    ('kind', 'celebration', 'Be proud', 'Look how far you''ve come with this piece.', 'all', 790),
    ('kind', 'music_note', 'Enjoy it', 'Enjoy the sound you''re making. That''s what it''s all for.', 'all', 800)
) AS v(kind, icon, title, body, audience, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM rest_messages);
