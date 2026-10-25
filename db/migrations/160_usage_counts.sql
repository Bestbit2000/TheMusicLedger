-- ML-22: how much each tool and each button is used - counted, never who (docs/usage-stats.md).
-- One row is one item on one day: a use of a tool ('use': started, and finished), a button pressed ('tap':
-- started is the number of presses) or a screen opened ('view'), on its own or in a practice session.
-- members is how many members it was the first time that day for (each device says so once a day - so a
-- member on two devices counts twice). who keeps the owner's own use and the local test accounts apart, so
-- the page can leave them out. No account column: nothing here is about anyone (docs/account-deletion.md),
-- so it is kept as long as it is useful.
CREATE TABLE usage_counts (
    day DATE NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('use', 'tap', 'view')),
    item TEXT NOT NULL CHECK (length(item) BETWEEN 1 AND 160),
    place TEXT NOT NULL CHECK (place IN ('own', 'session')),
    who TEXT NOT NULL CHECK (who IN ('member', 'admin', 'test')),
    started INTEGER NOT NULL DEFAULT 0 CHECK (started >= 0),
    finished INTEGER NOT NULL DEFAULT 0 CHECK (finished >= 0),
    members INTEGER NOT NULL DEFAULT 0 CHECK (members >= 0),
    PRIMARY KEY (day, kind, item, place, who)
);
CREATE INDEX idx_usage_counts_item ON usage_counts (kind, item, day);
