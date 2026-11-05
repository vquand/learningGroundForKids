---
title: Complete Database Tables Reference
tags: [database, tables, schema, postgresql, columns, constraints]
created: 2026-11-01
---

# Complete Database Tables Reference

This document provides a detailed specification of all database tables defined in `server/src/db/schema.ts`.

---

## 📑 System & Explore Snapshots

### 1. `explore_revisions`
Tracks monotonic content revisions for cache invalidation.
- `id` (integer, PK, default 1, singleton check `id = 1`)
- `catalog_revision` (bigint, default 1)
- `visibility_revision` (bigint, default 1)

### 2. `explore_snapshots`
Pre-calculated explore tree blobs.
- `id` (text, PK, 64-char sha256 hash)
- `kind` (text, `'common'` or `'view'`)
- `catalog_revision` (bigint)
- `visibility_revision` (bigint, nullable for common)
- `payload` (jsonb, bounded to 8MB)
- `payload_bytes` (integer)
- `created_at` (timestamp with tz)
- *Indices*: `(kind, created_at)`

### 3. `explore_rebuild_jobs`
Distributed background snapshot materialization queue.
- `id` (text, PK)
- `kind` (text, `'common'` or `'view'`)
- `owner` (text)
- `fence` (integer, 1–3)
- `state` (text, `'running'`, `'ready'`, `'failed'`)
- `lease_until` (timestamp with tz)
- `updated_at` (timestamp with tz)

---

## 👥 Families, Auth & Passkeys

### 4. `families`
Household / family root accounts.
- `id` (text, PK)
- `email` (text, UK)
- `display_name` (text)
- `password_hash` (text)
- `role` (text, `'family'` or `'admin'`)
- `is_active` (boolean, default true)
- `onboarding_dismissed` (boolean)
- `onboarding_parent_visited` (boolean)
- `created_at`, `updated_at` (timestamp with tz)

### 5. `sessions`
Active browser authentication sessions.
- `id` (text, PK)
- `token_hash` (text, UK, sha256 of session cookie)
- `family_id` (text, FK `families.id` CASCADE)
- `expires_at` (timestamp with tz)
- `parent_verified_until` (timestamp with tz)
- `parent_verified_by` (text, `'password'`, `'passkey'`, `'google'`)
- `created_at` (timestamp with tz)
- *Indices*: `(family_id, expires_at)`

### 6. `passkeys`
Registered WebAuthn/FIDO2 credentials.
- `id` (text, PK, credential ID)
- `family_id` (text, FK `families.id` CASCADE)
- `public_key` (text)
- `counter` (bigint, monotonic counter)
- `transports` (jsonb, array of transports)
- `device_type` (text, `'singleDevice'` or `'multiDevice'`)
- `backed_up` (boolean)
- `created_at`, `last_used_at` (timestamp with tz)

### 7. `passkey_challenges`
Pending challenges during WebAuthn registration/authentication.
- `token_hash` (text, PK)
- `challenge` (text)
- `purpose` (text, `'login'`, `'parent'`, `'register'`)
- `session_hash` (text)
- `family_id` (text, FK `families.id` CASCADE)
- `expires_at` (timestamp with tz)

### 8. `google_identities`
Google OAuth account associations.
- `subject` (text, PK)
- `family_id` (text, UK, FK `families.id` CASCADE)
- `created_at` (timestamp with tz)

### 9. `google_auth_transactions`
Temporary state storage for Google PKCE authorization flow.
- `token_hash` (text, PK)
- `verifier` (text)
- `purpose` (text, `'login'` or `'parent'`)
- `family_id` (text, FK `families.id` CASCADE)
- `expires_at` (timestamp with tz)

### 10. `family_password_audit`
Administrative password reset audit trail.
- `id` (text, PK)
- `actor_family_id` (text, FK `families.id`)
- `target_family_id` (text, FK `families.id`)
- `reason` (text)
- `created_at` (timestamp with tz)

---

## 🧒 Profiles & Social Connections

