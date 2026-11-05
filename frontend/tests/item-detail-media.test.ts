import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer, type ViteDevServer } from "vite";
import {
  AudioPlaybackController,
  isAbortPlaybackError,
  isKnownPlaybackError,
} from "../src/components/ItemDetail/audioPlaybackState.ts";
import {
  getQuizQuestionViewState,
  getQuizStatusViewState,
} from "../src/components/Quiz/quizCardState.ts";

let server: ViteDevServer;
let QuizCard: ComponentType<{
  itemId: string;
  itemTitle: string;
  profileId: string;
  hasQuiz: boolean;
}>;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    plugins: [],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  ({ QuizCard } = await server.ssrLoadModule("/src/components/Quiz/QuizCard.tsx"));
});

after(async () => { await server.close(); });

test("audio play rejections distinguish aborts, real failures, stale attempts, and rapid taps", () => {
  assert.equal(isAbortPlaybackError({ name: "AbortError" }), true);
  assert.equal(isKnownPlaybackError({ name: "NotAllowedError" }), true);
  assert.equal(isKnownPlaybackError({ name: "NotSupportedError" }), true);
  assert.equal(isKnownPlaybackError(new Error("network-ish")), false);

  const controller = new AudioPlaybackController();
  const first = controller.toggle();
  const paused = controller.toggle();
  assert.equal(first.shouldPlay, true);
  assert.equal(paused.shouldPlay, false);
  assert.equal(controller.reject(first.token, { name: "AbortError" }), null);
  assert.equal(controller.isPlaybackWanted(), false);

  const secondPlay = controller.toggle();
  const rejection = controller.reject(secondPlay.token, { name: "NotAllowedError" });
  assert.deepEqual(rejection, { playing: false, loadError: true });

  const thirdPlay = controller.toggle();
  const fourthTap = controller.toggle();
  assert.equal(thirdPlay.shouldPlay, true);
  assert.equal(fourthTap.shouldPlay, false);
  assert.equal(controller.reject(thirdPlay.token, { name: "NotSupportedError" }), null);
  assert.equal(controller.isPlaybackWanted(), false);
});

test("audio cleanup invalidates pending work without publishing an error", () => {
  const controller = new AudioPlaybackController();
  const pending = controller.toggle();
  controller.unmount();
  assert.equal(controller.isMounted(), false);
  assert.equal(controller.reject(pending.token, { name: "NotAllowedError" }), null);
  assert.equal(controller.mediaError(), false);
});

test("QuizCard renders nothing for an item whose catalog says it has no quiz", () => {
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    createElement(QueryClientProvider, { client }, createElement(QuizCard, {
      itemId: "item-without-quiz",
      itemTitle: "A lesson",
      profileId: "profile-a",
      hasQuiz: false,
    })),
  );
  assert.equal(html, "");
  client.clear();
});

test("QuizCard status and post-start question states are behaviorally distinct", () => {
  assert.equal(getQuizStatusViewState(true, false, undefined), "loading");
  assert.equal(getQuizStatusViewState(false, true, undefined), "error");
  assert.equal(getQuizStatusViewState(false, false, { attempt_count: 0, passed: false, best_score: 0, best_total: 0, latest_score: 0, latest_total: 0 }), "unstarted");
  assert.equal(getQuizStatusViewState(false, false, { attempt_count: 1, passed: false, best_score: 0, best_total: 1, latest_score: 0, latest_total: 1 }), "failed");
  assert.equal(getQuizStatusViewState(false, false, { attempt_count: 1, passed: true, best_score: 1, best_total: 1, latest_score: 1, latest_total: 1 }), "passed");

  assert.equal(getQuizQuestionViewState({ showQuiz: false, isLoading: false, isFetching: false, hasError: false, questionCount: undefined }), "hidden");
  assert.equal(getQuizQuestionViewState({ showQuiz: true, isLoading: true, isFetching: true, hasError: false, questionCount: undefined }), "loading");
  assert.equal(getQuizQuestionViewState({ showQuiz: true, isLoading: false, isFetching: false, hasError: true, questionCount: undefined }), "error");
  assert.equal(getQuizQuestionViewState({ showQuiz: true, isLoading: false, isFetching: false, hasError: false, questionCount: 0 }), "empty");
  assert.equal(getQuizQuestionViewState({ showQuiz: true, isLoading: false, isFetching: false, hasError: false, questionCount: 2 }), "ready");
});
