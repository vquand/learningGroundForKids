import { participantsSchema, participantKey, resolveParticipants, validateParticipants, type EventParticipant, type EventParticipantRef } from './participants.js';
import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import type { App } from '../contracts/app.js';
import type { AppDatabase, ProfileRecord } from '../contracts/db.js';
import { AppError } from '../errors.js';
import { parseJson, parsePathId } from '../input.js';
import { EVENT_ICON_KEYS } from './catalog.js';
import { addDays, calendarDates, isCivilDate, mondayStart, todayInVietnam } from './dates.js';
import { eventParticipantsAt, eventNameAt, type EventNameVersion } from './names.js';
import { EVENT_REPEATS, isEventActive, occurrencesInWindow, type EventRepeat } from './recurrence.js';

export const EVENT_ACTIVE_CAP = 50;
export const EVENT_TITLE_MAX = 40;
export const EVENT_START_HORIZON_DAYS = 365;
const REVISION_MAX = 2147483646;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

/** Kid event as returned by the API. */
export interface CalendarEvent {
  id: string;
  title: string;
  icon_key: string;
  start_date: string;
  repeat: EventRepeat;
  repeat_ended_on: string | null;
  revision: number;
  name_history?: EventNameVersion[];
  participants?: EventParticipant[];
}

/** One occurrence inside a calendar window (`events` in GET .../calendar). */
export interface CalendarEventOccurrence {
  event_id: string;
  participants?: EventParticipant[];
  date: string;
  title: string;
  icon_key: string;
  repeat: EventRepeat;
  repeat_ended_on: string | null;
  start_date: string;
  revision: number;
}

export interface CalendarEventCreateInput { title: string; icon_key: string; start_date: string; repeat: EventRepeat; participants?: EventParticipantRef[] }
export interface CalendarEventUpdateInput extends CalendarEventCreateInput { expected_revision: number; from_date?: string }

export interface CalendarEventsRepository {
  create(profileId: string, input: unknown, now: Date): Promise<CalendarEvent>;
  update(profileId: string, eventId: string, input: unknown, now: Date): Promise<CalendarEvent>;
  delete(profileId: string, eventId: string, expectedRevision: number, now: Date): Promise<void>;
  stopRepeat(profileId: string, eventId: string, input: unknown, now: Date): Promise<CalendarEvent>;
}

type Queryable = Pick<PoolClient, 'query'>;
const columns = `id,title,icon_key,to_char(start_date,'YYYY-MM-DD') AS start_date,"repeat",to_char(repeat_ended_on,'YYYY-MM-DD') AS repeat_ended_on,revision`;
const storedColumns = `${columns},name_history`;
const EVENT_ICON_SET: ReadonlySet<string> = new Set(EVENT_ICON_KEYS);

const revisionSchema = z.number().int().min(1).max(REVISION_MAX);
const revisionQuerySchema = z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(revisionSchema);
const eventIconSchema = z.string().refine(value => EVENT_ICON_SET.has(value), 'Unknown event icon');
const eventTitleSchema = z.string().max(1024)
  .transform(value => value.replace(CONTROL_CHARACTERS, '').trim())
  .refine(value => [...value].length >= 1 && [...value].length <= EVENT_TITLE_MAX, `Title must be 1 to ${EVENT_TITLE_MAX} characters`);

const civilDateSchema = z.string().refine(isCivilDate, 'Expected a valid YYYY-MM-DD civil date');

/** Schemas depend on "today" (Vietnam civil date), so they are built per captured instant. */
export function eventSchemas(today: string) {
  // Creation range. Updates check the range inside the transaction (assertStartDateChange) against the stored row.
  const createStartDateSchema = civilDateSchema
    .refine(value => value >= mondayStart(today) && value <= addDays(today, EVENT_START_HORIZON_DAYS), 'start_date is outside the calendar range');
  const body = {
    title: eventTitleSchema,
    icon_key: eventIconSchema,
    repeat: z.enum(EVENT_REPEATS),
    participants: participantsSchema.optional(),
  };
  return {
    create: z.object({ ...body, start_date: createStartDateSchema }).strict().refine(value => value.repeat === 'none' || value.start_date >= today, 'New repeating events cannot start in the past'),
    update: z.object({ ...body, start_date: civilDateSchema, expected_revision: revisionSchema, from_date: civilDateSchema.optional() }).strict(),
    stopRepeat: z.object({ expected_revision: revisionSchema }).strict(),
  };
}

/**
 * An unchanged start_date is always kept, even when it is in the past (a started series keeps its anchor).
 * A changed start_date is allowed only for an event that has not started yet, and must fall from today through today+365.
 */
