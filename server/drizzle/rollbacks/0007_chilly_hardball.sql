-- Development-only rollback; never run against production data.
ALTER TABLE "quiz_questions" DROP COLUMN "created_at";
