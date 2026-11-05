import { readFile, writeFile } from 'node:fs/promises';
import { reviewedQuizQuestions } from '../../server/src/quiz-content-policy.mjs';
const write = process.argv.includes('--write');
if (process.argv.slice(2).some(arg => arg !== '--write')) throw new Error('Usage: remove-placeholder-quizzes.mjs [--write]');
for (const file of ['legacy-catalog.json', 'generated-catalog.json', 'expanded-catalog.json']) {
  const path = new URL(`../data/${file}`, import.meta.url);
  const items = JSON.parse(await readFile(path, 'utf8'));
  let removed = 0, changed = 0, empty = 0;
  for (const item of items) {
    const before = item.quiz_questions ?? [];
    const questions = reviewedQuizQuestions(before);
    if (questions.length === before.length) continue;
    removed += before.length - questions.length; changed++;
    item.quiz_questions = questions;
    if (!questions.length) empty++;
  }
  if (write && changed) await writeFile(path, JSON.stringify(items, null, 2) + '\n');
  console.log(JSON.stringify({ file, removed, changed_items: changed, emptied_quizzes: empty, written: write && changed > 0 }));
}
