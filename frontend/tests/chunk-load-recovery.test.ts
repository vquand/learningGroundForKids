import assert from "node:assert/strict";
import test from "node:test";

import { installChunkLoadRecovery } from "../src/chunkLoadRecovery.ts";

interface FakeWindow {
  addEventListener: (type: string, listener: (event: Event) => void) => void;
}

function fakeWindow() {
  let listener: ((event: Event) => void) | undefined;
  const window: FakeWindow = {
    addEventListener(type, next) {
      assert.equal(type, "vite:preloadError");
      listener = next;
    },
  };
  return { window, trigger: (event: Event) => listener?.(event) };
}

function fakeStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    value: (key: string) => values.get(key),
  };
}

test("refreshes once when Vite cannot load a dynamic chunk", () => {
  const { window, trigger } = fakeWindow();
  const storage = fakeStorage();
  let reloads = 0;
  const event = new Event("vite:preloadError", { cancelable: true });

  installChunkLoadRecovery({ window, storage, reload: () => { reloads += 1; }, now: () => 1_000 });
  trigger(event);

  assert.equal(reloads, 1);
  assert.equal(event.defaultPrevented, true);
  assert.equal(storage.value("plg-vite-preload-reload-at"), "1000");
});

test("does not loop when the reload still encounters the missing chunk", () => {
  const { window, trigger } = fakeWindow();
  const storage = fakeStorage({ "plg-vite-preload-reload-at": "1000" });
  let reloads = 0;
  const event = new Event("vite:preloadError", { cancelable: true });

  installChunkLoadRecovery({ window, storage, reload: () => { reloads += 1; }, now: () => 1_001 });
  trigger(event);

  assert.equal(reloads, 0);
  assert.equal(event.defaultPrevented, false);
});
