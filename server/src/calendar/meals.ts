import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import type { App } from '../contracts/app.js';
import type { AppDatabase, ProfileRecord } from '../contracts/db.js';
import { AppError } from '../errors.js';
import { parseJson, parsePathId } from '../input.js';
import { LIBRARY_CAP, MEAL_FOOD_KEYS, CALENDAR_NAME_MAX, type MealFoodKey } from './catalog.js';

/** "My meals" library: a per-profile list of catalog foods with an optional child-given name. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

export interface MealLibraryItem { id: string; food_key: MealFoodKey; custom_name: string | null }
export interface MealLibraryAddInput { food: MealFoodKey; custom_name?: string | undefined }
export interface MealLibraryAdd { created: boolean; item: MealLibraryItem }
export interface MealLibraryRepository {
  add(profileId: string, input: MealLibraryAddInput): Promise<MealLibraryAdd>;
  remove(profileId: string, mealId: string): Promise<void>;
  update?(profileId: string, mealId: string, input: MealLibraryAddInput & { expected_food: MealFoodKey; expected_name: string | null }): Promise<MealLibraryItem>;
}

// Same cleaning and length rule as the list item `name` (1..CALENDAR_NAME_MAX after cleaning).
const customNameSchema = z.string().max(1024)
  .transform(value => value.replace(CONTROL_CHARACTERS, '').trim())
  .pipe(z.string().min(1).max(CALENDAR_NAME_MAX));
export const mealLibraryAddSchema = z.object({ food: z.enum(MEAL_FOOD_KEYS), custom_name: customNameSchema.optional() }).strict();
const mealLibraryUpdateSchema = mealLibraryAddSchema.extend({ expected_food: z.enum(MEAL_FOOD_KEYS), expected_name: z.string().max(CALENDAR_NAME_MAX).nullable() });
// Stored rows are re-checked on read; invalid rows are dropped and logged by id only.
const storedMealSchema = z.object({ id: z.string().min(1), food_key: z.enum(MEAL_FOOD_KEYS), custom_name: z.string().min(1).max(CALENDAR_NAME_MAX).nullable() });

type Row = { id: string; food_key: string; custom_name: string | null };

async function transact<T>(pool: Pool, profileId: string, action: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Same per-profile lock as the calendar repository, so the cap and list writes serialize together.
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

/** Reads the profile's library in creation order. Used by the calendar window read. */
export async function readMealLibrary(client: PoolClient, profileId: string,
  warn: (message: string, details: { id: string }) => void = (message, details) => console.warn(message, details)): Promise<MealLibraryItem[]> {
  const rows = (await client.query<Row>('SELECT id, food_key, custom_name FROM calendar_meal_library WHERE profile_id=$1 ORDER BY created_at, id', [profileId])).rows;
  const items: MealLibraryItem[] = [];
  for (const row of rows) {
    const parsed = storedMealSchema.safeParse(row);
    if (parsed.success) items.push(parsed.data);
    else warn('Invalid stored meal library row dropped', { id: row.id });
  }
  return items;
}

async function findMeal(client: PoolClient, profileId: string, food: MealFoodKey, customName: string | null): Promise<MealLibraryItem | undefined> {
  const row = (await client.query<Row>(
    "SELECT id, food_key, custom_name FROM calendar_meal_library WHERE profile_id=$1 AND food_key=$2 AND coalesce(custom_name,'')=$3 LIMIT 1",
    [profileId, food, customName ?? ''],
  )).rows[0];
  return row ? { id: row.id, food_key: food, custom_name: row.custom_name } : undefined;
}

