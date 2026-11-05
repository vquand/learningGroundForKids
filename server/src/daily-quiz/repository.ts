import { isPlaceholderQuizQuestion } from '../quiz-content-policy.mjs';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { AppError } from '../errors.js';
import { dailyAttemptDate } from '../quiz.js';
import { creditTown } from '../town-building/repository.js';
import type { QuizSubmitAnswer } from '../contracts/db.js';
import { DAILY_QUIZ_ACHIEVEMENTS } from './achievements.js';
import { buildDailyBank, eligibleDailyQuestion, gradeDailyAnswers, dailyMetrics, dailyReward, initialProgress, makeDailyQuestion, recordDailyAnswers, selectDailyQuestions, type DailyProgress, type DailyQuestion, type VocabularyMode } from './game.js';

type LoadLearned = (profileId: string, lang: string, familyId: string, snapshotItemIds?: string[]) => Promise<{ questions: DailyQuestion[]; learnedIds: string[] }>;
export function createDailyQuizRepository(pool: Pool, loadLearned: LoadLearned) {
  async function transact<T>(profileId: string, familyId: string, action: (state: DailyProgress, client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const owned = await client.query('SELECT id FROM profiles WHERE id=$1 AND family_id=$2', [profileId, familyId]);
      if (!owned.rowCount) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
      // Lock only this game's row. A profile FOR UPDATE lock can deadlock with
      // another game's Town credit acquiring a foreign-key key-share lock.
      const inserted = await client.query('INSERT INTO daily_quiz_progress(profile_id,state) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING profile_id', [profileId, JSON.stringify(initialProgress())]);
      const stored = await client.query<{ state: DailyProgress }>('SELECT state FROM daily_quiz_progress WHERE profile_id=$1 FOR UPDATE', [profileId]);
      const state = stored.rows[0]!.state;
      if (inserted.rowCount) {
        // Preserve historical verified completion totals, and prevent re-awarding today.
        const history = await client.query<{ day: string }>(`SELECT DISTINCT to_char(attempt_date AT TIME ZONE 'UTC','YYYY-MM-DD') AS day FROM quiz_attempts WHERE profile_id=$1 AND item_id IS NULL AND total>0 AND score::numeric/total>=0.7 ORDER BY day`, [profileId]);
        for (const { day } of history.rows) {
          const reward = dailyReward(day, state.lastPassed, state.weekStreak);
          state.lastPassed = day; state.weekStreak = reward.streak; state.stats.completed++;
          state.stats.bestWeekStreak = Math.max(state.stats.bestWeekStreak, reward.streak);
          if (reward.streak === 7) state.stats.perfectWeeks++;
        }
      }
      const result = await action(state, client);
      await client.query(`INSERT INTO daily_quiz_progress(profile_id,state) VALUES($1,$2) ON CONFLICT(profile_id) DO UPDATE SET state=EXCLUDED.state,updated_at=now()`, [profileId, JSON.stringify(state)]);
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async function learnedDrinks(client: PoolClient, profileId: string, lang: string): Promise<DailyQuestion[]> {
    const rows = await client.query<{ recipe: string }>(`SELECT DISTINCT data->>'recipeId' AS recipe FROM adventure_events WHERE profile_id=$1 AND game='kitchen' AND kind='meal_finished' AND data->>'recipeId' IN ('lemonade','mint-tea','iced-coffee')`, [profileId]);
    const vi = lang === 'vi';
    const definitions: Record<string, [string, string[]]> = vi ? {
      lemonade: ['Loại quả nào tạo vị chua trong món nước chanh bạn đã pha?', ['Chanh', 'Chuối', 'Táo']],
      'mint-tea': ['Loại lá nào dùng để trang trí trà bạc hà bạn đã pha?', ['Lá bạc hà', 'Lá phong', 'Lá thông']],
      'iced-coffee': ['Nguyên liệu nào tạo vị cà phê trong món cà phê đá bạn đã pha?', ['Cà phê', 'Trà', 'Nước chanh']],
    } : {
      lemonade: ['Which fruit gives the lemonade you made its sour flavor?', ['Lemon', 'Banana', 'Apple']],
      'mint-tea': ['Which leaf decorates the mint tea you made?', ['Mint leaf', 'Maple leaf', 'Pine needle']],
      'iced-coffee': ['Which ingredient gives the iced coffee you made its coffee flavor?', ['Coffee', 'Tea', 'Lemon juice']],
    };
    return rows.rows.map(({ recipe }) => { const [prompt, options] = definitions[recipe]!; return { ...makeDailyQuestion(`drink:${recipe}`, 'drink', prompt, options, 'easy', lang), recipeId: recipe }; });
  }
  return {
    async getDailySettings(profileId: string, familyId: string) {
      return transact(profileId, familyId, async state => ({ modes: state.modes }));
    },
    async setDailySettings(profileId: string, familyId: string, modes: VocabularyMode[]) {
      return transact(profileId, familyId, async state => { state.modes = [...modes]; return { modes: state.modes }; });
    },
    async getDailyQuiz(profileId: string, lang: string, day: string, familyId: string) {
      dailyAttemptDate(day);
      return transact(profileId, familyId, async (state, client) => {
        const learned = await loadLearned(profileId, lang, familyId, state.snapshot?.questions.map(q => q.item_id).filter(Boolean));
        if (state.snapshot?.day !== day || state.snapshot.questions.some(question => isPlaceholderQuizQuestion(question.question)) || state.lastPassed !== day && state.snapshot.questions.some(question => !eligibleDailyQuestion(question))) {
          const drinks = await learnedDrinks(client, profileId, lang);
          const previous = state.snapshot?.day === day ? state.snapshot : null;
          state.snapshot = { day, questions: selectDailyQuestions([...buildDailyBank(lang, state.modes), ...learned.questions, ...drinks], `${profileId}:${day}`), correctIds: [...new Set((previous?.correctIds ?? []).flatMap(id => [id, id.replace(/^daily-v1:word:/, 'daily-v1:word-clue:')]))], latest: previous?.latest ?? null };
        }
        const allowed = new Set(learned.learnedIds);
        if (state.snapshot.questions.some(q => q.item_id && !allowed.has(q.item_id))) throw new AppError(409, 'DAILY_CONTENT_CHANGED', 'A learned lesson is no longer available. Come back tomorrow for a new quiz.');
        return { questions: state.snapshot.questions, difficulty: 'Medium' as const };
      });
    },
    async getDailyStatus(profileId: string, day: string, familyId: string) {
      return transact(profileId, familyId, async state => {
        const passed = state.lastPassed === day, latest = state.snapshot?.day === day ? state.snapshot.latest : null;
        const reward = passed ? { streak: state.weekStreak, bonus: Math.min(state.weekStreak - 1, 3) * 2, amount: 10 + Math.min(state.weekStreak - 1, 3) * 2 } : dailyReward(day, state.lastPassed, state.weekStreak);
        return { attempted_today: passed || !!latest, passed, score: latest?.score ?? 0, total: latest?.total ?? 0, day, streak: reward.streak, bonus: reward.bonus, amount: reward.amount };
      });
    },
    async submitDaily(profileId: string, day: string, answers: QuizSubmitAnswer[], familyId: string) {
      return transact(profileId, familyId, async (state, client) => {
        if (state.snapshot?.day !== day) throw new AppError(409, 'DAILY_QUIZ_EXPIRED', 'The UTC day changed. Open a new daily quiz.');
        const questions = state.snapshot.questions;
        if (questions.some(question => isPlaceholderQuizQuestion(question.question))) throw new AppError(409, 'DAILY_QUIZ_REFRESHED', 'Placeholder questions were removed. Open the daily quiz again.');
        const learned = await loadLearned(profileId, questions[0]?.lang ?? 'en', familyId, questions.map(q => q.item_id).filter(Boolean));
        const allowed = new Set(learned.learnedIds);
        if (questions.some(q => q.item_id && !allowed.has(q.item_id))) throw new AppError(409, 'DAILY_CONTENT_CHANGED', 'A learned lesson is no longer available. Come back tomorrow for a new quiz.');
        if (answers.some(answer => answer.chosen_answers.length !== 1)) throw new AppError(422, 'INVALID_QUIZ_ANSWERS', 'Choose exactly one answer per question.');
        if (answers.some(answer => !questions.some(question => question.id === answer.question_id))) throw new AppError(409, 'DAILY_QUIZ_REFRESHED', 'Today’s questions were updated. Open the daily quiz again.');
        const graded = gradeDailyAnswers(questions, answers);
        const previouslyPassed = state.lastPassed === day;
        const reward = dailyReward(day, state.lastPassed, state.weekStreak);
        const newlyPassed = graded.passed && !previouslyPassed;
        recordDailyAnswers(state, day, graded.answers.filter(a => a.is_correct).map(a => a.question_id), graded.passed);
        state.snapshot.latest = { score: graded.score, total: graded.total };
        if (!previouslyPassed) await client.query(`INSERT INTO quiz_attempts(id,profile_id,item_id,attempt_date,score,total,answers) VALUES($1,$2,NULL,$3,$4,$5,$6)`, [randomUUID(), profileId, dailyAttemptDate(day), graded.score, graded.total, JSON.stringify(graded.answers)]);
        const metrics = dailyMetrics(state);
        for (const badge of DAILY_QUIZ_ACHIEVEMENTS.achievements) if (!state.earned[badge.id] && (metrics[badge.metric] ?? 0) >= badge.target) state.earned[badge.id] = new Date().toISOString();
        const receiptId = `daily-quiz:${day}`;
        const townReward = newlyPassed ? { wood: reward.amount, stamina: reward.amount, metal: reward.amount } : {};
        if (newlyPassed) await creditTown(client, profileId, receiptId, townReward);
        return { score: graded.score, total: graded.total, passed: graded.passed, new_badges: [], townReward, receiptId: newlyPassed ? receiptId : null,
          bonus: newlyPassed ? reward.bonus : 0, streak: state.weekStreak, alreadyRewarded: previouslyPassed };
      });
    },
  };
}
