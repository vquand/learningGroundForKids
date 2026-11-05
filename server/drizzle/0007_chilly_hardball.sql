-- Existing local rows receive migration time. Historical imports should supply
-- source question time when known, otherwise item/source snapshot time.
ALTER TABLE "quiz_questions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
