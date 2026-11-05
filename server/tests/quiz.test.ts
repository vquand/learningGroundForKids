import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAnswerableQuizSize,
  chooseQuizLanguage,
  dailyAttemptDate,
  dailyStatusFromLatest,
  gradeQuizAnswers,
  parseQuizQuestionRecord,
  publicQuizQuestion,
} from "../src/quiz.js";
import type { QuizQuestionRecord } from "../src/contracts/db.js";

function question(overrides: Partial<QuizQuestionRecord> = {}): QuizQuestionRecord {
  return {
    id: "q-1",
    item_id: "item-1",
    lang: "en",
    question_type: "single",
    question: "Which answer?",
    options: ["A", "B", "C"],
    correct_answers: [1],
    sort_order: 0,
    is_active: true,
    ...overrides,
  };
}

test("public quiz questions preserve single and never expose answer keys", () => {
  const output = publicQuizQuestion(question());
  assert.deepEqual(output, {
    id: "q-1",
    item_id: "item-1",
    question_type: "single",
    question: "Which answer?",
    options: ["A", "B", "C"],
    answer_count: 1,
    sort_order: 0,
  });
  assert.equal("correct_answers" in output, false);
});

test("production language policy prefers requested, English, then alphabetical fallback", () => {
  assert.equal(chooseQuizLanguage(["en", "vi"], "vi"), "vi");
  assert.equal(chooseQuizLanguage(["vi", "en"], "fr"), "en");
  const languages = ["vi", "de", "es"];
  assert.equal(chooseQuizLanguage(languages, "fr"), "de");
  assert.equal(chooseQuizLanguage([...languages].reverse(), "fr"), "de");
  assert.deepEqual(languages, ["vi", "de", "es"]);
  assert.equal(chooseQuizLanguage([], "fr"), null);
});

test("runtime quiz mapping accepts supported types and rejects impossible active rows", () => {
  for (const questionType of ["yes_no", "single", "abc", "abcd", "multi"]) {
    assert.ok(parseQuizQuestionRecord({
      id: "q",
      itemId: "item",
      lang: "en",
      question: "Question?",
      questionType,
      options: ["A", "B"],
      correctAnswers: questionType === "multi" ? [0, 1] : [0],
      sortOrder: 0,
      isActive: true,
    }));
  }

  for (const invalid of [
    { questionType: "unknown" },
    { options: [] },
    { options: [""] },
    { correctAnswers: [] },
    { correctAnswers: [0, 0] },
    { correctAnswers: [2] },
    { questionType: "single", correctAnswers: [0, 1] },
  ]) {
    assert.equal(parseQuizQuestionRecord({
      id: "q",
      itemId: "item",
      lang: "en",
      question: "Question?",
      questionType: "multi",
      options: ["A", "B"],
      correctAnswers: [0, 1],
      sortOrder: 0,
      isActive: true,
      ...invalid,
    }), null);
  }
});

test("quiz size is capped at the HTTP answer limit", () => {
  assert.doesNotThrow(() => assertAnswerableQuizSize(100));
  assert.throws(() => assertAnswerableQuizSize(101), /100/);
});

test("daily attempt attribution uses the supplied UTC day", () => {
  const attributed = dailyAttemptDate("2040-02-03");
  assert.equal(attributed.toISOString(), "2040-02-03T12:00:00.000Z");
});

test("daily status keeps pass monotonic while reporting the latest score", () => {
  assert.deepEqual(dailyStatusFromLatest({ score: 2, total: 10 }, true), {
    attempted_today: true,
    passed: true,
    score: 2,
    total: 10,
  });
});

test("grading derives score and pass state from server-side answer keys", () => {
  const result = gradeQuizAnswers(
    [question(), question({ id: "q-2", sort_order: 1, correct_answers: [0, 2], options: ["A", "B", "C"] })],
    [
      { question_id: "q-1", chosen_answers: [1] },
      { question_id: "q-2", chosen_answers: [2, 0] },
    ],
    0.8,
  );
  assert.deepEqual(result, {
    score: 2,
    total: 2,
    passed: true,
    answers: [
      { question_id: "q-1", chosen_answers: [1], is_correct: true },
      { question_id: "q-2", chosen_answers: [2, 0], is_correct: true },
    ],
  });
});

test("item and daily grading use their distinct thresholds", () => {
  const questions = Array.from({ length: 10 }, (_, index) => question({ id: `q-${index}`, sort_order: index }));
  const answers = questions.map((value, index) => ({
    question_id: value.id,
    chosen_answers: [index < 7 ? 1 : 0],
  }));
  assert.equal(gradeQuizAnswers(questions, answers, 0.8).passed, false);
  assert.equal(gradeQuizAnswers(questions, answers, 0.7).passed, true);
});

for (const [name, answers] of [
  ["missing question", [{ question_id: "q-1", chosen_answers: [1] }]],
  ["foreign question", [{ question_id: "q-1", chosen_answers: [1] }, { question_id: "foreign", chosen_answers: [0] }]],
  ["duplicate question", [{ question_id: "q-1", chosen_answers: [1] }, { question_id: "q-1", chosen_answers: [1] }]],
  ["duplicate choice", [{ question_id: "q-1", chosen_answers: [1, 1] }]],
  ["out of range choice", [{ question_id: "q-1", chosen_answers: [3] }]],
  ["empty choice", [{ question_id: "q-1", chosen_answers: [] }]],
] as const) {
  test(`rejects ${name} answers`, () => {
    assert.throws(
      () => gradeQuizAnswers(
        name === "missing question" ? [question(), question({ id: "q-2", sort_order: 1 })] : [question()],
        answers,
        0.8,
      ),
      (error: unknown) => error instanceof Error && error.name === "AppError",
    );
  });
}

test('authoring rejects placeholder association and category questions', async () => {
  const { quizContentValidationError } = await import('../src/quiz.js');
  for (const prompt of ['Which country or region is Fava associated with?', 'Fava gắn liền với nơi nào?', 'What kind of learning item is Fava?']) {
    assert.match(quizContentValidationError({ question: prompt, questionType: 'single', options: ['Turkey', 'Japan', 'France'], correctAnswers: [0] }) ?? '', /placeholder/i);
  }
});
