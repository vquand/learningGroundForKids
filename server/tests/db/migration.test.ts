import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the Neon calendar custom items handoff preserves canonical SQL and migration identity", async () => {
  const journal = JSON.parse(await readFile(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  const migration = journal.entries.find((entry: { tag: string }) => entry.tag === "0034_calendar_custom_items");
  const prerequisite = journal.entries.find((entry: { tag: string }) => entry.tag === "0033_kid_calendar");
  assert.ok(migration && prerequisite);
  const source = await readFile(new URL("../../drizzle/0034_calendar_custom_items.sql", import.meta.url), "utf8");
  const previousSource = await readFile(new URL("../../drizzle/0033_kid_calendar.sql", import.meta.url), "utf8");
  const handoff = await readFile(new URL("../../../docs/migrations/neon-0034-calendar-custom-items.sql", import.meta.url), "utf8");
  const hash = createHash("sha256").update(source).digest("hex");
  const previousHash = createHash("sha256").update(previousSource).digest("hex");
  assert.ok(handoff.includes(source.replaceAll("--> statement-breakpoint", "").trim()));
  assert.ok(handoff.includes(`VALUES ('${hash}', ${migration.when})`));
  assert.ok(handoff.includes(`created_at = ${prerequisite.when} AND hash = '${previousHash}'`));
  assert.match(handoff, /BEGIN;[\s\S]*COMMIT;/);
  assert.match(handoff, /LOCK TABLE drizzle\.__drizzle_migrations IN EXCLUSIVE MODE/);
  assert.match(handoff, /Required migration 0033_kid_calendar is missing/);
  assert.match(handoff, /already applied; no changes made/);
  assert.doesNotMatch(handoff, /DROP TABLE|TRUNCATE|DELETE FROM/i);
});

