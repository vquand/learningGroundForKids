import { isPlaceholderQuizQuestion } from './quiz-content-policy.mjs';
import { AppError } from './errors.ts';
import type {
  QuizDailyStatusRecord,
  QuizPublicQuestion,
  QuizQuestionRecord,
  QuizSubmitAnswer,
} from './contracts/db.js';

export const MAX_QUIZ_QUESTIONS = 100;
export const MAX_QUIZ_OPTIONS = 32;
export const MAX_QUIZ_OPTION_LENGTH = 2000;
export const MAX_QUIZ_ANSWER_INDICES = 8;
export const MAX_QUIZ_QUESTION_LENGTH = 8000;

const SUPPORTED_QUESTION_TYPES = new Set(['yes_no', 'single', 'abc', 'abcd', 'multi']);

const DIFFICULTY_WEIGHTS: Record<string, number> = {
  yes_no: 1,
  single: 2,
  abc: 2,
  abcd: 3,
  multi: 4,
};

export interface QuizContentInput {
  question: unknown;
  questionType: unknown;
  options: unknown;
  correctAnswers: unknown;
}

function storedJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

export function quizContentValidationError(input: QuizContentInput): string | null {
  const options = storedJson(input.options);
  const correctAnswers = storedJson(input.correctAnswers);
  if (typeof input.question !== 'string' || !input.question.trim() || input.question.length > MAX_QUIZ_QUESTION_LENGTH) {
    return 'question must be non-empty and bounded';
  }
  if (isPlaceholderQuizQuestion(input.question)) return 'placeholder quiz questions are not supported';
  if (typeof input.questionType !== 'string' || !SUPPORTED_QUESTION_TYPES.has(input.questionType)) {
    return 'question type is unsupported';
  }
  if (
    !Array.isArray(options)
    || options.length === 0
    || options.length > MAX_QUIZ_OPTIONS
    || !options.every((value) => typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_QUIZ_OPTION_LENGTH)
  ) {
    return 'options must be non-empty bounded strings';
  }
  if (
    !Array.isArray(correctAnswers)
    || correctAnswers.length === 0
    || correctAnswers.length > MAX_QUIZ_ANSWER_INDICES
    || !correctAnswers.every((value) => Number.isInteger(value) && value >= 0 && value < options.length)
    || new Set(correctAnswers).size !== correctAnswers.length
  ) {
    return 'correct answer indices must be unique and in range';
  }
  if (input.questionType !== 'multi' && correctAnswers.length !== 1) {
    return 'non-multi questions require exactly one correct answer';
  }
  return null;
}

export function parseQuizQuestionRecord(row: {
  id: string;
  itemId: string;
  lang: string;
  question: string;
  questionType: string;
  options: unknown;
  correctAnswers: unknown;
  sortOrder: number;
  isActive: boolean;
}): QuizQuestionRecord | null {
  if (quizContentValidationError(row)) return null;
  const options = storedJson(row.options) as string[];
  const correctAnswers = storedJson(row.correctAnswers) as number[];
  return {
    id: row.id,
    item_id: row.itemId,
    lang: row.lang,
    question: row.question,
    question_type: row.questionType,
    options,
    correct_answers: correctAnswers,
    sort_order: row.sortOrder,
    is_active: row.isActive,
  };
}

export function assertAnswerableQuizSize(count: number): void {
  if (!Number.isInteger(count) || count < 0 || count > MAX_QUIZ_QUESTIONS) {
    throw new AppError(422, 'QUIZ_TOO_LARGE', `A quiz may contain at most ${MAX_QUIZ_QUESTIONS} questions.`);
  }
}

export function dailyAttemptDate(day: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new AppError(422, 'INVALID_UTC_DAY', 'UTC day is invalid.');
  const value = new Date(`${day}T12:00:00.000Z`);
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== day) {
    throw new AppError(422, 'INVALID_UTC_DAY', 'UTC day is invalid.');
  }
  return value;
}

export function dailyStatusFromLatest(
  latest: { score: number; total: number } | null,
  anyPassed: boolean,
): QuizDailyStatusRecord {
  if (!latest) return { attempted_today: false, passed: false, score: 0, total: 0 };
  return { attempted_today: true, passed: anyPassed, score: latest.score, total: latest.total };
}

export function computeQuizDifficulty(questions: QuizQuestionRecord[]): 'Easy' | 'Medium' | 'Hard' {
  if (!questions.length) return 'Easy';
  const average = questions.reduce((sum, question) => sum + (DIFFICULTY_WEIGHTS[question.question_type] ?? 2), 0) / questions.length;
  if (average < 2) return 'Easy';
  if (average <= 3) return 'Medium';
  return 'Hard';
}

export function chooseQuizLanguage(languages: readonly string[], lang: string): string | null {
  if (languages.includes(lang)) return lang;
  if (languages.includes('en')) return 'en';
  return [...languages].sort()[0] ?? null;
}

export function publicQuizQuestion(question: QuizQuestionRecord): QuizPublicQuestion {
  const daily = question as QuizQuestionRecord & { subject?: string; level?: string };
  return {
    ...(daily.subject ? { subject: daily.subject, lang: question.lang, ...(daily.level ? { level: daily.level } : {}) } : {}),
    id: question.id,
    item_id: question.item_id,
    question_type: question.question_type,
    question: question.question,
    options: question.options,
    answer_count: question.correct_answers.length,
    sort_order: question.sort_order,
  };
}

function sameAnswerSet(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort((a, b) => a - b);
  const sortedRight = [...right].sort((a, b) => a - b);
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

export interface GradedQuiz {
  score: number;
  total: number;
  passed: boolean;
  answers: Array<{ question_id: string; chosen_answers: number[]; is_correct: boolean }>;
}

export function gradeQuizAnswers(
  questions: QuizQuestionRecord[],
  submitted: readonly QuizSubmitAnswer[],
  threshold: number,
): GradedQuiz {
  if (!questions.length) throw new AppError(422, 'QUIZ_UNAVAILABLE', 'This quiz is not available.');
  if (!submitted.length) throw new AppError(422, 'INVALID_QUIZ_ANSWERS', 'At least one quiz answer is required.');

  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const seen = new Set<string>();
  for (const answer of submitted) {
    if (seen.has(answer.question_id)) {
      throw new AppError(422, 'INVALID_QUIZ_ANSWERS', 'Each quiz question may be answered only once.');
    }
    seen.add(answer.question_id);
    const question = questionMap.get(answer.question_id);
    if (!question || !question.is_active) {
      throw new AppError(422, 'INVALID_QUIZ_ANSWERS', 'Quiz answers must match the active quiz questions.');
    }
    const chosen = answer.chosen_answers;
    if (!chosen.length || new Set(chosen).size !== chosen.length || chosen.some((index) => index < 0 || index >= question.options.length)) {
      throw new AppError(422, 'INVALID_QUIZ_ANSWERS', 'Quiz answer choices are invalid.');
    }
  }
  if (seen.size !== questionMap.size) {
    throw new AppError(422, 'INVALID_QUIZ_ANSWERS', 'All active quiz questions must be answered exactly once.');
  }

  let score = 0;
  const answers = submitted.map((answer) => {
    const question = questionMap.get(answer.question_id)!;
    const isCorrect = sameAnswerSet(answer.chosen_answers, question.correct_answers);
    if (isCorrect) score += 1;
    return { question_id: answer.question_id, chosen_answers: [...answer.chosen_answers], is_correct: isCorrect };
  });
  const total = questions.length;
  return { score, total, passed: total > 0 && score / total >= threshold, answers };
}
