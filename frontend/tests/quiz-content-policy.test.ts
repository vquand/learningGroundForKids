import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { isPlaceholderQuizQuestion } from '../../server/src/quiz-content-policy.mjs';
import { buildQuizQuestions } from '../scripts/catalog-crawler-lib.mjs';
import { normalizeCatalogItem } from '../scripts/catalog-content-review-lib.mjs';

test('association and category placeholders are banned in both languages', () => {
  for (const question of [
    'Which country or region is Fava (Turkish dish) associated with?',
    'Which country is Laksa most associated with?', 'Where is Fava associated with?',
    'Fava gắn liền với quốc gia hoặc vùng nào?', 'Fava gắn liền với nơi nào?',
    'What kind of learning item is a lemur?', 'Vượn thuộc loại nội dung học tập nào?',
  ]) assert.equal(isPlaceholderQuizQuestion(question), true, question);
  assert.equal(isPlaceholderQuizQuestion('Which ingredient gives lemonade its sour flavor?'), false);
  assert.deepEqual(buildQuizQuestions({ category: 'food', titleEn: 'Fava' }), []);
  const good = { question: 'Which ingredient gives lemonade its sour flavor?' };
  const normalized = normalizeCatalogItem({ category: 'food', translations: [], quiz_questions: [good, { question: 'Which country is Fava associated with?' }] });
  assert.deepEqual(normalized.quiz_questions, [good]);
});

test('all active fixture banks are free of placeholder quiz templates', async () => {
  for (const file of ['legacy-catalog.json', 'generated-catalog.json', 'expanded-catalog.json']) {
    const items = JSON.parse(await readFile(new URL(`../data/${file}`, import.meta.url), 'utf8'));
    for (const item of items) for (const question of item.quiz_questions ?? []) {
      assert.equal(isPlaceholderQuizQuestion(question.question), false, `${file}: ${question.question}`);
    }
  }
});
