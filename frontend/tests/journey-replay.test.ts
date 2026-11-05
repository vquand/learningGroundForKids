import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import type { AnimationState } from "../src/types/journey.ts";
import { isJourneyDiagnosticsEnabled } from "../src/components/Journey/journeyDiagnostics.ts";
import { createJourneyReplayRequestController } from "../src/hooks/journeyReplayRequests.ts";
import { splitPathAtWorldEdges } from "../src/components/Journey/journeyPathWrap.ts";
import { createJourneyStateThrottle } from "../src/hooks/journeyReplayState.ts";

let server: ViteDevServer;
let itemPreviewLabel: (title: string) => string;
let clusterExpansionLabel: (count: number) => string;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    plugins: [],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  ({ itemPreviewLabel, clusterExpansionLabel } = await server.ssrLoadModule("/src/components/Map/mapMarkerLabels.ts"));
  const { loadUiLanguage } = await server.ssrLoadModule("/src/i18n/uiText.ts");
  await loadUiLanguage("vi");
});

after(async () => { await server.close(); });

const playing = (segmentProgress: number): AnimationState => ({ status: "playing", currentSegment: 0, segmentProgress, totalSegments: 2 });

test("a slower older journey period response cannot overwrite the newer response", async () => {
  const controller = createJourneyReplayRequestController();
  let route: string | null = null;
  let releaseSlow!: () => void;
  let releaseFast!: () => void;
  const slow = new Promise<string>((resolve) => { releaseSlow = () => resolve("slow"); });
  const fast = new Promise<string>((resolve) => { releaseFast = () => resolve("fast"); });
  const load = async (response: Promise<string>) => {
    const generation = controller.begin();
    assert.notEqual(generation, null);
    const value = await response;
    if (controller.isCurrent(generation!)) route = value;
  };
  const slowLoad = load(slow);
  const fastLoad = load(fast);
  releaseFast();
  await fastLoad;
  releaseSlow();
  await slowLoad;
  assert.equal(route, "fast");
});

test("an unmounted journey ignores a deferred response", async () => {
  const controller = createJourneyReplayRequestController();
  let release!: () => void;
  const deferred = new Promise<void>((resolve) => { release = resolve; });
  const generation = controller.begin();
  controller.unmount();
  release();
  await deferred;
  assert.equal(controller.isCurrent(generation!), false);
  assert.equal(controller.begin(), null);
});

test("a remounted journey accepts requests again", () => {
  const controller = createJourneyReplayRequestController();
  controller.unmount();
  assert.equal(controller.begin(), null);
  controller.mount();
  assert.notEqual(controller.begin(), null);
});

test("a route leg crossing the date line is split at the map edges, not drawn across the map", () => {
  const pieces = splitPathAtWorldEdges([[10, 170], [20, 190], [30, 210]], 0);
  assert.equal(pieces.length, 2);
  assert.deepEqual(pieces[0]!.at(-1), [15, 180]);
  assert.deepEqual(pieces[1]![0], [15, -180]);
  for (const piece of pieces) {
    for (let i = 1; i < piece.length; i++) assert.ok(Math.abs(piece[i]![1] - piece[i - 1]![1]) < 180);
  }
  assert.equal(splitPathAtWorldEdges([[0, 10], [5, 20]], 0).length, 1);
  assert.deepEqual(splitPathAtWorldEdges([], 0), []);
});

test("journey animation state updates publish immediately, then throttle playing updates", () => {
  let now = 1_000;
  const timers = new Map<number, () => void>();
  let nextTimer = 1;
  const refs = {
    statePublishedAtRef: { current: 0 },
    pendingAnimationStateRef: { current: null as AnimationState | null },
    stateUpdateTimeoutRef: { current: null as number | null },
  };
  const published: AnimationState[] = [];
  const throttle = createJourneyStateThrottle(
    refs,
    (state) => published.push(state),
    120,
    () => now,
    (callback) => { const id = nextTimer++; timers.set(id, callback); return id; },
    (id) => { timers.delete(id); },
  );
  throttle.handle(playing(0));
  assert.equal(published.length, 1);
  now = 1_050;
  throttle.handle(playing(0.2));
  throttle.handle(playing(0.4));
  assert.equal(published.length, 1);
  const timer = refs.stateUpdateTimeoutRef.current!;
  timers.get(timer)!();
  assert.equal(published.at(-1)?.segmentProgress, 0.4);
  throttle.handle({ status: "paused", currentSegment: 0, segmentProgress: 0.4, totalSegments: 2 });
  assert.equal(published.at(-1)?.status, "paused");
  throttle.handle(playing(0.5));
  throttle.reset();
  assert.equal(refs.pendingAnimationStateRef.current, null);
  assert.equal(refs.stateUpdateTimeoutRef.current, null);
});

test("journey diagnostics stay absent unless both development gates are enabled", () => {
  assert.equal(isJourneyDiagnosticsEnabled({ DEV: false, VITE_JOURNEY_DIAGNOSTICS: "true" }), false);
  assert.equal(isJourneyDiagnosticsEnabled({ DEV: true, VITE_JOURNEY_DIAGNOSTICS: "false" }), false);
  assert.equal(isJourneyDiagnosticsEnabled({ DEV: true, VITE_JOURNEY_DIAGNOSTICS: "true" }), true);
});

test("map marker and cluster labels localize through the shared UI message catalog", () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { lang: "vi" } } });
  try {
    assert.equal(itemPreviewLabel("Saola"), "Mở bản xem trước mục trên bản đồ: Saola");
    assert.equal(clusterExpansionLabel(12), "Mở rộng cụm có 12 mục");
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