export function assertStartDateChange(current: { start_date: string }, nextStart: string, today: string): void {
  if (nextStart === current.start_date) return;
  if (current.start_date < today) throw new AppError(422, 'VALIDATION_ERROR', 'The start date of a started event cannot be changed.');
  if (nextStart < today || nextStart > addDays(today, EVENT_START_HORIZON_DAYS)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'start_date must be from today through 365 days ahead.');
  }
}

function validated<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) throw new AppError(422, 'VALIDATION_ERROR', 'Calendar event input is invalid.');
  return result.data;
}

function required<T>(row: T | undefined): T {
  if (row === undefined) throw new AppError(500, 'INTERNAL_ERROR', 'The server could not complete the request.');
  return row;
}

function publicEvent(event: CalendarEvent): CalendarEvent {
  const { name_history: _history, ...result } = event;
  return result;
}

async function projectEvent(client: Queryable, profileId: string, event: CalendarEvent, date: string): Promise<CalendarEvent> {
  const hasPeople = event.name_history?.some(version => version.participants !== undefined);
  return {...publicEvent(event), ...eventNameAt(event,date), ...(hasPeople ? {participants:await resolveParticipants(client,profileId,eventParticipantsAt(event,date))} : {})};
}

function checkRevision(expected: number, current: CalendarEvent) {
  if (expected !== current.revision) throw new AppError(409, 'CALENDAR_REVISION_CONFLICT', 'The calendar event has changed.', { current: publicEvent(current) });
}

function byDateTitleId(left: CalendarEventOccurrence, right: CalendarEventOccurrence): number {
  if (left.date !== right.date) return left.date < right.date ? -1 : 1;
  if (left.title !== right.title) return left.title < right.title ? -1 : 1;
  return left.event_id < right.event_id ? -1 : left.event_id > right.event_id ? 1 : 0;
}

/**
 * Kid occurrences inside the inclusive window, sorted by date, title and event id.
 * Runs on the caller's client so it can share the read transaction and advisory lock.
 */
export async function kidEventOccurrences(client: Queryable, profileId: string, windowStart: string, windowEnd: string): Promise<CalendarEventOccurrence[]> {
  const rows = (await client.query<CalendarEvent>(`SELECT ${storedColumns} FROM calendar_events WHERE profile_id=$1
    AND (("repeat"='none' AND start_date BETWEEN $2::date AND $3::date)
      OR ("repeat"<>'none' AND start_date<=$3::date AND (repeat_ended_on IS NULL OR repeat_ended_on>=$2::date)))`,
  [profileId, windowStart, windowEnd])).rows;
  const refs = [...new Map(rows.flatMap(row => row.name_history?.flatMap(version => eventParticipantsAt({name_history:[version]},version.from)) ?? []).map(p => [participantKey(p),p])).values()];
  const people = new Map((await resolveParticipants(client,profileId,refs)).map(p => [participantKey(p),p]));
  return rows.flatMap(row => occurrencesInWindow(row, windowStart, windowEnd).map(date => {
    const participants = eventParticipantsAt(row,date).map(p => people.get(participantKey(p)) ?? {kind:'role' as const,key:'friend' as const});
    return {event_id: row.id, date, ...eventNameAt(row, date), repeat: row.repeat, repeat_ended_on: row.repeat_ended_on, start_date: row.start_date, revision: row.revision,
      ...(row.name_history?.some(version => version.participants !== undefined) ? {participants:participants.filter((p,i) => participants.findIndex(other => participantKey(other) === participantKey(p)) === i)} : {})};
  })).sort(byDateTitleId);
}

