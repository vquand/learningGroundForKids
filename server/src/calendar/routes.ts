import type { Context } from 'hono';
import type { App } from '../contracts/app.js';
import type { CalendarWeather } from './weather-contracts.js';
import type { AppDatabase, ProfileRecord } from '../contracts/db.js';
import { AppError } from '../errors.js';
import { parseJson, parsePathId } from '../input.js';
import { deleteOverrideSchema, listBodySchema, renameItemSchema, studyLibrarySchema, studyLibraryUpdateSchema, writableItems } from './contracts.js';

export function registerCalendarRoutes(app: App, db: AppDatabase, maxBodyBytes: number,
  owned: (c: Context, db: AppDatabase, id: string) => Promise<ProfileRecord>, weather: CalendarWeather | null, clock: () => Date = () => new Date()) {
  for (const suffix of ['', '/lists', '/weather', '/rename-item', '/subjects', '/subjects/:subjectId']) app.all(`/api/v1/profiles/:profileId/calendar${suffix}`, async c => {
    c.header('Cache-Control', 'no-store');
    const now = clock(); // One captured instant for this entire request.
    const profileId = parsePathId(c.req.param('profileId'));
    const profile = await owned(c, db, profileId);
    if (suffix === '/weather') {
      if (c.req.method !== 'GET') throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
      const city = profile.native_city?.trim(), country = profile.native_country_code?.trim();
      if (!city || !country) return c.json({ status: 'no_location', location_label: null, updated_at: null, days: [] });
      try {
        if (weather) return c.json(await weather.get(profile, now));
      } catch { /* Provider details never leave this boundary. */ }
      return c.json({ status: 'unavailable', location_label: `${city}, ${country}`, updated_at: null, days: [] });
    }
    if (!db.calendar) throw new AppError(503, 'CALENDAR_UNAVAILABLE', 'Calendar is unavailable.');
    if (suffix === '/rename-item' && c.req.method === 'POST' && db.calendar.renameItem) {
      const input = await parseJson(c.req.raw, renameItemSchema, maxBodyBytes);
      return c.json(await db.calendar.renameItem(profileId, input, now));
    }
    if (suffix === '/subjects' && c.req.method === 'POST' && db.calendar.addStudy) {
      return c.json(await db.calendar.addStudy(profileId, await parseJson(c.req.raw, studyLibrarySchema, maxBodyBytes)), 201);
    }
    if (suffix === '/subjects/:subjectId' && c.req.method === 'DELETE' && db.calendar.removeStudy) {
      await db.calendar.removeStudy(profileId, parsePathId(c.req.param('subjectId') ?? ''));
      return c.body(null, 204);
    }
    if (suffix === '/subjects/:subjectId' && c.req.method === 'PUT' && db.calendar.updateStudy) {
      return c.json(await db.calendar.updateStudy(profileId, parsePathId(c.req.param('subjectId') ?? ''), await parseJson(c.req.raw, studyLibraryUpdateSchema, maxBodyBytes)));
    }
    if (!suffix && c.req.method === 'GET') return c.json(await db.calendar.read(profileId, now));
    if (suffix === '/lists' && c.req.method === 'PUT') {
      const input = await parseJson(c.req.raw, listBodySchema, maxBodyBytes);
      writableItems(input.area, input.items);
      return c.json(await db.calendar.upsert(profileId, input, now));
    }
    if (suffix === '/lists' && c.req.method === 'DELETE') {
      const params = new URL(c.req.url).searchParams;
      const parsed = deleteOverrideSchema.safeParse(Object.fromEntries(params));
      if (!parsed.success || [...params.keys()].some(key => params.getAll(key).length !== 1)) throw new AppError(422, 'VALIDATION_ERROR', 'Calendar query is invalid.');
      writableItems(parsed.data.area, []);
      await db.calendar.deleteOverride(profileId, parsed.data, now);
      return c.body(null, 204);
    }
    throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  });
}
