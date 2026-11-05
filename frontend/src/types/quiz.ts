import type { BadgeInfo } from './profile';

export type QuestionType = 'yes_no' | 'single' | 'abc' | 'abcd' | 'multi';

export interface QuizQuestion {
  subject?: string;
  lang?: string;
  level?: string;
  id: string;
  item_id?: string;
  question_type: QuestionType;
  question: string;
  options: string[];
  answer_count?: number;
  sort_order: number;
}

export interface QuizSessionQuestion extends Omit<QuizQuestion, 'options'> {
  readonly options: readonly string[];
  readonly shuffledToOriginal: readonly number[];
}

export interface QuizSession {
  readonly questions: readonly QuizSessionQuestion[];
}

export interface QuizOut {
  questions: QuizQuestion[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface QuizAnswerIn {
  question_id: string;
  chosen_answers: number[];
}

export interface QuizSubmitRequest {
  answers: QuizAnswerIn[];
}

export interface QuizSubmitResponse {
  townReward?: { wood?: number; stamina?: number; metal?: number };
  receiptId?: string | null;
  bonus?: number;
  streak?: number;
  alreadyRewarded?: boolean;
  score: number;
  total: number;
  passed: boolean;
  new_badges: BadgeInfo[];
}

export interface QuizItemStatus {
  attempt_count: number;
  passed: boolean;
  best_score: number;
  best_total: number;
  latest_score: number;
  latest_total: number;
}

export interface QuizDailyStatus {
  day?: string;
  streak?: number;
  bonus?: number;
  amount?: number;
  attempted_today: boolean;
  passed: boolean;
  score: number;
  total: number;
}

/** Convert displayed (shuffled) option positions to catalog option positions. */
export function mapShuffledAnswerIndices(
  shuffledAnswers: readonly number[],
  shuffledToOriginal: readonly number[],
): number[] {
  return shuffledAnswers.map((index) => shuffledToOriginal[index] ?? index);
}

function shuffledCopy<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}

/**
 * Builds one self-contained quiz session. React may call a state initializer
 * more than once in development; each returned value remains internally
 * consistent because this function has no side effects.
 */
export function createQuizSession(
  questions: readonly QuizQuestion[],
  random: () => number = Math.random,
): QuizSession {
  const sessionQuestions = shuffledCopy(questions, random).map((question) => {
    const shuffledToOriginal = Object.freeze(
      shuffledCopy(question.options.map((_, index) => index), random),
    );
    const options = Object.freeze(
      shuffledToOriginal.map((index) => question.options[index]!),
    );
    return Object.freeze({
      ...question,
      options,
      shuffledToOriginal,
    });
  });

  return Object.freeze({ questions: Object.freeze(sessionQuestions) });
}

export function dailyQuizCompletionMessage(passed: boolean): string {
  return passed
    ? 'Daily quiz done for today! Come back tomorrow 🌟'
    : 'Not quite yet — review what you learned and try again when you are ready.';
}
