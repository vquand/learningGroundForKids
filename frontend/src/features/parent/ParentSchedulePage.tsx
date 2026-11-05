import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParentRequests } from '../../hooks/useParentRequests';
import { applyParentSchedule, fetchParentSchedule, setParentScheduleEnabled, type ParentScheduleKid, type ScheduleSlot } from '../../api/schedule';
import { familyQueryKey } from '../../lib/familyQueries';
import { useFamilyStore } from '../../stores/familyStore';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiMessage, uiText } from '../../i18n/uiText';
import './parentSchedule.css';

const FIRST_HOUR = 6, LAST_HOUR = 22, STEP = 30;
const ROWS = ((LAST_HOUR - FIRST_HOUR) * 60) / STEP;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PALETTE = ['#6366f1', '#f97316', '#10b981', '#ec4899', '#0ea5e9', '#a16207', '#7c3aed', '#14b8a6'];

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60), m = total % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
const cellKey = (day: number, row: number) => `${day}:${row}`;
const rowStart = (row: number) => FIRST_HOUR * 60 + row * STEP;

function cellsToSlots(cells: Set<string>): ScheduleSlot[] {
  const slots: ScheduleSlot[] = [];
  for (let day = 0; day < 7; day++) {
    let start = -1;
    for (let row = 0; row <= ROWS; row++) {
      const on = row < ROWS && cells.has(cellKey(day, row));
      if (on && start < 0) start = row;
      if (!on && start >= 0) { slots.push({ weekday: day + 1, start_minute: rowStart(start), end_minute: rowStart(row) }); start = -1; }
    }
  }
  return slots;
}
function slotCovers(slots: ScheduleSlot[], day: number, row: number): boolean {
  const minute = rowStart(row);
  return slots.some(slot => slot.weekday === day + 1 && slot.start_minute <= minute && minute < slot.end_minute);
}
function slotsToCells(slots: ScheduleSlot[]): Set<string> {
  const cells = new Set<string>();
  for (let day = 0; day < 7; day++) for (let row = 0; row < ROWS; row++) if (slotCovers(slots, day, row)) cells.add(cellKey(day, row));
  return cells;
}

