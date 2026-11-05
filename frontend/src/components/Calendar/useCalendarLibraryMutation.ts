import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { calendarQueryKey } from '../../hooks/useCalendar';
import { useFamilyStore } from '../../stores/familyStore';
import { commitCalendarLibraryUpdate, refreshCalendarLibrary } from '../../lib/calendarLibraryCache';
import type { CalendarWindow } from '../../types/calendar';
import { getFamilySessionSnapshot, isCurrentFamilySession } from '../../lib/familyQueries';

interface CommittedFavorite {
  update: (current: CalendarWindow) => CalendarWindow;
  revealId?: string;
}

/** Keep committed rows and refresh feedback inside the open dialog until requests settle. */
export function useCalendarLibraryMutation(profileId: string, onChanged: () => Promise<unknown>, failureMessage: (error: unknown) => string) {
  const client = useQueryClient();
  const familyId = useFamilyStore(state => state.familyId);
  const key = calendarQueryKey(familyId, profileId);
  const mounted = useRef(false), pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reveal, setReveal] = useState({ id: '', token: 0 });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const refresh = async () => {
    try {
      await refreshCalendarLibrary(client, key, onChanged);
      if (mounted.current) setRefreshFailed(false);
    } catch {
      if (mounted.current) setRefreshFailed(true);
    }
  };
  const run = async (action: () => Promise<CommittedFavorite>, onSaved?: () => void) => {
    if (pending.current) return;
    const session = getFamilySessionSnapshot();
    pending.current = true; setBusy(true); setError(''); setSaved(false);
    try {
      const result = await action();
      await commitCalendarLibraryUpdate(client, key, result.update, () => isCurrentFamilySession(session));
      if (!mounted.current || !isCurrentFamilySession(session)) return;
      onSaved?.();
      setSaved(Boolean(result.revealId));
      if (result.revealId) setReveal(current => ({ id: result.revealId ?? '', token: current.token + 1 }));
      await refresh();
    } catch (caught) {
      if (mounted.current) setError(failureMessage(caught));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const retry = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try { await refresh(); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return { busy, error, refreshFailed, saved, setSaved, reveal, run, retry, canClose: () => !pending.current };
}
