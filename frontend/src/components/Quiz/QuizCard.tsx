import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchItemQuiz, fetchItemQuizStatus } from '../../api/quiz';
import { QuizOverlay } from './QuizOverlay';
import { familyQueryKey, familyScopedQuery, isCurrentFamilySession } from '../../lib/familyQueries';
import { useFamilyStore } from '../../stores/familyStore';
import { useProfileStore } from '../../stores/profileStore';
import { getQuizQuestionViewState, getQuizStatusViewState } from './quizCardState';

interface QuizCardProps {
  itemId: string;
  itemTitle: string;
  profileId: string;
  hasQuiz: boolean;
  lang?: string;
}

export function QuizCard({ itemId, itemTitle, profileId, hasQuiz, lang = 'en' }: QuizCardProps) {
  useUiLanguage();
  const [showQuiz, setShowQuiz] = useState(false);
  const queryClient = useQueryClient();
  const familyId = useFamilyStore((state) => state.familyId);
  const sessionGeneration = useFamilyStore((state) => state.sessionGeneration);
  const owner = `${sessionGeneration}:${familyId}:${profileId}:${itemId}`;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    setShowQuiz(false);
    return () => { mounted.current = false; };
  }, [owner]);

  const {
    data: quizData,
    error: quizError,
    isLoading: quizLoading,
    isFetching: quizFetching,
    refetch: refetchQuiz,
  } = useQuery({
    queryKey: ['quiz-questions', familyId, profileId, itemId, lang],
    queryFn: familyScopedQuery(familyId, () => fetchItemQuiz(itemId, lang, profileId)),
    enabled: Boolean(familyId && hasQuiz && showQuiz),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  const {
    data: status,
    isLoading: statusLoading,
    isError: statusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: familyQueryKey('quiz-status', familyId, itemId, profileId),
    queryFn: familyScopedQuery(familyId, () => fetchItemQuizStatus(profileId, itemId)),
    enabled: Boolean(familyId && hasQuiz),
    retry: false,
  });

  if (!hasQuiz) {
    return null;
  }

  const statusView = getQuizStatusViewState(statusLoading, statusError, status);
  const passed = statusView === 'passed';
  const hasAttempt = statusView === 'failed' || statusView === 'passed';
  const quizQuestionView = getQuizQuestionViewState({
    showQuiz,
    isLoading: quizLoading,
    isFetching: quizFetching,
    hasError: Boolean(quizError),
    questionCount: quizData?.questions.length,
  });

  async function handleComplete(_score: number, _total: number, passed: boolean) {
    const isActive = () => mounted.current && ownerRef.current === owner
      && isCurrentFamilySession({ familyId, sessionGeneration })
      && useProfileStore.getState().activeProfileId === profileId;
    if (!isActive()) return;
    const keys = [familyQueryKey('quiz-status', familyId, itemId, profileId)];
    if (passed) {
      for (const prefix of ['progress', 'badges', 'achievements']) keys.push(familyQueryKey(prefix, familyId, profileId));
      keys.push(familyQueryKey('profiles', familyId));
    }
    // Progress is read back from the server, not inferred from the client score.
    // Cancel even an initial GET: invalidation otherwise reuses its stale result.
    await Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey })));
    if (!isActive()) return;
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  }

  // Card state colors
  let cardClass = 'rounded-2xl p-4 border-2 ';
  let ctaText = 'Start Quiz →';
  let statusBadge: ReactNode = null;

  if (statusView === 'loading') {
    cardClass += 'bg-slate-50 border-slate-200';
    ctaText = 'Loading...';
  } else if (statusView === 'error') {
    cardClass += 'bg-rose-50 border-rose-200';
  } else if (!hasAttempt) {
    cardClass +=
      'bg-amber-50 border-amber-300 shadow-[0_0_12px_2px_rgba(251,191,36,0.3)] animate-[pulse_3s_ease-in-out_infinite]';
    ctaText = 'Start Quiz →';
  } else if (passed) {
    cardClass += 'bg-green-50 border-green-300';
    const score = status!.best_score;
    const total = status!.best_total;
    statusBadge = (
      <span className="text-sm font-semibold text-green-700">
        ✅ {score} / {total}
      </span>
    );
    ctaText = 'Retake?';
  } else {
    cardClass += 'bg-orange-50 border-orange-300';
    const score = status!.latest_score;
    const total = status!.latest_total;
    statusBadge = (
      <span className="text-sm font-semibold text-orange-700">
        {score} / {total}
      </span>
    );
    ctaText = 'Try Again!';
  }

  return (
    <>
      <div className={`mt-6 mb-2 ${cardClass}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <span className="font-bold text-gray-800">{uiText("Quiz Time!")}</span>
          </div>
          <div className="flex items-center gap-2">
            {quizData && (
              <>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 text-gray-600 font-medium border border-gray-200">
                  {quizData.difficulty}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 text-gray-600 font-medium border border-gray-200">
                  {quizData.questions.length}Q
                </span>
              </>
            )}
            {statusLoading && <span className="text-xs text-gray-500">{uiText('Loading quiz status...')}</span>}
            {statusBadge}
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-3">{uiText("Test what you learned about this item")}</p>
        {statusError && (
          <div role="alert" className="mb-3 rounded-xl border border-rose-200 bg-white/70 p-3 text-sm text-rose-800">
            <span>{uiText('Could not load quiz status. Please try again.')}</span>{' '}
            <button type="button" className="font-bold underline" onClick={() => void refetchStatus()}>
              {uiText('Try Again!')}
            </button>
          </div>
        )}
        <button
          onClick={() => {
            setShowQuiz(true);
            void refetchQuiz();
          }}
          disabled={statusLoading}
          className={`w-full min-h-[48px] rounded-xl font-bold text-base transition-all active:scale-95 ${
            passed
              ? 'bg-white border border-green-300 text-green-700 text-sm'
              : 'bg-amber-400 text-gray-900'
          }`}
        >
          {uiText(ctaText)}
        </button>
      </div>

      {quizQuestionView === 'loading' && (
        <div role="status" className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
          {uiText('Loading quiz...')}
        </div>
      )}

      {quizQuestionView === 'error' && (
        <div role="alert" className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p>{uiText('Could not load quiz. Please try again.')}</p>
          <button type="button" className="mt-2 font-bold underline" onClick={() => void refetchQuiz()}>
            {uiText('Try Again!')}
          </button>
        </div>
      )}

      {quizQuestionView === 'empty' && (
        <div role="status" className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {uiText('No quiz is available for this item.')}
        </div>
      )}

      {quizQuestionView === 'ready' && quizData && quizData.questions.length > 0 && (
        <QuizOverlay
          quiz={quizData}
          profileId={profileId}
          itemId={itemId}
          itemTitle={itemTitle}
          lang={lang}
          onClose={() => setShowQuiz(false)}
          onComplete={handleComplete}
        />
      )}
    </>
  );
}
