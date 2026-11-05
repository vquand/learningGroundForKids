interface RequestCallbacks<T> {
  start?: () => void;
  success?: (value: T) => void;
  error?: (error: unknown) => void;
  finish?: () => void;
}

/** Serialize a view's requests and discard callbacks from an invalidated owner. */
export function createRequestLifecycle(isCurrent: () => boolean) {
  let generation = 0;
  let active: symbol | null = null;
  return {
    get busy() { return active !== null; },
    invalidate() { generation++; active = null; },
    async run<T>(request: (isCurrent: () => boolean) => Promise<T>, callbacks: RequestCallbacks<T> = {}): Promise<void> {
      if (active || !isCurrent()) return;
      const token = Symbol('request');
      const expected = generation;
      const current = () => expected === generation && isCurrent();
      active = token;
      try {
        callbacks.start?.();
        const value = await request(current);
        if (current()) callbacks.success?.(value);
      } catch (error) {
        if (current()) callbacks.error?.(error);
      } finally {
        if (active === token) active = null;
        if (current()) callbacks.finish?.();
      }
    },
  };
}
