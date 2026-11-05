import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText } from '../i18n/uiText';
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useItem } from '../hooks/useItems';
import { AppShell } from '../components/Layout/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { CATEGORY_REGISTRY } from '../components/ItemDetail/CategoryRegistry';
import { DetailPageShell } from '../components/ItemDetail/DetailPageShell';
import { LanguageToggle } from '../components/ItemDetail/LanguageToggle';
import { ItemCompletionMedal } from '../components/DoneTracking/ItemCompletionMedal';
import { useDoneTracking } from '../components/DoneTracking/useDoneTracking';
import { BadgeCelebration } from '../components/Badges/BadgeCelebration';
import { FlashcardStudyHub } from '../components/Flashcards/FlashcardStudyHub';
import { QuizCard } from '../components/Quiz/QuizCard';
import { useProfileStore } from '../stores/profileStore';
import { useFamilyStore } from '../stores/familyStore';
import type { BadgeInfo } from '../types/profile';

export function ItemDetailPage() {
  useUiLanguage();
  const { id } = useParams<{ id: string }>();
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const familyId = useFamilyStore((s) => s.familyId);
  const generation = useFamilyStore((s) => s.sessionGeneration);
  // Timers, media interaction, and completion state belong to one item/profile.
  return <ItemDetailContent key={`${generation}:${familyId}:${activeProfileId}:${id}`} />;
}

// This effect commits only after the lazy category has actually rendered.
function ReadyContent({ children, onReady }: { children: ReactNode; onReady: (ready: boolean) => void }) {
  useUiLanguage();
  useEffect(() => { onReady(true); return () => onReady(false); }, [onReady]);
  return <>{children}</>;
}

function ItemDetailContent() {
  useUiLanguage();
  const { id } = useParams<{ id: string }>();
  const [lang, setLang] = useState<string>('en');
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const { data, isLoading, error } = useItem(id ?? '', lang);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentReady, setContentReady] = useState(false);
  const onReady = useCallback((ready: boolean) => setContentReady(ready), []);

  const hasMedia = data
    ? !!(data.youtube_url || (data.audio_urls && data.audio_urls.length > 0))
    : false;
  const { isDone, quizNudge, markMediaInteracted, newlyEarnedBadges, completionError, completionReadFailed, retryCompletion } = useDoneTracking(
    id ?? '',
    hasMedia,
    containerRef,
    Boolean(data && contentReady),
  );

  const [celebratingBadge, setCelebratingBadge] = useState<BadgeInfo | null>(null);

  useEffect(() => {
    if (newlyEarnedBadges.length > 0) {
      setCelebratingBadge(newlyEarnedBadges[0] ?? null);
    }
  }, [newlyEarnedBadges]);

  return (
    <AppShell>
      <div ref={containerRef} className="h-full overflow-y-auto">
        {isLoading && (
          <div className="max-w-2xl mx-auto px-4 pb-8 pt-4">
            <div className="animate-pulse">
              <div className="w-16 h-16 rounded-full bg-gray-200 mb-4" />
              <div className="h-48 bg-gray-200 rounded-2xl mb-4" />
              <div className="h-8 bg-gray-200 rounded-lg w-3/4 mb-3" />
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-5/6" />
                <div className="h-4 bg-gray-200 rounded w-4/5" />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="p-4">
            <p className="text-red-500">
              {uiText("Error:")}{error instanceof Error ? error.message : uiText("Unknown error")}
            </p>
          </div>
        )}
        {data && (() => {
          const config = CATEGORY_REGISTRY[data.category];
          if (!config) {
            return (
              <ReadyContent key={lang} onReady={onReady}><div className="max-w-2xl mx-auto px-4 pb-8" data-checkpoint="description">
                <h1 className="text-3xl font-bold mt-4 mb-2">
                  {data.translation?.title ?? uiText("Untitled")}
                </h1>
                {data.translation?.description && (
                  <p className="text-lg leading-relaxed">
                    {data.translation.description}
                  </p>
                )}
              </div></ReadyContent>
            );
          }
          const CategoryComponent = config.component;
          return (
            <DetailPageShell
              item={data}
              langToggle={
                <LanguageToggle
                  available={data.available_languages}
                  current={lang}
                  onChange={setLang}
                />
              }
              doneBadge={<ItemCompletionMedal isDone={isDone} />}
            >
              <ErrorBoundary>
                <Suspense fallback={
                  <div className="animate-pulse space-y-4 px-4">
                    <div className="h-4 bg-gray-200 rounded w-full" />
                    <div className="h-4 bg-gray-200 rounded w-5/6" />
                    <div className="h-4 bg-gray-200 rounded w-4/5" />
                    <div className="h-32 bg-gray-200 rounded-2xl" />
                  </div>
                }>
                  <ReadyContent key={lang} onReady={onReady}>
                    <CategoryComponent item={data} onMediaInteract={markMediaInteracted} />
                  </ReadyContent>
                </Suspense>
              </ErrorBoundary>
              {completionError && !isDone && (
                <div role="alert" className="mx-4 mt-4 rounded-xl bg-red-50 p-3 text-red-700">
                  <p>{completionError}</p>
                  <button type="button" onClick={retryCompletion} className="mt-2 min-h-11 font-semibold underline">{completionReadFailed ? uiText("Try checking again") : uiText("Try saving again")}</button>
                </div>
              )}
              {quizNudge && (
                <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                  <span className="text-xl">🎯</span>
                  <span className="text-sm font-semibold text-amber-800">{uiText("Quiz time! Pass the quiz below to complete this item.")}</span>
                </div>
              )}
              {activeProfileId && id && (
                <FlashcardStudyHub
                  itemId={id}
                  item={data}
                  lang={lang}
                  profileId={activeProfileId}
                />
              )}
              {activeProfileId && id && (
                <QuizCard
                  itemId={id}
                  itemTitle={data.translation?.title ?? uiText("Untitled")}
                  profileId={activeProfileId}
                  hasQuiz={data.has_quiz === true}
                  lang={lang}
                />
              )}
            </DetailPageShell>
          );
        })()}
      </div>
      <BadgeCelebration
        badge={celebratingBadge}
        onDismiss={() => setCelebratingBadge(null)}
      />
    </AppShell>
  );
}
