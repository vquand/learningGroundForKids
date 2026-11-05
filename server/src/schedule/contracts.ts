import { z } from 'zod';
import { SLOT_STEP_MINUTES, type ScheduleSlot } from './lock.js';

export const slotSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  start_minute: z.number().int().min(0).max(1410).refine(value => value % SLOT_STEP_MINUTES === 0),
  end_minute: z.number().int().min(30).max(1440).refine(value => value % SLOT_STEP_MINUTES === 0),
}).strict().refine(slot => slot.start_minute < slot.end_minute);

export const MAX_SLOTS = 7 * 48;
export const applySchema = z.object({
  mode: z.enum(['replace', 'add']),
  slots: z.array(slotSchema).max(MAX_SLOTS),
  targets: z.array(z.object({ profile_id: z.string().min(1).max(64), expected_revision: z.number().int().min(0) }).strict()).min(1).max(20),
}).strict();
export const enabledSchema = z.object({ enabled: z.boolean(), expected_revision: z.number().int().min(0) }).strict();

export interface ParentScheduleKid {
  profile_id: string; name: string; emoji: string; color: string;
  enabled: boolean; revision: number; timezone: string | null;
  slots: ScheduleSlot[]; weekly_minutes: number; daily_minutes: number[];
  timezone_events: { from_timezone: string | null; to_timezone: string; at: string }[];
}
export interface ScheduleContext { enabled: boolean; slots: ScheduleSlot[]; timezone: string }