async function activeCount(client: Queryable, profileId: string, today: string, exceptId: string | null): Promise<number> {
  const row = (await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM calendar_events WHERE profile_id=$1
    AND id IS DISTINCT FROM $3::text
    AND (("repeat"='none' AND start_date>=$2::date) OR ("repeat"<>'none' AND (repeat_ended_on IS NULL OR repeat_ended_on>=$2::date)))`,
  [profileId, today, exceptId])).rows[0];
  return row?.n ?? 0;
}

async function findOwned(client: Queryable, profileId: string, eventId: string): Promise<CalendarEvent> {
  const row = (await client.query<CalendarEvent>(`SELECT ${storedColumns} FROM calendar_events WHERE id=$1 AND profile_id=$2`, [eventId, profileId])).rows[0];
  if (!row) throw new AppError(404, 'CALENDAR_EVENT_NOT_FOUND', 'Calendar event not found.');
  return row;
}

function assertCapacity(count: number) {
  if (count >= EVENT_ACTIVE_CAP) throw new AppError(422, 'CALENDAR_EVENTS_FULL', 'The calendar has too many active events.');
}

export function createCalendarEventsRepository(pool: Pool): CalendarEventsRepository {
  // Same per-profile advisory lock as the list repository, so every event and list write for a profile is serialized.
  async function transact<T>(profileId: string, action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,20261029))', [profileId]);
      const result = await action(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  return {
    async create(profileId, raw, now) {
      const today = todayInVietnam(now);
      const input = validated(eventSchemas(today).create, raw);
      return transact(profileId, async client => {
        if (isEventActive({ ...input, repeat_ended_on: null }, today)) assertCapacity(await activeCount(client, profileId, today, null));
        if (input.participants) await validateParticipants(client,profileId,input.participants);
        const history: EventNameVersion[] = input.participants ? [{from:input.start_date,title:input.title,icon_key:input.icon_key,participants:input.participants}] : [];
        const saved = required((await client.query<CalendarEvent>(`INSERT INTO calendar_events(id,profile_id,title,icon_key,start_date,"repeat",repeat_ended_on,revision,name_history)
          VALUES($1,$2,$3,$4,$5::date,$6,NULL,1,$7::jsonb) RETURNING ${storedColumns}`,
        [randomUUID(), profileId, input.title, input.icon_key, input.start_date, input.repeat, JSON.stringify(history)])).rows[0]);
        return projectEvent(client,profileId,saved,input.start_date);
      });
    },
    async update(profileId, eventId, raw, now) {
      const today = todayInVietnam(now);
      const input = validated(eventSchemas(today).update, raw);
      return transact(profileId, async client => {
        const current = await findOwned(client, profileId, eventId);
        checkRevision(input.expected_revision, current);
        assertStartDateChange(current, input.start_date, today);
        if (current.repeat === 'none' && input.repeat !== 'none' && input.start_date < today) throw new AppError(422, 'VALIDATION_ERROR', 'New repeating events cannot start in the past.');
        // A one-off edit always belongs to its own date, even a past one. A series edit applies from the chosen
        // occurrence (or from today/its start when none is sent) onwards. A sent from_date must be a displayed occurrence.
        const oneOff = current.repeat === 'none';
        const selectedDate = input.from_date ?? (oneOff || current.start_date > today ? current.start_date : today);
        // Rescheduling starts a new schedule; edits must already apply to its first occurrence.
        const effectiveDate = input.start_date === current.start_date ? selectedDate : input.start_date;
        let nameHistory = current.name_history ?? [];
        if (input.from_date || input.participants !== undefined || nameHistory.length > 0) {
          const window = calendarDates(now);
          if (input.from_date && (selectedDate < window.start || selectedDate > window.end || !occurrencesInWindow(current, selectedDate, selectedDate).length)) throw new AppError(422, 'VALIDATION_ERROR', 'Choose an occurrence in the displayed calendar.');
          const previous = eventParticipantsAt(current, selectedDate);
          if (input.participants) await validateParticipants(client,profileId,input.participants,previous);
          const participants = input.participants ?? previous;
          nameHistory = [...nameHistory.filter(version => version.from < effectiveDate), { from: effectiveDate, title: input.title, icon_key: input.icon_key,
            ...(input.participants !== undefined || current.name_history?.some(version => version.participants !== undefined) ? {participants} : {}) }];
        }
        // A stopped series stays stopped unless the edit moves its start after the stop date (then it starts over).
        const repeatEndedOn = input.repeat === 'none' || current.repeat_ended_on === null || input.start_date > current.repeat_ended_on
          ? null : current.repeat_ended_on;
        if (isEventActive({ start_date: input.start_date, repeat: input.repeat, repeat_ended_on: repeatEndedOn }, today)) {
          assertCapacity(await activeCount(client, profileId, today, eventId));
        }
        const versioned = Boolean(input.from_date) || nameHistory.length > 0;
        const saved = required((await client.query<CalendarEvent>(`UPDATE calendar_events SET title=$1,icon_key=$2,start_date=$3::date,"repeat"=$4,
          repeat_ended_on=$5::date,revision=revision+1,updated_at=now(),name_history=$8::jsonb WHERE id=$6 AND profile_id=$7 RETURNING ${storedColumns}`,
        [versioned ? current.title : input.title, versioned ? current.icon_key : input.icon_key, input.start_date, input.repeat, repeatEndedOn, eventId, profileId, JSON.stringify(nameHistory)])).rows[0]);
        return projectEvent(client, profileId, saved, effectiveDate);
      });
    },
    async delete(profileId, eventId, expectedRevision, _now) {
      const revision = validated(revisionSchema, expectedRevision);
      await transact(profileId, async client => {
        checkRevision(revision, await findOwned(client, profileId, eventId));
        await client.query('DELETE FROM calendar_events WHERE id=$1 AND profile_id=$2', [eventId, profileId]);
      });
    },
    async stopRepeat(profileId, eventId, raw, now) {
      const today = todayInVietnam(now);
      const input = validated(eventSchemas(today).stopRepeat, raw);
      return transact(profileId, async client => {
        const current = await findOwned(client, profileId, eventId);
        checkRevision(input.expected_revision, current);
        // Stopping a one-off or an already-stopped series changes nothing and does not bump the revision.
        if (current.repeat === 'none') return projectEvent(client,profileId,current,current.start_date > today ? current.start_date : today);
        // A series that has not started yet becomes a one-off on its start date.
        const next = current.start_date > today
          ? { repeat: 'none' as const, repeat_ended_on: null }
          : { repeat: current.repeat, repeat_ended_on: current.repeat_ended_on !== null && current.repeat_ended_on < today ? current.repeat_ended_on : today };
        if (next.repeat === current.repeat && next.repeat_ended_on === current.repeat_ended_on) return projectEvent(client,profileId,current,current.start_date > today ? current.start_date : today);
        const saved = required((await client.query<CalendarEvent>(`UPDATE calendar_events SET "repeat"=$1,repeat_ended_on=$2::date,revision=revision+1,updated_at=now()
          WHERE id=$3 AND profile_id=$4 RETURNING ${storedColumns}`, [next.repeat, next.repeat_ended_on, eventId, profileId])).rows[0]);
        return projectEvent(client,profileId,saved,saved.start_date > today ? saved.start_date : today);
      });
    },
  };
}

const eventsQuerySchema = z.object({ expected_revision: revisionQuerySchema }).strict();

export function registerCalendarEventRoutes(app: App, db: AppDatabase, maxBodyBytes: number,
  owned: (c: Context, db: AppDatabase, id: string) => Promise<ProfileRecord>, clock: () => Date = () => new Date()) {
  const methodNotAllowed = () => new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  async function prepare(c: Context) {
    c.header('Cache-Control', 'no-store');
    const now = clock(); // One captured instant for this entire request.
    const profileId = parsePathId(c.req.param('profileId') ?? '');
    await owned(c, db, profileId);
    if (!db.calendarEvents) throw new AppError(503, 'CALENDAR_UNAVAILABLE', 'Calendar is unavailable.');
    return { profileId, now, repository: db.calendarEvents, today: todayInVietnam(now) };
  }
  app.all('/api/v1/profiles/:profileId/calendar/events', async c => {
    const { profileId, now, repository, today } = await prepare(c);
    if (c.req.method !== 'POST') throw methodNotAllowed();
    const input = await parseJson(c.req.raw, eventSchemas(today).create, maxBodyBytes);
    return c.json(await repository.create(profileId, input, now), 201);
  });
  app.all('/api/v1/profiles/:profileId/calendar/events/:eventId', async c => {
    const { profileId, now, repository, today } = await prepare(c);
    const eventId = parsePathId(c.req.param('eventId'));
    if (c.req.method === 'PUT') {
      const input = await parseJson(c.req.raw, eventSchemas(today).update, maxBodyBytes);
      return c.json(await repository.update(profileId, eventId, input, now));
    }
    if (c.req.method === 'DELETE') {
      const params = new URL(c.req.url).searchParams;
      const keys = [...params.keys()];
      if (keys.some(key => params.getAll(key).length !== 1)) throw new AppError(422, 'VALIDATION_ERROR', 'Calendar query is invalid.');
      const parsed = eventsQuerySchema.safeParse(Object.fromEntries(params));
      if (!parsed.success) throw new AppError(422, 'VALIDATION_ERROR', 'Calendar query is invalid.');
      await repository.delete(profileId, eventId, parsed.data.expected_revision, now);
      return c.body(null, 204);
    }
    throw methodNotAllowed();
  });
  app.all('/api/v1/profiles/:profileId/calendar/events/:eventId/stop-repeat', async c => {
    const { profileId, now, repository, today } = await prepare(c);
    const eventId = parsePathId(c.req.param('eventId'));
    if (c.req.method !== 'POST') throw methodNotAllowed();
    const input = await parseJson(c.req.raw, eventSchemas(today).stopRepeat, maxBodyBytes);
    return c.json(await repository.stopRepeat(profileId, eventId, input, now));
  });
}
