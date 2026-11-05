import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { createInfinidrillGame } from '../../src/infinidrill/game.js';
import { emptyProgress, type Progress } from '../../src/infinidrill/progress.js';
import { createInfinidrillRepository } from '../../src/infinidrill/repository.js';
import { evaluate } from '../../src/questions/equation.js';
import type { PublicQuestion } from '../../src/questions/projection.js';
import { createTownRepository } from '../../src/town-building/repository.js';

const configured = process.env.TEST_DATABASE_URL;

function answerFromPublicEquation(question: PublicQuestion): number {
  if (question.card.kind !== 'equation') assert.fail('The repaired question is not an equation');
  const { values, operators, result } = question.card;
  if (result === null) return evaluate(values.map(value => value!), operators).at(-1)!;
  const missing = values.findIndex(value => value === null);
  assert.notEqual(missing, -1);
  for (let candidate = 0; candidate <= 999; candidate += 1) {
    const operands = values.map((value, index) => index === missing ? candidate : value!) as number[];
    try {
      if (evaluate(operands, operators).at(-1) === result) return candidate;
    } catch { /* Trial values can make an intermediate equation invalid. */ }
  }
  assert.fail('The repaired public equation has no visible solution');
}

test('a broken saved InfiniDrill question stays stable from GET through submit', {
  skip: configured ? false : 'TEST_DATABASE_URL is not configured',
}, async () => {
  const url = assertSafeTestDatabaseUrl(configured!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((value): value is string => Boolean(value)), process.env.ALLOW_NONLOCAL_TEST_DATABASE);
  const pool = new Pool({ connectionString: url, max: 4 });
  const family = `infinidrill-repair-${randomUUID()}`;
  const profile = `${family}-kid`;
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    await pool.query("INSERT INTO families(id,email,display_name,password_hash,role) VALUES($1,$2,'Repair','unused','family')", [family, `${family}@example.test`]);
    await pool.query("INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES($1,$2,'Kid','cow','blue',$1)", [profile, family]);
    await createTownRepository(pool).get(profile);
    const initial = createInfinidrillGame({ random: () => 0.5 });
    const broken: Progress = {
      ...emptyProgress(),
      game: { ...initial, level: 18, questionCounter: 1, currentQuestion: { id: 'broken', notAQuestion: true } } as unknown as Progress['game'],
    };
    await pool.query('INSERT INTO infinidrill_progress(profile_id,state) VALUES($1,$2)', [profile, JSON.stringify(broken)]);
    const drill = createInfinidrillRepository(pool);
    const shown = await drill.get(profile);
    const question = shown.game?.currentQuestion;
    assert.ok(question);
    assert.equal(question.id.startsWith('earth-question-'), true);
    assert.equal(question.card.kind, 'equation');
    const answer = answerFromPublicEquation(question);
    const submitted = await drill.mutate(profile, shown.revision, { type: 'submit-answer', questionId: question.id, answer });
    assert.equal(submitted.game?.mainQuestionsCompleted, 1);
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]);
    await pool.end();
  }
});
