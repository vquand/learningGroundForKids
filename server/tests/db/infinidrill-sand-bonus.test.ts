import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { assertSafeTestDatabaseUrl } from "../../src/db/test-database.js";
import { createInfinidrillRepository } from "../../src/infinidrill/repository.js";
import { createInfinidrillGame } from "../../src/infinidrill/game.js";
import { generateInfinidrillQuestion } from "../../src/infinidrill/questions-config.js";
import type { Progress, PublicState } from "../../src/infinidrill/progress.js";
import { createTownRepository } from "../../src/town-building/repository.js";
import type { TownState } from "../../src/town-building/game.js";

const configured = process.env.TEST_DATABASE_URL;
const privateRemainder = (progress: Progress): number =>
  (progress as Progress & { townRockRemainder?: number }).townRockRemainder ?? 0;

function levelSevenFixture(remainder?: number): Progress {
  const initial = createInfinidrillGame({ random: () => 0.5 });
  const currentQuestion = generateInfinidrillQuestion(7, () => 0.5);
  const game = {
    ...initial,
    worldSeed: 123_456,
    level: 7 as const,
    depthBlocks: 120,
    depthMetres: 720,
    mainQuestionsCompleted: 9,
    questionsSinceChallenge: 0,
    destroyedBlocks: 120,
    currentQuestion,
    questionCounter: 9,
    input: "",
    questionStartedAt: 0,
    questionAttempted: false,
    firstTryMastery: 0,
    fastStreak: 0,
    excavations: [{ from: 0, to: 120, left: -1, right: 1 }],
    laserCuts: [],
    resources: { crystals: 0, nuggets: 0 },
    mode: "playing" as const,
    previousMode: null,
    pauseStartedAt: null,
    upgradeChoices: [],
    lastEvent: { kind: "none" as const },
    feedback: null,
    finishedAt: null,
  };
  return remainder === undefined ? { revision: 9, game, caveFalls: 0, bonusQuestionsCompleted: 0, earned: {} } : {
    revision: 9,
    game,
    caveFalls: 0,
    bonusQuestionsCompleted: 0,
    earned: {},
    townRockRemainder: remainder,
  } as Progress;
}

async function privateState(pool: Pool, profileId: string): Promise<Progress> {
  const result = await pool.query<{ state: Progress }>(
    "SELECT state FROM infinidrill_progress WHERE profile_id=$1",
    [profileId],
  );
  assert.ok(result.rows[0]);
  return result.rows[0]!.state;
}

async function seedTown(pool: Pool, profileId: string, materials: Partial<TownState["materials"]> = {}) {
  const town = createTownRepository(pool);
  await town.get(profileId);
  const state = await town.get(profileId);
  state.materials = {
    stamina: 0,
    wood: 0,
    rock: 0,
    sand: 0,
    metal: 0,
    ...materials,
  };
  await pool.query("UPDATE town_state SET state=$2 WHERE profile_id=$1", [profileId, JSON.stringify(state)]);
  return town;
}

async function correctCommand(pool: Pool, profileId: string) {
  const state = await privateState(pool, profileId);
  const question = state.game?.currentQuestion;
  assert.ok(question);
  return {
    revision: state.revision,
    command: { type: "submit-answer" as const, questionId: question.id, answer: Number(question.answer) },
  };
}

