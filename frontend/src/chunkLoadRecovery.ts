export const CHUNK_RELOAD_STORAGE_KEY = "plg-vite-preload-reload-at";
const RELOAD_GUARD_MS = 30_000;

interface ChunkLoadWindow {
  addEventListener(type: "vite:preloadError", listener: (event: Event) => void): void;
}

interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface ChunkLoadRecoveryOptions {
  window: ChunkLoadWindow;
  storage?: StringStorage;
  reload: () => void;
  now?: () => number;
}

/** Reload once when a deployment leaves an open tab pointing at an old chunk. */
export function installChunkLoadRecovery({
  window,
  storage,
  reload,
  now = Date.now,
}: ChunkLoadRecoveryOptions): void {
  let lastReloadAt: number | undefined;

  window.addEventListener("vite:preloadError", (event) => {
    const currentTime = now();
    let previousTime = lastReloadAt;
    try {
      const persistedTime = storage?.getItem(CHUNK_RELOAD_STORAGE_KEY);
      if (persistedTime !== null && persistedTime !== undefined) {
        const parsedTime = Number(persistedTime);
        if (Number.isFinite(parsedTime)) previousTime = parsedTime;
      }
    } catch {
      // Some privacy modes make sessionStorage inaccessible; use the in-memory guard.
    }

    if (previousTime !== undefined && currentTime - previousTime < RELOAD_GUARD_MS) return;

    lastReloadAt = currentTime;
    try {
      storage?.setItem(CHUNK_RELOAD_STORAGE_KEY, String(currentTime));
    } catch {
      // The reload still provides recovery when storage is unavailable.
    }
    event.preventDefault();
    reload();
  });
}