### 11. `profiles`
Individual child learner profiles.
- `id` (text, PK)
- `family_id` (text, FK `families.id` CASCADE)
- `name` (text)
- `emoji` (text)
- `color` (text)
- `public_id` (text, UK)
- `native_country_code`, `native_city` (text)
- `avatar_type`, `avatar_url`, `avatar_frame` (text)
- `created_at`, `updated_at` (timestamp with tz)

### 12. `friend_requests`
Cross-family and profile-to-profile friendship connections.
- `id` (text, PK)
- `requesting_family_id` (text, FK `families.id` CASCADE)
- `requesting_scope` (text, `'profile'` or `'family'`)
- `requesting_profile_id` (text, FK `profiles.id` CASCADE)
- `requesting_label` (text)
- `target_family_id` (text, FK `families.id` CASCADE)
- `target_scope` (text, `'profile'` or `'family'`)
- `target_profile_id` (text, FK `profiles.id` CASCADE)
- `target_label` (text)
- `target_code` (text)
- `requester_message` (text)
- `status` (text, `'pending'`, `'accepted'`, `'rejected'`, `'cancelled'`)
- `created_at`, `responded_at` (timestamp with tz)

---

## 📚 Catalog & Learning Content

### 13. `items`
Geographic landmarks, historical events, and lessons.
- `id` (text, PK)
- `category` (text)
- `latitude`, `longitude` (doublePrecision)
- `country_code`, `icon_slug` (text)
- `is_published` (boolean)
- `source_type` (text, `'system'` or `'family'`)
- `owner_family_id` (text, FK `families.id` CASCADE)
- `recipe`, `location_desc` (text)
- `fun_facts`, `audio_urls`, `characters`, `rich_fields` (jsonb)
- `youtube_url`, `trailer_url` (text)
- `start_year`, `end_year` (integer)
- `time_precision`, `released_date`, `franchise_id` (text)
- `quiz_required` (boolean)
- `catalog_content_hash` (text)
- `created_at`, `updated_at` (timestamp with tz)

### 14. `item_translations`
Localized item titles, descriptions, and histories.
- `id` (text, PK)
- `item_id` (text, FK `items.id` CASCADE)
- `lang` (text, `'en'` or `'vi'`)
- `title` (text)
- `description`, `history` (text)
- *Indices*: Unique `(item_id, lang)`

### 15. `item_media`
Photos, illustrations, and audio clips for items.
- `id` (text, PK)
- `item_id` (text, FK `items.id` CASCADE)
- `media_type` (text)
- `label`, `lang` (text)
- `filename` (text)
- `sort_order` (integer)

### 16. `lesson_audiences`
Custom lesson sharing between families and children.
- `id` (text, PK)
- `item_id` (text, FK `items.id` CASCADE)
- `target_family_id` (text, FK `families.id` CASCADE)
- `target_profile_id` (text, FK `profiles.id` CASCADE)
- `granted_by_family_id` (text, FK `families.id` CASCADE)
- `created_at` (timestamp with tz)

### 17. `family_disabled_lessons`
Parent-level disabling of specific lessons.
- `family_id` (text, FK `families.id` CASCADE)
- `item_id` (text, FK `items.id` CASCADE)
- `disabled_at` (timestamp with tz)
- *PK*: `(family_id, item_id)`

---

## 📝 Quizzes, Flashcards & Progress

### 18. `quiz_questions`
Item-specific assessment questions.
- `id` (text, PK)
- `item_id` (text, FK `items.id` CASCADE)
- `question_group_id`, `lang` (text)
- `question`, `question_type` (text)
- `options` (jsonb, array of choices)
- `correct_answers` (jsonb, array of indices)
- `sort_order` (integer)
- `is_active` (boolean)
- `created_at` (timestamp with tz)

