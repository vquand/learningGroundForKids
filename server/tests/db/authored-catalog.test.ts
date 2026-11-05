import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCatalogSeed, catalogContentHash, type CatalogItem } from '../../src/db/catalog-seed.js';

const authored = () => ({
  category: 'landmark', latitude: 1, longitude: 2, is_published: true,
  translations: [{ lang: 'en', title: 'Reviewed place', description: 'An approved description.', history: 'An approved history.' }],
  content_review: { batch: 'exploring-30-2026-10-23', approved_at: '2026-10-23' },
  flashcards: [{ key: 'formation', lang: 'en', front: 'How did the cave form?', back: 'Water dissolved limestone.', sort_order: 0 }],
  quiz_questions: [{ key: 'lighting', lang: 'en', question: 'What colours the cave?', question_type: 'single', options: ['Lamps', 'Lava', 'Algae'], correct_answers: [0], sort_order: 0 }],
});

test('authored catalog cards replace generated prompts and retire obsolete rows without deleting history', () => {
  const item = authored();
  const seed = buildCatalogSeed([item], {});
  const cards = seed.statements.filter(s => s.text.startsWith('INSERT INTO flashcards'));
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0]!.values.slice(2, 5), ['en', 'How did the cave form?', 'Water dissolved limestone.']);
  assert.equal(cards[0]!.values[8], 'catalog_authored');
  assert.ok(seed.statements.some(s => s.text.startsWith('UPDATE flashcards') && s.text.includes('is_published = false')));
  assert.ok(seed.statements.some(s => s.text.startsWith('UPDATE quiz_questions') && s.text.includes('is_active = false')));
  assert.ok(seed.statements.every(s => !/DELETE FROM|TRUNCATE/i.test(s.text)));
  assert.deepEqual(seed, buildCatalogSeed([item], {}));
  const legacy: CatalogItem = { ...item };
  delete legacy.flashcards;
  const legacyQuiz = buildCatalogSeed([legacy], {}).statements.find(s => s.text.startsWith('INSERT INTO quiz_questions'))!;
  const reviewedQuiz = seed.statements.find(s => s.text.startsWith('INSERT INTO quiz_questions'))!;
  assert.notEqual(reviewedQuiz.values[0], legacyQuiz.values[0], 'new quiz identity preserves historical question rows');
});

test('authored flashcards participate in content hashes and fail closed on invalid definitions', () => {
  const item = authored();
  const changed = structuredClone(item); changed.flashcards[0]!.back = 'A changed explanation.';
  assert.notEqual(catalogContentHash(item), catalogContentHash(changed));
  for (const patch of [[], [{...item.flashcards[0]!, front: ''}], [{...item.flashcards[0]!, lang: 'vi'}], [...item.flashcards, ...item.flashcards]]) {
    assert.throws(() => buildCatalogSeed([{...item, flashcards: patch}], {}), /authored flashcard/i);
  }
  assert.throws(() => buildCatalogSeed([{...item, quiz_questions: [{...item.quiz_questions[0]!, key: ''}]}], {}), /authored quiz/i);
});
