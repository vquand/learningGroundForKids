import type { Context } from 'hono';
import type { App } from '../contracts/app.js';
import type { AppDatabase, ProfileRecord } from '../contracts/db.js';
import { AppError } from '../errors.js';
import { parsePathId } from '../input.js';

/**
 * Parent Space read-only calendar. Authentication and the parent capability are
 * enforced by app.ts for every /api/v1/parent/ path; `owned` proves the profile
 * belongs to the session family, so foreign and unknown profiles return 404.
 * There are deliberately no write routes and no weather lookups here.
 */
export function registerParentCalendarRoutes(app: App, db: AppDatabase,
  owned: (c: Context, db: AppDatabase, id: string) => Promise<ProfileRecord>) {
  app.all('/api/v1/parent/calendar/:profileId', async c => {
    c.header('Cache-Control', 'no-store');
    if (c.req.method !== 'GET') {
      c.header('Allow', 'GET');
      throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    }
    const profileId = parsePathId(c.req.param('profileId'));
    await owned(c, db, profileId);
    if (!db.calendar) throw new AppError(503, 'CALENDAR_UNAVAILABLE', 'Calendar is unavailable.');
    return c.json(await db.calendar.read(profileId, new Date())); // One captured instant per request.
  });
}
