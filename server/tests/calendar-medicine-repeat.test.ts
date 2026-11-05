import assert from 'node:assert/strict';
import test from 'node:test';
import { listBodySchema, medicineItemSchema } from '../src/calendar/contracts.js';
const item = { medicine: { method: 'tablet', color: 'red', qty: 1 }, series_id: '11111111-1111-4111-8111-111111111111' };
const input = { scope: 'template', weekday: 4, area: 'medicine', items: [], expected_revision: 0,
  medicine_repeats: [{ item, weekdays: [1, 3, 5] }],
  expected_medicine_revisions: [1, 3, 5].map(weekday => ({ weekday, expected_revision: 0 })),
};
test('multi-weekday medicine writes require exact captured weekday revisions and valid medicine lineage', () => {
  assert.equal(listBodySchema.safeParse(input).success, true);
  assert.equal(medicineItemSchema.safeParse(item).success, true);
  for (const change of [
    { area: 'study_morning' }, { expected_medicine_revisions: [] },
    { expected_medicine_revisions: [...input.expected_medicine_revisions, { weekday: 2, expected_revision: 0 }] },
    { medicine_repeats: [{ item, weekdays: [] }] }, { medicine_repeats: [{ item, weekdays: [1, 1] }] },
    { medicine_repeats: [{ item, weekdays: [0, 8] }] },
    { medicine_repeats: [{ item: { ...item, series_id: undefined }, weekdays: [1, 3, 5] }] },
    { medicine_repeats: [{ item: { food: 'rice', series_id: item.series_id }, weekdays: [1, 3, 5] }] },
    { medicine_repeats: [{ item, weekdays: [1, 3, 5] }, { item, weekdays: [1] }] },
  ]) assert.equal(listBodySchema.safeParse({ ...input, ...change }).success, false, JSON.stringify(change));
});
