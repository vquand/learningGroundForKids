-- Retire placeholder quizzes: migration 0031 only.
-- Prerequisite: migrations through 0030_daily_quiz already applied.
-- Run the ENTIRE file in one session, with no migration runner in parallel.
-- Content retirement only: retains historical attempts, learning progress,
-- earned badges and Town receipts. A repeated matching run is a no-op.
-- Any error aborts the transaction; run ROLLBACK before retrying.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DO $placeholder_quiz_migration$
DECLARE recorded_hash text;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'Apply existing migrations through 0030 before running migration 0031';
  END IF;
  LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
  SELECT hash INTO recorded_hash FROM drizzle.__drizzle_migrations
    WHERE created_at = 1792829344744;
  IF FOUND THEN
    IF recorded_hash <> 'a510a71b82c433e732cbc7aa7692e257e509feb6c2b2512492d2bcb20f722eb6' THEN
      RAISE EXCEPTION 'Migration 0031 is recorded with a different hash; inspect migration history';
    END IF;
    RAISE NOTICE 'Placeholder quiz migration 0031 is already applied; no changes made';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE created_at = 1792742944744 AND hash = 'd8164d1d9e1a172e8f6f4c4783cbd62305b2de8be01e6198afefca4823712e90') THEN
    RAISE EXCEPTION 'Required migration 0030_daily_quiz is missing or its hash differs';
  END IF;
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at > 1792829344744) THEN
    RAISE EXCEPTION 'A later migration is recorded without 0031; inspect migration history';
  END IF;

-- Retire placeholder quizzes and their derived cards; preserve all attempts,
-- learned items, earned badges, Town receipts and player progress.
-- Only cache-revision triggers are suspended under table write locks, then
-- restored before commit. One revision bump avoids thousands of row bumps.
LOCK TABLE items, quiz_questions IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE items DISABLE TRIGGER explore_catalog_revision;
ALTER TABLE quiz_questions DISABLE TRIGGER explore_catalog_revision;
DO $retire_quiz_placeholders$
DECLARE
  pattern text := $quiz_placeholder$associat(ed|e|ing)\s+with|gắn\s+liền\s+với|what\s+(kind|type)\s+of\s+learning\s+item\s+is|thuộc\s+loại\s+nội\s+dung(\s+học\s+tập)?\s+nào$quiz_placeholder$;
  question_count integer;
  card_count integer;
  item_count integer;
BEGIN
  UPDATE quiz_questions SET is_active = false WHERE is_active AND question ~* pattern;
  GET DIAGNOSTICS question_count = ROW_COUNT;
  UPDATE flashcards SET is_published = false, updated_at = now()
    WHERE is_published AND source_type = 'catalog_quiz' AND front ~* pattern;
  GET DIAGNOSTICS card_count = ROW_COUNT;
  UPDATE items SET quiz_required = false, updated_at = now()
    WHERE quiz_required AND NOT EXISTS (
      SELECT 1 FROM quiz_questions q WHERE q.item_id = items.id AND q.is_active
    );
  GET DIAGNOSTICS item_count = ROW_COUNT;
  IF question_count > 0 OR item_count > 0 THEN
    UPDATE explore_revisions SET catalog_revision = catalog_revision + 1,
      visibility_revision = visibility_revision + 1 WHERE id = 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Explore revision state is missing'; END IF;
  END IF;
  RAISE NOTICE 'Retired % placeholder questions and % derived cards; cleared % empty quiz requirements', question_count, card_count, item_count;
END;
$retire_quiz_placeholders$;
ALTER TABLE quiz_questions ENABLE TRIGGER explore_catalog_revision;
ALTER TABLE items ENABLE TRIGGER explore_catalog_revision;

  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('a510a71b82c433e732cbc7aa7692e257e509feb6c2b2512492d2bcb20f722eb6', 1792829344744);
END;
$placeholder_quiz_migration$;
COMMIT;
SELECT hash, created_at FROM drizzle.__drizzle_migrations
  WHERE created_at = 1792829344744;
