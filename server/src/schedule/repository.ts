import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { AppError } from '../errors.js';
import { DEFAULT_TIMEZONE, isValidTimezone, normalizeSlots, slotTotals, type ScheduleSlot } from './lock.js';
import type { ParentScheduleKid, ScheduleContext } from './contracts.js';

export const MAX_TIMEZONE_CHANGES_PER_DAY = 3;

export interface ScheduleRepository {
  /** Lock context for a profile of this family (null: unknown profile). Records an accepted time-zone change. */
  resolve(familyId: string, profileId: string, reportedTimezone: string | null, now: Date): Promise<ScheduleContext | null>;
  listForFamily(familyId: string): Promise<ParentScheduleKid[]>;
  setEnabled(familyId: string, profileId: string, enabled: boolean, expectedRevision: number): Promise<void>;
  apply(familyId: string, mode: 'replace' | 'add', slots: ScheduleSlot[],
    targets: { profile_id: string; expected_revision: number }[]): Promise<void>;
}

async function transact<T>(pool: Pool, key: string, action: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,20261104))', [key]);
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

type SlotRow = { weekday: number; start_minute: number; end_minute: number };
const toSlots = (rows: SlotRow[]): ScheduleSlot[] => rows.map(row => ({ weekday: row.weekday, start_minute: row.start_minute, end_minute: row.end_minute }));

