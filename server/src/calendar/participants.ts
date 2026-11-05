import type { Context } from 'hono';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import type { App } from '../contracts/app.js';
import type { AppDatabase, ProfileRecord } from '../contracts/db.js';
import { AppError } from '../errors.js';
import { parseJson, parsePathId } from '../input.js';
import { acceptedFriendshipSql } from '../town-building/friendship.js';
import { calendarSearchText } from './search.js';

export const RELATIVE_ROLES = ['dad', 'mom', 'paternal_grandpa', 'paternal_grandma', 'maternal_grandpa', 'maternal_grandma'] as const;
export const PARTICIPANT_ROLES = [...RELATIVE_ROLES, 'friend'] as const;
export type RelativeRole = typeof RELATIVE_ROLES[number];
export const participantSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('role'), key: z.enum(PARTICIPANT_ROLES) }).strict(),
  z.object({ kind: z.literal('profile'), profile_id: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/) }).strict(),
]);
export type EventParticipantRef = z.infer<typeof participantSchema>;
export type EventParticipant = Extract<EventParticipantRef, { kind: 'role' }> | { kind: 'profile'; profile_id: string; name: string };
export const participantKey = (person: EventParticipantRef) => person.kind === 'role' ? `role:${person.key}` : `profile:${person.profile_id}`;
export const participantsSchema = z.array(participantSchema).max(24).refine(rows => new Set(rows.map(participantKey)).size === rows.length);
const disabledRolesSchema = z.array(z.enum(RELATIVE_ROLES)).max(6).refine(rows => new Set(rows).size === rows.length);
export const settingsSchema = z.object({ disabled_roles: disabledRolesSchema, expected_revision: z.number().int().min(0).max(2147483646) }).strict();
export interface CalendarPeopleSettings { disabled_roles: RelativeRole[]; revision: number }
export interface ParticipantCandidate { profile_id: string; name: string; source: 'family' | 'friend' }
export interface CalendarPeopleRepository {
  candidates(profileId: string, search: string): Promise<{ roles: typeof PARTICIPANT_ROLES[number][]; profiles: ParticipantCandidate[]; has_more: boolean }>;
  settings(familyId: string): Promise<CalendarPeopleSettings>;
  saveSettings(familyId: string, input: z.infer<typeof settingsSchema>): Promise<CalendarPeopleSettings>;
}
export const PARTICIPANT_CANDIDATE_CAP = 2505;
type Queryable = Pick<PoolClient, 'query'>;

export async function readPeopleSettings(client: Queryable, familyId: string): Promise<CalendarPeopleSettings> {
  const row = (await client.query<CalendarPeopleSettings>('SELECT disabled_roles,revision FROM calendar_family_settings WHERE family_id=$1', [familyId])).rows[0];
  return row ?? { disabled_roles: [], revision: 0 };
}
async function viewerFamily(client: Queryable, profileId: string): Promise<string> {
  const row = (await client.query<{ family_id: string }>('SELECT family_id FROM profiles WHERE id=$1', [profileId])).rows[0];
  if (!row) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
  return row.family_id;
}

/** Both ends of an accepted friendship must cover these exact child profiles. */
async function allowedProfiles(client: Queryable, profileId: string, familyId: string, search: string, ids?: readonly string[]): Promise<ParticipantCandidate[]> {
  const needle = calendarSearchText(search);
  // Families contain at most five profiles, but accepted friendships have no
  // total cap. Bound the authorized set explicitly rather than scanning pages
  // sequentially or silently hiding matches beyond a truncated candidate list.
  const limit = ids ? ids.length : PARTICIPANT_CANDIDATE_CAP + 1;
  const rows = (await client.query<ParticipantCandidate>(`SELECT p.id AS profile_id,p.name,CASE WHEN p.family_id=$1 THEN 'family' ELSE 'friend' END AS source
    FROM profiles p WHERE p.id<>$2 AND (p.family_id=$1 OR EXISTS(SELECT 1 FROM friend_requests f WHERE f.status='accepted' AND ${acceptedFriendshipSql}))
      AND ($3::text[] IS NULL OR p.id=ANY($3::text[]))
    ORDER BY (p.family_id=$1) DESC,lower(p.name),p.id LIMIT $4`,
  [familyId, profileId, ids ?? null, limit])).rows;
  if (!ids && rows.length > PARTICIPANT_CANDIDATE_CAP)
    throw new AppError(503, 'CALENDAR_PEOPLE_TOO_LARGE', 'Too many people to search. Please try again later.');
  return rows.filter(row => !needle || calendarSearchText(row.name).includes(needle)).slice(0, ids ? ids.length : 101);
}

