import assert from 'node:assert/strict';
import test from 'node:test';
import { filterStudyChoices, orderStudyItems, setStudyLanguage, studyClubSectionHeight } from '../src/lib/calendarStudyPlan.ts';
import { addStudyKey } from '../src/lib/calendarHelpers.ts';

test('search matches English, Vietnamese and custom names without accents or case', () => {
  const entries = [{ en: 'Math', vi: 'Toán', name: 'Math A+' }, { en: 'Art', vi: 'Mỹ thuật' }];
  assert.deepEqual(filterStudyChoices(entries, 'TOAN'), [entries[0]]);
  assert.deepEqual(filterStudyChoices(entries, 'a+'), [entries[0]]);
  assert.deepEqual(filterStudyChoices(entries, 'my thuat'), [entries[1]]);
});

test('teaching language is optional and changes only the selected occurrence', () => {
  const item = { subject: 'math' as const, name: 'Math A+', series_id: 'lineage' };
  assert.deepEqual(setStudyLanguage(item, 'vi'), { ...item, teaching_language: 'vi' });
  assert.deepEqual(setStudyLanguage({ ...item, teaching_language: 'en' }, ''), item);
  assert.deepEqual(addStudyKey([{ subject: 'math', teaching_language: 'en' }], 'math'), [{ subject: 'math', teaching_language: 'en' }]);
});

test('morning and afternoon clubs are grouped last without mutating saved order', () => {
  const items = [{ subject: 'club_chess' as const }, { subject: 'math' as const }, { subject: 'club_coding' as const }, { subject: 'english' as const }];
  assert.deepEqual(orderStudyItems(items, 'study_afternoon'), [items[1], items[3], items[0], items[2]]);
  assert.deepEqual(orderStudyItems(items, 'study_morning'), [items[1], items[3], items[0], items[2]]);
  assert.deepEqual(orderStudyItems(items, 'study_extra'), items);
  assert.equal(items[0]?.subject, 'club_chess');
});

test('club section has a shared height bounded to leave space for subject overflow', () => {
  assert.equal(studyClubSectionHeight(240, 2), 66);
  assert.equal(studyClubSectionHeight(80, 2), 50);
  assert.equal(studyClubSectionHeight(20, 2), 0);
  assert.equal(studyClubSectionHeight(240, 0), 0);
});

test('study favorites toggle by subject and name regardless of language, including a full draft', async () => {
  const { addStudy, toggleStudy, hasStudy } = await import('../src/lib/calendarHelpers.ts');
  const favorite = { subject: 'math' as const, name: 'Toán vui' };
  const taught = { ...favorite, teaching_language: 'vi' as const, series_id: 'keep-lineage' };
  assert.equal(hasStudy([taught], favorite), true);
  assert.deepEqual(addStudy([taught], favorite), [taught]);
  assert.deepEqual(toggleStudy([taught], favorite), []);
  assert.deepEqual(toggleStudy([], favorite), [favorite]);
  const full = Array.from({ length: 8 }, (_, i) => ({ ...taught, name: `Subject ${i}` }));
  assert.equal(toggleStudy(full, favorite).length, 8);
  assert.equal(toggleStudy(full, { ...favorite, name: 'Subject 7' }).length, 7);
  assert.deepEqual(addStudy([taught], { ...favorite, name: 'Other Math' }), [taught, { ...favorite, name: 'Other Math' }]);
});
