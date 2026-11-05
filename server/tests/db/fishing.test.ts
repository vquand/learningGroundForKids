import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { createFishingRepository } from '../../src/fishing/repository.js';
import type { FishingProgress } from '../../src/fishing/types.js';

const configured = process.env.TEST_DATABASE_URL;
test('fishing transactions serialize bait/casts and atomically dedupe inventory, journal, points and Town stamina', { skip: configured ? false : 'TEST_DATABASE_URL is not configured' }, async () => {
  const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(configured!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((url): url is string => Boolean(url))) });
  const family = randomUUID(), profile = randomUUID();
  let clock = 0, roll = 0, failSave = false;
  const guardedPool = {
    query: pool.query.bind(pool),
    async connect() {
      const client = await pool.connect();
      return new Proxy(client, { get(target, property) {
        if (property === 'query') return (...args: unknown[]) => {
          if (failSave && typeof args[0] === 'string' && args[0].startsWith('UPDATE fishing_progress')) throw new Error('Injected persistence failure after Town credit');
          return (target.query as (...args: unknown[]) => unknown).apply(target, args);
        };
        const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
      } }) as PoolClient;
    },
  } as unknown as Pool;
  const repo = createFishingRepository(guardedPool, { now: () => clock, random: max => roll % max });
  const stored = async () => (await pool.query<{ state: FishingProgress }>('SELECT state FROM fishing_progress WHERE profile_id=$1', [profile])).rows[0]!.state;
  try {
    await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)', [family,`${family}@test.local`,'Test','unused']);
    await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)', [profile,family,'Test','🐟','blue']);
    let state = await repo.get(profile);
    const competingQuestions = await Promise.allSettled([0,1].map(() => repo.mutate(profile, state.revision, { type: 'question', baitId: 'baby' })));
    assert.equal(competingQuestions.filter(result => result.status === 'fulfilled').length, 1);
    state = await repo.get(profile);
    const question = (await stored()).question!;
    state = await repo.mutate(profile, state.revision, { type: 'answer', questionId: question.id, answer: question.question.answer as number + 1 });
    assert.equal(state.question!.attempts, 1); assert.equal(state.bait.baby, 0);
    const competingAnswers = await Promise.allSettled([0,1].map(() => repo.mutate(profile, state.revision, { type: 'answer', questionId: question.id, answer: question.question.answer as number })));
    assert.equal(competingAnswers.filter(result => result.status === 'fulfilled').length, 1);
    state = await repo.get(profile); assert.equal(state.bait.baby, 1);
    const competingCasts = await Promise.allSettled([0,1].map(() => repo.mutate(profile, state.revision, { type: 'cast' })));
    assert.equal(competingCasts.filter(result => result.status === 'fulfilled').length, 1);
    state = await repo.get(profile); assert.equal(state.bait.baby, 0); assert.equal(state.stats.casts, 1);
    const castId = state.cast!.id;
    assert.equal('fishId' in state.cast!, false);
    for (clock = 1000; clock <= 7000; clock += 1000) state = await repo.mutate(profile, state.revision, { type: 'tick' });
    failSave = true;
    await assert.rejects(() => repo.mutate(profile, state.revision, { type: 'tick' }), /Injected persistence failure/);
    assert.equal((await stored()).cast?.phase, 'waiting');
    assert.equal((await pool.query('SELECT * FROM fishing_cast_results WHERE profile_id=$1', [profile])).rowCount, 0);
    assert.equal((await pool.query('SELECT * FROM town_reward_events WHERE profile_id=$1', [profile])).rowCount, 0);
    assert.equal((await pool.query('SELECT * FROM town_state WHERE profile_id=$1', [profile])).rowCount, 0);
    failSave = false;
    const competingFinishes = await Promise.allSettled([0,1].map(() => repo.mutate(profile, state.revision, { type: 'tick' })));
    assert.equal(competingFinishes.filter(result => result.status === 'fulfilled').length, 1);
    state = await repo.get(profile);
    assert.equal(state.cast!.fishId, 'P1'); assert.equal(state.inventory.P1, 1); assert.deepEqual(state.discovered.pond, ['P1']);
    assert.equal(state.points.pond, 1); assert.equal(state.stats.caught, 1);
    const event = (await pool.query('SELECT event_id,reward FROM town_reward_events WHERE profile_id=$1', [profile])).rows;
    assert.deepEqual(event, [{ event_id: `fishing:cast:${castId}`, reward: { stamina: 1 } }]);
    const town = (await pool.query('SELECT state FROM town_state WHERE profile_id=$1', [profile])).rows[0].state;
    const beforeStamina = town.materials.stamina;
    state = await repo.mutate(profile, state.revision, { type: 'tick' });
    assert.equal((await pool.query('SELECT * FROM fishing_cast_results WHERE profile_id=$1', [profile])).rowCount, 1);
    assert.equal((await pool.query('SELECT state FROM town_state WHERE profile_id=$1', [profile])).rows[0].state.materials.stamina, beforeStamina);

    // A fresh repository simulates restart. Lease expiry pauses without adding
    // offline time and resumes the same private committed catch exactly once.
    state = await repo.mutate(profile, state.revision, { type: 'question', baitId: 'leafy' });
    const turtleQuestion = (await stored()).question!;
    state = await repo.mutate(profile, state.revision, { type: 'answer', questionId: turtleQuestion.id, answer: turtleQuestion.question.answer as number });
    state = await repo.mutate(profile, state.revision, { type: 'select-bait', baitId: 'leafy' });
    clock += 2000;
    state = await repo.mutate(profile, state.revision, { type: 'cast' });
    const turtleId = state.cast!.id;
    clock += 20000;
    const restarted = createFishingRepository(pool, { now: () => clock, random: () => 99 });
    state = await restarted.get(profile); assert.equal(state.cast!.paused, true); assert.equal(state.cast!.remainingMs, 8000);
    state = await restarted.mutate(profile, state.revision, { type: 'tick' }); assert.equal(state.cast!.remainingMs, 8000);
    state = await restarted.mutate(profile, state.revision, { type: 'resume' });
    for (let index = 0; index < 8; index++) { clock += 1000; state = await restarted.mutate(profile, state.revision, { type: 'tick' }); }
    assert.equal(state.cast!.id, turtleId); assert.equal(state.cast!.fishId, 'T1'); assert.equal('T1' in state.inventory, false);
    assert.ok(state.discovered.pond.includes('T1')); assert.equal(state.points.pond, 3);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM town_reward_events WHERE profile_id=$1', [profile])).rows[0].count, 2);

    roll = 99;
    state = await repo.mutate(profile, state.revision, { type: 'question', baitId: 'leafy' });
    const emptyQuestion = (await stored()).question!;
    state = await repo.mutate(profile, state.revision, { type: 'answer', questionId: emptyQuestion.id, answer: emptyQuestion.question.answer as number });
    clock += 2000;
    state = await repo.mutate(profile, state.revision, { type: 'cast' });
    for (let index = 0; index < 8; index++) { clock += 1000; state = await repo.mutate(profile, state.revision, { type: 'tick' }); }
    assert.equal(state.cast!.fishId, null); assert.equal(state.stats.garbage, 1); assert.equal(state.points.pond, 3);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM town_reward_events WHERE profile_id=$1', [profile])).rows[0].count, 2);
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]);
    await pool.end();
  }
});

