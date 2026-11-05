import { z } from 'zod';
import { STUDY_KEYS, MEAL_FOOD_KEYS, MEDICINE_METHOD_KEYS, MEDICINE_COLOR_KEYS, CALENDAR_NAME_MAX } from './catalog.js';
import { CALENDAR_TIMEZONE, isCivilDate, type Weekday } from './dates.js';
import type { MealLibraryItem } from './meals.js';
import type { CalendarEventOccurrence } from './events.js';
import type { SystemEventKey } from './catalog.js';
import { AppError } from '../errors.js';
export const CALENDAR_AREAS = ['study_morning', 'study_afternoon', 'study_extra', 'meal_breakfast', 'meal_lunch', 'meal_snack', 'meal_dinner', 'medicine'] as const;
export const areaSchema = z.enum(CALENDAR_AREAS);
export type CalendarArea = z.infer<typeof areaSchema>;
export const civilDateSchema = z.string().refine(isCivilDate, 'Expected a valid YYYY-MM-DD civil date');
const revision = z.number().int().min(0).max(2147483646);
const cleanedText = (max: number) => z.string().max(1024).transform(value => value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim()).pipe(z.string().min(1).max(max));
export const studyItemSchema = z.object({ subject: z.enum(STUDY_KEYS), teaching_language: z.enum(['en', 'vi']).optional(), name: cleanedText(CALENDAR_NAME_MAX).optional(), series_id: z.string().uuid().optional() }).strict();
// Empty key sets intentionally reject unreviewed foods, methods and icons.
export const medicineItemSchema = z.object({ medicine: z.object({ method: z.enum(MEDICINE_METHOD_KEYS), color: z.enum(MEDICINE_COLOR_KEYS), qty: z.number().int().min(1).max(20), dose: cleanedText(16).optional() }).strict(), series_id: z.string().uuid().optional() }).strict();
export const mealItemSchema = z.union([
  z.object({ food: z.enum(MEAL_FOOD_KEYS), series_id: z.string().uuid().optional() }).strict(),
  z.object({ food: z.literal('custom'), icon: z.enum(MEAL_FOOD_KEYS), name: cleanedText(CALENDAR_NAME_MAX), series_id: z.string().uuid().optional() }).strict(),
  medicineItemSchema,
]);
export const studyItemsSchema = z.array(studyItemSchema).max(8);
export const mealItemsSchema = z.array(mealItemSchema).max(8);
export const medicineItemsSchema = z.array(medicineItemSchema).max(6);
export const itemsByArea = { study_morning: studyItemsSchema, study_afternoon: studyItemsSchema, study_extra: studyItemsSchema, meal_breakfast: mealItemsSchema, meal_lunch: mealItemsSchema, meal_snack: mealItemsSchema, meal_dinner: mealItemsSchema, medicine: medicineItemsSchema };
export type CalendarItems = z.infer<typeof studyItemsSchema> | z.infer<typeof mealItemsSchema> | z.infer<typeof medicineItemsSchema>;
const repeatWeekdays = z.array(z.number().int().min(1).max(7)).min(1).max(7).refine(values => new Set(values).size === values.length);
export const medicineRepeatSchema = z.object({ item: medicineItemSchema.extend({ series_id: z.string().uuid() }), weekdays: repeatWeekdays }).strict();
const medicineRepeats = z.array(medicineRepeatSchema).min(1).max(8).refine(values => new Set(values.map(value => value.item.series_id)).size === values.length);
const medicineRevisions = z.array(z.object({ weekday: z.number().int().min(1).max(7), expected_revision: revision }).strict()).min(1).max(7);
const body = { area: areaSchema, items: z.array(z.unknown()), expected_revision: revision,
  medicine_repeats: medicineRepeats.optional(), expected_medicine_revisions: medicineRevisions.optional() };
