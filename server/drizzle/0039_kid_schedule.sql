CREATE TABLE "profile_schedule_events" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"from_timezone" text,
	"to_timezone" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_schedule_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	CONSTRAINT "profile_schedule_slots_range" CHECK ("profile_schedule_slots"."weekday" BETWEEN 1 AND 7 AND "profile_schedule_slots"."start_minute" >= 0 AND "profile_schedule_slots"."start_minute" < "profile_schedule_slots"."end_minute" AND "profile_schedule_slots"."end_minute" <= 1440 AND "profile_schedule_slots"."start_minute" % 30 = 0 AND "profile_schedule_slots"."end_minute" % 30 = 0)
);
--> statement-breakpoint
CREATE TABLE "profile_schedules" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"current_timezone" text,
	"timezone_changed_at" timestamp with time zone,
	"timezone_change_day" date,
	"timezone_changes_today" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_schedule_events" ADD CONSTRAINT "profile_schedule_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_schedule_slots" ADD CONSTRAINT "profile_schedule_slots_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_schedules" ADD CONSTRAINT "profile_schedules_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_profile_schedule_events_profile_at" ON "profile_schedule_events" USING btree ("profile_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_schedule_slots_start_unique" ON "profile_schedule_slots" USING btree ("profile_id","weekday","start_minute");