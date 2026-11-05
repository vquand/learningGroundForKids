CREATE TABLE "families" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'family' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_media" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"media_type" text NOT NULL,
	"label" text,
	"lang" text,
	"filename" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"lang" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"history" text
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"country_code" text,
	"icon_slug" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"source_type" text DEFAULT 'system' NOT NULL,
	"owner_family_id" text,
	"recipe" text,
	"location_desc" text,
	"fun_facts" jsonb,
	"audio_urls" jsonb,
	"youtube_url" text,
	"trailer_url" text,
	"characters" jsonb,
	"start_year" integer,
	"end_year" integer,
	"time_precision" text,
	"released_date" text,
	"rich_fields" jsonb,
	"franchise_id" text,
	"quiz_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"item_id" text NOT NULL,
	"category" text NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"name" text NOT NULL,
	"emoji" text NOT NULL,
	"color" text NOT NULL,
	"public_id" text NOT NULL,
	"native_country_code" text,
	"native_city" text,
	"avatar_type" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"item_id" text,
	"attempt_date" timestamp with time zone NOT NULL,
	"score" integer NOT NULL,
	"total" integer NOT NULL,
	"answers" jsonb NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"lang" text NOT NULL,
	"question" text NOT NULL,
	"question_type" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_answers" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_media" ADD CONSTRAINT "item_media_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_translations" ADD CONSTRAINT "item_translations_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_owner_family_id_families_id_fk" FOREIGN KEY ("owner_family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_progress" ADD CONSTRAINT "profile_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_progress" ADD CONSTRAINT "profile_progress_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "families_email_unique" ON "families" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_item_media_item_order" ON "item_media" USING btree ("item_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "item_translations_item_lang_unique" ON "item_translations" USING btree ("item_id","lang");--> statement-breakpoint
CREATE INDEX "idx_item_translations_item_lang" ON "item_translations" USING btree ("item_id","lang");--> statement-breakpoint
CREATE INDEX "idx_items_published_category" ON "items" USING btree ("is_published","category","created_at");--> statement-breakpoint
CREATE INDEX "idx_items_owner_created" ON "items" USING btree ("owner_family_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_items_franchise" ON "items" USING btree ("franchise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_progress_profile_item_unique" ON "profile_progress" USING btree ("profile_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_profile_progress_profile_recent" ON "profile_progress" USING btree ("profile_id","done_at");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_public_id_unique" ON "profiles" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_profiles_family_created" ON "profiles" USING btree ("family_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_profile_item" ON "quiz_attempts" USING btree ("profile_id","item_id","completed_at");--> statement-breakpoint
CREATE INDEX "idx_quiz_questions_item_active" ON "quiz_questions" USING btree ("item_id","is_active","lang","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_sessions_family_expiry" ON "sessions" USING btree ("family_id","expires_at");