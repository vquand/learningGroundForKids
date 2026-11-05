import type { Context } from 'hono';
import type { App } from '../contracts/app.js';
import type { AppDatabase, ProfileRecord } from '../contracts/db.js';
import { AppError } from '../errors.js';
import { parseJson, parsePathId } from '../input.js';
import { applySchema, enabledSchema } from './contracts.js';
import { evaluateLock } from './lock.js';

export const TIMEZONE_HEADER = 'x-device-timezone';
export const LOCK_WARNING_SECONDS = 300;

/** Kid paths that stay usable while locked: calendar, reading the profile, its counts, and schedule status. */
export function isLockExempt(method: string, pathname: string): boolean {
  const match = /^\/api\/v1\/profiles\/[^/]+(\/.*)?$/.exec(pathname);
  if (!match) return true;
  const rest = match[1] ?? '';
  if (rest === '' || rest === '/progress') return method === 'GET';
  if (rest === '/schedule/status') return method === 'GET';
  return rest === '/calendar' || rest.startsWith('/calendar/');
}

/** Returns a 423 AppError when the child is locked; also records the (rate-limited) reported time zone. */
export async function enforceScheduleLock(db: AppDatabase, familyId: string, method: string, pathname: string,
  reportedTimezone: string | null, now: Date, parentOverride: () => Promise<boolean> = async () => false,
  profileIdQuery: string | null = null): Promise<void> {
  if (!db.schedules) return;
  const profileMatch = /^\/api\/v1\/profiles\/([^/]+)/.exec(pathname);
  // Child-facing content endpoints name the child in ?profile_id=; Parent Space reads omit it.
  const contentRead = /^\/api\/v1\/items(\/|$)/.test(pathname) && profileIdQuery !== null;
  const raw = profileMatch ? profileMatch[1]! : contentRead ? profileIdQuery! : null;
  if (raw === null) return;
  let profileId: string;
  try { profileId = profileMatch ? decodeURIComponent(raw) : raw; } catch { return; } // The route's own id validation answers.
  const context = await db.schedules.resolve(familyId, profileId, reportedTimezone, now);
  if (!context || !context.enabled) return;
  const state = evaluateLock(true, context.slots, now, context.timezone);
  if (!state.locked) return;
  // Only Parent Space profile edits or removal skip the lock, and only with a confirmed parent capability.
  // Content reads never skip it, so a parent session left open on a child's device does not unlock play.
  const parentEdit = !contentRead && (method === 'PUT' || method === 'DELETE') && pathname.replace(/\/$/, '') === `/api/v1/profiles/${raw}`;
  if ((profileMatch && isLockExempt(method, pathname)) || (parentEdit && await parentOverride())) return;
  throw new AppError(423, 'ADVENTURE_LOCKED', 'It is not yet time for adventure(s).', { next_open_at: state.next_open_at });
}

export function registerScheduleRoutes(app: App, db: AppDatabase, maxBodyBytes: number,
  owned: (c: Context, db: AppDatabase, id: string) => Promise<ProfileRecord>) {
  app.all('/api/v1/profiles/:profileId/schedule/status', async c => {
    c.header('Cache-Control', 'no-store');
    if (c.req.method !== 'GET') throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    const profileId = parsePathId(c.req.param('profileId'));
    await owned(c, db, profileId);
    const now = new Date();
    const context = db.schedules ? await db.schedules.resolve(c.get('family').id, profileId, null, now) : null;
    const state = evaluateLock(context?.enabled === true, context?.slots ?? [], now, context?.timezone ?? 'UTC');
    return c.json({
      enabled: context?.enabled === true, locked: state.locked, next_open_at: state.next_open_at, ends_at: state.ends_at,
      warning_seconds: LOCK_WARNING_SECONDS, server_now: now.toISOString(),
    });
  });

  const schedules = () => {
    if (!db.schedules) throw new AppError(503, 'SCHEDULE_UNAVAILABLE', 'Schedules are unavailable.');
    return db.schedules;
  };
  app.all('/api/v1/parent/schedule', async c => {
    c.header('Cache-Control', 'no-store');
    if (c.req.method !== 'GET') throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    return c.json({ kids: await schedules().listForFamily(c.get('family').id) });
  });
  app.all('/api/v1/parent/schedule/apply', async c => {
    c.header('Cache-Control', 'no-store');
    if (c.req.method !== 'POST') throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    const input = await parseJson(c.req.raw, applySchema, maxBodyBytes);
    await schedules().apply(c.get('family').id, input.mode, input.slots, input.targets);
    return c.json({ kids: await schedules().listForFamily(c.get('family').id) });
  });
  app.all('/api/v1/parent/schedule/kids/:profileId/enabled', async c => {
    c.header('Cache-Control', 'no-store');
    if (c.req.method !== 'PUT') throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    const input = await parseJson(c.req.raw, enabledSchema, maxBodyBytes);
    await schedules().setEnabled(c.get('family').id, parsePathId(c.req.param('profileId')), input.enabled, input.expected_revision);
    return c.json({ kids: await schedules().listForFamily(c.get('family').id) });
  });
}
