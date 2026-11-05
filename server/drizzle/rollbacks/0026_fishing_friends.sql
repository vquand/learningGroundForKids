-- Destructive development rollback: explicitly selected disposable databases only.
DROP TABLE IF EXISTS fishing_cast_results, fishing_progress;
