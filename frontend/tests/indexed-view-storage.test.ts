import assert from 'node:assert/strict';
import test from 'node:test';
import { backgroundWrites, indexedViewStorage } from '../src/lib/indexedViewStorage.ts';

test('background writes are bounded, serialized, and recover from a failed write', async () => {
  const enqueue = backgroundWrites(2);
  const written: number[] = [];
  let release!: () => void;
  enqueue(() => new Promise(resolve => { release = resolve; }));
  enqueue(async () => { written.push(1); });
  enqueue(async () => { written.push(2); throw new Error('quota'); });
  enqueue(async () => { written.push(3); });
  assert.equal(written.length, 0);
  await new Promise(resolve => setTimeout(resolve, 10));
  release();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(written, [2, 3]);
  enqueue(async () => { written.push(4); });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(written, [2, 3, 4]);
});

test('unavailable IndexedDB remains an optional cache', async () => {
  const storage = indexedViewStorage('m2-cache-test');
  assert.equal(await storage.get('key'), undefined);
  await storage.put('key', { valid: true });
  assert.equal(await storage.get('key'), undefined);
});

test('IndexedDB reuses a connection, evicts using metadata only, and reopens after versionchange', async () => {
  const original = globalThis.indexedDB;
  const payloads = new Map<string, unknown>();
  const metadata = new Map<string, { id: string; bytes: number; touched: number; sequence: number }>();
  let opens = 0;
  let closes = 0;
  let current!: IDBDatabase;
  const fake = {
    open() {
      opens++;
      const db = {
        close() { closes++; },
        transaction() {
          const tx = {
            oncomplete: null as (() => void) | null,
            objectStore(name: string) {
              const rows = name === 'views' ? payloads : metadata;
              return {
                get(key: string) {
                  const request = { result: rows.get(key), onsuccess: null as (() => void) | null };
                  queueMicrotask(() => request.onsuccess?.());
                  return request;
                },
                put(value: unknown, key?: string) {
                  if (name === 'views') payloads.set(key!, value);
                  else { const row = value as { id: string; bytes: number; touched: number; sequence: number }; metadata.set(row.id, row); }
                },
                delete(key: string) { rows.delete(key); },
                index(index: string) {
                  assert.equal(name, 'metadata', 'eviction must never scan payloads');
                  assert.equal(index, 'touched');
                  return { openCursor() {
                    const sorted = [...metadata.values()].sort((a, b) => b.sequence - a.sequence || b.id.localeCompare(a.id));
                    let offset = 0;
                    const request = { result: undefined as unknown, onsuccess: null as (() => void) | null };
                    const advance = () => queueMicrotask(() => {
                      const row = sorted[offset++];
                      request.result = row ? { value: row, primaryKey: row.id, delete: () => metadata.delete(row.id), continue: advance } : null;
                      request.onsuccess?.();
                    });
                    advance();
                    return request;
                  } };
                },
              };
            },
          };
          setImmediate(() => tx.oncomplete?.());
          return tx;
        },
      };
      current = db as unknown as IDBDatabase;
      const request = { result: db, onsuccess: null as (() => void) | null };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
  try {
    globalThis.indexedDB = fake as unknown as IDBFactory;
    const storage = indexedViewStorage('metadata-test', 2, 100);
    const now = Date.now;
    Date.now = () => 100;
    try {
      await storage.put('z', { value: 'z' });
      await storage.put('y', { value: 'y' });
      await storage.put('a', { value: 'a' });
      assert.equal(await storage.get('z'), undefined, 'oldest write is evicted despite tied timestamps');
      assert.deepEqual(await storage.get('a'), { value: 'a' }, 'newest write survives tied timestamps');
      await new Promise(resolve => setImmediate(resolve));
      await storage.put('z', { value: 'z' });
      assert.deepEqual(await storage.get('a'), { value: 'a' }, 'read promotes older entry');
      assert.equal(await storage.get('y'), undefined, 'least recently used is evicted');
    } finally { Date.now = now; }
    payloads.clear(); metadata.clear();
    await storage.put('a', { value: 'a' });
    await storage.put('b', { value: 'b' });
    await storage.put('c', { value: 'c' });
    assert.equal(await storage.get('a'), undefined);
    assert.deepEqual(await storage.get('c'), { value: 'c' });
    assert.equal(opens, 1);
    assert.equal(metadata.size, 2);
    assert.equal(payloads.size, 2);
    await storage.put('oversized', 'x'.repeat(101));
    assert.equal(await storage.get('oversized'), undefined);
    current.onversionchange?.({} as IDBVersionChangeEvent);
    assert.equal(closes, 1);
    assert.deepEqual(await storage.get('b'), { value: 'b' });
    assert.equal(opens, 2);
    const byteLimited = indexedViewStorage('byte-test', 16, 25);
    await byteLimited.put('d', { value: 'd' });
    assert.equal(payloads.size, 1, 'byte cap evicts older payloads even below entry cap');
  } finally {
    if (original === undefined) Reflect.deleteProperty(globalThis, 'indexedDB');
    else globalThis.indexedDB = original;
  }
});
