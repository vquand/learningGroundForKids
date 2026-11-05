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