export function createScheduleRepository(pool: Pool): ScheduleRepository {
  async function ensureRow(client: PoolClient, profileId: string): Promise<void> {
    await client.query('INSERT INTO profile_schedules (profile_id) VALUES ($1) ON CONFLICT DO NOTHING', [profileId]);
  }
  async function checkRevision(client: PoolClient, profileId: string, expected: number): Promise<void> {
    const { rows } = await client.query<{ revision: number }>('SELECT revision FROM profile_schedules WHERE profile_id=$1 FOR UPDATE', [profileId]);
    if (!rows[0] || rows[0].revision !== expected) throw new AppError(409, 'SCHEDULE_REVISION_CONFLICT', 'The schedule changed. Reload and try again.');
  }
  return {
    async resolve(familyId, profileId, reported, now) {
      const { rows } = await pool.query<{ enabled: boolean | null; current_timezone: string | null; changes: number | null; change_day: string | null }>(
        `SELECT s.enabled, s.current_timezone, s.timezone_changes_today AS changes, s.timezone_change_day::text AS change_day
           FROM profiles p LEFT JOIN profile_schedules s ON s.profile_id=p.id WHERE p.id=$1 AND p.family_id=$2`, [profileId, familyId]);
      const row = rows[0];
      if (!row) return null;
      if (!row.enabled) return { enabled: false, slots: [], timezone: row.current_timezone ?? DEFAULT_TIMEZONE };
      let timezone = row.current_timezone ?? DEFAULT_TIMEZONE;
      if (reported && isValidTimezone(reported) && reported !== row.current_timezone) {
        const day = now.toISOString().slice(0, 10);
        const used = row.change_day === day ? (row.changes ?? 0) : 0;
        // The first report is free; later changes are capped per UTC day so a device clock cannot be flipped at will.
        if (row.current_timezone === null || used < MAX_TIMEZONE_CHANGES_PER_DAY) {
          const accepted = await transact(pool, profileId, async client => {
            // Re-read under the lock so concurrent reports cannot exceed the daily cap.
            const fresh = (await client.query<{ current_timezone: string | null; changes: number; change_day: string | null }>(
              `SELECT current_timezone, timezone_changes_today AS changes, timezone_change_day::text AS change_day FROM profile_schedules WHERE profile_id=$1 FOR UPDATE`, [profileId])).rows[0];
            if (!fresh || fresh.current_timezone === reported) return fresh?.current_timezone === reported;
            const freshUsed = fresh.change_day === day ? fresh.changes : 0;
            if (fresh.current_timezone !== null && freshUsed >= MAX_TIMEZONE_CHANGES_PER_DAY) return false;
            await client.query(
              `UPDATE profile_schedules SET current_timezone=$2, timezone_changed_at=$3, timezone_change_day=$4,
                 timezone_changes_today=CASE WHEN current_timezone IS NULL THEN 0 WHEN timezone_change_day=$4 THEN timezone_changes_today+1 ELSE 1 END
               WHERE profile_id=$1`, [profileId, reported, now, day]);
            if (fresh.current_timezone !== null) {
              await client.query('INSERT INTO profile_schedule_events (id, profile_id, from_timezone, to_timezone, at) VALUES ($1,$2,$3,$4,$5)',
                [randomUUID(), profileId, fresh.current_timezone, reported, now]);
            }
            return true;
          });
          if (accepted) timezone = reported;
        }
      }
      const slots = await pool.query<SlotRow>('SELECT weekday, start_minute, end_minute FROM profile_schedule_slots WHERE profile_id=$1 ORDER BY weekday, start_minute', [profileId]);
      return { enabled: true, slots: toSlots(slots.rows), timezone };
    },
    async listForFamily(familyId) {
      const profiles = await pool.query<{ id: string; name: string; emoji: string; color: string; enabled: boolean | null; revision: number | null; current_timezone: string | null }>(
        `SELECT p.id, p.name, p.emoji, p.color, s.enabled, s.revision, s.current_timezone
           FROM profiles p LEFT JOIN profile_schedules s ON s.profile_id=p.id WHERE p.family_id=$1 ORDER BY p.created_at, p.id`, [familyId]);
      const ids = profiles.rows.map(row => row.id);
      const slots = await pool.query<SlotRow & { profile_id: string }>('SELECT profile_id, weekday, start_minute, end_minute FROM profile_schedule_slots WHERE profile_id=ANY($1) ORDER BY weekday, start_minute', [ids]);
      const events = await pool.query<{ profile_id: string; from_timezone: string | null; to_timezone: string; at: Date }>(
        `SELECT profile_id, from_timezone, to_timezone, at FROM (
           SELECT *, row_number() OVER (PARTITION BY profile_id ORDER BY at DESC) rn FROM profile_schedule_events WHERE profile_id=ANY($1)) e WHERE rn<=5 ORDER BY at DESC`, [ids]);
      return profiles.rows.map(row => {
        const mine = toSlots(slots.rows.filter(slot => slot.profile_id === row.id));
        return {
          profile_id: row.id, name: row.name, emoji: row.emoji, color: row.color,
          enabled: row.enabled === true, revision: row.revision ?? 0, timezone: row.current_timezone,
          slots: mine, ...slotTotals(mine),
          timezone_events: events.rows.filter(event => event.profile_id === row.id).map(event => ({ from_timezone: event.from_timezone, to_timezone: event.to_timezone, at: event.at.toISOString() })),
        };
      });
    },
    async setEnabled(familyId, profileId, enabled, expectedRevision) {
      await transact(pool, profileId, async client => {
        const owned = await client.query('SELECT 1 FROM profiles WHERE id=$1 AND family_id=$2', [profileId, familyId]);
        if (owned.rowCount === 0) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
        await ensureRow(client, profileId);
        await checkRevision(client, profileId, expectedRevision);
        await client.query('UPDATE profile_schedules SET enabled=$2, revision=revision+1 WHERE profile_id=$1', [profileId, enabled]);
      });
    },
    async apply(familyId, mode, slots, targets) {
      const ids = [...new Set(targets.map(target => target.profile_id))].sort();
      if (ids.length !== targets.length) throw new AppError(422, 'VALIDATION_ERROR', 'Duplicate children.');
      await transact(pool, `family:${familyId}`, async client => {
        for (const target of [...targets].sort((a, b) => a.profile_id.localeCompare(b.profile_id))) {
          const owned = await client.query<{ enabled: boolean | null }>(
            'SELECT s.enabled FROM profiles p LEFT JOIN profile_schedules s ON s.profile_id=p.id WHERE p.id=$1 AND p.family_id=$2', [target.profile_id, familyId]);
          if (!owned.rows[0]) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
          if (owned.rows[0].enabled !== true) throw new AppError(409, 'SCHEDULE_NOT_ENABLED', 'Turn the schedule on for this child first.');
          await checkRevision(client, target.profile_id, target.expected_revision);
          let next = normalizeSlots(slots);
          if (mode === 'add') {
            const existing = await client.query<SlotRow>('SELECT weekday, start_minute, end_minute FROM profile_schedule_slots WHERE profile_id=$1', [target.profile_id]);
            next = normalizeSlots([...toSlots(existing.rows), ...slots]);
          }
          await client.query('DELETE FROM profile_schedule_slots WHERE profile_id=$1', [target.profile_id]);
          if (next.length > 0) {
            await client.query(
              `INSERT INTO profile_schedule_slots (id, profile_id, weekday, start_minute, end_minute)
               SELECT x.id, $1, x.weekday, x.start_minute, x.end_minute
                 FROM unnest($2::text[], $3::smallint[], $4::smallint[], $5::smallint[]) AS x(id, weekday, start_minute, end_minute)`,
              [target.profile_id, next.map(() => randomUUID()), next.map(slot => slot.weekday), next.map(slot => slot.start_minute), next.map(slot => slot.end_minute)]);
          }
          await client.query('UPDATE profile_schedules SET revision=revision+1 WHERE profile_id=$1', [target.profile_id]);
        }
      });
    },
  };
}
