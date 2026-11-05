import { coreRequest } from './core.ts';

export interface ScheduleSlot { weekday: number; start_minute: number; end_minute: number }
export interface ScheduleStatus {
  enabled: boolean; locked: boolean; next_open_at: string | null; ends_at: string | null;
  warning_seconds: number; server_now: string;
}
export interface ParentScheduleKid {
  profile_id: string; name: string; emoji: string; color: string; enabled: boolean; revision: number;
  timezone: string | null; slots: ScheduleSlot[]; weekly_minutes: number; daily_minutes: number[];
  timezone_events: { from_timezone: string | null; to_timezone: string; at: string }[];
}

export const fetchScheduleStatus = (profileId: string) =>
  coreRequest<ScheduleStatus>(`/api/v1/profiles/${encodeURIComponent(profileId)}/schedule/status`);
export const fetchParentSchedule = () => coreRequest<{ kids: ParentScheduleKid[] }>('/api/v1/parent/schedule');
export const applyParentSchedule = (body: { mode: 'replace' | 'add'; slots: ScheduleSlot[]; targets: { profile_id: string; expected_revision: number }[] }) =>
  coreRequest<{ kids: ParentScheduleKid[] }>('/api/v1/parent/schedule/apply', { method: 'POST', body: JSON.stringify(body) });
export const setParentScheduleEnabled = (profileId: string, enabled: boolean, expectedRevision: number) =>
  coreRequest<{ kids: ParentScheduleKid[] }>(`/api/v1/parent/schedule/kids/${encodeURIComponent(profileId)}/enabled`,
    { method: 'PUT', body: JSON.stringify({ enabled, expected_revision: expectedRevision }) });
