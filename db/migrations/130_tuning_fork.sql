-- ML-158: the Tuning fork - a note to tune to, picked on a stave and held until stopped. A tool of its
-- own (All tools, Everyday) and a pop-up from the Tuner. Nothing is stored: the note and the volume are
-- kept on the device. Off until switched on (Admin -> Feature access).

INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('tuning_fork', 'Tuning fork', 'A note to tune to (ML-158): pick it on a stave - written for your instrument, starting on its usual tuning note - and it sounds until you stop it, with a volume control. A tool on All tools (Everyday) and a button on the Tuner that opens it as a pop-up; the tuner stops listening while it sounds. Follows the Tuner''s A = setting.', false)
ON CONFLICT (feature_key) DO NOTHING;
