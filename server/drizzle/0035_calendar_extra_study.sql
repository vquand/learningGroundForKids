ALTER TABLE "calendar_plan_lists" DROP CONSTRAINT "calendar_plan_lists_area";
--> statement-breakpoint
ALTER TABLE "calendar_plan_lists" ADD CONSTRAINT "calendar_plan_lists_area" CHECK ("calendar_plan_lists"."area" IN ('study_morning','study_afternoon','study_extra','meal_breakfast','meal_lunch','meal_snack','meal_dinner','medicine'));