test("the Neon Explore handoff preserves the canonical migration and Drizzle identity", async () => {
  const journal = JSON.parse(await readFile(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  const migration = journal.entries.find((entry: { tag: string }) => entry.tag === "0025_explore_snapshots");
  assert.ok(migration);
  const source = await readFile(new URL("../../drizzle/0025_explore_snapshots.sql", import.meta.url), "utf8");
  const handoff = await readFile(new URL("../../../docs/migrations/neon-0025-explore-snapshots.sql", import.meta.url), "utf8");
  const hash = createHash("sha256").update(source).digest("hex");
  assert.ok(handoff.includes(source.replaceAll("--> statement-breakpoint", "").trim()));
  assert.ok(handoff.includes(`VALUES ('${hash}', ${migration.when})`));
  assert.match(handoff, /BEGIN;[\s\S]*COMMIT;/);
  assert.match(handoff, /Required migration 0024_child_adventures is missing/);
  assert.match(handoff, /already applied; no changes made/);
});

test("the Neon Fishing Friends handoff preserves the canonical migration and Drizzle identity", async () => {
  const journal = JSON.parse(await readFile(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  const migration = journal.entries.find((entry: { tag: string }) => entry.tag === "0026_fishing_friends");
  const prerequisite = journal.entries.find((entry: { tag: string }) => entry.tag === "0025_explore_snapshots");
  assert.ok(migration && prerequisite);
  const source = await readFile(new URL("../../drizzle/0026_fishing_friends.sql", import.meta.url), "utf8");
  const previousSource = await readFile(new URL("../../drizzle/0025_explore_snapshots.sql", import.meta.url), "utf8");
  const handoff = await readFile(new URL("../../../docs/migrations/neon-0026-fishing-friends.sql", import.meta.url), "utf8");
  const hash = createHash("sha256").update(source).digest("hex");
  const previousHash = createHash("sha256").update(previousSource).digest("hex");
  assert.ok(handoff.includes(source.replaceAll("--> statement-breakpoint", "").trim()));
  assert.ok(handoff.includes(`VALUES ('${hash}', ${migration.when})`));
  assert.ok(handoff.includes(`created_at = ${prerequisite.when} AND hash = '${previousHash}'`));
  assert.match(handoff, /BEGIN;[\s\S]*COMMIT;/);
  assert.match(handoff, /LOCK TABLE drizzle\.__drizzle_migrations IN EXCLUSIVE MODE/);
  assert.match(handoff, /Required migration 0025_explore_snapshots is missing/);
  assert.match(handoff, /already applied; no changes made/);
  assert.doesNotMatch(handoff, /DROP TABLE|TRUNCATE|DELETE FROM/i);
});

test("the Neon Road Racing handoff preserves the canonical migration and Drizzle identity", async () => {
  const journal = JSON.parse(await readFile(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  const migration = journal.entries.find((entry: { tag: string }) => entry.tag === "0027_road_racing");
  const prerequisite = journal.entries.find((entry: { tag: string }) => entry.tag === "0026_fishing_friends");
  assert.ok(migration && prerequisite);
  const source = await readFile(new URL("../../drizzle/0027_road_racing.sql", import.meta.url), "utf8");
  const previousSource = await readFile(new URL("../../drizzle/0026_fishing_friends.sql", import.meta.url), "utf8");
  const handoff = await readFile(new URL("../../../docs/migrations/neon-0027-road-racing.sql", import.meta.url), "utf8");
  const hash = createHash("sha256").update(source).digest("hex");
  const previousHash = createHash("sha256").update(previousSource).digest("hex");
  assert.ok(handoff.includes(source.replaceAll("--> statement-breakpoint", "").trim()));
  assert.ok(handoff.includes(`VALUES ('${hash}', ${migration.when})`));
  assert.ok(handoff.includes(`created_at = ${prerequisite.when} AND hash = '${previousHash}'`));
  assert.match(handoff, /BEGIN;[\s\S]*COMMIT;/);
  assert.match(handoff, /LOCK TABLE drizzle\.__drizzle_migrations IN EXCLUSIVE MODE/);
  assert.match(handoff, /Required migration 0026_fishing_friends is missing/);
  assert.match(handoff, /already applied; no changes made/);
  assert.doesNotMatch(handoff, /DROP TABLE|TRUNCATE|DELETE FROM/i);
});

test("the Neon Daily Quiz handoff preserves the canonical migration and Drizzle identity", async () => {
  const journal = JSON.parse(await readFile(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  const migration = journal.entries.find((entry: { tag: string }) => entry.tag === "0030_daily_quiz");
  const prerequisite = journal.entries.find((entry: { tag: string }) => entry.tag === "0029_town_river_sharing");
  assert.ok(migration && prerequisite);
  const source = await readFile(new URL("../../drizzle/0030_daily_quiz.sql", import.meta.url), "utf8");
  const previousSource = await readFile(new URL("../../drizzle/0029_town_river_sharing.sql", import.meta.url), "utf8");
  const handoff = await readFile(new URL("../../../docs/migrations/neon-0030-daily-quiz.sql", import.meta.url), "utf8");
  const hash = createHash("sha256").update(source).digest("hex");
  const previousHash = createHash("sha256").update(previousSource).digest("hex");
  assert.ok(handoff.includes(source.replaceAll("--> statement-breakpoint", "").trim()));
  assert.ok(handoff.includes(`VALUES ('${hash}', ${migration.when})`));
  assert.ok(handoff.includes(`created_at = ${prerequisite.when} AND hash = '${previousHash}'`));
  assert.match(handoff, /BEGIN;[\s\S]*COMMIT;/);
  assert.match(handoff, /LOCK TABLE drizzle\.__drizzle_migrations IN EXCLUSIVE MODE/);
  assert.match(handoff, /Required migration 0029_town_river_sharing is missing/);
  assert.match(handoff, /already applied; no changes made/);
  assert.doesNotMatch(handoff, /DROP TABLE|TRUNCATE|DELETE FROM/i);
});

test("the placeholder retirement handoff preserves the canonical migration and Drizzle identity", async () => {
  const journal = JSON.parse(await readFile(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  const migration = journal.entries.find((entry: { tag: string }) => entry.tag === "0031_retire_placeholder_quizzes");
  const prerequisite = journal.entries.find((entry: { tag: string }) => entry.tag === "0030_daily_quiz");
  assert.ok(migration && prerequisite);
  const source = await readFile(new URL("../../drizzle/0031_retire_placeholder_quizzes.sql", import.meta.url), "utf8");
  const previousSource = await readFile(new URL("../../drizzle/0030_daily_quiz.sql", import.meta.url), "utf8");
  const handoff = await readFile(new URL("../../../docs/migrations/neon-0031-retire-placeholder-quizzes.sql", import.meta.url), "utf8");
  const hash = createHash("sha256").update(source).digest("hex");
  const previousHash = createHash("sha256").update(previousSource).digest("hex");
  assert.ok(handoff.includes(source.trim()));
  assert.ok(handoff.includes(`VALUES ('${hash}', ${migration.when})`));
  assert.ok(handoff.includes(`created_at = ${prerequisite.when} AND hash = '${previousHash}'`));
  assert.match(handoff, /BEGIN;[\s\S]*COMMIT;/);
  assert.match(handoff, /LOCK TABLE drizzle\.__drizzle_migrations IN EXCLUSIVE MODE/);
  assert.match(handoff, /Required migration 0030_daily_quiz is missing/);
  assert.match(handoff, /already applied; no changes made/);
  assert.doesNotMatch(handoff, /DROP TABLE|TRUNCATE|DELETE FROM/i);
});

test("the initial migration is tracked by Drizzle and does not mask schema drift", async () => {
  const journal = JSON.parse(await readFile(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8")) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  assert.ok(journal.entries.length > 0);
  const sequence = journal.entries as Array<{ idx: number; tag: string; when: number }>;
  sequence.forEach((entry, index) => {
    assert.equal(entry.idx, index, 'Migration indexes must not collide or skip.');
    if (index) assert.ok(entry.when > sequence[index - 1]!.when, 'Migration timestamps must increase.');
  });
  for (const entry of journal.entries) {
    const migration = await readFile(new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url), "utf8");
    assert.doesNotMatch(migration, /IF NOT EXISTS/i);
  }

  const latest = journal.entries.at(-1)!;
  const snapshotName = `${String(latest.idx).padStart(4, "0")}_snapshot.json`;
  const snapshot = JSON.parse(await readFile(new URL(`../../drizzle/meta/${snapshotName}`, import.meta.url), "utf8")) as {
    dialect: string;
    tables: Record<string, unknown>;
  };
  assert.equal(snapshot.dialect, "postgresql");
  assert.ok(snapshot.tables["public.families"]);
  assert.ok(snapshot.tables["public.profile_progress"]);
  assert.ok(snapshot.tables["public.daily_quiz_snapshots"]);
  assert.ok(snapshot.tables["public.flashcards"]);
  assert.ok(snapshot.tables["public.flashcard_study_sessions"]);
  assert.equal(latest.tag, "0039_kid_schedule");
  assert.ok((snapshot.tables["public.families"] as {columns: Record<string, unknown>}).columns.legal_accepted_at);
  assert.ok((snapshot.tables["public.families"] as {columns: Record<string, unknown>}).columns.legal_accepted_version);
  for (const name of ["calendar_plan_lists", "calendar_meal_library", "calendar_events"]) {
    assert.ok(snapshot.tables[`public.${name}`]);
  }
  assert.ok(snapshot.tables["public.daily_quiz_progress"]);
  for (const name of ["town_basket_gifts", "town_raft_items", "town_raft_progress", "town_river_events", "town_river_inbox"]) assert.ok(snapshot.tables[`public.${name}`]);
  assert.ok(snapshot.tables["public.road_racing_progress"]);
  assert.ok(snapshot.tables["public.fishing_progress"]);
  assert.ok(snapshot.tables["public.fishing_cast_results"]);
  assert.ok(snapshot.tables["public.explore_revisions"]);
  assert.ok(snapshot.tables["public.explore_snapshots"]);
  assert.ok(snapshot.tables["public.explore_rebuild_jobs"]);
  assert.ok(snapshot.tables["public.adventure_events"]);
  assert.ok(snapshot.tables["public.kitchen_sessions"]);
  const family = snapshot.tables["public.families"] as { columns: Record<string, { default?: boolean }> };
  assert.equal(family.columns.onboarding_dismissed?.default, true);
  assert.equal(family.columns.onboarding_parent_visited?.default, false);
  assert.ok(snapshot.tables["public.google_identities"]);
  assert.ok(snapshot.tables["public.google_auth_transactions"]);
  assert.ok(snapshot.tables["public.math_wall_progress"]);
  assert.ok(snapshot.tables["public.infinidrill_progress"]);
  assert.ok(snapshot.tables["public.town_state"]);
  assert.ok(snapshot.tables["public.town_reward_events"]);
  assert.ok(snapshot.tables["public.cabbage_roll_sessions"]);
  assert.ok(snapshot.tables["public.achievement_definitions"]);
  assert.ok(snapshot.tables["public.ufo_words"]);
  assert.ok(snapshot.tables["public.ufo_progress"]);
  assert.ok(snapshot.tables["public.family_password_audit"]);
  assert.ok(snapshot.tables["public.miniku_progress"]);
  assert.ok(snapshot.tables["public.miniku_puzzles"]);
  assert.ok(snapshot.tables["public.miniku_family_settings"]);
  assert.ok(snapshot.tables["public.friend_requests"]);
  assert.ok(snapshot.tables["public.lesson_audiences"]);
  assert.ok(snapshot.tables["public.family_disabled_lessons"]);
  assert.ok(snapshot.tables["public.passkeys"]);
  assert.ok(snapshot.tables["public.passkey_challenges"]);
  const profiles = snapshot.tables["public.profiles"] as { columns?: Record<string, unknown> };
  assert.deepEqual(profiles.columns?.tour_completed_at, {
    name: "tour_completed_at", type: "timestamp with time zone", primaryKey: false, notNull: false,
  });
  assert.ok(profiles.columns?.avatar_frame);

  const socialMigration = await readFile(new URL("../../drizzle/0004_social_friend_requests.sql", import.meta.url), "utf8");
  assert.doesNotMatch(socialMigration, /uuid/i);
  assert.match(socialMigration, /requesting_scope_shape/);
  assert.match(socialMigration, /target_scope_shape/);
  assert.match(socialMigration, /cross_family/);
  assert.match(socialMigration, /friend_requests_pending_unique/);
  assert.match(socialMigration, /requesting_family_id_families_id_fk/);
  assert.match(socialMigration, /target_family_id_families_id_fk/);

  const audienceMigration = await readFile(new URL("../../drizzle/0005_awesome_moonstone.sql", import.meta.url), "utf8");
  assert.match(audienceMigration, /lesson_audiences_target_required/);
  assert.match(audienceMigration, /lesson_audiences_target_family_id_families_id_fk/);
  assert.match(audienceMigration, /lesson_audiences_target_profile_id_profiles_id_fk/);

  const disabledMigration = await readFile(new URL("../../drizzle/0006_breezy_spirit.sql", import.meta.url), "utf8");
  assert.match(disabledMigration, /family_disabled_lessons_family_id_item_id_pk/);

  const questionTimeMigration = await readFile(new URL("../../drizzle/0007_chilly_hardball.sql", import.meta.url), "utf8");
  assert.match(questionTimeMigration, /quiz_questions.*created_at/);
  assert.match(questionTimeMigration, /snapshot time/);
  const questionTimeRollback = await readFile(new URL("../../drizzle/rollbacks/0007_chilly_hardball.sql", import.meta.url), "utf8");
  assert.match(questionTimeRollback, /DROP COLUMN "created_at"/);

  const questionGroupMigration = await readFile(new URL("../../drizzle/0008_lively_hawkeye.sql", import.meta.url), "utf8");
  assert.match(questionGroupMigration, /quiz_questions.*question_group_id/);
  const questionGroupRollback = await readFile(new URL("../../drizzle/rollbacks/0008_lively_hawkeye.sql", import.meta.url), "utf8");
  assert.match(questionGroupRollback, /DROP COLUMN "question_group_id"/);
  const avatarFrameMigration = await readFile(new URL("../../drizzle/0009_naive_guardian.sql", import.meta.url), "utf8");
  assert.match(avatarFrameMigration, /profiles.*avatar_frame/);
  const avatarFrameRollback = await readFile(new URL("../../drizzle/rollbacks/0009_naive_guardian.sql", import.meta.url), "utf8");
  assert.match(avatarFrameRollback, /DROP COLUMN "avatar_frame"/);
  const auditMigration = await readFile(new URL("../../drizzle/0010_flaky_dracula.sql", import.meta.url), "utf8");
  assert.match(auditMigration, /CREATE TABLE "family_password_audit"/);
  const auditRollback = await readFile(new URL("../../drizzle/rollbacks/0010_flaky_dracula.sql", import.meta.url), "utf8");
  assert.match(auditRollback, /DROP TABLE "family_password_audit"/);

  const rollback = await readFile(new URL("../../drizzle/rollback_all.sql", import.meta.url), "utf8");
  assert.ok(rollback.indexOf("DROP TABLE IF EXISTS lesson_audiences;") < rollback.indexOf("DROP TABLE IF EXISTS items;"));
  assert.ok(rollback.indexOf("DROP TABLE IF EXISTS family_disabled_lessons;") < rollback.indexOf("DROP TABLE IF EXISTS items;"));
  for (const name of ["calendar_plan_lists", "calendar_meal_library", "calendar_events"]) {
    assert.ok(rollback.indexOf(`DROP TABLE IF EXISTS ${name};`) >= 0);
    assert.ok(rollback.indexOf(`DROP TABLE IF EXISTS ${name};`) < rollback.indexOf("DROP TABLE IF EXISTS profiles;"));
  }
  const calendarRollback = await readFile(new URL("../../drizzle/rollbacks/0033_kid_calendar.sql", import.meta.url), "utf8");
  for (const name of ["calendar_plan_lists", "calendar_meal_library", "calendar_events"]) assert.ok(calendarRollback.includes(`DROP TABLE "${name}";`));
  assert.match(rollback, /DROP TABLE IF EXISTS friend_requests;/);
  assert.ok(rollback.indexOf("DROP TABLE IF EXISTS friend_requests;") < rollback.indexOf("DROP TABLE IF EXISTS profiles;"));
});
