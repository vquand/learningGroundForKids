-- Development-only rollback for the nullable quiz group field.
-- Do not use while source groups or imported data need to be preserved.
ALTER TABLE "quiz_questions" DROP COLUMN "question_group_id";
