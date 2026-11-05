-- Disposable development rollback only; this deletes shared egg stock.
DROP INDEX IF EXISTS fishing_cast_profile_fish;
DELETE FROM town_raft_items WHERE kind='egg';
ALTER TABLE town_raft_items DROP CONSTRAINT town_raft_kind;
ALTER TABLE town_raft_items ADD CONSTRAINT town_raft_kind CHECK (kind IN ('fish','vegetable'));