export const listBodySchema = z.discriminatedUnion('scope', [
  z.object({ ...body, scope: z.literal('template'), weekday: z.number().int().min(1).max(7) }).strict(),
  z.object({ ...body, scope: z.literal('date'), date: civilDateSchema }).strict(),
]).superRefine((value, context) => {
  if (value.medicine_repeats || value.expected_medicine_revisions) {
    const selected = new Set(value.medicine_repeats?.flatMap(repeat => repeat.weekdays));
    const revisions = value.expected_medicine_revisions ?? [];
    if (!value.medicine_repeats || !value.expected_medicine_revisions || value.area.startsWith('study_') ||
        revisions.length !== selected.size || new Set(revisions.map(row => row.weekday)).size !== revisions.length ||
        revisions.some(row => !selected.has(row.weekday))) {
      context.addIssue({ code: 'custom', path: ['medicine_repeats'], message: 'Medicine repeats require exact weekday revisions and a meal or medicine area' });
    }
  }
  if (value.area === 'study_morning' || value.area === 'study_afternoon' || value.area === 'study_extra') {
    const parsed = studyItemsSchema.safeParse(value.items);
    if (!parsed.success) context.addIssue({ code: 'custom', path: ['items'], message: 'Expected at most eight study catalog entries' });
  }
});
export type ListWrite = z.infer<typeof listBodySchema>;
export const deleteOverrideSchema = z.object({ date: civilDateSchema, area: areaSchema, expected_revision: z.string().regex(/^(0|[1-9][0-9]*)$/).transform(Number).pipe(revision) }).strict();
export type DeleteOverride = z.infer<typeof deleteOverrideSchema>;
export const renameItemSchema = z.object({ date: civilDateSchema, area: areaSchema, index: z.number().int().min(0).max(7), name: cleanedText(CALENDAR_NAME_MAX), expected_revision: revision, expected_template_revision: revision }).strict();
export type RenameItemInput = z.infer<typeof renameItemSchema>;
export const studyLibrarySchema = z.object({ subject: z.enum(STUDY_KEYS), name: cleanedText(CALENDAR_NAME_MAX) }).strict();
export const studyLibraryUpdateSchema = studyLibrarySchema.extend({ expected_subject: z.enum(STUDY_KEYS), expected_name: z.string().max(CALENDAR_NAME_MAX) });
export interface StudyLibraryItem { id: string; subject: typeof STUDY_KEYS[number]; name: string }
export function writableItems(area: CalendarArea, items: unknown): CalendarItems {
  const result = itemsByArea[area].safeParse(items);
  if (!result.success) throw new AppError(422, 'VALIDATION_ERROR', 'Calendar items are invalid.');
  return result.data;
}
export interface CalendarList { id: string | null; items: CalendarItems; revision: number; source: 'template' | 'override' | 'empty' }
export type CalendarTemplateList = Omit<CalendarList, 'source'> & { source: 'template' | 'empty' };
export type CalendarWeekdayKey = '1' | '2' | '3' | '4' | '5' | '6' | '7';
export interface CalendarWindow {
  today: string; timezone: typeof CALENDAR_TIMEZONE;
  weeks: { start: string; days: { date: string; weekday: Weekday; is_past: boolean; lists: Record<CalendarArea, CalendarList> }[] }[];
  // Weekday templates only (Monday = '1'), so a date override never hides the weekly plan.
  templates: Record<CalendarWeekdayKey, Record<CalendarArea, CalendarTemplateList>>;
  meal_library: MealLibraryItem[]; study_library?: StudyLibraryItem[]; events: CalendarEventOccurrence[]; system_events: { key: SystemEventKey; date: string }[];
}
export interface CalendarRepository {
  read(profileId: string, now: Date): Promise<CalendarWindow>;
  upsert(profileId: string, input: ListWrite, now: Date): Promise<CalendarList>;
  deleteOverride(profileId: string, input: DeleteOverride, now: Date): Promise<void>;
  renameItem?(profileId: string, input: RenameItemInput, now: Date): Promise<CalendarList>;
  addStudy?(profileId: string, input: { subject: typeof STUDY_KEYS[number]; name: string }): Promise<StudyLibraryItem>;
  removeStudy?(profileId: string, id: string): Promise<void>;
  updateStudy?(profileId: string, id: string, input: z.infer<typeof studyLibraryUpdateSchema>): Promise<StudyLibraryItem>;
}