### 19. `quiz_attempts`
Historical assessment results.
- `id` (text, PK)
- `profile_id` (text, FK `profiles.id` CASCADE)
- `item_id` (text, FK `items.id` CASCADE)
- `attempt_date` (timestamp with tz)
- `score`, `total` (integer)
- `answers` (jsonb)
- `completed_at` (timestamp with tz)

### 20. `daily_quiz_snapshots`
Daily frozen questions assigned to each child.
- `id` (text, PK)
- `profile_id` (text, FK `profiles.id` CASCADE)
- `snapshot_date` (date string)
- `lang` (text)
- `question_ids` (jsonb, array of IDs)
- *Indices*: Unique `(profile_id, snapshot_date)`

### 21. `daily_quiz_progress`
Daily quiz streak and bonus state.
- `profile_id` (text, PK, FK `profiles.id` CASCADE)
- `state` (jsonb)
- `updated_at` (timestamp with tz)

### 22. `flashcards`
Flashcard review decks.
- `id` (text, PK)
- `item_id` (text, FK `items.id` CASCADE)
- `lang`, `front`, `back`, `media_hint` (text)
- `sort_order` (integer)
- `is_published` (boolean)
- `source_type` (text)

### 23. `flashcard_study_sessions`
Recorded spaced repetition study sessions.
- `id` (text, PK)
- `profile_id` (text, FK `profiles.id` CASCADE)
- `focus_item_id` (text, FK `items.id` SET NULL)
- `theme_type`, `theme_value`, `lang` (text)
- `cards_shown`, `got_it_count`, `review_again_count` (integer)
- `responses` (jsonb)
- `started_at`, `completed_at` (timestamp with tz)

### 24. `profile_progress`
Marked completions of landmarks.
- `id` (text, PK)
- `profile_id` (text, FK `profiles.id` CASCADE)
- `item_id` (text, FK `items.id` CASCADE)
- `category` (text)
- `done_at` (timestamp with tz)
- *Indices*: Unique `(profile_id, item_id)`

### 25. `achievement_definitions`
Authoritative catalog of platform achievements.
- `id` (text, PK)
- `group_id` (text)
- `definition` (jsonb)

---

## 🕹️ Minigames & Simulations

### 26. `ufo_words` & `ufo_progress`
*Shoo Shoo UFO* spelling dictionary and player progress.
- `ufo_words`: `id` (PK), `language` (`'en'` or `'vi'`), `word`, `difficulty`, `clue`, `definition`.
- `ufo_progress`: `profile_id` (PK, FK `profiles.id` CASCADE), `state` (jsonb), `updated_at`.

### 27. `math_wall_progress`
*Waddle Wall* math sprint progress and high scores.
- `profile_id` (PK, FK `profiles.id` CASCADE), `state` (jsonb), `best_score` (integer), `updated_at`.

### 28. `infinidrill_progress`
*InfiniDrill* mining expedition state, depth, upgrades, and mineral balances.
- `profile_id` (PK, FK `profiles.id` CASCADE), `state` (jsonb), `updated_at`.

### 29. `miniku_puzzles`, `miniku_progress` & `miniku_family_settings`
*Miniku* mini Sudoku boards and solvers.
- `miniku_puzzles`: `id` (PK), `owner_family_id` (FK), `size` (4 or 6), `givens` (jsonb), `solution` (jsonb), `enabled`, `revision`.
- `miniku_progress`: `profile_id` (PK, FK), `state` (jsonb).
- `miniku_family_settings`: `family_id` (PK, FK), `hints` (boolean).

### 30. `fishing_progress` & `fishing_cast_results`
*Fishing Friends* rod, bait, pond/river records, and catch history.
- `fishing_progress`: `profile_id` (PK, FK), `state` (jsonb), `updated_at`.
- `fishing_cast_results`: `profile_id` (FK), `cast_id`, `location`, `fish_id`, `stamina`, `points`, `created_at`. PK: `(profile_id, cast_id)`.

### 31. `road_racing_progress`
*Road Racing* vehicle tuning and course completion state.
- `profile_id` (PK, FK), `state` (jsonb), `updated_at`.

