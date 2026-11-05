import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { createMathWallRepository } from '../../src/math-wall/repository.js';
import { startSession, emptyProgress, generateQuestion, type Action, type Difficulty, type Progress } from '../../src/math-wall/game.js';
import { createTownRepository } from '../../src/town-building/repository.js';

const configured = process.env.TEST_DATABASE_URL;
test('Waddle rewards persist atomically, deduplicate concurrent passes, and survive replay', {
  skip: configured ? false : 'TEST_DATABASE_URL is not configured',
}, async () => {
  const url = assertSafeTestDatabaseUrl(configured!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((v): v is string => !!v), process.env.ALLOW_NONLOCAL_TEST_DATABASE);
  const pool = new Pool({ connectionString: url });
  const family = `waddle-reward-${randomUUID()}`, kid = `${family}-kid`, sibling = `${family}-sibling`;
  const math = createMathWallRepository(pool), town = createTownRepository(pool);
  async function stored() {
    return (await pool.query<{ state: Progress }>('SELECT state FROM math_wall_progress WHERE profile_id=$1', [kid])).rows[0]!.state;
  }
  async function ready(difficulty: Difficulty, pass = true) {
    const previous = await math.get(kid);
    const progress = startSession(emptyProgress(), { animal: 'cow', language: 'en', wall: 'brick' }, Date.now(), () => 0);
    progress.revision = previous.revision;
    progress.stats.passed = previous.achievements.find(a => a.id === 'first')!.current;
    const question = generateQuestion(difficulty, () => 0, new Set(), `waddle-reward-${difficulty}`);
    progress.session!.question = question;
    progress.session!.difficulty = difficulty;
    progress.session!.seenQuestions = [question.key];
    progress.session!.recentCorrectLanes = [question.response.mode === 'choice' ? question.response.correct : 0];
    assert.equal(progress.session!.question.response.mode, 'choice');
    progress.session!.lane = pass ? progress.session!.question.response.correct : (progress.session!.question.response.correct + 1) % 3;
    progress.session!.deadline = Date.now() - 1;
    await pool.query(`INSERT INTO math_wall_progress(profile_id,state) VALUES($1,$2)
      ON CONFLICT(profile_id) DO UPDATE SET state=EXCLUDED.state`, [kid, JSON.stringify(progress)]);
    return progress.revision;
  }
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    await pool.query("INSERT INTO families(id,email,display_name,password_hash,role) VALUES($1,$2,'Rewards','unused','family')", [family, `${family}@example.test`]);
    for (const id of [kid, sibling]) await pool.query("INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES($1,$2,'Kid','cow','blue',$1)", [id, family]);
    const initial = {...(await town.get(kid)).materials,wool:(await town.get(kid)).storage?.wool??0};
    let total = 0;
    // Pause and finish also grade expired walls; both must credit a pass once.
    for (const [difficulty, amount, type] of [['easy', 1, 'settle'], ['medium', 3, 'pause'], ['hard', 5, 'finish']] as const) {
      const revision = await ready(difficulty);
      const outcomes = await Promise.allSettled([
        math.mutate(kid, revision, { action: { type } }),
        math.mutate(kid, revision, { action: { type } }),
      ]);
      const winners = outcomes.filter(outcome => outcome.status === 'fulfilled');
      assert.equal(winners.length, 1);
      assert.deepEqual(winners[0]!.value.townReward, { wood: amount, wool: amount });
      const loser = outcomes.find(outcome => outcome.status === 'rejected');
      assert.ok(loser?.status === 'rejected' && loser.reason.code === 'MATH_WALL_STALE_SESSION');
      total += amount;
      const materials = {...(await town.get(kid)).materials,wool:(await town.get(kid)).storage?.wool??0};
      assert.equal(materials.wood, initial.wood + total);
      assert.equal(materials.wool, Math.min(10,initial.wool + total));
      assert.equal((await stored()).stats.passed, difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3);
    }
    const events = await pool.query('SELECT event_id FROM town_reward_events WHERE profile_id=$1', [kid]);
    assert.equal(events.rowCount, 3);
    assert.equal(new Set(events.rows.map(row => row.event_id)).size, 3);
    assert.equal((await town.get(sibling)).materials.wood, initial.wood);
    assert.equal(((await town.get(sibling)).storage?.wool??0), initial.wool);
    const beforeFailure = {...(await town.get(kid)).materials,wool:(await town.get(kid)).storage?.wool??0};
    const revision = await ready('hard', false);
    const failed = await math.mutate(kid, revision, { action: { type: 'settle' } });
    assert.equal(failed.townReward, undefined);
    const failedState = (await town.get(kid));
    assert.deepEqual({ ...failedState.materials, wool: failedState.storage?.wool ?? 0 }, beforeFailure);
    await math.mutate(kid, failed.revision, { action: { type: 'finish' } });
    const finished = await math.get(kid);
    const replay = await math.mutate(kid, finished.revision, { settings: { animal: 'cow', language: 'en', wall: 'brick' } });
    assert.equal(replay.townReward, undefined);
    const moved = await math.mutate(kid, replay.revision, { action: { type: 'lane', lane: 1 } });
    assert.equal(moved.townReward, undefined);
    const laterState = (await town.get(kid));
    assert.deepEqual({ ...laterState.materials, wool: laterState.storage?.wool ?? 0 }, beforeFailure);

    // A failed credit rolls back grading too, so the valid retry can still earn.
    const retryRevision = await ready('easy');
    await pool.query("UPDATE town_state SET state=jsonb_set(state,'{materials,wood}',to_jsonb($2::bigint)) WHERE profile_id=$1", [kid, Number.MAX_SAFE_INTEGER]);
    await assert.rejects(math.mutate(kid, retryRevision, { action: { type: 'settle' } as Action }), /Invalid resource credit/);
    assert.equal((await stored()).revision, retryRevision);
    assert.equal((await pool.query('SELECT event_id FROM town_reward_events WHERE profile_id=$1', [kid])).rowCount, 3);
    await pool.query("UPDATE town_state SET state=jsonb_set(state,'{materials,wood}',to_jsonb($2::int)) WHERE profile_id=$1", [kid, beforeFailure.wood]);
    await math.mutate(kid, retryRevision, { action: { type: 'settle' } });
    assert.equal((await town.get(kid)).materials.wood, beforeFailure.wood + 1);
    assert.equal(((await town.get(kid)).storage?.wool??0), Math.min(10,beforeFailure.wool + 1));
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]);
    await pool.end();
  }
});
