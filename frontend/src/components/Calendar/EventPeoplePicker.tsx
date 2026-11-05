import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCalendarParticipants } from '../../api/calendarPeople';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { participantKey, participantLabel, toggleParticipant } from '../../lib/calendarPeople';
import { useFamilyStore } from '../../stores/familyStore';
import type { EventParticipant } from '../../types/calendarPeople';
import { CalendarChoiceChip } from './CalendarControls';
import { CalendarScrollPanel } from './CalendarScrollPanel';

interface Props {
  profileId: string;
  value: EventParticipant[];
  onChange: (people: EventParticipant[]) => void;
  disabled: boolean;
}

/** People are part of the event draft. Friends expand into an inline, live-searchable list. */
export function EventPeoplePicker({ profileId, value, onChange, disabled }: Props) {
  const language = useUiLanguage();
  const familyId = useFamilyStore(state => state.familyId);
  const friendsId = useId();
  const [showFriends, setShowFriends] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [search]);
  const candidates = useQuery({
    queryKey: familyQueryKey('calendar-participants', familyId, profileId, ''),
    queryFn: ({ signal }) => familyScopedQuery(familyId, () => fetchCalendarParticipants(profileId, '', signal))(),
    enabled: Boolean(familyId), retry: false, staleTime: 0,
  });
  const searchResults = useQuery({
    queryKey: familyQueryKey('calendar-participants', familyId, profileId, query),
    queryFn: ({ signal }) => familyScopedQuery(familyId, () => fetchCalendarParticipants(profileId, query, signal))(),
    enabled: Boolean(familyId) && showFriends && Boolean(query), retry: false, staleTime: 0,
  });
  const friends = query ? searchResults : candidates;
  const choices = new Map<string, EventParticipant>();
  for (const key of candidates.data?.roles ?? []) choices.set(`role:${key}`, { kind: 'role', key });
  // Keep saved people visible and removable even after a parent hides their role.
  for (const person of value) choices.set(participantKey(person), person);
  const chip = (person: EventParticipant) => {
    const selected = value.some(other => participantKey(other) === participantKey(person));
    return <CalendarChoiceChip key={participantKey(person)} aria-pressed={selected}
      disabled={disabled || (!selected && value.length >= 24)} onClick={() => onChange(toggleParticipant(value, person))}>
      {participantLabel(person, language)}
    </CalendarChoiceChip>;
  };
  return <section className="events-people-picker" aria-label={uiText('Participant(s)')}
    onKeyDown={event => {
      if (event.key === 'Escape' && showFriends) { event.stopPropagation(); setShowFriends(false); }
    }}>
    <h3>{uiText('Participant(s)')}</h3>
    <div className="events-people-options" role="group" aria-label={uiText('Choose people')}>
      {[...choices.values()].map(chip)}
      <CalendarChoiceChip aria-pressed={showFriends} aria-expanded={showFriends} aria-controls={showFriends ? friendsId : undefined}
        disabled={disabled} onClick={() => setShowFriends(current => !current)}>{uiText('Friends')}</CalendarChoiceChip>
    </div>
    {candidates.isPending && <p className="events-note" role="status">{uiText('Loading people…')}</p>}
    {candidates.isError && <p className="events-note" role="alert">{uiText('Could not load people. Please try again.')} <button type="button" className="calendar-library-button" onClick={() => void candidates.refetch()}>{uiText('Retry')}</button></p>}
    {showFriends && <div id={friendsId} className="events-people-friends">
      <label className="calendar-field">{uiText('Find a child by name')}
        <input type="search" maxLength={64} disabled={disabled} value={search} onChange={event => setSearch(event.currentTarget.value)} />
      </label>
      <CalendarScrollPanel label={uiText('Children in your family and friends')} resetKey={query}>
        <div className="events-friend-choices">
          {friends.isPending && <p role="status">{uiText('Loading people…')}</p>}
          {friends.isError && <p role="alert">{uiText('Could not load people. Please try again.')} <button type="button" className="calendar-library-button" onClick={() => void friends.refetch()}>{uiText('Retry')}</button></p>}
          {friends.data?.profiles.map(person => chip({ kind: 'profile', profile_id: person.profile_id, name: person.name }))}
          {friends.data && !friends.data.profiles.length && <p>{uiText('No children found.')}</p>}
          {friends.data?.has_more && <p>{uiText('Search by name to find more children.')}</p>}
        </div>
      </CalendarScrollPanel>
    </div>}
    {value.length >= 24 && <p className="events-note" role="status">{uiText('You can select up to 24 people.')}</p>}
  </section>;
}
