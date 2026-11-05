import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { createDailyQuizRepository } from '../../src/daily-quiz/repository.js';
import { createDatabase } from '../../src/db/index.js';
import { createTownRepository } from '../../src/town-building/repository.js';
import { createParentReportRepository } from '../../src/parent-reports/repository.js';
import { DAILY_QUIZ_ACHIEVEMENTS } from '../../src/daily-quiz/achievements.js';
import { buildDailyBank, DEFAULT_MODES, makeDailyQuestion, eligibleDailyQuestion, type DailyProgress } from '../../src/daily-quiz/game.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { hashSessionToken } from '../../src/auth.js';
const configured = process.env.TEST_DATABASE_URL;
test('daily quiz atomic rewards, UTC streaks, settings, learned content and kid/Parent/Admin reporting', { skip: configured ? false : 'TEST_DATABASE_URL is not configured' }, async () => {
  const url = assertSafeTestDatabaseUrl(configured!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((v): v is string => !!v), process.env.ALLOW_NONLOCAL_TEST_DATABASE);
  const pool = new Pool({ connectionString: url }), db = createDatabase(url), town = createTownRepository(pool), reports = createParentReportRepository(pool);
  const family = `daily-${randomUUID()}`, kid = `${family}-kid`, sibling = `${family}-sibling`, token = randomUUID();
  let learned = true;
  const learnedQuestion = { ...makeDailyQuestion('learned', 'animal', 'Which animal has a trunk?', ['Elephant', 'Cow', 'Cat']), item_id: 'learned-animal' };
  const daily = createDailyQuizRepository(pool, async () => ({ questions: learned ? [learnedQuestion] : [], learnedIds: learned ? ['learned-animal'] : [] }));
  async function privateState() { return (await pool.query<{ state: DailyProgress }>('SELECT state FROM daily_quiz_progress WHERE profile_id=$1', [kid])).rows[0]!.state; }
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    await pool.query("INSERT INTO families(id,email,display_name,password_hash,role) VALUES($1,$2,'Daily family','unused','admin')", [family, `${family}@example.test`]);
    for (const id of [kid, sibling]) await pool.query("INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES($1,$2,'Learner','cow','blue',$1)", [id, family]);
    await assert.rejects(daily.getDailySettings(kid, 'another-family'), /not found/);
    assert.equal((await daily.getDailySettings(kid, family)).modes.length, 4);
    await daily.setDailySettings(kid, family, ['en-en']);
    const day = '2040-02-06'; // Monday
    const first = await daily.getDailyQuiz(kid, 'en', day, family);
    assert.equal(first.questions.length, 8);
    await daily.setDailySettings(kid, family, ['vi-vi']);
    assert.deepEqual((await daily.getDailyQuiz(kid, 'vi', day, family)).questions, first.questions);
    const correct = first.questions.map(q => ({ question_id: q.id, chosen_answers: q.correct_answers }));
    const wrong = first.questions.map(q => ({ question_id: q.id, chosen_answers: [(q.correct_answers[0]! + 1) % q.options.length] }));
    await assert.rejects(daily.submitDaily(kid, day, correct.map(a => ({ ...a, chosen_answers: [0, 1] })), family), /exactly one/);
    const failed = await daily.submitDaily(kid, day, wrong, family);
    assert.equal(failed.passed, false); assert.deepEqual(failed.townReward, {});
    const initialMaterials = (await town.get(kid)).materials;
    const concurrent = await Promise.all([daily.submitDaily(kid, day, correct, family), daily.submitDaily(kid, day, correct, family)]);
    assert.equal(concurrent.filter(r => r.receiptId !== null).length, 1);
    assert.deepEqual((await town.get(kid)).materials, { ...initialMaterials, wood: initialMaterials.wood + 10, metal: initialMaterials.metal + 10, stamina: initialMaterials.stamina + 10 });
    assert.equal((await privateState()).stats.completed, 1);
    assert.equal((await pool.query('SELECT 1 FROM town_reward_events WHERE profile_id=$1', [kid])).rowCount, 1);
    const saved = await privateState();
    await daily.submitDaily(kid, day, correct, family);
    assert.deepEqual(await privateState(), saved);
    if (first.questions.some(q => q.item_id)) {
      learned = false;
      await assert.rejects(daily.submitDaily(kid, day, correct, family), /no longer available/);
      learned = true;
    }
    const amounts: number[] = [];
    for (const date of ['2040-02-07', '2040-02-08', '2040-02-09', '2040-02-10', '2040-02-11', '2040-02-12', '2040-02-13', '2040-02-15']) {
      const quiz = await daily.getDailyQuiz(kid, 'en', date, family);
      assert.ok(quiz.questions.every(q => !q.mode || q.mode === 'vi-vi'));
      const result = await daily.submitDaily(kid, date, quiz.questions.map(q => ({ question_id: q.id, chosen_answers: q.correct_answers })), family);
      amounts.push(result.townReward.wood!);
    }
    assert.deepEqual(amounts, [12, 14, 16, 16, 16, 16, 10, 10]);
    const progress = await privateState();
    assert.ok(progress.earned['daily-quiz-first']); assert.ok(progress.earned['daily-quiz-four']); assert.ok(progress.earned['daily-quiz-week']);
    // Credit overflow must roll back the source completion and unique reward receipt.
    const beforeFailure = await privateState();
    await pool.query("UPDATE town_state SET state=jsonb_set(state,'{materials,wood}',to_jsonb($2::bigint)) WHERE profile_id=$1", [kid, Number.MAX_SAFE_INTEGER]);
    const pending = await daily.getDailyQuiz(kid, 'en', '2040-02-16', family);
    await assert.rejects(daily.submitDaily(kid, '2040-02-16', pending.questions.map(q => ({ question_id: q.id, chosen_answers: q.correct_answers })), family), /Invalid resource credit/);
    assert.equal((await privateState()).stats.completed, beforeFailure.stats.completed);
    assert.equal((await pool.query("SELECT 1 FROM town_reward_events WHERE profile_id=$1 AND event_id='daily-quiz:2040-02-16'", [kid])).rowCount, 0);
    await db.achievements!.sync(DAILY_QUIZ_ACHIEVEMENTS); await db.achievements!.sync(DAILY_QUIZ_ACHIEVEMENTS);
    assert.equal((await db.achievements!.list()).filter(a => a.groupId === 'daily-quiz').length, 8);
    const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: url, ALLOWED_ORIGINS: 'https://daily.example.test', ALLOWED_FORWARDED_HOSTS: 'daily.example.test' });
    await pool.query("INSERT INTO sessions(id,token_hash,family_id,expires_at,parent_verified_until,parent_verified_by) VALUES($1,$2,$3,now()+interval '1 hour',now()+interval '1 hour','password')", [randomUUID(), hashSessionToken(token), family]);
    const app = createApp({ db, config, logger: { info() {}, warn() {}, error() {} } });
    const request = (path: string, method = 'GET', body?: unknown, authenticated = true) => app.request(`https://daily.example.test/api/v1/${path}`, { method, headers: { ...(authenticated ? { cookie: `${config.sessionCookieName}=${token}` } : {}), origin: 'https://daily.example.test', 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal((await request(`profiles/${kid}/quiz/daily`, 'GET', undefined, false)).status, 401);
    assert.equal((await request('profiles/not-owned/quiz/daily')).status, 404);
    assert.equal((await request(`profiles/${kid}/quiz/daily/settings`, 'PUT', { modes: [] })).status, 422);
    assert.equal((await request(`profiles/${kid}/quiz/daily/settings`, 'PUT', { modes: ['en-en'], score: 8 })).status, 422);
    const parent = await (await request('parent/reports')).json(), adminResponse = await request(`admin/families/${family}/reports`);
    assert.equal(adminResponse.status, 200); assert.match(adminResponse.headers.get('cache-control') ?? '', /no-store/);
    const admin = await adminResponse.json();
    const select = (report: typeof parent) => report.children.find((c: { id: string }) => c.id === kid).games.find((g: { id: string }) => g.id === 'daily-quiz');
    assert.deepEqual(select(parent), select(admin)); assert.equal(select(parent).achievements.length, 8);
    const groups = await (await request(`profiles/${kid}/achievement-groups`)).json();
    assert.deepEqual(groups.find((g: { id: string }) => g.id === 'daily-quiz'), select(parent));
    assert.equal(JSON.stringify(admin).includes('correct_answers'), false);
    assert.equal((await town.get(sibling)).materials.wood, 0);
    // Exercise the real HTTP validator with standalone bank IDs, not just repository calls.
    const publicQuiz = await (await request(`profiles/${sibling}/quiz/daily`)).json();
    assert.equal(publicQuiz.questions.length, 8);
    assert.equal(JSON.stringify(publicQuiz).includes('correct_answers'), false);
    const siblingState = (await pool.query<{ state: DailyProgress }>('SELECT state FROM daily_quiz_progress WHERE profile_id=$1', [sibling])).rows[0]!.state;
    const staleQuestions = structuredClone(siblingState.snapshot!.questions);
    staleQuestions[0] = makeDailyQuestion('legacy-filler', 'animal', 'What kind of learning item is a lemur?', ['an animal', 'animal', 'a movie']);
    siblingState.snapshot!.questions = staleQuestions;
    siblingState.snapshot!.correctIds = ['previously-counted-question'];
    siblingState.stats.hardMath = 5;
    await pool.query('UPDATE daily_quiz_progress SET state=$2 WHERE profile_id=$1', [sibling, JSON.stringify(siblingState)]);
    const refreshed = await db.quiz.getDailyQuiz(sibling, 'en', siblingState.snapshot!.day, family);
    assert.ok(refreshed!.questions.every(question => eligibleDailyQuestion(question as import('../../src/daily-quiz/game.js').DailyQuestion)));
    let repaired = (await pool.query<{ state: DailyProgress }>('SELECT state FROM daily_quiz_progress WHERE profile_id=$1', [sibling])).rows[0]!.state;
    assert.deepEqual(repaired.snapshot!.correctIds, ['previously-counted-question']);
    assert.equal(repaired.stats.hardMath, 5);
    const clueWord = buildDailyBank('en', DEFAULT_MODES).find(q => q.mode === 'en-en' && q.concept === 'word:8')!;
    const oldWordId = 'daily-v1:word:en-en:8';
    repaired.snapshot!.questions[0] = { ...clueWord, id: oldWordId, question: 'What does “blanket” mean?', options: ['A warm covering used on a bed.', 'A folding cover held above you.', 'A way of avoiding mistakes.'] };
    repaired.snapshot!.correctIds.push(oldWordId);
    repaired.categories['vocabulary-en'] = 1;
    await pool.query('UPDATE daily_quiz_progress SET state=$2 WHERE profile_id=$1', [sibling, JSON.stringify(repaired)]);
    await db.quiz.getDailyQuiz(sibling, 'en', repaired.snapshot!.day, family);
    repaired = (await pool.query<{ state: DailyProgress }>('SELECT state FROM daily_quiz_progress WHERE profile_id=$1', [sibling])).rows[0]!.state;
    assert.ok(repaired.snapshot!.questions.every(q => !q.id.startsWith('daily-v1:word:')));
    assert.ok(repaired.snapshot!.correctIds.includes(oldWordId));
    assert.ok(repaired.snapshot!.correctIds.includes(clueWord.id));
    assert.equal(repaired.categories['vocabulary-en'], 1);
    assert.equal(repaired.stats.hardMath, 5);
    assert.equal((await town.get(sibling)).materials.wood, 0);

    const staleResponse = await request(`profiles/${sibling}/quiz/daily/submit`, 'POST', { answers: staleQuestions.map(q => ({ question_id: q.id, chosen_answers: q.correct_answers })) });
    assert.equal(staleResponse.status, 409);
    assert.equal((await staleResponse.json()).error.code, 'DAILY_QUIZ_REFRESHED');
    siblingState.snapshot = repaired.snapshot;
    const httpPass = await request(`profiles/${sibling}/quiz/daily/submit`, 'POST', {
      answers: siblingState.snapshot!.questions.map(q => ({ question_id: q.id, chosen_answers: q.correct_answers })),
    });
    assert.equal(httpPass.status, 200);
    const httpResult = await httpPass.json();
    assert.equal(httpResult.passed, true);
    assert.deepEqual(httpResult.townReward, { wood: 10, stamina: 10, metal: 10 });

    // A completed snapshot containing a retired template is repaired without
    // losing completion, achievement counts or awarding the same day twice.
    const completed = (await pool.query<{ state: DailyProgress }>('SELECT state FROM daily_quiz_progress WHERE profile_id=$1', [sibling])).rows[0]!.state;
    completed.snapshot!.questions[0] = makeDailyQuestion('retired-association', 'food', 'Which country is Fava associated with?', ['Turkey', 'Japan', 'France']);
    await pool.query('UPDATE daily_quiz_progress SET state=$2 WHERE profile_id=$1', [sibling, JSON.stringify(completed)]);
    const rejected = await request(`profiles/${sibling}/quiz/daily/submit`, 'POST', { answers: completed.snapshot!.questions.map(q => ({ question_id: q.id, chosen_answers: q.correct_answers })) });
    assert.equal(rejected.status, 409);
    assert.equal((await rejected.json()).error.code, 'DAILY_QUIZ_REFRESHED');
    const repairedCompleted = await db.quiz.getDailyQuiz(sibling, 'en', completed.snapshot!.day, family);
    assert.ok(repairedCompleted!.questions.every(q => eligibleDailyQuestion(q as import('../../src/daily-quiz/game.js').DailyQuestion)));
    const completedAfter = (await pool.query<{ state: DailyProgress }>('SELECT state FROM daily_quiz_progress WHERE profile_id=$1', [sibling])).rows[0]!.state;
    assert.deepEqual(completedAfter.stats, completed.stats);
    assert.deepEqual(completedAfter.earned, completed.earned);
    assert.equal(completedAfter.lastPassed, completed.lastPassed);
    assert.deepEqual(completedAfter.snapshot!.correctIds, completed.snapshot!.correctIds);
    const repeated = await db.quiz.submitDaily(sibling, completed.snapshot!.day, completedAfter.snapshot!.questions.map(q => ({ question_id: q.id, chosen_answers: q.correct_answers })), family);
    assert.deepEqual(repeated.townReward, {});
    assert.equal(repeated.receiptId, null);
    assert.equal((await town.get(sibling)).materials.wood, 10);

    assert.equal((await reports.read(family)).children.length, 2);
  } finally { await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end(); await db.close?.(); }
});
