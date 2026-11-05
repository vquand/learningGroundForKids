import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { actFishing, fetchFishing, type FishingCommand, type FishingState } from '../../api/fishing';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { useSessionRequests } from '../../hooks/useSessionRequests';
import { useFamilyStore } from '../../stores/familyStore';

/** Render alone grades answers and awards catches. Failed commands require a fresh read. */
export function useFishingSession(profileId: string) {
  const familyId = useFamilyStore(s => s.familyId), generation = useFamilyStore(s => s.sessionGeneration);
  const queryClient = useQueryClient();
  const queryKey = familyQueryKey('fishing', familyId, generation, profileId);
  const requests = useSessionRequests(profileId);
  const [rewardReceipt, setRewardReceipt] = useState<{ event: string; reward: { stamina: number } }>({ event: '', reward: { stamina: 0 } });
  const [busy, setBusy] = useState(false), [error, setError] = useState(false), [halted, setHalted] = useState(true);
  const haltedRef = useRef(true), pendingPause = useRef(false), pauseVersion = useRef(0), remote = useRef<FishingState | null>(null);
  const failed = useRef(false), queue = useRef<Promise<unknown>>(Promise.resolve()), heartbeatPending = useRef(false), userPending = useRef(false);
  const query = useQuery({ queryKey, queryFn: familyScopedQuery(familyId, () => fetchFishing(profileId)), enabled: Boolean(familyId && profileId), retry: false, refetchOnWindowFocus: false, staleTime: 0 });
  remote.current = query.data ?? null;
  const halt = useCallback(() => { pauseVersion.current++; haltedRef.current = true; setHalted(true); pendingPause.current = true; }, []);
  async function send(command: FishingCommand): Promise<FishingState | null> {
    // User input waits for an in-flight heartbeat instead of being dropped. All
    // commands read the latest committed revision when they reach the queue.
    const heartbeat = command.type === 'tick', userCommand = !heartbeat && command.type !== 'pause';
    if (userCommand && userPending.current) return null;
    if (userCommand) userPending.current = true;
    if (heartbeat && heartbeatPending.current) return null;
    if (heartbeat) heartbeatPending.current = true;
    const operation = queue.current.then(async () => {
      if (!remote.current || failed.current || (heartbeat && haltedRef.current)) return null;
      let result: FishingState | null = null;
      await requests.run(() => actFishing(profileId, remote.current!.revision, command), {
      start: () => { if (!heartbeat) setBusy(true); },
      success: value => {
        const previous = remote.current;
        result = value; remote.current = value; queryClient.setQueryData(queryKey, value);
        if (previous?.cast?.phase === 'waiting' && value.cast?.phase === 'result' && (value.cast.stamina ?? 0) > 0) {
          setRewardReceipt({ event: value.cast.id, reward: { stamina: value.cast.stamina! } });
          void queryClient.invalidateQueries({ queryKey: familyQueryKey('town', familyId, profileId), refetchType: 'none' });
        }
      },
      error: () => { failed.current = true; halt(); setError(true); },
      finish: () => { if (!heartbeat) setBusy(false); },
      });
      return result;
    });
    queue.current = operation;
    try { return await operation; } finally { if (heartbeat) heartbeatPending.current = false; if (userCommand) userPending.current = false; }
  }
  const sendRef = useRef(send); sendRef.current = send;
  // Pause wins over an in-flight heartbeat. Never resume because a tab gains focus.
  useEffect(() => {
    if (pendingPause.current && !busy && !query.isFetching && query.data?.running && !error) {
      pendingPause.current = false; void sendRef.current({ type: 'pause' });
    }
  }, [busy, halted, query.data, query.isFetching, error]);
  useEffect(() => {
    const pause = () => { halt(); };
    const visibility = () => { if (document.hidden) pause(); };
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', visibility);
    const timer = window.setInterval(() => {
      if (!document.hidden && !haltedRef.current && remote.current?.running) void sendRef.current({ type: 'tick' });
    }, 1000);
    return () => { clearInterval(timer); window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility); haltedRef.current = true; };
  }, [halt]);
  async function activate(type: 'cast' | 'resume') {
    const version = pauseVersion.current;
    pendingPause.current = false;
    const value = await send({ type });
    // A blur/dialog pause during this request must win over its late reply.
    if (value && !document.hidden && version === pauseVersion.current) { pendingPause.current = false; haltedRef.current = false; setHalted(false); }
    else if (value) halt();
  }
  const resume = () => activate('resume'), cast = () => activate('cast');
  async function sync() {
    halt();
    // Keep mutations blocked until the read has installed the committed
    // revision. A lost answer reply may already have consumed its new bait.
    const value = await query.refetch();
    if (!value.isError) { failed.current = false; setError(false); }
  }
  return { rewardReceipt, state: query.data, loading: query.isPending, busy: busy || query.isFetching, error: error || query.isError, halted, halt, resume, cast, send, sync };
}
