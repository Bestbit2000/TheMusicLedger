-- Archiving a piece or a practice list once it is done with (the owner, 12 Oct 2026). An archived piece
-- or list is hidden from the lists until the member asks to see what is archived, and can be brought
-- back. Nothing is deleted, and a piece stays on the practice lists it is on.
--
-- Two ways, because a band's music is shared:
--   * "just for me" - a row here, per member. Any piece or list the member can see: their own, a
--     band's, a public piece. Nobody else's lists change.
--   * "for everyone" - archived_at on the piece or list itself. Only someone who may change it (its
--     owner; for a band's, an organiser or a member who can change the band's music).
-- A piece or list is archived for a member when either says so.

CREATE TABLE archived_scores (
    account_id  BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    score_id    BIGINT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, score_id)
);

CREATE TABLE archived_practice_lists (
    account_id       BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    practice_list_id BIGINT NOT NULL REFERENCES practice_lists(id) ON DELETE CASCADE,
    archived_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, practice_list_id)
);

ALTER TABLE scores ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE practice_lists ADD COLUMN archived_at TIMESTAMPTZ;