### 32. `town_state` & `town_reward_events`
*Town Building* grid layout, buildings, gardens, civic houses, and reward event idempotency.
- `town_state`: `profile_id` (PK, FK), `state` (jsonb), `updated_at`.
- `town_reward_events`: `profile_id` (FK), `event_id`, `reward` (jsonb), `created_at`. PK: `(profile_id, event_id)`.

### 33. `town_basket_gifts`
Friend gift baskets exchanged between towns.
- `id` (PK), `sender_profile_id` (FK), `recipient_profile_id` (FK), `decoration`, `message` (0–9), `created_at`, `opened_at`.

### 34. `town_raft_progress` & `town_raft_items`
Shared river raft trade network.
- `town_raft_progress`: `profile_id` (PK, FK), `fish_caught` (0–50).
- `town_raft_items`: `id` (PK), `provider_id` (FK), `source_key`, `kind` (`'fish'`, `'vegetable'`, `'egg'`), `item_id`, `stamina` (1–10), `produced_at`, `picker_id` (FK), `picked_at`, `pickup_request_id`.

### 35. `town_river_events` & `town_river_inbox`
Append-only river news feed.
- `town_river_events`: `sequence` (bigserial, PK), `event_key` (UK), `owner_id` (FK), `visitor_id`, `kind`, `data` (jsonb), `stamina`, `created_at`.
- `town_river_inbox`: `profile_id` (PK, FK), `last_sequence`, `last_arrival_id`, `last_arrival_new`, `last_report` (jsonb).

### 36. `kitchen_sessions` & `cabbage_roll_sessions`
Cooking simulations.
- `kitchen_sessions`: `profile_id` (FK), `recipe_id`, `state` (jsonb). PK: `(profile_id, recipe_id)`.
- `cabbage_roll_sessions`: `profile_id` (PK, FK), `state` (jsonb).

### 37. `adventure_events`
Timeline of noteworthy achievements across all minigames.
- `id` (PK), `profile_id` (FK), `event_key` (UK), `game`, `kind`, `data` (jsonb), `created_at`.

---

## 📅 Kid Calendar & Routines

### 38. `calendar_plan_lists`
Daily task checklists, meals, and medication schedules.
- `id` (text, PK)
- `profile_id` (text, FK `profiles.id` CASCADE)
- `scope` (text, `'template'` or `'date'`)
- `weekday` (integer 1–7, template scope)
- `local_date` (date string YYYY-MM-DD, date scope)
- `area` (text, schedule section)
- `items` (jsonb, array of items)
- `revision` (integer)
- `updated_at` (timestamp with tz)

### 39. `calendar_events`
Events, holidays, birthdays, and reminders.
- `id` (text, PK)
- `profile_id` (text, FK `profiles.id` CASCADE)
- `title`, `icon_key` (text)
- `start_date` (date)
- `repeat` (text, `'none'`, `'weekly'`, `'monthly'`, `'yearly'`)
- `repeat_ended_on` (date)
- `name_history` (jsonb)
- `revision` (integer)
- `created_at`, `updated_at` (timestamp with tz)

### 40. `calendar_meal_library` & `calendar_study_library`
Personalized food and subject items.
- `calendar_meal_library`: `id` (PK), `profile_id` (FK), `food_key`, `custom_name`, `created_at`.
- `calendar_study_library`: `id` (PK), `profile_id` (FK), `subject`, `name`, `created_at`.

### 41. `calendar_family_settings`
Household calendar preferences.
- `family_id` (text, PK, FK `families.id` CASCADE)
- `disabled_roles` (jsonb)
- `revision` (integer)

---

## 🧭 Navigation & Cross References
- Schema Overview: [[05-database/schema-overview|Database Schema Overview and ERD]]
- Migrations: [[05-database/migrations|Database Migrations]]
- Core Entities: [[04-domain-entities/core-entities|Core Domain Entities]]
- API Endpoints: [[06-api-reference/api-overview|API Reference Overview]]
