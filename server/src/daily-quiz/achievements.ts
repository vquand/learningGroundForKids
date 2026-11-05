import type { AchievementDefinition, AchievementGroup } from '../achievement-catalog.js';
import { SUBJECTS } from './game.ts';
const definitions: Array<[string, string, string, AchievementDefinition['difficulty'], AchievementDefinition['metric'], number]> = [
  ['first', 'First Daily Quiz', 'Pass one daily quiz.', 'easy', 'dailyCompleted', 1],
  ['four', 'Four in a Row', 'Pass four consecutive UTC days in one Monday–Sunday week.', 'medium', 'dailyWeekStreak', 4],
  ['week', 'Perfect Week', 'Pass every UTC day from Monday through Sunday in one week.', 'hard', 'dailyPerfectWeeks', 1],
  ['ten', 'Daily Ten', 'Pass daily quizzes on 10 distinct UTC days.', 'easy', 'dailyCompleted', 10],
  ['thirty', 'Daily Thirty', 'Pass daily quizzes on 30 distinct UTC days.', 'medium', 'dailyCompleted', 30],
  ['hundred', 'Daily Hundred', 'Pass daily quizzes on 100 distinct UTC days.', 'hard', 'dailyCompleted', 100],
  ['all', 'All-Round Learner', 'Correctly answer a question in each of the 13 Daily Quiz subjects.', 'medium', 'dailyCategories', SUBJECTS.length],
  ['hard-math', 'Hard Math Twenty', 'Correctly answer 20 hard math questions. Each counts once per UTC day.', 'hard', 'dailyHardMath', 20],
];
export const DAILY_QUIZ_ACHIEVEMENTS: AchievementGroup = {
  id: 'daily-quiz', name: 'Daily Quiz', earning: 'server-verified',
  achievements: definitions.map(([key, name, description, difficulty, metric, target], badgeIndex) => ({
    id: `daily-quiz-${key}`, name, description, difficulty, metric, target,
    badge: '/minigames/daily-quiz/badges.png', badgeIndex, badgeColumns: 4, badgeRows: 2,
  })),
};
