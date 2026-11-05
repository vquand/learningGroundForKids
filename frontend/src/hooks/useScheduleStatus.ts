import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchScheduleStatus } from '../api/schedule';
import { familyQueryKey, familyScopedQuery } from '../lib/familyQueries';
import { useFamilyStore } from '../stores/familyStore';
import { useProfileStore } from '../stores/profileStore';

export function scheduleStatusKey(familyId: string | null, profileId: string | null) {
  return familyQueryKey('schedule-status', familyId, profileId);
}

/** Server-owned lock state for the active child. Countdown uses the server clock offset, never the device clock alone. */
export function useScheduleStatus() {
  const familyId = useFamilyStore(state => state.familyId);
  const profileId = useProfileStore(state => state.activeProfileId);
  const query = useQuery({
    queryKey: scheduleStatusKey(familyId, profileId),
    queryFn: familyScopedQuery(familyId, () => fetchScheduleStatus(profileId!)),
    enabled: Boolean(familyId && profileId), refetchInterval: 30_000, retry: false,
  });
  const status = query.data;
  const [now, setNow] = useState(Date.now());
  const fetchedAt = query.dataUpdatedAt;
  const { refetch } = query;
  // A request answered 423 means the lock began; ask the server right away.
  useEffect(() => {
    const onLocked = () => { void refetch(); };
    window.addEventListener('plg:adventure-locked', onLocked);
    return () => window.removeEventListener('plg:adventure-locked', onLocked);
  }, [refetch]);
  const timed = Boolean(status?.enabled && ((status.ends_at && !status.locked) || (status.locked && status.next_open_at)));
  useEffect(() => {
    if (!timed) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timed]);
  const serverNow = status ? Date.parse(status.server_now) + (Math.max(now, fetchedAt) - fetchedAt) : 0;
  const secondsLeft = status?.ends_at && !status.locked ? Math.max(0, Math.round((Date.parse(status.ends_at) - serverNow) / 1000)) : null;
  const lastRefetch = useRef(0);
  useEffect(() => {
    if (Date.now() - lastRefetch.current < 5000) return;
    if (status?.enabled && ((secondsLeft === 0) || (status.locked && status.next_open_at && serverNow >= Date.parse(status.next_open_at)))) { lastRefetch.current = Date.now(); void refetch(); }
  }, [secondsLeft, serverNow, status, refetch]);
  return {
    status, locked: status?.enabled === true && status.locked, secondsLeft,
    warning: secondsLeft !== null && status !== undefined && secondsLeft <= status.warning_seconds,
  };
}
