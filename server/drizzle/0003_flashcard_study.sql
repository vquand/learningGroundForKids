CREATE TABLE "flashcard_study_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"focus_item_id" text,
	"theme_type" text NOT NULL,
	"theme_value" text NOT NULL,
	"lang" text NOT NULL,
	"cards_shown" integer NOT NULL,
	"got_it_count" integer NOT NULL,
	"review_again_count" integer NOT NULL,
	"responses" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flashcard_study_sessions_valid_theme" CHECK ("flashcard_study_sessions"."theme_type" IN ('item', 'country', 'continent', 'era', 'category')),
	CONSTRAINT "flashcard_study_sessions_cards_shown_range" CHECK ("flashcard_study_sessions"."cards_shown" BETWEEN 1 AND 15),
	CONSTRAINT "flashcard_study_sessions_got_it_range" CHECK ("flashcard_study_sessions"."got_it_count" BETWEEN 0 AND "flashcard_study_sessions"."cards_shown"),
	CONSTRAINT "flashcard_study_sessions_review_again_range" CHECK ("flashcard_study_sessions"."review_again_count" BETWEEN 0 AND "flashcard_study_sessions"."cards_shown"),
	CONSTRAINT "flashcard_study_sessions_responses_within_shown" CHECK ("flashcard_study_sessions"."got_it_count" + "flashcard_study_sessions"."review_again_count" <= "flashcard_study_sessions"."cards_shown"),
	CONSTRAINT "flashcard_study_sessions_started_before_completed" CHECK ("flashcard_study_sessions"."started_at" <= "flashcard_study_sessions"."completed_at")
);
--> statement-breakpoint
CREATE TABLE "flashcards" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"lang" text NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"media_hint" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flashcards_lang_length" CHECK (char_length("flashcards"."lang") BETWEEN 2 AND 8),
	CONSTRAINT "flashcards_front_length" CHECK (char_length("flashcards"."front") BETWEEN 1 AND 500),
	CONSTRAINT "flashcards_back_length" CHECK (char_length("flashcards"."back") BETWEEN 1 AND 4000)
);
--> statement-breakpoint
ALTER TABLE "flashcard_study_sessions" ADD CONSTRAINT "flashcard_study_sessions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_study_sessions" ADD CONSTRAINT "flashcard_study_sessions_focus_item_id_items_id_fk" FOREIGN KEY ("focus_item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_flashcard_study_sessions_profile_completed" ON "flashcard_study_sessions" USING btree ("profile_id","completed_at");--> statement-breakpoint
CREATE INDEX "idx_flashcards_item_published_language_order" ON "flashcards" USING btree ("item_id","is_published","lang","sort_order","id");