test("verified InfiniDrill rock bonus persists carry, deduplicates retries, isolates children, and rolls back atomically", {
  skip: configured ? false : "TEST_DATABASE_URL is not configured",
}, async () => {
  const url = assertSafeTestDatabaseUrl(
    configured!,
    [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((value): value is string => Boolean(value)),
    process.env.ALLOW_NONLOCAL_TEST_DATABASE,
  );
  const pool = new Pool({ connectionString: url, max: 8 });
  const familyId = `infinidrill-sand-${randomUUID()}`;
  const profileId = `${familyId}-one`;
  const otherProfileId = `${familyId}-two`;
  const rollbackProfileId = `${familyId}-rollback`;
  const legacyProfileId = `${familyId}-legacy`;
  const historyProfileId = `${familyId}-history`;
  const boundaryProfileId = `${familyId}-boundary`;
  const profileIds = [profileId, otherProfileId, rollbackProfileId, legacyProfileId, historyProfileId, boundaryProfileId];

  try {
    await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
    await pool.query(
      "INSERT INTO families(id,email,display_name,password_hash,role) VALUES ($1,$2,$3,$4,$5)",
      [familyId, `${familyId}@example.test`, "InfiniDrill sand bonus", "not-a-real-password", "family"],
    );
    for (const id of profileIds) {
      await pool.query(
        "INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES ($1,$2,$3,$4,$5,$1)",
        [id, familyId, id, "🌟", "blue"],
      );
    }

    const drill = createInfinidrillRepository(pool);
    const town = await seedTown(pool, profileId, { rock: 9, sand: 4 });
    await pool.query(
      "INSERT INTO infinidrill_progress(profile_id,state) VALUES ($1,$2)",
      [profileId, JSON.stringify(levelSevenFixture(9))],
    );
    const beforeTown = await town.get(profileId);
    const first = await correctCommand(pool, profileId);
    const firstResult = await drill.mutate(profileId, first.revision, first.command) as PublicState & { townReward?: Record<string, number> };
    const firstReward = firstResult.townReward ?? {};
    const afterFirstTown = await town.get(profileId);
    const earnedRock = firstReward.rock ?? 0;
    assert.ok(earnedRock > 0, "level-7 depth-120 fixture must earn rock");
    assert.equal(afterFirstTown.materials.rock, beforeTown.materials.rock + earnedRock, "all mined rock stays in town");
    assert.equal(afterFirstTown.materials.sand, beforeTown.materials.sand + Math.floor((9 + earnedRock) / 10), "bonus sand uses the seeded remainder");
    const firstPrivate = await privateState(pool, profileId);
    assert.equal(privateRemainder(firstPrivate), (9 + earnedRock) % 10);
    assert.equal(JSON.stringify(await drill.get(profileId)).includes("townRockRemainder"), false, "carry stays private");

    const reloaded = createInfinidrillRepository(pool);
    const second = await correctCommand(pool, profileId);
    const beforeEvents = Number((await pool.query("SELECT count(*)::int AS count FROM town_reward_events WHERE profile_id=$1", [profileId])).rows[0]!.count);
    const races = await Promise.allSettled([
      reloaded.mutate(profileId, second.revision, second.command),
      reloaded.mutate(profileId, second.revision, second.command),
    ]);
    assert.equal(races.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(races.filter((result) => result.status === "rejected").length, 1);
    const afterEvents = Number((await pool.query("SELECT count(*)::int AS count FROM town_reward_events WHERE profile_id=$1", [profileId])).rows[0]!.count);
    assert.equal(afterEvents, beforeEvents + 1, "parallel same-revision submissions credit one event");
    await assert.rejects(() => reloaded.mutate(profileId, second.revision, second.command), /changed|stale/i);

    const afterSecondPrivate = await privateState(pool, profileId);
    const carryAfterSecond = privateRemainder(afterSecondPrivate);
    const winner = races.find(result => result.status === "fulfilled") as PromiseFulfilledResult<PublicState & { townReward?: Record<string, number> }>;
    const totalRock = earnedRock + (winner.value.townReward?.rock ?? 0);
    const afterSecondTown = await town.get(profileId);
    assert.equal(afterSecondTown.materials.rock, beforeTown.materials.rock + totalRock);
    assert.equal(afterSecondTown.materials.sand, beforeTown.materials.sand + Math.floor((9 + totalRock) / 10));
    assert.equal(carryAfterSecond, (9 + totalRock) % 10, "reload and parallel submission retain cumulative carry");
    const replayed = await reloaded.mutate(profileId, (await reloaded.get(profileId)).revision, { type: "replay" });
    assert.equal(privateRemainder(await privateState(pool, profileId)), carryAfterSecond, "replay preserves rock carry");
    assert.equal(JSON.stringify(replayed).includes("townRockRemainder"), false);
    const afterReplayTown = await town.get(profileId);
    const spent = await town.mutate(profileId, afterReplayTown.revision, { type: "build", blueprintId: "rocky-road", x: 5, y: 8 });
    assert.equal(privateRemainder(await privateState(pool, profileId)), carryAfterSecond, "spending town rock does not reset drill carry");
    assert.equal(spent.materials.rock, afterReplayTown.materials.rock - 1);

    const otherTown = await seedTown(pool, otherProfileId, { rock: 0, sand: 0 });
    await pool.query("INSERT INTO infinidrill_progress(profile_id,state) VALUES ($1,$2)", [otherProfileId, JSON.stringify(levelSevenFixture(0))]);
    const otherBefore = await otherTown.get(otherProfileId);
    const otherCommand = await correctCommand(pool, otherProfileId);
    const otherResult = await drill.mutate(otherProfileId, otherCommand.revision, otherCommand.command) as PublicState & { townReward?: Record<string, number> };
    const otherReward = otherResult.townReward ?? {};
    const otherAfter = await otherTown.get(otherProfileId);
    assert.equal(otherAfter.materials.rock, otherBefore.materials.rock + (otherReward.rock ?? 0));
    assert.equal(otherAfter.materials.sand, otherBefore.materials.sand + Math.floor((otherReward.rock ?? 0) / 10));
    const concurrent = await correctCommand(pool, otherProfileId);
    const [readDuringMutation] = await Promise.all([
      drill.get(otherProfileId),
      drill.mutate(otherProfileId, concurrent.revision, concurrent.command),
    ]);
    assert.ok(readDuringMutation.revision === concurrent.revision || readDuringMutation.revision === concurrent.revision + 1);
    assert.equal((await privateState(pool, otherProfileId)).revision, concurrent.revision + 1, 'a concurrent read must not overwrite the mutation');
    assert.equal((await town.get(profileId)).materials.rock, spent.materials.rock, "a second child cannot change the first child's town");

    await seedTown(pool, legacyProfileId, { rock: 0, sand: 0 });
    await pool.query("INSERT INTO infinidrill_progress(profile_id,state) VALUES ($1,$2)", [legacyProfileId, JSON.stringify(levelSevenFixture())]);
    const legacyCommand = await correctCommand(pool, legacyProfileId);
    const legacyResult = await drill.mutate(legacyProfileId, legacyCommand.revision, legacyCommand.command) as PublicState & { townReward?: Record<string, number> };
    assert.equal(legacyResult.townReward?.sand ?? 0, Math.floor((legacyResult.townReward?.rock ?? 0) / 10), "legacy missing carry starts at zero");

    const historyTown = await seedTown(pool, historyProfileId);
    const historyProgress = levelSevenFixture(9);
    const { excavations: _historyMain, laserCuts: _historyLaser, ...historyGame } = historyProgress.game!;
    historyProgress.game = historyGame;
    await pool.query("INSERT INTO infinidrill_progress(profile_id,state) VALUES ($1,$2)", [historyProfileId, JSON.stringify(historyProgress)]);
    const historyCommand = await correctCommand(pool, historyProfileId);
    const historyResult = await drill.mutate(historyProfileId, historyCommand.revision, historyCommand.command) as PublicState & { townReward?: Record<string, number> };
    const historyReward = historyResult.townReward ?? {};
    assert.ok((historyReward.rock ?? 0) > 0 && (historyReward.rock ?? 0) < 100);
    assert.equal(historyReward.sand, Math.floor((9 + (historyReward.rock ?? 0)) / 10), "old surface excavation cannot grant historical sand");
    assert.equal((await historyTown.get(historyProfileId)).materials.sand, historyReward.sand);

    const boundaryTown = await seedTown(pool, boundaryProfileId);
    const boundaryBefore = await boundaryTown.get(boundaryProfileId);
    const boundaryProgress = levelSevenFixture(9);
    const { excavations: _boundaryMain, laserCuts: _boundaryLaser, ...boundaryGame } = boundaryProgress.game!;
    boundaryProgress.game = { ...boundaryGame, depthBlocks: 140, depthMetres: 840 };
    await pool.query("INSERT INTO infinidrill_progress(profile_id,state) VALUES ($1,$2)", [boundaryProfileId, JSON.stringify(boundaryProgress)]);
    const boundaryCommand = await correctCommand(pool, boundaryProfileId);
    const boundaryResult = await drill.mutate(boundaryProfileId, boundaryCommand.revision, boundaryCommand.command) as PublicState & { townReward?: Record<string, number> };
    assert.equal(boundaryResult.game!.depthBlocks, 140);
    assert.deepEqual(boundaryResult.townReward ?? {}, {}, "stationary legacy practice cannot earn new materials");
    assert.deepEqual(await boundaryTown.get(boundaryProfileId), boundaryBefore);
    assert.equal(privateRemainder(await privateState(pool, boundaryProfileId)), 9);

    const rollbackTown = await seedTown(pool, rollbackProfileId, { rock: Number.MAX_SAFE_INTEGER, sand: 7 });
    await pool.query("INSERT INTO infinidrill_progress(profile_id,state) VALUES ($1,$2)", [rollbackProfileId, JSON.stringify(levelSevenFixture(9))]);
    const rollbackBeforeProgress = await privateState(pool, rollbackProfileId);
    const rollbackBeforeTown = await rollbackTown.get(rollbackProfileId);
    const rollbackCommand = await correctCommand(pool, rollbackProfileId);
    await assert.rejects(() => drill.mutate(rollbackProfileId, rollbackCommand.revision, rollbackCommand.command), /Invalid resource credit|safe/i);
    assert.deepEqual(await privateState(pool, rollbackProfileId), rollbackBeforeProgress, "failed town credit rolls back drill progress and carry");
    assert.deepEqual(await rollbackTown.get(rollbackProfileId), rollbackBeforeTown, "failed town credit rolls back town balances");
  } finally {
    await pool.query("DELETE FROM families WHERE id=$1", [familyId]);
    await pool.end();
  }
});
