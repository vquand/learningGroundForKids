import assert from 'node:assert/strict';
import test from 'node:test';
import { captureMedicineTemplateRevisions, toggleMedicineWeekday, withMedicineRepeats } from '../src/lib/calendarMedicineRepeats.ts';
import type { MealListWrite, MedicineRepeatDraft } from '../src/types/calendarMeals.ts';
const item = { medicine: { method: 'tablet' as const, color: 'red' as const, qty: 1 }, series_id: '11111111-1111-4111-8111-111111111111' };
test('weekday choices independently toggle in Monday-to-Sunday order and may be cleared', () => {
  assert.deepEqual(toggleMedicineWeekday([1, 5], 3), [1, 3, 5]);
  assert.deepEqual(toggleMedicineWeekday([1, 3, 5], 3), [1, 5]);
  assert.deepEqual(toggleMedicineWeekday([1], 1), []);
});
test('medicine broadcasts retain ordinary foods and send only selected captured weekday revisions', () => {
  const input: MealListWrite = { scope: 'date', date: '2026-10-29', area: 'meal_breakfast', items: [{ food: 'rice' }, item], expected_revision: 7 };
  const repeats: MedicineRepeatDraft[] = [{ item, weekdays: [1, 3, 5] }];
  const revisions = Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, expected_revision: i + 10 }));
  assert.deepEqual(withMedicineRepeats(input, repeats, revisions), { ...input, items: [{ food: 'rice' }], medicine_repeats: repeats, expected_medicine_revisions: [revisions[0], revisions[2], revisions[4]] });
  assert.equal(withMedicineRepeats(input, [], revisions), input);
  assert.equal(input.items.length, 2, 'draft is not mutated');
});

test('missing medicine template areas capture revision zero without breaking Save', () => {
  const data = { templates: { '1': { medicine: { revision: 12 } }, '3': {} } } as unknown as import('../src/types/calendar.ts').CalendarWindow;
  assert.deepEqual(captureMedicineTemplateRevisions(data, 'medicine'), Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, expected_revision: i === 0 ? 12 : 0 })));
  assert.ok(captureMedicineTemplateRevisions(data, 'meal_lunch').every(row => row.expected_revision === 0));
});
