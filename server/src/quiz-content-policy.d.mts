export const PLACEHOLDER_QUIZ_PATTERN: string;
export function isPlaceholderQuizQuestion(question: unknown): boolean;
export function reviewedQuizQuestions<T extends { question: unknown; seed_index?: number }>(questions: readonly T[]): T[];
