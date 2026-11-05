import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  fetchDailyQuiz,
  fetchDailyQuizStatus,
  fetchItemQuiz,
  fetchItemQuizStatus,
  submitDailyQuiz,
  submitItemQuiz,
} from "../src/api/quiz.ts";
import {
  createQuizSession,
  dailyQuizCompletionMessage,
  mapShuffledAnswerIndices,
  type QuizQuestion,
} from "../src/types/quiz.ts";
import {
  getQuizQuestionViewState,
  getQuizStatusViewState,
} from "../src/components/Quiz/quizCardState.ts";

const question: QuizQuestion = {
  id: "question/1",
  item_id: "item/1",
  question_type: "single",
  question: "Which answer?",
  options: ["A", "B"],
  answer_count: 1,
  sort_order: 0,
};

function installFetch(responseBody: unknown) {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => {
    requests.push({ url: typeof input === "string" ? input : input.toString(), init });
    return Response.json(responseBody);
  }) as typeof fetch;
  return { originalFetch, requests };
}

test("quiz API uses the exact same-origin routes and preserves server results", async () => {
  const { originalFetch, requests } = installFetch({
    questions: [question],
    difficulty: "Easy",
  });

  try {
    await fetchItemQuiz("item/1", "vi et");
    await fetchItemQuizStatus("profile/1", "item/1");
    await submitItemQuiz("profile/1", "item/1", {
      answers: [{ question_id: "question/1", chosen_answers: [1] }],
    });
    await fetchDailyQuiz("profile/1", "vi et");
    await fetchDailyQuizStatus("profile/1");
    await submitDailyQuiz("profile/1", {
      answers: [{ question_id: "question/1", chosen_answers: [1] }],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(
    requests.map(({ url, init }) => ({
      url,
      method: init?.method ?? "GET",
      body: init?.body,
    })),
    [
      { url: "/api/v1/items/item%2F1/quiz?lang=vi%20et", method: "GET", body: undefined },
      {
        url: "/api/v1/profiles/profile%2F1/quiz/items/item%2F1/status",
        method: "GET",
        body: undefined,
      },
      {
        url: "/api/v1/profiles/profile%2F1/quiz/items/item%2F1/submit",
        method: "POST",
        body: JSON.stringify({ answers: [{ question_id: "question/1", chosen_answers: [1] }] }),
      },
      {
        url: "/api/v1/profiles/profile%2F1/quiz/daily?lang=vi%20et",
        method: "GET",
        body: undefined,
      },
      {
        url: "/api/v1/profiles/profile%2F1/quiz/daily/status",
        method: "GET",
        body: undefined,
      },
      {
        url: "/api/v1/profiles/profile%2F1/quiz/daily/submit",
        method: "POST",
        body: JSON.stringify({ answers: [{ question_id: "question/1", chosen_answers: [1] }] }),
      },
    ],
  );
});

test("public quiz data strips any accidental answer key from a service response", async () => {
  const { originalFetch } = installFetch({
    questions: [{ ...question, correct_answers: [0] }],
    difficulty: "Easy",
  });

  try {
    const result = await fetchItemQuiz("item/1");
    assert.deepEqual(result.questions[0], question);
    assert.equal("correct_answers" in result.questions[0]!, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("item quiz can request the selected profile's shared lessons", async () => {
  const { originalFetch, requests } = installFetch({ questions: [], difficulty: "Easy" });
  try {
    await fetchItemQuiz("item/1", "en", "profile/1");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requests[0]?.url, "/api/v1/items/item%2F1/quiz?lang=en&profile_id=profile%2F1");
});

test("public quiz type and overlay cannot contain correct answers", () => {
  for (const relativePath of [
    "src/types/quiz.ts",
    "src/api/quiz.ts",
    "src/components/Quiz/QuizOverlay.tsx",
  ]) {
    const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
    assert.equal(source.includes("correct_answers"), false, relativePath);
  }
});

test("shuffled option indices map back to the server's original indices", () => {
  assert.deepEqual(mapShuffledAnswerIndices([0, 2], [2, 0, 1]), [2, 1]);
});

test("quiz session construction keeps every displayed option paired with its original index", () => {
  const sourceQuestions: QuizQuestion[] = [
    { ...question, id: "q1", options: ["A1", "A2", "A3"] },
    { ...question, id: "q2", options: ["B1", "B2", "B3"] },
  ];
  const originalSnapshot = structuredClone(sourceQuestions);
  const randomValues = [0.1, 0.8, 0.3, 0.9, 0.2];
  let randomIndex = 0;

  const session = createQuizSession(
    sourceQuestions,
    () => randomValues[randomIndex++] ?? 0.4,
  );

  assert.equal(Object.isFrozen(session), true);
  assert.equal(Object.isFrozen(session.questions), true);
  for (const displayed of session.questions) {
    const original = sourceQuestions.find((candidate) => candidate.id === displayed.id)!;
    assert.deepEqual(
      displayed.options,
      displayed.shuffledToOriginal.map((index) => original.options[index]),
    );
    assert.equal(Object.isFrozen(displayed), true);
    assert.equal(Object.isFrozen(displayed.options), true);
    assert.equal(Object.isFrozen(displayed.shuffledToOriginal), true);
  }
  assert.deepEqual(sourceQuestions, originalSnapshot);
});

test("independent Strict Mode-style session builds are each internally consistent", () => {
  const sourceQuestions: QuizQuestion[] = [
    { ...question, id: "q1", options: ["A1", "A2", "A3"] },
    { ...question, id: "q2", options: ["B1", "B2", "B3"] },
  ];
  const first = createQuizSession(sourceQuestions, () => 0);
  const second = createQuizSession(sourceQuestions, () => 0.99);

  for (const session of [first, second]) {
    for (const displayed of session.questions) {
      const original = sourceQuestions.find((candidate) => candidate.id === displayed.id)!;
      assert.deepEqual(
        displayed.options,
        displayed.shuffledToOriginal.map((index) => original.options[index]),
      );
    }
  }
  assert.notDeepEqual(first, second);
});

test("item quiz completion refreshes status without closing the active overlay", () => {
  for (const relativePath of [
    "src/components/Quiz/QuizCard.tsx",
  ]) {
    const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
    assert.match(source, /onComplete=\{handleComplete\}/, relativePath);
    assert.match(source, /onClose=\{\(\) => setShowQuiz\(false\)\}/, relativePath);
    // Ownership changes also close stale overlays; only inspect the completion
    // handler here. Browser regressions verify both lifecycle behaviors.
    const start = source.indexOf('function handleComplete(');
    assert.ok(start >= 0, relativePath);
    const handler = source.slice(start, source.indexOf('\n  }', start));
    assert.doesNotMatch(handler, /setShowQuiz\(false\)/, `${relativePath}: completion must not close the overlay`);
    assert.match(handler, /queryClient\.(invalidateQueries|refetchQueries)/, relativePath);
  }
});

test("item quiz waits for Start Quiz and distinguishes unavailable and failed states", () => {
  assert.equal(getQuizStatusViewState(true, false, undefined), "loading");
  assert.equal(getQuizStatusViewState(false, true, undefined), "error");
  assert.equal(getQuizStatusViewState(false, false, { attempt_count: 0, passed: false, best_score: 0, best_total: 0, latest_score: 0, latest_total: 0 }), "unstarted");
  assert.equal(getQuizStatusViewState(false, false, { attempt_count: 1, passed: false, best_score: 0, best_total: 1, latest_score: 0, latest_total: 1 }), "failed");
  assert.equal(getQuizQuestionViewState({ showQuiz: false, isLoading: false, isFetching: false, hasError: false, questionCount: undefined }), "hidden");
  assert.equal(getQuizQuestionViewState({ showQuiz: true, isLoading: true, isFetching: true, hasError: false, questionCount: undefined }), "loading");
  assert.equal(getQuizQuestionViewState({ showQuiz: true, isLoading: false, isFetching: false, hasError: true, questionCount: undefined }), "error");
  assert.equal(getQuizQuestionViewState({ showQuiz: true, isLoading: false, isFetching: false, hasError: false, questionCount: 0 }), "empty");
});

test("daily completion copy reflects the server's passed result", () => {
  assert.match(dailyQuizCompletionMessage(true), /done|tomorrow/i);
  assert.doesNotMatch(dailyQuizCompletionMessage(false), /done|tomorrow/i);

  const overlaySource = readFileSync(
    new URL("../src/components/Quiz/QuizOverlay.tsx", import.meta.url),
    "utf8",
  );
  assert.match(overlaySource, /dailyQuizCompletionMessage\(completion\.passed\)/);
  assert.doesNotMatch(overlaySource, /optionIndexMapsRef/);
});
