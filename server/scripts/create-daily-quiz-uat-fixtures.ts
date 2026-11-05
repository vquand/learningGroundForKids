/** Local browser fixtures only. Register/sign in to a dedicated Daily Quiz Test
 * Family first. Never modifies an existing child, credential, or progress row.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { createDatabase } from '../src/db/index.js';
import { requireUnpooledDatabaseUrl } from '../src/db/migration-url.js';
import { buildDailyBank, initialProgress, selectDailyQuestions } from '../src/daily-quiz/game.js';

const url = requireUnpooledDatabaseUrl(process.env);
const target = new URL(url);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  || !/(?:^|[_-])(?:dev|test|local)(?:$|[_-])/.test(target.pathname.slice(1))
  || /(?:^|[_-])(?:prod|production|live)(?:$|[_-])/.test(target.pathname.slice(1))) {
  throw new Error('Daily Quiz browser fixtures require an explicitly local dev/test database.');
}
const email = process.env.DAILY_QUIZ_UAT_EMAIL ?? 'daily-quiz-20261023@example.test';
if (!/^daily-quiz-[a-z0-9-]+@example\.test$/i.test(email)) throw new Error('Use a dedicated daily-quiz-…@example.test family.');
const pool = new Pool({ connectionString: url }), db = createDatabase(url);
try {
  const result = await pool.query<{ id: string }>("SELECT id FROM families WHERE email=$1 AND display_name='Daily Quiz Test Family' AND role='family'", [email]);
  if (result.rowCount !== 1) throw new Error('Register the dedicated local Daily Quiz Test Family first.');
  const familyId = result.rows[0]!.id, day = new Date().toISOString().slice(0, 10);
  const monday = new Date(`${day}T12:00:00Z`).getUTCDay() === 1;
  const directory = '/tmp/daily-quiz-uat-fixtures';
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const existing = await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM profiles WHERE family_id=$1', [familyId]);
  const freeSlots = Math.max(0, 5 - existing.rows[0]!.count);
  if (!freeSlots) throw new Error('This test family has no free child slots; use a fresh dedicated test family.');
  for (const bonus of (monday ? [0] : [0, 2, 4, 6]).slice(0, freeSlots)) {
    const name = `Daily Quiz Bonus ${10 + bonus} ${randomUUID().slice(0, 6)}`;
    const profile = await db.profiles.create(familyId, { name, emoji: '🦊', color: '#3B82F6', avatar_type: 'emoji' });
    const state = initialProgress();
    state.weekStreak = bonus / 2;
    state.stats.completed = state.stats.bestWeekStreak = state.weekStreak;
    state.lastPassed = bonus ? new Date(Date.parse(`${day}T12:00:00Z`) - 86400000).toISOString().slice(0, 10) : null;
    state.snapshot = { day, questions: selectDailyQuestions(buildDailyBank('en', state.modes), `${profile.id}:${day}`), correctIds: [], latest: null };
    await pool.query('INSERT INTO daily_quiz_progress(profile_id,state) VALUES($1,$2)', [profile.id, JSON.stringify(state)]);
    const file = `${directory}/${profile.id}.json`;
    await writeFile(file, JSON.stringify({ profileId: profile.id, name, day, bonus, stagedHistory: true,
      viewport: bonus === 2 ? [1366, 768] : bonus === 4 ? [1024, 768] : [1180, 820],
      answers: Object.fromEntries(state.snapshot.questions.map(question => [question.question, question.options[question.correct_answers[0]!]])),
    }), { mode: 0o600 });
    console.log(`${name}: ${file}`);
  }
} finally { await pool.end(); await db.close?.(); }
