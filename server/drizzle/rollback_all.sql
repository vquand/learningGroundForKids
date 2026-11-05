DROP TABLE IF EXISTS calendar_family_settings;
DROP TABLE IF EXISTS "daily_quiz_progress" CASCADE;
DROP TABLE IF EXISTS town_river_inbox, town_river_events, town_raft_items, town_raft_progress, town_basket_gifts;
DROP FUNCTION IF EXISTS explore_invalidate_catalog() CASCADE;
DROP TABLE IF EXISTS explore_snapshots, explore_rebuild_jobs, explore_revisions;
DROP TABLE IF EXISTS adventure_events;
DROP TABLE IF EXISTS kitchen_sessions;
DROP TABLE IF EXISTS google_auth_transactions;
DROP TABLE IF EXISTS google_identities;
DROP TABLE IF EXISTS miniku_family_settings;
DROP TABLE IF EXISTS miniku_puzzles;
DROP TABLE IF EXISTS cabbage_roll_sessions, town_drink_sessions, town_learned_items, town_reward_events, town_state CASCADE;
-- Development rollback for the complete initial schema history. This is
-- destructive and must only be used against an explicitly selected disposable
-- database. Drizzle does not run this file automatically.

DROP TABLE IF EXISTS achievement_definitions;
DROP TABLE IF EXISTS road_racing_progress;
DROP TABLE IF EXISTS infinidrill_progress;
DROP TABLE IF EXISTS miniku_progress;
DROP TABLE IF EXISTS fishing_cast_results, fishing_progress;
DROP TABLE IF EXISTS passkey_challenges;
DROP TABLE IF EXISTS passkeys;
DROP TABLE IF EXISTS ufo_progress;
DROP TABLE IF EXISTS math_wall_progress;
DROP TABLE IF EXISTS ufo_words;
DROP TABLE IF EXISTS lesson_audiences;
DROP TABLE IF EXISTS family_disabled_lessons;
DROP TABLE IF EXISTS friend_requests;
DROP TABLE IF EXISTS daily_quiz_snapshots;
DROP TABLE IF EXISTS flashcard_study_sessions;
DROP TABLE IF EXISTS profile_progress;
DROP TABLE IF EXISTS quiz_attempts;
DROP TABLE IF EXISTS flashcards;
DROP TABLE IF EXISTS quiz_questions;
DROP TABLE IF EXISTS item_media;
DROP TABLE IF EXISTS item_translations;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS profile_schedule_events;
DROP TABLE IF EXISTS profile_schedule_slots;
DROP TABLE IF EXISTS profile_schedules;
DROP TABLE IF EXISTS calendar_events;
DROP TABLE IF EXISTS calendar_meal_library;
DROP TABLE IF EXISTS calendar_study_library;
DROP TABLE IF EXISTS calendar_plan_lists;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS family_password_audit;
DROP TABLE IF EXISTS families;
