CREATE TABLE "ufo_progress" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ufo_words" (
	"id" text PRIMARY KEY NOT NULL,
	"word" text NOT NULL,
	"difficulty" text NOT NULL,
	"clue" text NOT NULL,
	"definition" text NOT NULL,
	CONSTRAINT "ufo_words_word_valid" CHECK ("ufo_words"."word" ~ '^[A-Z]{2,18}$'),
	CONSTRAINT "ufo_words_difficulty_valid" CHECK ("ufo_words"."difficulty" IN ('easy','medium','hard'))
);
--> statement-breakpoint
ALTER TABLE "ufo_progress" ADD CONSTRAINT "ufo_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ufo_words_word_unique" ON "ufo_words" USING btree ("word");