import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useScrollCheckpoints } from './useScrollCheckpoints';
import { useProfileStore } from '../../stores/profileStore';
import { useFamilyStore } from '../../stores/familyStore';
import { familyQueryKey, familyScopedQuery, isCurrentFamilySession } from '../../lib/familyQueries';
import { markItemDone, checkItemDone } from '../../api/profiles';
import type { BadgeInfo } from '../../types/profile';
import { uiText } from '../../i18n/uiText';

export function useDoneTracking(
  itemId: string,
  hasMedia: boolean,
  containerRef: RefObject<HTMLElement | null>,
  ready = true,
) {
  const profileId = useProfileStore((s) => s.activeProfileId);
  const familyId = useFamilyStore((s) => s.familyId);
  const sessionGeneration = useFamilyStore((s) => s.sessionGeneration);
  const queryClient = useQueryClient();
  const owner = `${sessionGeneration}:${familyId}:${profileId}:${itemId}`;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const mounted = useRef(false);
  const attempted = useRef(false);
  const [quizNudge, setQuizNudge] = useState(false);
  const [timeGate, setTimeGate] = useState(false);
  const [mediaInteracted, setMediaInteracted] = useState(false);
  const [newlyEarnedBadges, setNewlyEarnedBadges] = useState<BadgeInfo[]>([]);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const doneKey = familyQueryKey('progress', familyId, profileId, itemId);
  const { data: alreadyDone, isError: completionReadFailed, refetch } = useQuery({
    queryKey: doneKey,
    queryFn: familyScopedQuery(familyId, () => checkItemDone(profileId!, itemId)),
    enabled: Boolean(familyId && profileId && itemId),
    retry: false,
  });
  const { isCovered } = useScrollCheckpoints(containerRef, ready);
  const scrollGate = alreadyDone === true || isCovered;
  const mediaGate = !hasMedia || mediaInteracted;

  useEffect(() => {
    mounted.current = true;
    attempted.current = false;
    setQuizNudge(false);
    setTimeGate(false);
    setMediaInteracted(false);
    setNewlyEarnedBadges([]);
    setCompletionError(null);
    return () => { mounted.current = false; };
  }, [owner]);

  useEffect(() => { setMediaInteracted(false); }, [hasMedia]);

  useEffect(() => {
    setTimeGate(false);
    if (!ready || alreadyDone !== false) return;
    const timer = setTimeout(() => setTimeGate(true), 15000);
    return () => clearTimeout(timer);
  }, [owner, ready, alreadyDone]);

  const markMediaInteracted = useCallback(() => { setMediaInteracted(true); }, []);
  const retryCompletion = useCallback(() => {
    setCompletionError(null);
    if (completionReadFailed) void refetch();
    else setRetryAttempt((value) => value + 1);
  }, [completionReadFailed, refetch]);

  useEffect(() => {
    if (!ready || attempted.current || !profileId || alreadyDone !== false || !timeGate || !scrollGate || !mediaGate) return;
    // Lock before starting the request, including a quiz-required response.
    attempted.current = true;
    const snapshot = { familyId, sessionGeneration };
    const isActive = () => mounted.current && ownerRef.current === owner
      && isCurrentFamilySession(snapshot) && useProfileStore.getState().activeProfileId === profileId;
    void markItemDone(profileId, itemId).then((response) => {
      if (!isActive()) return;
      if (response.status === 'quiz_required') {
        setQuizNudge(true);
        return;
      }
      queryClient.setQueryData(doneKey, true);
      setQuizNudge(false);
      setNewlyEarnedBadges(response.newly_earned_badges ?? []);
      for (const prefix of ['progress', 'badges', 'achievements']) {
        void queryClient.invalidateQueries({ queryKey: familyQueryKey(prefix, familyId, profileId) });
      }
      void queryClient.invalidateQueries({ queryKey: familyQueryKey('profiles', familyId) });
    }).catch(() => {
      if (!isActive()) return;
      attempted.current = false;
      setCompletionError(uiText('We couldn’t save your progress. Please try again.'));
    });
  }, [owner, ready, timeGate, scrollGate, mediaGate, itemId, profileId, familyId, sessionGeneration, alreadyDone, queryClient, retryAttempt]);

  return {
    isDone: alreadyDone === true,
    quizNudge: alreadyDone !== true && quizNudge,
    gates: { time: timeGate, scroll: scrollGate, media: mediaGate },
    markMediaInteracted,
    newlyEarnedBadges,
    completionError: completionReadFailed ? uiText('We couldn’t check your progress. Please try again.') : completionError,
    completionReadFailed,
    retryCompletion,
  };
}
