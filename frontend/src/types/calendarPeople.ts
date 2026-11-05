export const RELATIVE_ROLES = ['dad', 'mom', 'paternal_grandpa', 'paternal_grandma', 'maternal_grandpa', 'maternal_grandma'] as const;
export type RelativeRole = typeof RELATIVE_ROLES[number];
export type ParticipantRole = RelativeRole | 'friend';
export type EventParticipantRef = { kind: 'role'; key: ParticipantRole } | { kind: 'profile'; profile_id: string };
export type EventParticipant = Extract<EventParticipantRef, { kind: 'role' }> | { kind: 'profile'; profile_id: string; name: string };
export interface CalendarPeopleSettings { disabled_roles: RelativeRole[]; revision: number }
export interface ParticipantCandidates { roles: ParticipantRole[]; profiles: { profile_id: string; name: string; source: 'family' | 'friend' }[]; has_more: boolean }
