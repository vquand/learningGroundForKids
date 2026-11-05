import { uiText } from '../i18n/uiText.ts';
import type { UiLanguage } from './uiLanguage.ts';
import type { EventParticipant, EventParticipantRef, ParticipantRole } from '../types/calendarPeople.ts';
export const PARTICIPANT_ROLE_LABELS: Record<ParticipantRole, string> = {
  dad: 'Dad', mom: 'Mom', paternal_grandpa: 'Paternal grandfather', paternal_grandma: 'Paternal grandmother',
  maternal_grandpa: 'Maternal grandfather', maternal_grandma: 'Maternal grandmother', friend: 'A friend',
};
export const participantKey = (person: EventParticipantRef) => person.kind === 'role' ? `role:${person.key}` : `profile:${person.profile_id}`;
export const participantLabel = (person: EventParticipant, language?: UiLanguage) => person.kind === 'role' ? uiText(PARTICIPANT_ROLE_LABELS[person.key], language) : person.name;
export const participantRefs = (people: readonly EventParticipant[]): EventParticipantRef[] => people.map(person => person.kind === 'role' ? { kind: 'role', key: person.key } : { kind: 'profile', profile_id: person.profile_id });
export function toggleParticipant(people: EventParticipant[], person: EventParticipant): EventParticipant[] {
  return people.some(p => participantKey(p) === participantKey(person)) ? people.filter(p => participantKey(p) !== participantKey(person)) : people.length < 24 ? [...people, person] : people;
}
