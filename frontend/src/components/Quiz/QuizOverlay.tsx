import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { submitDailyQuiz, submitItemQuiz } from "../../api/quiz";
import type { QuizAnswerIn, QuizOut } from "../../types/quiz";
import {
  createQuizSession,
  dailyQuizCompletionMessage,
  mapShuffledAnswerIndices,
} from "../../types/quiz";
import { useTTS } from "../../hooks/useTTS";

interface QuizOverlayProps {
  quiz: QuizOut;
  profileId: string;
  itemId?: string;
  itemTitle: string;
  lang?: string;
  onClose: () => void;
  onComplete: (score: number, total: number, passed: boolean) => void;
}

interface CompletionResult {
  score: number;
  total: number;
  passed: boolean;
}

function starsForScore(score: number, total: number): number {
  if (total === 0) return 1;
  const pct = score / total;
  if (pct >= 1) return 5;
  if (pct >= 0.8) return 4;
  if (pct >= 0.6) return 3;
  if (pct >= 0.4) return 2;
  return 1;
}

export function QuizOverlay({
  quiz,
  profileId,
  itemId,
  itemTitle,
  lang = "en",
  onClose,
  onComplete,
}: QuizOverlayProps) {
  useUiLanguage();
  const answersRef = useRef<QuizAnswerIn[]>([]);
  const selectionLockedRef = useRef(false);
  const isSubmittingRef = useRef(false);

  const [session] = useState(() => createQuizSession(quiz.questions));
  const questions = session.questions;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [completion, setCompletion] = useState<CompletionResult | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const { speak } = useTTS();
  const total = questions.length;

  const submitMutation = useMutation({
    mutationFn: (answers: QuizAnswerIn[]) => {
      if (itemId) return submitItemQuiz(profileId, itemId, { answers });
      return submitDailyQuiz(profileId, { answers });
    },
    onSuccess: (result) => {
      isSubmittingRef.current = false;
      setCompletion({ score: result.score, total: result.total, passed: result.passed });
      onComplete(result.score, result.total, result.passed);
    },
    onError: (error) => {
      isSubmittingRef.current = false;
      setSubmissionError(error instanceof Error ? error.message : "Could not submit quiz.");
    },
  });

  const currentQ = questions[currentIdx];
  if (!currentQ) return null;

  const isMulti = currentQ.question_type === "multi";
  const answerCount = Math.max(1, currentQ.answer_count ?? 1);
  const progress = total > 0 ? (currentIdx / total) * 100 : 0;
  const optionLetters = ["A", "B", "C", "D", "E", "F"];

  function handleReadAloud() {
    const optionText = currentQ!.options
      .map((option, index) => `${optionLetters[index] ?? String(index + 1)}: ${option}`)
      .join(". ");
    speak(`${currentQ!.question}. ${optionText}`, lang);
  }

  function toggleOption(index: number) {
    if (selectionLockedRef.current || isSubmittingRef.current || submissionError) return;
    setSelectedAnswers((previous) => {
      if (previous.includes(index)) return previous.filter((value) => value !== index);
      if (previous.length >= answerCount) return previous;
      return [...previous, index];
    });
  }

  function submitCollectedAnswers() {
    if (isSubmittingRef.current || answersRef.current.length !== total) return;
    isSubmittingRef.current = true;
    setSubmissionError(null);
    submitMutation.mutate(answersRef.current);
  }

  function commitAnswer(shuffledAnswers: number[]) {
    if (selectionLockedRef.current || isSubmittingRef.current) return;
    if (shuffledAnswers.length === 0) return;

    selectionLockedRef.current = true;
    const answer: QuizAnswerIn = {
      question_id: currentQ!.id,
      chosen_answers: mapShuffledAnswerIndices(
        shuffledAnswers,
        currentQ!.shuffledToOriginal,
      ),
    };
    const nextAnswers = [...answersRef.current, answer];
    answersRef.current = nextAnswers;
    setSelectedAnswers([]);

    if (nextAnswers.length === total) {
      isSubmittingRef.current = true;
      setSubmissionError(null);
      submitMutation.mutate(nextAnswers);
      return;
    }

    setCurrentIdx((index) => index + 1);
    selectionLockedRef.current = false;
  }

  function handleSingleSelect(index: number) {
    commitAnswer([index]);
  }

  function retryQuiz() {
    answersRef.current = [];
    selectionLockedRef.current = false;
    isSubmittingRef.current = false;
    setCurrentIdx(0);
    setSelectedAnswers([]);
    setCompletion(null);
    setSubmissionError(null);
    submitMutation.reset();
  }

  function optionStyle(index: number): string {
    const base =
      "w-full min-h-[64px] flex items-center gap-3 px-4 py-3 rounded-2xl text-left font-semibold text-base transition-all active:scale-95 border-2";
    return `${base} ${selectedAnswers.includes(index)
      ? "border-amber-400 bg-amber-50 text-amber-800"
      : "border-gray-200 bg-white text-gray-800"}`;
  }

  if (completion) {
    const stars = starsForScore(completion.score, completion.total);
    return (
      <div className="fixed inset-0 z-[2100] flex flex-col bg-gradient-to-b from-purple-600 to-blue-600">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-6xl mb-4" aria-hidden="true">🎉</p>
          <p className="text-3xl font-bold text-white mb-2">
            {completion.passed ? uiText("Great job!") : uiText("Keep trying!")}
          </p>
          <p className="text-5xl font-bold text-white mt-4 mb-2">
            {completion.score} / {completion.total}
          </p>
          <p className="text-3xl mb-6" aria-label={`${stars} out of 5 stars`}>
            {"⭐".repeat(stars)}{"☆".repeat(5 - stars)}
          </p>
          {!itemId && (
            <p className="text-white/80 text-base mb-6">
              {dailyQuizCompletionMessage(completion.passed)}
            </p>
          )}
          <div className="flex gap-3 mt-2">
            <button
              onClick={onClose}
              className="px-6 py-3 min-h-[56px] bg-white/20 text-white rounded-full font-bold text-base"
            >
              {itemId ? uiText("Back to Item") : uiText("Back to Map")}
            </button>
            {itemId && (
              <button
                onClick={retryQuiz}
                className="px-6 py-3 min-h-[56px] bg-white text-purple-700 rounded-full font-bold text-base"
              >
                {uiText("Try Again")}</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2100] flex flex-col bg-gray-50">
      <div className="h-14 bg-black/60 backdrop-blur-sm flex items-center px-4 gap-3 shrink-0">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center shrink-0"
          aria-label={uiText("Close quiz")}
        >
          &#x2715;
        </button>
        <span className="flex-1 text-white font-semibold text-sm truncate">
          {itemId ? `${itemTitle} Quiz` : uiText("Daily Quiz")}
        </span>
        <span className="text-white/70 text-sm shrink-0">
          {currentIdx + 1} / {total}
        </span>
      </div>

      <div className="h-1 bg-gray-200 shrink-0">
        <div
          className="h-full bg-amber-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="flex items-start gap-2 mb-6">
          <p className="text-2xl font-bold text-gray-800 flex-1 leading-snug">
            {currentQ.question}
          </p>
          {!submissionError && (
            <button
              onClick={handleReadAloud}
              className="w-10 h-10 shrink-0 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-lg"
              aria-label={uiText("Read question aloud")}
            >
              🔊
            </button>
          )}
        </div>

        {submissionError && (
          <div role="alert" className="mb-4 px-4 py-3 rounded-2xl bg-red-100 text-red-700 text-center">
            <p className="font-semibold">{submissionError}</p>
            <button
              onClick={submitCollectedAnswers}
              className="mt-3 min-h-[44px] px-4 rounded-xl bg-red-700 text-white font-bold"
            >
              {uiText("Retry submission")}</button>
          </div>
        )}

        {isMulti && !submissionError && (
          <p className="text-sm text-gray-500 mb-3">
            {uiText("Select")}{answerCount} {uiText(" answers (")}{selectedAnswers.length}/{answerCount})
          </p>
        )}

        <div className="space-y-3">
          {currentQ.options.map((option, index) => (
            <button
              key={`${currentQ.id}-${index}`}
              className={optionStyle(index)}
              onClick={() => (isMulti ? toggleOption(index) : handleSingleSelect(index))}
              disabled={Boolean(submissionError) || isSubmittingRef.current}
              aria-pressed={selectedAnswers.includes(index)}
            >
              <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center shrink-0">
                {optionLetters[index] ?? String(index + 1)}
              </span>
              <span className="text-xl leading-snug">{option}</span>
            </button>
          ))}
        </div>

        {isMulti && !submissionError && (
          <button
            onClick={() => commitAnswer(selectedAnswers)}
            disabled={selectedAnswers.length !== answerCount || isSubmittingRef.current}
            className={`mt-6 w-full min-h-[56px] rounded-2xl font-bold text-base transition-all ${
              selectedAnswers.length === answerCount
                ? "bg-amber-400 text-gray-900 active:scale-95"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {uiText("Confirm (")}{selectedAnswers.length}/{answerCount})
          </button>
        )}
      </div>
    </div>
  );
}