test('continuous fishing commits two catches with parallel math and concurrent wakeups exactly once', { skip: configured ? false : 'TEST_DATABASE_URL is not configured' }, async () => {
  const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(configured!) });
  const family = randomUUID(), profile = randomUUID(); let clock = 0;
  const repo = createFishingRepository(pool, { now: () => clock, random: () => 0 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)', [family,`${family}@test.local`,'Test','unused']);
    await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)', [profile,family,'Test','🐟','blue']);
    let state = await repo.get(profile);
    state = await repo.mutate(profile, state.revision, { type: 'cast' });
    assert.equal(state.running, true); assert.equal(state.cast, null);
    state = await repo.mutate(profile, state.revision, { type: 'question', baitId: 'baby' });
    // The shared engine picks the card; read the server-held answer instead of assuming a fixed pair.
    const firstAnswer = Number((await pool.query("SELECT state->'question'->'question'->>'answer' AS answer FROM fishing_progress WHERE profile_id=$1", [profile])).rows[0].answer);
    const answers = await Promise.allSettled([0,1].map(() => repo.mutate(profile, state.revision, { type: 'answer', questionId: state.question!.id, answer: firstAnswer })));
    assert.equal(answers.filter(row => row.status === 'fulfilled').length, 1);
    state = await repo.get(profile); assert.equal(state.stats.casts, 1); assert.equal(state.bait.baby, 0);
    state = await repo.mutate(profile, state.revision, { type: 'question', baitId: 'baby' });
    for (clock = 1000; clock <= 8000; clock += 1000) state = await repo.mutate(profile, state.revision, { type: 'tick' });
    assert.ok(state.question); assert.equal(state.cast?.phase, 'result'); assert.equal(state.inventory.P1, 1);
    let nextAnswer=Number((await pool.query("SELECT state->'question'->'question'->>'answer' AS answer FROM fishing_progress WHERE profile_id=$1",[profile])).rows[0].answer);
    state = await repo.mutate(profile, state.revision, { type: 'answer', questionId: state.question!.id, answer: nextAnswer });
    assert.equal(state.bait.baby, 1); assert.equal(state.stats.casts, 1);
    clock = 10000; state = await repo.mutate(profile, state.revision, { type: 'tick' });
    assert.equal(state.stats.casts, 2); assert.equal(state.bait.baby, 0);
    for (clock = 11000; clock <= 18000; clock += 1000) state = await repo.mutate(profile, state.revision, { type: 'tick' });
    assert.equal(state.inventory.P1, 2); assert.equal(state.points.pond, 2);
    for (clock = 19000; clock <= 21000; clock += 1000) state = await repo.mutate(profile, state.revision, { type: 'tick' });
    assert.equal(state.running, true); assert.equal(state.stats.casts, 2);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM fishing_cast_results WHERE profile_id=$1', [profile])).rows[0].count, 2);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM town_reward_events WHERE profile_id=$1', [profile])).rows[0].count, 2);
    state = await repo.mutate(profile, state.revision, { type: 'pause' });
    state = await repo.mutate(profile, state.revision, { type: 'question', baitId: 'baby' });
    nextAnswer=Number((await pool.query("SELECT state->'question'->'question'->>'answer' AS answer FROM fishing_progress WHERE profile_id=$1",[profile])).rows[0].answer);
    state = await repo.mutate(profile, state.revision, { type: 'answer', questionId: state.question!.id, answer: nextAnswer });
    assert.equal(state.bait.baby, 1); assert.equal(state.stats.casts, 2); assert.equal(state.running, false);
  } finally { await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end(); }
});
