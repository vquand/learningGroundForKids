import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from '../../src/db/index.js';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { isPlaceholderQuizQuestion, PLACEHOLDER_QUIZ_PATTERN } from '../../src/quiz-content-policy.mjs';

const configured = process.env.TEST_DATABASE_URL;
test('placeholder-only quizzes disappear, mixed quizzes retain real questions, and retirement preserves progress', { skip: configured ? false : 'TEST_DATABASE_URL is not configured' }, async () => {
  const url = assertSafeTestDatabaseUrl(configured!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((v): v is string => !!v), process.env.ALLOW_NONLOCAL_TEST_DATABASE);
  const pool = new Pool({ connectionString: url }), db = createDatabase(url);
  const family = `placeholder-${randomUUID()}`, kid = `${family}-kid`, empty = `${family}-empty`, mixed = `${family}-mixed`;
  const placeholder = 'Which country or region is Fava (Turkish dish) associated with?';
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    await pool.query("INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,'Quiz test','unused')", [family, `${family}@example.test`]);
    await pool.query("INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES($1,$2,'Kid','cow','blue',$1)", [kid, family]);
    for (const id of [empty, mixed]) {
      await pool.query("INSERT INTO items(id,category,latitude,longitude,is_published,quiz_required,source_type,owner_family_id) VALUES($1,'food',1,2,true,true,'family',$2)", [id, family]);
      await pool.query("INSERT INTO item_translations(id,item_id,lang,title) VALUES($1,$2,'en','Fava')", [randomUUID(), id]);
      await pool.query("INSERT INTO quiz_questions(id,item_id,lang,question,question_type,options,correct_answers,sort_order,is_active) VALUES($1,$2,'vi',$3,'single',$4,$5,0,true)", [`${id}-bad`, id, placeholder, JSON.stringify(['Turkey', 'Japan', 'France']), JSON.stringify([0])]);
    }
    await pool.query("INSERT INTO quiz_questions(id,item_id,lang,question,question_type,options,correct_answers,sort_order,is_active) VALUES($1,$2,'en','Which ingredient gives lemonade its sour flavor?','single',$3,$4,1,true)", [`${mixed}-good`, mixed, JSON.stringify(['Lemon', 'Milk', 'Mint']), JSON.stringify([0])]);
    const noQuiz = await db.items.get(empty, 'en', family, kid);
    assert.equal(noQuiz?.has_quiz, false); assert.equal(noQuiz?.quiz_required, false);
    assert.deepEqual((await db.quiz.getItemQuiz(empty, 'vi', family, kid))?.questions, []);
    const realQuiz = await db.quiz.getItemQuiz(mixed, 'vi', family, kid);
    assert.deepEqual(realQuiz?.questions.map(question => question.id), [`${mixed}-good`]);
    assert.equal((await db.progress.mark(family, kid, empty))?.status, 'done');
    const before = await db.progress.get(family, kid, empty);
    const daily = await db.quiz.getDailyQuiz(kid, 'en', '2040-02-03', family);
    assert.equal(daily?.questions.length, 8);
    assert.ok(daily?.questions.every(question => !isPlaceholderQuizQuestion(question.question)));
    await pool.query("INSERT INTO flashcards(id,item_id,lang,front,back,sort_order,is_published,source_type) VALUES($1,$2,'en',$3,'Turkey',0,true,'catalog_quiz')", [`${empty}-card`, empty, placeholder]);
    const migration = await readFile(new URL('../../drizzle/0031_retire_placeholder_quizzes.sql', import.meta.url), 'utf8');
    assert.ok(migration.includes(`$quiz_placeholder$${PLACEHOLDER_QUIZ_PATTERN}$quiz_placeholder$`));
    const client = await pool.connect();
    try { await client.query('BEGIN'); await client.query(migration); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    assert.equal((await pool.query('SELECT is_active FROM quiz_questions WHERE id=$1', [`${empty}-bad`])).rows[0].is_active, false);
    assert.equal((await pool.query('SELECT is_published FROM flashcards WHERE id=$1', [`${empty}-card`])).rows[0].is_published, false);
    assert.equal((await pool.query('SELECT quiz_required FROM items WHERE id=$1', [empty])).rows[0].quiz_required, false);
    assert.equal((await pool.query('SELECT quiz_required FROM items WHERE id=$1', [mixed])).rows[0].quiz_required, true);
    assert.deepEqual(await db.progress.get(family, kid, empty), before);
    // Exercise the operator wrapper's real body and ledger insertion, then
    // restore the existing migration ledger by rolling the test transaction back.
    const handoff = await readFile(new URL('../../../docs/migrations/neon-0031-retire-placeholder-quizzes.sql', import.meta.url), 'utf8');
    const operator = await pool.connect();
    try {
      await operator.query('BEGIN');
      await operator.query('DELETE FROM drizzle.__drizzle_migrations WHERE created_at>=1792829344744');
      await operator.query(handoff.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, ''));
      assert.equal((await operator.query('SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=1792829344744')).rowCount, 1);
      await operator.query(handoff.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, ''));
      assert.equal((await operator.query('SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=1792829344744')).rowCount, 1);
    } finally { await operator.query('ROLLBACK'); operator.release(); }
    const revision = (await pool.query('SELECT * FROM explore_revisions WHERE id=1')).rows[0];
    const retry = await pool.connect();
    try { await retry.query('BEGIN'); await retry.query(migration); await retry.query('COMMIT'); }
    catch (error) { await retry.query('ROLLBACK'); throw error; } finally { retry.release(); }
    assert.deepEqual((await pool.query('SELECT * FROM explore_revisions WHERE id=1')).rows[0], revision);
    assert.deepEqual(await db.progress.get(family, kid, empty), before);
  } finally {
    await pool.query('DELETE FROM items WHERE id=ANY($1)', [[empty, mixed]]);
    await pool.query('DELETE FROM families WHERE id=$1', [family]);
    await pool.end(); await db.close?.();
  }
});
