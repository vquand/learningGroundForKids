import type { QuizItemStatus } from "../../types/quiz";

export type QuizQuestionViewState = "hidden" | "loading" | "error" | "empty" | "ready";

export function getQuizQuestionViewState(options: {
  showQuiz: boolean;
  isLoading: boolean;
  isFetching: boolean;
  hasError: boolean;
  questionCount: number | undefined;
}): QuizQuestionViewState {
  if (!options.showQuiz) return "hidden";
  if (options.isLoading || options.isFetching) return "loading";
  if (options.hasError) return "error";
  if (options.questionCount === 0) return "empty";
  return options.questionCount === undefined ? "hidden" : "ready";
}

export type QuizStatusViewState = "loading" | "error" | "unstarted" | "passed" | "failed";

export function getQuizStatusViewState(
  statusLoading: boolean,
  statusError: boolean,
  status: QuizItemStatus | undefined,
): QuizStatusViewState {
  if (statusLoading) return "loading";
  if (statusError) return "error";
  if (status?.passed === true) return "passed";
  if (status && status.attempt_count > 0) return "failed";
  return "unstarted";
}