export async function resolveParticipants(client: Queryable, profileId: string, refs: readonly EventParticipantRef[]): Promise<EventParticipant[]> {
  if (!refs.length) return [];
  const familyId = await viewerFamily(client, profileId);
  const ids = refs.flatMap(p => p.kind === 'profile' ? [p.profile_id] : []);
  const profiles = ids.length ? await allowedProfiles(client, profileId, familyId, '', ids) : [];
  const names = new Map(profiles.map(p => [p.profile_id, p.name]));
  // Revoked friendships/deleted profiles reveal no profile id or fresh private name.
  const result: EventParticipant[] = refs.map(p => p.kind === 'role' ? p : names.has(p.profile_id)
    ? { kind: 'profile', profile_id: p.profile_id, name: names.get(p.profile_id)! } : { kind: 'role', key: 'friend' });
  return result.filter((p, i) => result.findIndex(other => participantKey(other) === participantKey(p)) === i);
}

export async function validateParticipants(client: Queryable, profileId: string, refs: readonly EventParticipantRef[], previous: readonly EventParticipantRef[] = []): Promise<void> {
  const familyId = await viewerFamily(client, profileId);
  // Serialize role changes with parent settings writes, across all children of this family.
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,20261101))', [familyId]);
  const settings = await readPeopleSettings(client, familyId);
  const existing = new Set(previous.map(participantKey));
  if (refs.some(p => p.kind === 'role' && settings.disabled_roles.includes(p.key as RelativeRole) && !existing.has(participantKey(p))))
    throw new AppError(422, 'CALENDAR_PARTICIPANT_UNAVAILABLE', 'Some people are no longer available. Choose people again.');
  const ids = refs.flatMap(p => p.kind === 'profile' ? [p.profile_id] : []);
  const allowed = ids.length ? await allowedProfiles(client, profileId, familyId, '', ids) : [];
  if (allowed.length !== ids.length) throw new AppError(422, 'CALENDAR_PARTICIPANT_UNAVAILABLE', 'Some people are no longer available. Choose people again.');
}

export function createCalendarPeopleRepository(pool: Pool): CalendarPeopleRepository {
  return {
    settings: familyId => readPeopleSettings(pool, familyId),
    async candidates(profileId, search) {
      const viewer = (await pool.query<{ family_id: string; disabled_roles: RelativeRole[] | null }>(`SELECT p.family_id,s.disabled_roles
        FROM profiles p LEFT JOIN calendar_family_settings s ON s.family_id=p.family_id WHERE p.id=$1`, [profileId])).rows[0];
      if (!viewer) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
      const rows = await allowedProfiles(pool, profileId, viewer.family_id, search);
      return { roles: PARTICIPANT_ROLES.filter(role => !viewer.disabled_roles?.includes(role as RelativeRole)), profiles: rows.slice(0, 100), has_more: rows.length > 100 };
    },
    async saveSettings(familyId, input) {
      const parsed = settingsSchema.parse(input);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,20261101))', [familyId]);
        const current = await readPeopleSettings(client, familyId);
        if (current.revision !== parsed.expected_revision) throw new AppError(409, 'CALENDAR_REVISION_CONFLICT', 'These settings have changed.', { current });
        const row = (await client.query<CalendarPeopleSettings>(`INSERT INTO calendar_family_settings(family_id,disabled_roles,revision) VALUES($1,$2::jsonb,1)
          ON CONFLICT(family_id) DO UPDATE SET disabled_roles=excluded.disabled_roles,revision=calendar_family_settings.revision+1 RETURNING disabled_roles,revision`, [familyId, JSON.stringify(parsed.disabled_roles)])).rows[0]!;
        await client.query('COMMIT'); return row;
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
  };
}

export function registerCalendarPeopleRoutes(app: App, db: AppDatabase, maxBodyBytes: number, owned: (c: Context, db: AppDatabase, id: string) => Promise<ProfileRecord>) {
  app.get('/api/v1/profiles/:profileId/calendar/participants', async c => {
    c.header('Cache-Control', 'no-store');
    const id = parsePathId(c.req.param('profileId')); await owned(c, db, id);
    if (!db.calendarPeople) throw new AppError(503, 'CALENDAR_UNAVAILABLE', 'Calendar is unavailable.');
    const params = new URL(c.req.url).searchParams;
    if ([...params.keys()].some(key => key !== 'q' || params.getAll(key).length !== 1) || (params.get('q')?.length ?? 0) > 64) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid search.');
    return c.json(await db.calendarPeople.candidates(id, (params.get('q') ?? '').trim()));
  });
  // /parent/ middleware in app.ts verifies the parent capability on every request.
  app.all('/api/v1/parent/calendar-settings', async c => {
    c.header('Cache-Control', 'no-store');
    if (!db.calendarPeople) throw new AppError(503, 'CALENDAR_UNAVAILABLE', 'Calendar is unavailable.');
    const familyId = c.get('family').id;
    if (c.req.method === 'GET') return c.json(await db.calendarPeople.settings(familyId));
    if (c.req.method === 'PUT') return c.json(await db.calendarPeople.saveSettings(familyId, await parseJson(c.req.raw, settingsSchema, maxBodyBytes)));
    c.header('Allow', 'GET, PUT'); throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  });
}
