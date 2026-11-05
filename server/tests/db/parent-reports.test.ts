import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { createParentReportRepository } from '../../src/parent-reports/repository.js';
import { createDatabase } from '../../src/db/index.js';
import { FISHING_ACHIEVEMENT_GROUP, WADDLE_WALL_ACHIEVEMENT_GROUP } from '../../src/achievement-catalog.js';
const configured = process.env.TEST_DATABASE_URL;
test('parent report snapshot aggregates own-family progress, quizzes, and deduplicated rewards without writes', { skip: configured ? false : 'TEST_DATABASE_URL not configured' }, async () => {
  const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(configured!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((value): value is string => !!value)) });
  const family = randomUUID(), foreign = randomUUID(), kid = randomUUID(), stranger = randomUUID(), item = randomUUID(), privateItem = randomUUID();
  const db = createDatabase(configured!);
  try {
    await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    for (const id of [family, foreign]) await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)', [id, `${id}@reports.test`, 'Report family', 'not-a-password']);
    for (const [id, owner] of [[kid, family], [stranger, foreign]]) await pool.query('INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES($1,$2,$3,$4,$5,$1)', [id, owner, 'Report child', '⭐', '#456']);
    await pool.query('INSERT INTO items(id,category,latitude,longitude,is_published) VALUES($1,$2,0,0,true)', [item, 'animal']);
    await pool.query('INSERT INTO profile_progress(id,profile_id,item_id,category) VALUES($1,$2,$3,$4)', [randomUUID(), kid, item, 'animal']);
    for (const [score, total] of [[4, 5], [2, 5], [0, 0]]) await pool.query('INSERT INTO quiz_attempts(id,profile_id,item_id,attempt_date,score,total,answers) VALUES($1,$2,$3,now(),$4,$5,$6)', [randomUUID(), kid, item, score, total, '[]']);
    await pool.query('INSERT INTO miniku_progress(profile_id,state) VALUES($1,$2)', [kid, JSON.stringify({ completed: 7, completedBySize: { '3': 5, '4': 1, '5': 1 }, board: { solution: ['PRIVATE'] }, earned: { 'miniku-first-solve': '2026-10-12T00:00:00Z' } })]);
    await pool.query('INSERT INTO miniku_progress(profile_id,state) VALUES($1,$2)', [stranger, JSON.stringify({ completed: 9999 })]);
    const wallState = { revision: 1, best: 30, stats: { passed: 10, hard: 10, medium: 0, streak: 10 }, session: null };
    await pool.query('INSERT INTO math_wall_progress(profile_id,state,best_score) VALUES($1,$2,$3)', [kid, JSON.stringify(wallState), 30]);
    const fishingState = { stats: { caught: 9, questions: 12, casts: 11 }, points: { pond: 60, river: 20 },
      discovered: { pond: ['P1', 'P2', 'P3', 'P4', 'P5', 'T1'], river: ['P1', 'R1'] },
      earnedBaits: ['baby', 'beginner', 'leafy', 'chewy'], friendCatches: ['cow', 'highland'],
      earned: { 'fishing-first-nibble': '2026-10-19T00:00:00Z', 'fishing-pond-graduate': '2026-10-19T00:00:00Z' },
      question: { answer: 'PRIVATE-FISHING-ANSWER' }, cast: { outcome: 'PRIVATE-FISHING-OUTCOME' } };
    await pool.query('INSERT INTO fishing_progress(profile_id,state) VALUES($1,$2)', [kid, JSON.stringify(fishingState)]);
    await pool.query('INSERT INTO fishing_progress(profile_id,state) VALUES($1,$2)', [stranger, JSON.stringify({ stats: { caught: 9999 } })]);
    for (const event of ['drink:one', 'drink:two', 'ufo:one']) await pool.query('INSERT INTO town_reward_events(profile_id,event_id,reward) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [kid, event, '{"stamina":6}']);
    await pool.query('INSERT INTO town_reward_events(profile_id,event_id,reward) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [kid, 'drink:one', '{"stamina":6}']);
    const before = (await pool.query('SELECT xmin::text AS version FROM miniku_progress WHERE profile_id=$1', [kid])).rows[0].version;
    const fishingBefore = (await pool.query('SELECT xmin::text AS version FROM fishing_progress WHERE profile_id=$1', [kid])).rows[0].version;
    const report = await createParentReportRepository(pool).read(family);
    assert.equal(report.children.length, 1);
    assert.equal(report.children[0]!.id, kid);
    assert.equal(report.totals.exploring_completed, 1);
    assert.equal(report.totals.quiz_attempts, 3);
    assert.equal(report.totals.quiz_passes, 1);
    assert.equal(report.totals.drink_completions, 2);
    assert.equal(report.children[0]!.games.find(game => game.id === 'miniku')!.metrics[0]!.value, 7);
    const scientist = report.children[0]!.games.find(game => game.id === 'waddle-wall')!.achievements.find(badge => badge.id === 'waddle-wall-scientist');
    assert.ok(scientist?.earned);
    assert.equal(scientist.name, 'Math Scientist');
    assert.equal(scientist.badge, '/minigames/math-quiz-wall/math-scientist.png');
    const fishing = report.children[0]!.games.find(game => game.id === 'fishing')!;
    assert.equal(fishing.metrics[0]!.value, 9);
    assert.equal(fishing.achievements.length, 7);
    assert.equal(fishing.achievements.find(badge => badge.id === 'fishing-first-nibble')?.earned, true);
    assert.equal(fishing.achievements.find(badge => badge.id === 'fishing-pond-graduate')?.earned, true);
    assert.equal(fishing.achievements.find(badge => badge.id === 'fishing-river-graduate')?.earned, false);
    assert.equal(JSON.stringify(report).includes('PRIVATE'), false);
    assert.equal(JSON.stringify(report).includes(stranger), false);
    assert.equal((await pool.query('SELECT xmin::text AS version FROM miniku_progress WHERE profile_id=$1', [kid])).rows[0].version, before);
    assert.equal((await pool.query('SELECT xmin::text AS version FROM fishing_progress WHERE profile_id=$1', [kid])).rows[0].version, fishingBefore);
    await db.achievements!.sync(FISHING_ACHIEVEMENT_GROUP);
    await db.achievements!.sync(FISHING_ACHIEVEMENT_GROUP);
    assert.deepEqual((await pool.query('SELECT state FROM fishing_progress WHERE profile_id=$1', [kid])).rows[0].state, fishingState,
      'catalog migration preserves earned badges, inventory and progress');
    assert.equal((await db.achievements!.list()).filter(badge => badge.groupId === 'fishing').length, 7);
    await db.achievements!.sync(WADDLE_WALL_ACHIEVEMENT_GROUP);
    await db.achievements!.sync(WADDLE_WALL_ACHIEVEMENT_GROUP);
    assert.equal((await db.achievements!.list()).filter(badge => badge.groupId === 'waddle-wall').length, 7);
    assert.deepEqual((await pool.query('SELECT state FROM math_wall_progress WHERE profile_id=$1', [kid])).rows[0].state, wallState,
      'repeated catalog migration preserves hard-wall counters and earned Scientist status');
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM town_state WHERE profile_id=$1', [kid])).rows[0].count, 0, 'report reads must not initialize town rows');
    assert.equal((await db.items.getParent!(item,family))?.id,item,'parents can inspect system content');
    await pool.query('INSERT INTO items(id,category,latitude,longitude,is_published,source_type,owner_family_id) VALUES($1,$2,0,0,true,$3,$4)',[privateItem,'animal','custom',foreign]);
    assert.equal(await db.items.getParent!(privateItem,family),null,'foreign private content stays hidden');
    await pool.query('INSERT INTO lesson_audiences(id,item_id,target_profile_id,granted_by_family_id) VALUES($1,$2,$3,$4)',[randomUUID(),privateItem,kid,foreign]);
    assert.equal((await db.items.getParent!(privateItem,family))?.id,privateItem,'a parent can inspect content shared with their child');
    assert.equal(await db.items.getAdmin(privateItem,family),null,'read access never grants edit ownership');
    await pool.query('DELETE FROM lesson_audiences WHERE item_id=$1',[privateItem]);
    assert.equal(await db.items.getParent!(privateItem,family),null,'withdrawn sharing removes read access');
    await pool.query('INSERT INTO profile_progress(id,profile_id,item_id,category) VALUES($1,$2,$3,$4)',[randomUUID(),kid,privateItem,'animal']);
    const revoked=await createParentReportRepository(pool).read(family);
    assert.ok(revoked.children[0]!.latest_items.every(item=>item.item_id!==privateItem),'recent titles respect current content access');
  } finally {
    await pool.query('DELETE FROM families WHERE id=ANY($1::text[])', [[family, foreign]]);
    await pool.query('DELETE FROM items WHERE id=ANY($1::text[])', [[item,privateItem]]);
    await db.close?.();
    await pool.end();
  }
});
