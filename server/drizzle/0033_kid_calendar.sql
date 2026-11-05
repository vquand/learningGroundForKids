CREATE TABLE "calendar_events" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"title" text NOT NULL,
	"icon_key" text NOT NULL,
	"start_date" date NOT NULL,
	"repeat" text DEFAULT 'none' NOT NULL,
	"repeat_ended_on" date,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_events_repeat" CHECK ("calendar_events"."repeat" IN ('none','weekly','monthly','yearly')),
	CONSTRAINT "calendar_events_revision" CHECK ("calendar_events"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "calendar_meal_library" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"food_key" text NOT NULL,
	"custom_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_plan_lists" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"scope" text NOT NULL,
	"weekday" integer,
	"local_date" date,
	"area" text NOT NULL,
	"items" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_plan_lists_scope_shape" CHECK (("calendar_plan_lists"."scope" = 'template' AND "calendar_plan_lists"."weekday" IS NOT NULL AND "calendar_plan_lists"."weekday" BETWEEN 1 AND 7 AND "calendar_plan_lists"."local_date" IS NULL) OR ("calendar_plan_lists"."scope" = 'date' AND "calendar_plan_lists"."weekday" IS NULL AND "calendar_plan_lists"."local_date" IS NOT NULL)),
	CONSTRAINT "calendar_plan_lists_area" CHECK ("calendar_plan_lists"."area" IN ('study_morning','study_afternoon','meal_breakfast','meal_lunch','meal_snack','meal_dinner','medicine')),
	CONSTRAINT "calendar_plan_lists_revision" CHECK ("calendar_plan_lists"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_meal_library" ADD CONSTRAINT "calendar_meal_library_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_plan_lists" ADD CONSTRAINT "calendar_plan_lists_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_events_profile_start" ON "calendar_events" USING btree ("profile_id","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_meal_library_unique" ON "calendar_meal_library" USING btree ("profile_id","food_key",coalesce("custom_name", ''));--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_plan_lists_template_unique" ON "calendar_plan_lists" USING btree ("profile_id","weekday","area") WHERE "calendar_plan_lists"."scope" = 'template';--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_plan_lists_date_unique" ON "calendar_plan_lists" USING btree ("profile_id","local_date","area") WHERE "calendar_plan_lists"."scope" = 'date';--> statement-breakpoint
CREATE INDEX "calendar_plan_lists_profile_date" ON "calendar_plan_lists" USING btree ("profile_id","local_date");