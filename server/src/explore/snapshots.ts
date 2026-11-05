import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { AppError } from '../errors.js';

export interface SnapshotIdentity {
  id: string;
  kind: 'common' | 'view';
  catalogRevision: string;
  visibilityRevision: string | null;
}
export interface SnapshotStore {
  read(key: SnapshotIdentity): Promise<unknown | null>;
  claim(key: SnapshotIdentity, owner: string): Promise<{ state: 'claimed'; fence: number } | { state: 'busy' } | { state: 'failed' }>;
  complete(key: SnapshotIdentity, owner: string, fence: number, value: unknown, bytes: number): Promise<boolean>;
  fail(key: SnapshotIdentity, owner: string, fence: number): Promise<void>;
}

/** Callers derive scope and CURRENT revisions after server authorization. */
export function snapshotIdentity(input: {
  kind: 'common' | 'view'; catalogRevision: string; visibilityRevision?: string;
  scope: string; variant: string;
}): SnapshotIdentity {
  if (!/^\d{1,19}$/.test(input.catalogRevision) ||
    (input.kind === 'view' && !/^\d{1,19}$/.test(input.visibilityRevision ?? '')) ||
    input.scope.length > 1024 || input.variant.length > 4096) throw new Error('Invalid snapshot identity');
  const visibilityRevision = input.kind === 'common' ? null : input.visibilityRevision!;
  return { id: createHash('sha256').update(JSON.stringify([
    'explore-snapshot-v1', input.kind, input.catalogRevision, visibilityRevision, input.scope, input.variant,
  ])).digest('hex'), kind: input.kind, catalogRevision: input.catalogRevision, visibilityRevision };
}

interface Entry { value: unknown; bytes: number }
interface Options {
  maxEntries: number; maxBytes: number; maxPayloadBytes: number;
  maxInFlight: number; waitMs: number; buildMs: number;
}

/** Bounded disposable memory over fenced durable snapshots. No auth lives here. */
export class SnapshotCache {
  private readonly memory = new Map<string, Entry>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private bytes = 0;
  private readonly options: Options;
  private readonly counters = { memoryHits: 0, durableHits: 0, builds: 0, coalesced: 0, waits: 0, evictions: 0 };

  constructor(private readonly store: SnapshotStore, options: Partial<Options> = {}) {
    this.options = { maxEntries: 32, maxBytes: 32 * 1024 * 1024, maxPayloadBytes: 8 * 1024 * 1024,
      maxInFlight: 32, waitMs: 5000, buildMs: 5000, ...options };
    if (Object.values(this.options).some(value => !Number.isSafeInteger(value) || value < 1)) throw new Error('Invalid snapshot limits');
  }

  get stats() { return { ...this.counters, entries: this.memory.size, bytes: this.bytes, inFlight: this.inFlight.size }; }

  get<T>(key: SnapshotIdentity, build: (signal: AbortSignal) => Promise<T>, validate: (value: unknown) => T): Promise<T> {
    // The key must come from a fresh DB revision/visibility check, not client
    // input or a long-lived revision cache. A hot value never authorizes access.
    const entry = this.memory.get(key.id);
    if (entry) {
      this.memory.delete(key.id); this.memory.set(key.id, entry);
      this.counters.memoryHits++;
      return Promise.resolve(entry.value as T);
    }
    const running = this.inFlight.get(key.id);
    if (running) { this.counters.coalesced++; return running as Promise<T>; }
    if (this.inFlight.size >= this.options.maxInFlight) return Promise.reject(new AppError(503, 'EXPLORE_CACHE_BUSY', 'Map preparation is busy. Try again shortly.'));
    const promise = this.load(key, build, validate).finally(() => { this.inFlight.delete(key.id); });
    this.inFlight.set(key.id, promise);
    return promise;
  }

  private size(value: unknown): number {
    const json = JSON.stringify(value);
    if (json === undefined) throw new Error('Invalid snapshot payload');
    const bytes = Buffer.byteLength(json);
    if (bytes > this.options.maxPayloadBytes) throw new AppError(503, 'EXPLORE_CACHE_TOO_LARGE', 'Prepared map exceeds the snapshot size limit.');
    return bytes;
  }

  private admit(key: string, value: unknown, bytes: number) {
    if (bytes > this.options.maxBytes) return;
    while (this.memory.size && (this.memory.size >= this.options.maxEntries || this.bytes + bytes > this.options.maxBytes)) {
      const first = this.memory.keys().next().value!;
      this.bytes -= this.memory.get(first)!.bytes; this.memory.delete(first); this.counters.evictions++;
    }
    this.memory.set(key, { value, bytes }); this.bytes += bytes;
  }

  private async load<T>(key: SnapshotIdentity, build: (signal: AbortSignal) => Promise<T>, validate: (value: unknown) => T): Promise<T> {
    const deadline = performance.now() + this.options.waitMs;
    let backoff = 100;
    while (true) {
      if (performance.now() >= deadline) throw new AppError(503, 'EXPLORE_CACHE_BUSY', 'Map preparation is busy. Try again shortly.');
      const stored = await this.store.read(key);
      if (stored !== null) {
        const value = validate(stored);
        this.admit(key.id, value, this.size(value)); this.counters.durableHits++;
        return value;
      }
      const owner = randomUUID();
      const claim = await this.store.claim(key, owner);
      if (claim.state === 'failed') throw new AppError(503, 'EXPLORE_CACHE_FAILED', 'Map preparation needs an operator retry.');
      if (claim.state === 'busy') {
        if (performance.now() >= deadline) throw new AppError(503, 'EXPLORE_CACHE_BUSY', 'Map preparation is busy. Try again shortly.');
        this.counters.waits++;
        await delay(Math.max(1, Math.ceil(Math.min(deadline - performance.now(), backoff + Math.random() * 25))));
        backoff = Math.min(225, backoff * 2);
        continue;
      }
      this.counters.builds++;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        timer = setTimeout(() => controller.abort(new AppError(503, 'EXPLORE_CACHE_TIMEOUT', 'Map preparation timed out.')), this.options.buildMs);
        // Retain both local admission and the durable lease until source work
        // actually stops. Sources enforce shorter DB statement timeouts and
        // check this signal before starting another query. A Promise.race alone
        // would detach still-running work and let retries grow without bound.
        const built = await build(controller.signal);
        controller.signal.throwIfAborted();
        clearTimeout(timer);
        const value = validate(built);
        const bytes = this.size(value);
        if (!await this.store.complete(key, owner, claim.fence, value, bytes)) {
          throw new AppError(503, 'EXPLORE_CACHE_STALE', 'Snapshot revision or job ownership changed. Retry the current view.');
        }
        this.admit(key.id, value, bytes);
        return value;
      } catch (error) {
        // A failed old owner cannot alter the reclaimed job; the store fences
        // every write. Preserve the original error if the DB is unavailable.
        await this.store.fail(key, owner, claim.fence).catch(() => undefined);
        throw error;
      } finally { clearTimeout(timer); }
    }
  }
}