export function ParentSchedulePage() {
  useUiLanguage();
  const queryClient = useQueryClient();
  const familyId = useFamilyStore(state => state.familyId);
  const key = familyQueryKey('parent-schedule', familyId);
  const query = useQuery({ queryKey: key, queryFn: fetchParentSchedule, enabled: !!familyId, retry: false });
  const kids = query.data?.kids ?? [];
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const paint = useRef<'add' | 'remove' | null>(null);
  const colors = useMemo(() => new Map(kids.map((kid, index) => [kid.profile_id, PALETTE[index % PALETTE.length]!])), [kids]);
  const chosen = kids.filter(kid => selected.includes(kid.profile_id));
  const blocked = chosen.some(kid => !kid.enabled);
  const refresh = (data: { kids: ParentScheduleKid[] }) => { queryClient.setQueryData(key, data); setError(''); };
  const fail = (caught: unknown) => { setError(caught instanceof Error ? caught.message : uiText('Something went wrong. Please try again.')); void queryClient.invalidateQueries({ queryKey: key }); };
  const requests = useParentRequests();
  const [pending, setPending] = useState(false);
  // Parent callbacks are discarded on lock or expiry, so protected data is never written back afterwards.
  const mutate = (request: () => Promise<{ kids: ParentScheduleKid[] }>, done?: () => void) => void requests.run(request, {
    start: () => setPending(true), success: data => { refresh(data); done?.(); }, error: caught => { setConfirming(false); fail(caught); }, finish: () => setPending(false),
  });
  const toggle = { isPending: pending, mutate: (kid: ParentScheduleKid) => mutate(() => setParentScheduleEnabled(kid.profile_id, !kid.enabled, kid.revision)) };
  const apply = { isPending: pending, mutate: (mode: 'replace' | 'add') => mutate(
    () => applyParentSchedule({ mode, slots: cellsToSlots(draft), targets: chosen.map(kid => ({ profile_id: kid.profile_id, expected_revision: kid.revision })) }),
    () => { setConfirming(false); setDraft(new Set()); }) };
  const grid = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<[number, number]>([0, 0]);
  function moveFocus(day: number, row: number) {
    const next: [number, number] = [Math.min(6, Math.max(0, day)), Math.min(ROWS - 1, Math.max(0, row))];
    setFocus(next);
    grid.current?.querySelector<HTMLElement>(`[data-cell="${cellKey(next[0], next[1])}"]`)?.focus();
  }
  function keyDown(event: React.KeyboardEvent) {
    const [day, row] = focus;
    const moves: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    if (moves[event.key]) { event.preventDefault(); moveFocus(day + moves[event.key]![0], row + moves[event.key]![1]); }
    else if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      setDraft(current => { const next = new Set(current), id = cellKey(day, row); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    }
  }

  function press(day: number, row: number) {
    const id = cellKey(day, row);
    paint.current = draft.has(id) ? 'remove' : 'add';
    setDraft(current => { const next = new Set(current); if (paint.current === 'add') next.add(id); else next.delete(id); return next; });
  }
  function enter(day: number, row: number) {
    if (!paint.current) return;
    const id = cellKey(day, row), mode = paint.current;
    setDraft(current => { const next = new Set(current); if (mode === 'add') next.add(id); else next.delete(id); return next; });
  }
  const laneKids = chosen.length > 0 ? chosen : [];
  const draftMinutes = draft.size * STEP;

  return <div className="schedule-page" onPointerUp={() => { paint.current = null; }} onPointerLeave={() => { paint.current = null; }}>
    <header className="schedule-heading">
      <div><h1>{uiText('Adventure schedule')}</h1>
        <p>{uiText('Choose when each child may play. Outside these times they can only see their calendar. Without the schedule on, there are no limits.')}</p></div>
    </header>
    {error && <p className="schedule-error" role="alert">{error}</p>}
    {query.isLoading && <p>{uiText('Loading…')}</p>}
    <div className="schedule-body">
      <section className="parent-panel schedule-kids" aria-label={uiText('Children')}>
        <h2>{uiText('Children')}</h2>
        <p className="schedule-hint">{uiText('Select a child or several children here to apply the new schedule.')}</p>
        {kids.length === 0 && !query.isLoading && <p>{uiText('Add a child first.')}</p>}
        {kids.map(kid => {
          const on = selected.includes(kid.profile_id), color = colors.get(kid.profile_id)!;
          return <div key={kid.profile_id} className={`schedule-kid${on ? ' is-selected' : ''}`} style={{ borderColor: on ? color : undefined }}>
            <button type="button" className="schedule-kid-main" aria-pressed={on} onClick={() => setSelected(current => on ? current.filter(id => id !== kid.profile_id) : [...current, kid.profile_id])}>
              <span className="schedule-dot" style={{ background: color }} aria-hidden="true" />
              <span><strong>{kid.emoji} {kid.name}</strong>
                <small>{kid.enabled ? uiMessage('Max {time} / week', { time: formatMinutes(kid.weekly_minutes) }) : uiText('Schedule off · no limits')}</small>
                {kid.enabled && <small className="schedule-days">{DAYS.map((day, index) => `${uiText(day)} ${formatMinutes(kid.daily_minutes[index] ?? 0)}`).join(' · ')}</small>}
              </span>
            </button>
            <button type="button" className="parent-button parent-button-quiet" disabled={toggle.isPending} onClick={() => toggle.mutate(kid)}>
              {kid.enabled ? uiText('Turn off') : uiText('Turn on')}</button>
          </div>;
        })}
        {chosen.flatMap(kid => kid.timezone_events.slice(0, 1).map(event => <p key={kid.profile_id} className="schedule-note">
          {uiMessage('{name}’s time zone changed from {from} to {to}.', { name: kid.name, from: event.from_timezone ?? '—', to: event.to_timezone })}</p>))}
      </section>

      <section className="parent-panel schedule-calendar" aria-label={uiText('Week')}>
        <div className="schedule-toolbar">
          <h2>{uiText('Week')}</h2>
          <span className="schedule-hint">{uiText('Drag across the grid to paint time slots for the pattern you want to apply. Amber outline: children overlap.')}</span>
        </div>
        <div className="schedule-grid" ref={grid} onKeyDown={keyDown} role="grid" aria-label={uiText('Weekly time slots')} aria-describedby="schedule-keys" style={{ ['--rows' as string]: ROWS }}>
          <div className="schedule-corner" />
          {DAYS.map(day => <div key={day} className="schedule-day-head">{uiText(day)}</div>)}
          {Array.from({ length: ROWS }, (_, row) => <FragmentRow key={row} row={row} lanes={laneKids} colors={colors} draft={draft} focus={focus} onFocus={(d, r) => setFocus([d, r])} onPress={press} onEnter={enter} />)}
        </div>
        <p id="schedule-keys" className="schedule-hint">{uiText('Keyboard: arrow keys move between times, Space selects or clears a time.')}</p>
        <div className="schedule-actions">
          <button type="button" className="parent-button parent-button-quiet" disabled={chosen.length === 0} onClick={() => setDraft(slotsToCells(chosen[0]!.slots))}>
            {uiText('Copy first selected child into pattern')}</button>
          <button type="button" className="parent-button parent-button-quiet" disabled={draft.size === 0} onClick={() => setDraft(new Set())}>{uiText('Clear pattern')}</button>
          <span className="schedule-hint">{uiMessage('Pattern: {time} per week', { time: formatMinutes(draftMinutes) })}</span>
          <button type="button" className="parent-button" disabled={chosen.length === 0 || blocked || apply.isPending} onClick={() => setConfirming(true)}>
            {uiText('Apply pattern to selected children')}</button>
        </div>
        {blocked && <p className="schedule-note">{uiText('Turn the schedule on for every selected child before applying.')}</p>}
        {chosen.length > 0 && <ul className="schedule-legend" aria-label={uiText('Legend')}>{chosen.map(kid => <li key={kid.profile_id}>
          <span className="schedule-dot" style={{ background: colors.get(kid.profile_id) }} aria-hidden="true" />{kid.name}: {kid.enabled ? uiMessage('{time} / week', { time: formatMinutes(kid.weekly_minutes) }) : uiText('no limits')}</li>)}</ul>}
      </section>
    </div>
    {confirming && <div className="schedule-dialog-backdrop"><div className="schedule-dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-apply-title">
      <h2 id="schedule-apply-title">{uiText('Apply this pattern')}</h2>
      {draft.size === 0 && <p className="schedule-note">{uiText('The pattern is empty. Replacing keeps the schedule on but allows no adventure time at all.')}</p>}
      <p className="schedule-hint">{uiText('Times outside 06:00–22:00 are not shown here. Replace removes them; Add keeps them.')}</p>
      <p>{uiMessage('{count} child(ren): {names}. Replace their schedule, or add these times to it?', { count: chosen.length, names: chosen.map(kid => kid.name).join(', ') })}</p>
      <div className="schedule-dialog-actions">
        <button type="button" className="parent-button" disabled={apply.isPending} onClick={() => apply.mutate('replace')}>{uiText('Replace schedule')}</button>
        <button type="button" className="parent-button" disabled={apply.isPending || draft.size === 0} onClick={() => apply.mutate('add')}>{uiText('Add to schedule')}</button>
        <button type="button" className="parent-button parent-button-quiet" disabled={apply.isPending} onClick={() => setConfirming(false)}>{uiText('Cancel')}</button>
      </div></div></div>}
  </div>;
}

function FragmentRow({ row, lanes, colors, draft, focus, onFocus, onPress, onEnter }: {
  row: number; lanes: ParentScheduleKid[]; colors: Map<string, string>; draft: Set<string>; focus: [number, number]; onFocus: (day: number, row: number) => void;
  onPress: (day: number, row: number) => void; onEnter: (day: number, row: number) => void;
}) {
  const minute = rowStart(row);
  return <>
    <div className="schedule-time">{minute % 60 === 0 ? `${String(minute / 60).padStart(2, '0')}:00` : ''}</div>
    {DAYS.map((_, day) => {
      const active = lanes.filter(kid => kid.enabled && slotCovers(kid.slots, day, row));
      const isFocus = focus[0] === day && focus[1] === row;
      return <div key={day} role="gridcell" data-cell={cellKey(day, row)} tabIndex={isFocus ? 0 : -1} aria-selected={draft.has(cellKey(day, row))}
        aria-label={`${uiText(DAYS[day]!)} ${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`}
        onFocus={() => onFocus(day, row)} className={`schedule-cell${draft.has(cellKey(day, row)) ? ' is-draft' : ''}${active.length > 1 ? ' is-overlap' : ''}`}
        onPointerDown={event => { event.preventDefault(); (event.target as Element).releasePointerCapture?.(event.pointerId); onPress(day, row); }} onPointerEnter={() => onEnter(day, row)}>
        {lanes.map(kid => <i key={kid.profile_id} style={{ background: active.includes(kid) ? colors.get(kid.profile_id) : 'transparent' }} />)}
      </div>;
    })}
  </>;
}