export function createMealLibraryRepository(pool: Pool): MealLibraryRepository {
  return {
    async add(profileId, input) {
      const food = input.food, customName = input.custom_name ?? null;
      return transact(pool, profileId, async client => {
        // Idempotent: the same (food, name) pair returns the existing row and never consumes cap.
        const existing = await findMeal(client, profileId, food, customName);
        if (existing) return { created: false, item: existing };
        const count = (await client.query<{ n: number }>('SELECT count(*)::int AS n FROM calendar_meal_library WHERE profile_id=$1', [profileId])).rows[0]?.n ?? 0;
        if (count >= LIBRARY_CAP) throw new AppError(422, 'CALENDAR_LIBRARY_FULL', 'The meal library is full.');
        const row = (await client.query<Row>(
          'INSERT INTO calendar_meal_library(id,profile_id,food_key,custom_name) VALUES($1,$2,$3,$4) RETURNING id, food_key, custom_name',
          [randomUUID(), profileId, food, customName],
        )).rows[0];
        if (!row) throw new AppError(500, 'INTERNAL_ERROR', 'The server could not complete the request.');
        return { created: true, item: { id: row.id, food_key: food, custom_name: row.custom_name } };
      });
    },
    async remove(profileId, mealId) {
      await transact(pool, profileId, async client => {
        // Lists store catalog keys, not library rows, so removing a library entry never edits a list.
        const result = await client.query('DELETE FROM calendar_meal_library WHERE id=$1 AND profile_id=$2', [mealId, profileId]);
        if (result.rowCount !== 1) throw new AppError(404, 'CALENDAR_MEAL_NOT_FOUND', 'Meal library item not found.');
      });
    },
    async update(profileId, mealId, input) {
      return transact(pool, profileId, async client => {
        const current = (await client.query<Row>('SELECT id,food_key,custom_name FROM calendar_meal_library WHERE id=$1 AND profile_id=$2', [mealId, profileId])).rows[0];
        if (!current) throw new AppError(404, 'CALENDAR_MEAL_NOT_FOUND', 'Meal library item not found.');
        if (current.food_key !== input.expected_food || current.custom_name !== input.expected_name) throw new AppError(409, 'CALENDAR_REVISION_CONFLICT', 'The favorite has changed.');
        const duplicate = await findMeal(client, profileId, input.food, input.custom_name ?? null);
        if (duplicate && duplicate.id !== mealId) {
          await client.query('DELETE FROM calendar_meal_library WHERE id=$1 AND profile_id=$2', [mealId, profileId]);
          return duplicate;
        }
        const row = (await client.query<MealLibraryItem>('UPDATE calendar_meal_library SET food_key=$1,custom_name=$2 WHERE id=$3 AND profile_id=$4 RETURNING id,food_key,custom_name', [input.food, input.custom_name ?? null, mealId, profileId])).rows[0];
        if (!row) throw new AppError(500, 'INTERNAL_ERROR', 'Could not update the favorite.');
        return row;
      });
    },
  };
}

type OwnedProfile = (c: Context, db: AppDatabase, id: string) => Promise<ProfileRecord>;

export function registerCalendarMealRoutes(app: App, db: AppDatabase, maxBodyBytes: number, owned: OwnedProfile) {
  app.all('/api/v1/profiles/:profileId/calendar/meals', async c => {
    c.header('Cache-Control', 'no-store');
    const profileId = parsePathId(c.req.param('profileId'));
    await owned(c, db, profileId);
    if (c.req.method !== 'POST') throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    if (!db.calendarMeals) throw new AppError(503, 'CALENDAR_UNAVAILABLE', 'Calendar is unavailable.');
    const input = await parseJson(c.req.raw, mealLibraryAddSchema, maxBodyBytes);
    const result = await db.calendarMeals.add(profileId, input);
    return c.json(result.item, result.created ? 201 : 200);
  });
  app.all('/api/v1/profiles/:profileId/calendar/meals/:mealId', async c => {
    c.header('Cache-Control', 'no-store');
    const profileId = parsePathId(c.req.param('profileId'));
    await owned(c, db, profileId);
    if (!db.calendarMeals) throw new AppError(503, 'CALENDAR_UNAVAILABLE', 'Calendar is unavailable.');
    if (c.req.method === 'PUT' && db.calendarMeals.update) {
      const input = await parseJson(c.req.raw, mealLibraryUpdateSchema, maxBodyBytes);
      return c.json(await db.calendarMeals.update(profileId, parsePathId(c.req.param('mealId')), input));
    }
    if (c.req.method !== 'DELETE') throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    await db.calendarMeals.remove(profileId, parsePathId(c.req.param('mealId')));
    return c.body(null, 204);
  });
}
