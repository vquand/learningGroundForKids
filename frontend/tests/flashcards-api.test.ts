import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  fetchFlashcardDeck,
  fetchFlashcardDeckOptions,
  recordFlashcardStudySession,
} from "../src/api/flashcards.ts";
import {
  MAX_VIEWED_FLASHCARD_IDS,
  buildFlashcardStudySessionInput,
  createFlashcardStudyState,
  rateFlashcard,
  viewFlashcard,
  type FlashcardDeck,
} from "../src/types/flashcard.ts";

function installFetch(responseBodies: unknown[]) {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  let responseIndex = 0;
  globalThis.fetch = (async (input, init) => {
    requests.push({ url: typeof input === "string" ? input : input.toString(), init });
    const responseBody = responseBodies[responseIndex++];
    return responseBody === undefined
      ? new Response(null, { status: 204 })
      : Response.json(responseBody);
  }) as typeof fetch;
  return { originalFetch, requests };
}

test("flashcard API uses exact encoded same-origin routes without client catalog inputs", async () => {
  const deck: FlashcardDeck = {
    theme_type: "country",
    theme_value: "sea & islands",
    title: "Island cards",
    description: "Study islands",
    cards: [],
    available_cards: 0,
    item_count: 0,
  };
  const { originalFetch, requests } = installFetch([[], deck]);
  try {
    await fetchFlashcardDeckOptions("item/1", "vi et");
    await fetchFlashcardDeck(
      "profile/1",
      "item/1",
      "vi et",
      "country",
      "sea & islands",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(
    requests.map(({ url, init }) => ({ url, method: init?.method ?? "GET", body: init?.body })),
    [
      {
        url: "/api/v1/items/item%2F1/flashcards/options?lang=vi%20et",
        method: "GET",
        body: undefined,
      },
      {
        url: "/api/v1/profiles/profile%2F1/items/item%2F1/flashcards/deck?lang=vi%20et&theme_type=country&theme_value=sea%20%26%20islands",
        method: "GET",
        body: undefined,
      },
    ],
  );
  const source = readFileSync(new URL("../src/api/flashcards.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /_detail|_items/);
});

test("flashcard options can request the selected profile's shared lessons", async () => {
  const { originalFetch, requests } = installFetch([[]]);
  try {
    await fetchFlashcardDeckOptions("item/1", "en", "profile/1");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requests[0]?.url, "/api/v1/items/item%2F1/flashcards/options?lang=en&profile_id=profile%2F1");
});

test("flashcard session POST sends raw study data without client-derived fields", async () => {
  const { originalFetch, requests } = installFetch([undefined]);
  const input = {
    profile_id: "profile/1",
    focus_item_id: "item/1",
    theme_type: "item" as const,
    theme_value: "item/1",
    lang: "vi et",
    viewed_flashcard_ids: ["card/1", "card/2"],
    responses: [
      { flashcard_id: "card/1", rating: "got_it" as const },
      { flashcard_id: "card/2", rating: "review_again" as const },
    ],
    started_at: "2026-09-20T01:02:03.000Z",
    cards_shown: 999,
    got_it_count: 999,
    review_again_count: 999,
    completed_at: "client-owned",
  };

  try {
    await recordFlashcardStudySession(input);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(
    requests.map(({ url, init }) => ({ url, method: init?.method, body: init?.body })),
    [{
      url: "/api/v1/profiles/profile%2F1/flashcard-study-sessions",
      method: "POST",
      body: JSON.stringify({
        focus_item_id: "item/1",
        theme_type: "item",
        theme_value: "item/1",
        lang: "vi et",
        viewed_flashcard_ids: ["card/1", "card/2"],
        responses: [
          { flashcard_id: "card/1", rating: "got_it" },
          { flashcard_id: "card/2", rating: "review_again" },
        ],
        started_at: "2026-09-20T01:02:03.000Z",
      }),
    }],
  );
});

test("flashcard session POST omits an unspecified focus item instead of sending null", async () => {
  const { originalFetch, requests } = installFetch([undefined]);

  try {
    await recordFlashcardStudySession({
      profile_id: "profile/1",
      theme_type: "category",
      theme_value: "food",
      lang: "en",
      viewed_flashcard_ids: ["card/1"],
      responses: [{ flashcard_id: "card/1", rating: "got_it" }],
      started_at: "2026-09-20T01:02:03.000Z",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const requestBody = JSON.parse(String(requests[0]?.init?.body)) as Record<string, unknown>;
  assert.equal("focus_item_id" in requestBody, false);
  assert.deepEqual(requestBody, {
    theme_type: "category",
    theme_value: "food",
    lang: "en",
    viewed_flashcard_ids: ["card/1"],
    responses: [{ flashcard_id: "card/1", rating: "got_it" }],
    started_at: "2026-09-20T01:02:03.000Z",
  });
});

test("flashcard client avoids direct database SDKs and client-derived persistence fields", () => {
  for (const relativePath of [
    "src/api/flashcards.ts",
    "src/types/flashcard.ts",
    "src/components/Flashcards/FlashcardOverlay.tsx",
  ]) {
    const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /supa[a-z]*base/i, relativePath);
    for (const forbidden of [
      "cards_shown",
      "got_it_count",
      "review_again_count",
      "completed_at",
    ]) {
      assert.equal(source.includes(forbidden), false, `${relativePath}: ${forbidden}`);
    }
  }
});

test("viewed flashcard IDs retain the 15th unique ID, reject the 16th, and ignore duplicates", () => {
  assert.equal(MAX_VIEWED_FLASHCARD_IDS, 15);
  let state = createFlashcardStudyState("card-1", "2026-09-20T00:00:00.000Z");
  state = viewFlashcard(state, "card-1");
  for (let index = 2; index <= 16; index += 1) {
    state = viewFlashcard(state, `card-${index}`);
  }

  assert.equal(state.viewed_flashcard_ids.length, 15);
  assert.equal(new Set(state.viewed_flashcard_ids).size, 15);
  assert.equal(state.viewed_flashcard_ids.includes("card-15"), true);
  assert.equal(state.viewed_flashcard_ids.includes("card-16"), false);
});

test("the final synchronous rating is included in the exit payload", () => {
  let state = createFlashcardStudyState("card-1", "2026-09-20T00:00:00.000Z");
  state = rateFlashcard(state, "card-1", "got_it");
  state = viewFlashcard(state, "card-2");
  state = rateFlashcard(state, "card-2", "review_again");

  const payload = buildFlashcardStudySessionInput({
    profile_id: "profile-1",
    focus_item_id: "item-1",
    theme_type: "item",
    theme_value: "item-1",
    lang: "en",
  }, state);

  assert.deepEqual(payload.viewed_flashcard_ids, ["card-1", "card-2"]);
  assert.deepEqual(payload.responses, [
    { flashcard_id: "card-1", rating: "got_it" },
    { flashcard_id: "card-2", rating: "review_again" },
  ]);

  const overlaySource = readFileSync(
    new URL("../src/components/Flashcards/FlashcardOverlay.tsx", import.meta.url),
    "utf8",
  );
  assert.match(overlaySource, /sessionRef\.current\s*=\s*nextSession/);
  assert.match(overlaySource, /buildFlashcardStudySessionInput/);
});

test("restarting creates a fresh coherent session and exit is submission-guarded", () => {
  let previous = createFlashcardStudyState("old-card", "2026-09-20T00:00:00.000Z");
  previous = rateFlashcard(previous, "old-card", "got_it");

  const restarted = createFlashcardStudyState("new-first-card", "2026-09-20T01:00:00.000Z");
  assert.deepEqual(restarted, {
    viewed_flashcard_ids: ["new-first-card"],
    responses: [],
    started_at: "2026-09-20T01:00:00.000Z",
  });
  assert.notDeepEqual(restarted, previous);

  const overlaySource = readFileSync(
    new URL("../src/components/Flashcards/FlashcardOverlay.tsx", import.meta.url),
    "utf8",
  );
  assert.match(overlaySource, /function resetSession[\s\S]*createFlashcardStudyState/);
  assert.match(overlaySource, /if \(submissionPromiseRef\.current\) return;/);
  assert.doesNotMatch(overlaySource, /console\./);
});
