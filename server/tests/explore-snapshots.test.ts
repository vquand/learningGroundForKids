import assert from 'node:assert/strict';
import { setImmediate, setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { SnapshotCache, snapshotIdentity, type SnapshotIdentity, type SnapshotStore } from '../src/explore/snapshots.js';

const key = (revision = '1', variant = '') => snapshotIdentity({ kind: 'common', catalogRevision: revision, scope: 'common', variant });
const validate = (value: unknown): { count: number } => {
  assert.ok(value && typeof value === 'object' && 'count' in value && typeof value.count === 'number');
  return value as { count: number };
};
function memoryStore() {
  const rows = new Map<string, unknown>();
  let claimed = 0, failed = 0, reads = 0;
  let publish = true;
  const store: SnapshotStore = {
    async read(identity) { reads++; return rows.get(identity.id) ?? null; },
    async claim() { return { state: 'claimed', fence: ++claimed }; },
    async complete(identity, _owner, _fence, value) { if (publish) rows.set(identity.id, value); return publish; },
    async fail() { failed++; },
  };
  return { store, rows, rejectPublish() { publish = false; }, stats: () => ({ claimed, failed, reads }) };
}

test('ten concurrent readers share one build and hot reads need no durable payload fetch', async () => {
  const db = memoryStore(), cache = new SnapshotCache(db.store);
  let builds = 0;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const build = async () => { builds++; await barrier; return { count: 2982 }; };
  const reads = Array.from({ length: 10 }, () => cache.get(key(), build, validate));
  await setImmediate();
  assert.equal(builds, 1); assert.equal(db.stats().claimed, 1);
  release();
  assert.deepEqual(await Promise.all(reads), Array.from({ length: 10 }, () => ({ count: 2982 })));
  const before = db.stats().reads;
  await cache.get(key(), build, validate);
  assert.equal(db.stats().reads, before);
  assert.equal(cache.stats.builds, 1);
  assert.equal(cache.stats.coalesced, 9);
});

test('a fresh API cache reuses the durable snapshot without source materialization', async () => {
  const db = memoryStore();
  await new SnapshotCache(db.store).get(key(), async () => ({ count: 4000 }), validate);
  const restarted = new SnapshotCache(db.store);
  assert.deepEqual(await restarted.get(key(), async () => { throw new Error('source must not be read'); }, validate), { count: 4000 });
  assert.equal(restarted.stats.durableHits, 1);
  assert.equal(restarted.stats.builds, 0);
});

test('a stale or reclaimed builder cannot return or admit its rejected snapshot', async () => {
  const db = memoryStore(); db.rejectPublish();
  const cache = new SnapshotCache(db.store);
  await assert.rejects(cache.get(key(), async () => ({ count: 1 }), validate), /revision|ownership/i);
  assert.equal(cache.stats.entries, 0);
  assert.equal(db.rows.size, 0);
});

test('failed in-flight work is removed so a later allowed attempt can recover', async () => {
  const db = memoryStore(), cache = new SnapshotCache(db.store);
  await assert.rejects(cache.get(key(), async () => { throw new Error('test failure'); }, validate), /test failure/);
  assert.equal(db.stats().failed, 1);
  assert.deepEqual(await cache.get(key(), async () => ({ count: 2 }), validate), { count: 2 });
  assert.equal(db.stats().claimed, 2);
});

test('timeout aborts the builder and retains admission until underlying work settles', async () => {
  const db = memoryStore(), cache = new SnapshotCache(db.store, { maxInFlight: 1, buildMs: 10 });
  let release!: () => void, aborted!: () => void;
  const stopped = new Promise<void>(resolve => { release = resolve; });
  const abort = new Promise<void>(resolve => { aborted = resolve; });
  const build = cache.get(key(), async signal => {
    signal.addEventListener('abort', aborted, { once: true });
    await stopped; // Models a DB query still waiting for its statement timeout.
    return { count: 1 };
  }, validate);
  const rejected = assert.rejects(build, /timed out/);
  await abort; await delay(5);
  try {
    assert.equal(cache.stats.inFlight, 1, 'unsettled source work must still occupy its slot');
    assert.equal(db.stats().failed, 0, 'do not surrender durable ownership while work is still running');
    await assert.rejects(cache.get(key('2'), async () => ({ count: 2 }), validate), /busy/);
  } finally { release(); await rejected; }
  assert.equal(db.rows.size, 0, 'a timed-out result must not be published');
  assert.equal(cache.stats.inFlight, 0);
  assert.equal(db.stats().failed, 1);
});

test('busy cross-process readers back off instead of repeatedly hitting PostgreSQL', async () => {
  const db = memoryStore();
  db.store.claim = async () => ({ state: 'busy' });
  const cache = new SnapshotCache(db.store, { waitMs: 350 });
  await assert.rejects(cache.get(key(), async () => ({ count: 1 }), validate), /busy/);
  assert.ok(db.stats().reads <= 5, `expected bounded polling, got ${db.stats().reads} reads`);
});

test('the source deadline is cleared before bounded snapshot publication starts', async () => {
  const db = memoryStore(); let sourceSignal!: AbortSignal;
  const complete = db.store.complete;
  db.store.complete = async (...args) => {
    await delay(30);
    assert.equal(sourceSignal.aborted, false, 'publication has its own database deadline');
    return complete(...args);
  };
  const cache = new SnapshotCache(db.store, { buildMs: 10 });
  assert.deepEqual(await cache.get(key(), async signal => { sourceSignal = signal; return { count: 1 }; }, validate), { count: 1 });
});

test('oversized payloads fail before publication and bounded memory evicts old entries', async () => {
  const db = memoryStore(), cache = new SnapshotCache(db.store, { maxEntries: 2, maxBytes: 100, maxPayloadBytes: 50 });
  await assert.rejects(cache.get(key(), async () => ({ count: 1, extra: 'x'.repeat(100) }), validate), /size|large/i);
  assert.equal(db.rows.size, 0);
  for (const revision of ['2', '3', '4']) await cache.get(key(revision), async () => ({ count: 1 }), validate);
  assert.equal(cache.stats.entries, 2);
  assert.equal(cache.stats.evictions, 1);
  assert.ok(cache.stats.bytes <= 100);
});

test('identity includes algorithm, revision, scope and variant, with no raw identity in storage keys', () => {
  const base = { kind: 'view' as const, catalogRevision: '1', visibilityRevision: '1', scope: 'family-a/child-a', variant: 'animal/year=2024/z=2' };
  const identities: SnapshotIdentity[] = [snapshotIdentity(base), snapshotIdentity({ ...base, catalogRevision: '2' }),
    snapshotIdentity({ ...base, visibilityRevision: '2' }), snapshotIdentity({ ...base, scope: 'family-a/child-b' }),
    snapshotIdentity({ ...base, variant: 'food/year=2024/z=2' })];
  assert.equal(new Set(identities.map(k => k.id)).size, identities.length);
  assert.ok(identities.every(k => /^[a-f0-9]{64}$/.test(k.id)));
});
