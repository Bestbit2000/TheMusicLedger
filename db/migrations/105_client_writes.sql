-- ML-220: working offline. Something logged with no connection waits on the device and is sent when
-- the connection is back. If the answer to that send is lost (the connection drops again), the device
-- sends it again - so each one carries an id it made itself (the X-Client-Write-Id header), and the
-- server remembers the ids it has already done. A second arrival is answered "already saved" and
-- nothing is written twice (server/services/clientWrites.js, docs/offline.md).
--
-- Rows are only needed for as long as a device might retry; ones older than 60 days are cleared as new
-- ones arrive. The account column means a deleted account's rows go with it (the default in
-- docs/account-deletion.md) - they say nothing about the member beyond "a write happened".
CREATE TABLE client_writes (
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    write_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, write_id)
);
CREATE INDEX idx_client_writes_created ON client_writes (created_at);
