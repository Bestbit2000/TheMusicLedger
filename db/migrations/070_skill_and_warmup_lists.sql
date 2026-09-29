-- ML-339: named skills lists - you can keep several ("Grade 3 prep", "Band season") and a practice
-- session picks which one its Skills blocks use. skill_list_items stays as your progress on each skill
-- (where you're up to, when you last practised it) - shared by every list the skill is on, and kept
-- when a skill comes off a list. Each account's current skills become its first list, "My skills".
CREATE TABLE IF NOT EXISTS skill_lists (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
    skill_keys TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(skill_keys) <= 40),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_skill_lists_account ON skill_lists (account_id, sort_order, id);

INSERT INTO skill_lists (account_id, name, skill_keys)
SELECT i.account_id, 'My skills', array_agg(i.skill_key ORDER BY i.sort_order, i.id)
  FROM skill_list_items i
 WHERE NOT EXISTS (SELECT 1 FROM skill_lists l WHERE l.account_id = i.account_id)
 GROUP BY i.account_id;

-- ML-343: your own warm-up lists - which kinds of warm-up (long tones, lip slurs...), played in order
-- or at random. The standard lists everyone has (External warm-up, One of each kind, Brass basics,
-- Everything random) are built into the app (public/practicePlan.js, WARMUP_LISTS), not stored.
CREATE TABLE IF NOT EXISTS warmup_lists (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
    kinds TEXT[] NOT NULL CHECK (cardinality(kinds) BETWEEN 1 AND 10),
    random_order BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warmup_lists_account ON warmup_lists (account_id, id);
