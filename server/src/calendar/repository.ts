import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { AppError } from '../errors.js';
import { readMealLibrary } from './meals.js';
import { kidEventOccurrences } from './events.js';
import { systemEventsInWindow } from './system-events.js';
import { renameSeriesItem } from './names.js';
import { LIBRARY_CAP } from './catalog.js';
import { addDays, calendarDates, CALENDAR_TIMEZONE, weekday } from './dates.js';
import { CALENDAR_AREAS, itemsByArea, listBodySchema, renameItemSchema, studyLibrarySchema, writableItems, type StudyLibraryItem, type CalendarArea, type CalendarList, type CalendarRepository, type CalendarTemplateList, type CalendarWeekdayKey, type CalendarWindow, type ListWrite } from './contracts.js';

type Row = { id: string; scope: 'template' | 'date'; weekday: number | null; local_date: string | null; area: CalendarArea; items: unknown; revision: number };
const columns = "id,scope,weekday,to_char(local_date,'YYYY-MM-DD') AS local_date,area,items,revision";
const WEEKDAY_KEYS: CalendarWeekdayKey[] = ['1', '2', '3', '4', '5', '6', '7'];
const empty = (): CalendarTemplateList => ({ id: null, items: [], revision: 0, source: 'empty' });
export function createCalendarRepository(pool: Pool, options: { warn?: (message: string, details: { id: string; area: string }) => void } = {}): CalendarRepository {
  const warn = options.warn ?? ((message, details) => console.warn(message, details));
  function project(row: Row | undefined): CalendarList {
    if (!row) return empty();
    const parsed = itemsByArea[row.area].safeParse(row.items);
    if (!parsed.success) warn('Invalid stored calendar list dropped', { id: row.id, area: row.area });
    // Keep row identity/revision so a corrupt override stays empty and can be repaired.
    return { id: row.id, items: parsed.success ? parsed.data : [], revision: row.revision, source: row.scope === 'date' ? 'override' : 'template' };
  }
  async function transact<T>(profileId: string, action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,20261029))', [profileId]);
      const result = await action(client);
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  function checkRevision(expected: number, row: Row | undefined) {
    if (expected !== (row?.revision ?? 0)) throw new AppError(409, 'CALENDAR_REVISION_CONFLICT', 'The calendar list has changed.', { current: project(row) });
  }
  function editable(date: string, now: Date) {
    if (!calendarDates(now).editable(date)) throw new AppError(422, 'CALENDAR_DATE_NOT_EDITABLE', 'This calendar date is not editable.');
  }
  async function prune(client: PoolClient, profileId: string, today: string) {
    await client.query("DELETE FROM calendar_plan_lists WHERE profile_id=$1 AND scope='date' AND local_date<$2::date", [profileId, addDays(today, -14)]);
  }
  async function freezePastTemplate(client: PoolClient, profileId: string, area: CalendarArea, day: number, current: Row | undefined, now: Date) {
    const window = calendarDates(now), pastDate = addDays(window.start, day - 1);
    if (pastDate >= window.today) return;
    await client.query(`INSERT INTO calendar_plan_lists(id,profile_id,scope,local_date,area,items,revision)
      VALUES($1,$2,'date',$3::date,$4,$5::jsonb,1) ON CONFLICT (profile_id,local_date,area) WHERE scope='date' DO NOTHING`,
      [randomUUID(), profileId, pastDate, area, JSON.stringify(project(current).items)]);
  }

  /** Append new reminder lineage once. Never replace another weekday's foods or existing medicines. */
  async function appendMedicine(client: PoolClient, profileId: string, area: CalendarArea, day: number,
    current: Row | undefined, additions: NonNullable<ListWrite['medicine_repeats']>[number]['item'][]) {
    const next = [...project(current).items];
    let changed = false;
    for (const addition of additions) {
      const existing = next.find(item => 'series_id' in item && item.series_id === addition.series_id);
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(addition)) throw new AppError(422, 'VALIDATION_ERROR', 'Medicine reminder identity has different content.');
        continue;
      }
      next.push(addition); changed = true;
    }
    if (!changed) return current;
    if (next.length > (area === 'medicine' ? 6 : 8)) throw new AppError(422, 'CALENDAR_MEDICINE_FULL', 'A selected weekday is full.');
    const items = writableItems(area, next);
    if (current) return (await client.query<Row>(`UPDATE calendar_plan_lists SET items=$1::jsonb,revision=revision+1,updated_at=now() WHERE id=$2 AND profile_id=$3 RETURNING ${columns}`, [JSON.stringify(items), current.id, profileId])).rows[0];
    return (await client.query<Row>(`INSERT INTO calendar_plan_lists(id,profile_id,scope,weekday,area,items,revision)
      VALUES($1,$2,'template',$3,$4,$5::jsonb,1) RETURNING ${columns}`, [randomUUID(), profileId, day, area, JSON.stringify(items)])).rows[0];
  }

  return {
    async read(profileId, now) {
      const window = calendarDates(now);
      return transact(profileId, async client => {
        const rows = (await client.query<Row>(`SELECT ${columns} FROM calendar_plan_lists WHERE profile_id=$1 AND (scope='template' OR local_date BETWEEN $2::date AND $3::date)`, [profileId, window.start, window.end])).rows;
        const projected = new Map(rows.map(row => [row.id, project(row)]));
        const weeks = window.weeks.map(week => ({ ...week, days: week.days.map(day => ({ ...day, lists: Object.fromEntries(CALENDAR_AREAS.map(area => {
          const row = rows.find(row => row.scope === 'date' && row.local_date === day.date && row.area === area)
            ?? rows.find(row => row.scope === 'template' && row.weekday === day.weekday && row.area === area);
          return [area, row ? projected.get(row.id)! : empty()];
        })) as Record<CalendarArea, CalendarList> })) }));
        // Template rows are already loaded; expose them independently of any date override.
        const templates = Object.fromEntries(WEEKDAY_KEYS.map(key => [key, Object.fromEntries(CALENDAR_AREAS.map(area => {
          const row = rows.find(row => row.scope === 'template' && row.weekday === Number(key) && row.area === area);
          return [area, row ? { ...projected.get(row.id)!, source: 'template' as const } : empty()];
        })) as Record<CalendarArea, CalendarTemplateList>])) as CalendarWindow['templates'];
        const studyRows = (await client.query<StudyLibraryItem>('SELECT id,subject,name FROM calendar_study_library WHERE profile_id=$1 ORDER BY created_at,id', [profileId])).rows;
        const study_library = studyRows.filter(row => studyLibrarySchema.safeParse({ subject: row.subject, name: row.name }).success);
        return { today: window.today, timezone: CALENDAR_TIMEZONE, weeks, templates, study_library, meal_library: await readMealLibrary(client, profileId), events: await kidEventOccurrences(client, profileId, window.start, window.end), system_events: systemEventsInWindow(window.start, window.end) } satisfies CalendarWindow;
      });
    },
    async upsert(profileId, raw, now) {
      const parsed = listBodySchema.safeParse(raw);
      if (!parsed.success) throw new AppError(422, 'VALIDATION_ERROR', 'Calendar input is invalid.');
      const input = parsed.data, items = writableItems(input.area, input.items), window = calendarDates(now);
      if (input.scope === 'date') editable(input.date, now);
      return transact(profileId, async client => {
        const key = input.scope === 'template' ? input.weekday : input.date;
        const predicate = input.scope === 'template' ? 'weekday=$3' : 'local_date=$3::date';
        const current = (await client.query<Row>(`SELECT ${columns} FROM calendar_plan_lists WHERE profile_id=$1 AND area=$2 AND ${predicate} AND scope=$4`, [profileId, input.area, key, input.scope])).rows[0];
        checkRevision(input.expected_revision, current);
        const repeatRevisions = input.expected_medicine_revisions ?? [];
        // Compare affected templates before the ordinary draft, under the same profile lock; any failure rolls back the whole save.
        for (const target of repeatRevisions) {
          const template = (await client.query<Row>(`SELECT ${columns} FROM calendar_plan_lists WHERE profile_id=$1 AND area=$2 AND scope='template' AND weekday=$3`, [profileId, input.area, target.weekday])).rows[0];
          checkRevision(target.expected_revision, template);
          await freezePastTemplate(client, profileId, input.area, target.weekday, template, now);
        }
        if (input.scope === 'template') await freezePastTemplate(client, profileId, input.area, input.weekday, current, now);
        let saved: Row | undefined;
        if (current) {
          saved = (await client.query<Row>(`UPDATE calendar_plan_lists SET items=$1::jsonb,revision=revision+1,updated_at=now() WHERE id=$2 AND profile_id=$3 RETURNING ${columns}`, [JSON.stringify(items), current.id, profileId])).rows[0];
        } else {
          saved = (await client.query<Row>(`INSERT INTO calendar_plan_lists(id,profile_id,scope,weekday,local_date,area,items,revision) VALUES($1,$2,$3,$4,$5::date,$6,$7::jsonb,1) RETURNING ${columns}`, [randomUUID(), profileId, input.scope, input.scope === 'template' ? input.weekday : null, input.scope === 'date' ? input.date : null, input.area, JSON.stringify(items)])).rows[0];
        }
        for (const target of repeatRevisions) {
          const additions = (input.medicine_repeats ?? []).filter(repeat => repeat.weekdays.includes(target.weekday)).map(repeat => repeat.item);
          // Re-read because the ordinary draft may have just changed this template or a date override.
          const template = (await client.query<Row>(`SELECT ${columns} FROM calendar_plan_lists WHERE profile_id=$1 AND area=$2 AND scope='template' AND weekday=$3`, [profileId, input.area, target.weekday])).rows[0];
          const updatedTemplate = await appendMedicine(client, profileId, input.area, target.weekday, template, additions);
          if (input.scope === 'template' && input.weekday === target.weekday) saved = updatedTemplate;
          // Future date-only plans retain their contents and gain the new weekly reminder too. Past copies stay frozen.
          const overrides = (await client.query<Row>(`SELECT ${columns} FROM calendar_plan_lists WHERE profile_id=$1 AND area=$2 AND scope='date'
            AND local_date BETWEEN $3::date AND $4::date AND extract(isodow FROM local_date)::int=$5`, [profileId, input.area, window.today, window.end, target.weekday])).rows;
          for (const override of overrides) {
            const updated = await appendMedicine(client, profileId, input.area, target.weekday, override, additions);
            if (input.scope === 'date' && override.local_date === input.date) saved = updated;
          }
        }
        await prune(client, profileId, window.today);
        return project(saved);
      });
    },
    async deleteOverride(profileId, input, now) {
      writableItems(input.area, []); editable(input.date, now);
      return transact(profileId, async client => {
        const current = (await client.query<Row>(`SELECT ${columns} FROM calendar_plan_lists WHERE profile_id=$1 AND scope='date' AND local_date=$2::date AND area=$3`, [profileId, input.date, input.area])).rows[0];
        if (!current) throw new AppError(404, 'CALENDAR_LIST_NOT_FOUND', 'Calendar override not found.');
        checkRevision(input.expected_revision, current);
        await client.query('DELETE FROM calendar_plan_lists WHERE id=$1 AND profile_id=$2', [current.id, profileId]);
        await prune(client, profileId, calendarDates(now).today);
      });
    },
    async addStudy(profileId, raw) {
      const parsed = studyLibrarySchema.safeParse(raw);
      if (!parsed.success) throw new AppError(422, 'VALIDATION_ERROR', 'Subject input is invalid.');
      const input = parsed.data;
      return transact(profileId, async client => {
        const existing = (await client.query<StudyLibraryItem>('SELECT id,subject,name FROM calendar_study_library WHERE profile_id=$1 AND subject=$2 AND name=$3', [profileId, input.subject, input.name])).rows[0];
        if (existing) return existing;
        const count = (await client.query<{ n: number }>('SELECT count(*)::int AS n FROM calendar_study_library WHERE profile_id=$1', [profileId])).rows[0]?.n ?? 0;
        if (count >= LIBRARY_CAP) throw new AppError(422, 'CALENDAR_LIBRARY_FULL', 'The subject library is full.');
        const row = (await client.query<StudyLibraryItem>('INSERT INTO calendar_study_library(id,profile_id,subject,name) VALUES($1,$2,$3,$4) RETURNING id,subject,name', [randomUUID(), profileId, input.subject, input.name])).rows[0];
        if (!row) throw new AppError(500, 'INTERNAL_ERROR', 'Could not save the subject.');
        return row;
      });
    },
    async removeStudy(profileId, id) {
      return transact(profileId, async client => {
        const result = await client.query('DELETE FROM calendar_study_library WHERE id=$1 AND profile_id=$2', [id, profileId]);
        if (result.rowCount !== 1) throw new AppError(404, 'CALENDAR_LIST_NOT_FOUND', 'Subject not found.');
      });
    },
    async updateStudy(profileId, id, input) {
      return transact(profileId, async client => {
        const current = (await client.query<StudyLibraryItem>('SELECT id,subject,name FROM calendar_study_library WHERE id=$1 AND profile_id=$2', [id, profileId])).rows[0];
        if (!current) throw new AppError(404, 'CALENDAR_LIST_NOT_FOUND', 'Subject not found.');
        if (current.subject !== input.expected_subject || current.name !== input.expected_name) throw new AppError(409, 'CALENDAR_REVISION_CONFLICT', 'The favorite has changed.');
        const duplicate = (await client.query<StudyLibraryItem>('SELECT id,subject,name FROM calendar_study_library WHERE profile_id=$1 AND subject=$2 AND name=$3', [profileId, input.subject, input.name])).rows[0];
        if (duplicate && duplicate.id !== id) {
          await client.query('DELETE FROM calendar_study_library WHERE id=$1 AND profile_id=$2', [id, profileId]);
          return duplicate;
        }
        const row = (await client.query<StudyLibraryItem>('UPDATE calendar_study_library SET subject=$1,name=$2 WHERE id=$3 AND profile_id=$4 RETURNING id,subject,name', [input.subject, input.name, id, profileId])).rows[0];
        if (!row) throw new AppError(500, 'INTERNAL_ERROR', 'Could not update the subject.');
        return row;
      });
    },
    async renameItem(profileId, raw, now) {
      const parsed = renameItemSchema.safeParse(raw);
      if (!parsed.success) throw new AppError(422, 'VALIDATION_ERROR', 'Rename input is invalid.');
      const input = parsed.data, window = calendarDates(now);
      if (input.date < window.start || input.date > window.end || input.area === 'medicine') throw new AppError(422, 'CALENDAR_DATE_NOT_EDITABLE', 'This item cannot be renamed.');
      return transact(profileId, async client => {
        const rows = (await client.query<Row>(`SELECT ${columns} FROM calendar_plan_lists WHERE profile_id=$1 AND area=$2 AND (scope='template' AND weekday=$3 OR scope='date' AND local_date BETWEEN $4::date AND $5::date)`, [profileId, input.area, weekday(input.date), window.start, window.end])).rows;
        const template = rows.find(row => row.scope === 'template');
        const effective = rows.find(row => row.scope === 'date' && row.local_date === input.date) ?? template;
        checkRevision(input.expected_revision, effective);
        checkRevision(input.expected_template_revision, template);
        const items = project(effective).items;
        const selected = items[input.index];
        if (!selected || 'medicine' in selected) throw new AppError(422, 'VALIDATION_ERROR', 'This item cannot be renamed.');
        const templateItems = project(template).items;
        const seriesId = 'series_id' in selected ? selected.series_id : undefined;
        const templateIndex = seriesId ? templateItems.findIndex(item => 'series_id' in item && item.series_id === seriesId) : effective === template ? input.index : -1;
        const repeating = template !== undefined && templateIndex >= 0;
        const rename = (values: typeof items, index: number, id?: string) => {
          const renamed = renameSeriesItem<object>(values, index, input.name);
          if (id && renamed[index]) renamed[index] = { ...renamed[index], series_id: id };
          return writableItems(input.area, renamed);
        };
        const update = async (row: Row, next: typeof items) => {
          await client.query('UPDATE calendar_plan_lists SET items=$1::jsonb,revision=revision+1,updated_at=now() WHERE id=$2 AND profile_id=$3', [JSON.stringify(next), row.id, profileId]);
        };
        if (repeating) {
          const id = seriesId ?? randomUUID();
          const preserved = templateItems.map((item, index) => 'medicine' in item ? item : { ...item, series_id: index === templateIndex ? id : item.series_id ?? randomUUID() });
          // Freeze earlier occurrences before changing this weekday's template. Other weekdays and areas are never touched.
          for (const day of window.weeks.flatMap(week => week.days)) {
            if (day.weekday !== template.weekday || day.date >= input.date) continue;
            await client.query(`INSERT INTO calendar_plan_lists(id,profile_id,scope,local_date,area,items,revision) VALUES($1,$2,'date',$3::date,$4,$5::jsonb,1) ON CONFLICT (profile_id,local_date,area) WHERE scope='date' DO NOTHING`, [randomUUID(), profileId, day.date, input.area, JSON.stringify(preserved)]);
          }
          await update(template, rename(writableItems(input.area, preserved), templateIndex, id));
          for (const row of rows) {
            if (row.scope !== 'date' || !row.local_date || row.local_date < input.date) continue;
            const values = project(row).items;
            const index = row === effective ? input.index : seriesId ? values.findIndex(item => 'series_id' in item && item.series_id === seriesId) : -1;
            if (index >= 0) await update(row, rename(values, index, id));
          }
        } else if (effective) await update(effective, rename(items, input.index));
        // A renamed common item becomes a personal catalog choice. Existing entries keep their own stored names.
        if ('subject' in selected) {
          if (selected.name) {
            await client.query(`UPDATE calendar_study_library SET name=$1 WHERE profile_id=$2 AND subject=$3 AND name=$4 AND NOT EXISTS (SELECT 1 FROM calendar_study_library WHERE profile_id=$2 AND subject=$3 AND name=$1)`, [input.name, profileId, selected.subject, selected.name]);
          }
          await client.query(`INSERT INTO calendar_study_library(id,profile_id,subject,name) SELECT $1,$2,$3,$4 WHERE (SELECT count(*) FROM calendar_study_library WHERE profile_id=$2)<$5 ON CONFLICT (profile_id,subject,name) DO NOTHING`, [randomUUID(), profileId, selected.subject, input.name, LIBRARY_CAP]);
        } else {
          const food = selected.food === 'custom' ? selected.icon : selected.food;
          if (selected.food === 'custom') {
            await client.query(`UPDATE calendar_meal_library SET custom_name=$1 WHERE profile_id=$2 AND food_key=$3 AND custom_name=$4 AND NOT EXISTS (SELECT 1 FROM calendar_meal_library WHERE profile_id=$2 AND food_key=$3 AND custom_name=$1)`, [input.name, profileId, food, selected.name]);
          }
          await client.query(`INSERT INTO calendar_meal_library(id,profile_id,food_key,custom_name) SELECT $1,$2,$3,$4 WHERE (SELECT count(*) FROM calendar_meal_library WHERE profile_id=$2)<$5 ON CONFLICT DO NOTHING`, [randomUUID(), profileId, food, input.name, LIBRARY_CAP]);
        }
        const saved = (await client.query<Row>(`SELECT ${columns} FROM calendar_plan_lists WHERE id=$1 AND profile_id=$2`, [effective?.id, profileId])).rows[0];
        return project(saved);
      });
    },
  };
}
