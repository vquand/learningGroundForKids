import assert from 'node:assert/strict';
import test from 'node:test';
import { publicQuestion } from '../src/questions/projection.js';
import { promptText } from '../src/questions/text.js';
import { ANIMALS, ANIMAL_NAMES, makeQuestion, QUESTION_ANIMAL_NAMES, QUESTION_ANIMALS } from '../src/road-racing/questions.js';
import { act, emptyProgress, startRace, publicState } from '../src/road-racing/game.js';
import { roadSettingsSchema } from '../src/road-racing/routes.js';

const added = ['rabbit', 'cat', 'dog', 'pig', 'sheep', 'goat', 'horse', 'donkey', 'deer', 'fox', 'bear', 'panda', 'lion', 'tiger', 'giraffe', 'zebra', 'elephant', 'monkey', 'turtle', 'penguin'];

for (const language of ['en', 'vi'] as const) {
  test(`all 27 picture animals appear once before fallback (${language})`, () => {
    const seen: string[] = [];
    const animals = new Set<string>();
    for (let i = 0; i < 27; i += 1) {
      const q = makeQuestion(language, 2 + i * 4, seen, () => 0);
      assert.equal(q.card.kind, 'picture');
      const animal = q.card.subject;
      assert.equal(animals.has(animal), false);
      animals.add(animal); seen.push(q.key);
      assert.equal(q.response.mode, 'choice');
      assert.equal(new Set(q.response.choices).size, 3);
      assert.ok(q.response.correct >= 0 && q.response.correct < 3);
      assert.ok(promptText(q.card, language).split(/\s+/).length < 10);
      assert.equal('correct' in publicQuestion(q), false);
    }
    for (const animal of [...ANIMALS, ...added]) assert.ok(animals.has(animal), animal);
    assert.equal(makeQuestion(language, 110, seen, () => 0).card.kind, 'compare');
  });
}

test('picture answers use server grading and cannot add racers or duplicate boosts', () => {
  for (const language of ['en', 'vi'] as const) for (const animal of QUESTION_ANIMALS) {
    const progress = startRace(emptyProgress(), { animal: 'capybara', difficulty: 'easy', language }, 1000, () => 0, 'picture-test');
    const q = makeQuestion(language, 2, QUESTION_ANIMALS.filter((candidate) => candidate !== animal).map((candidate) => `picture:${candidate}`), () => 0);
    assert.equal(q.card.kind, 'picture');
    assert.equal(q.card.subject, animal);
    assert.equal(q.response.mode, 'choice');
    const correct = q.response.mode === 'choice' ? q.response.correct : 0;
    assert.equal(q.response.choices[correct], QUESTION_ANIMAL_NAMES[animal][language === 'vi' ? 1 : 0]);
    progress.race!.question = q; progress.race!.sequence = 2; progress.race!.seen.push(q.key);
    const next = act(progress, { type: 'answer', questionId: q.id, choice: correct }, 1200, () => 0);
    assert.equal(next.race!.stacks.length, 1);
    assert.equal(publicState(next, 1200).race!.feedback!.answer, q.response.choices[correct]);
    assert.throws(() => act(next, { type: 'answer', questionId: q.id, choice: correct }, 1200, () => 0));
    if (added.includes(animal)) assert.equal(roadSettingsSchema.safeParse({ animal, language, difficulty: 'easy' }).success, false);
  }
});

test('roster names remain the shared catalog names', () => {
  assert.deepEqual(ANIMAL_NAMES.capybara, ['Capybara', 'Chuột lang nước']);
});
