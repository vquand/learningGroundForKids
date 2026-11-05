/** A bounded best-effort payload cache; metadata cursors never read payloads. */
export function indexedViewStorage(name: string, maxEntries = 16, maxBytes = 2 * 1024 * 1024) {
  let connection: Promise<IDBDatabase | undefined> | undefined;
  function database() {
    if (connection) return connection;
    connection = new Promise(resolve => {
      if (typeof indexedDB === 'undefined') { resolve(undefined); return; }
      const open = indexedDB.open(name, 3);
      let abandoned = false;
      open.onupgradeneeded = () => {
        const db = open.result;
        // Older schemas lack monotonic recency. Discard this disposable cache.
        if (db.objectStoreNames.contains('views')) db.deleteObjectStore('views');
        if (db.objectStoreNames.contains('metadata')) db.deleteObjectStore('metadata');
        db.createObjectStore('views');
        db.createObjectStore('metadata', { keyPath: 'id' }).createIndex('touched', 'sequence');
      };
      open.onerror = open.onblocked = () => {
        abandoned = true;
        connection = undefined;
        resolve(undefined);
      };
      open.onsuccess = () => {
        const db = open.result;
        if (abandoned) { db.close(); return; }
        const active = connection;
        const reset = () => { if (connection === active) connection = undefined; };
        db.onversionchange = () => { db.close(); reset(); };
        db.onclose = reset;
        resolve(db);
      };
    });
    return connection;
  }
  // All writers serialize on metadata. Allocate a persisted monotonic sequence,
  // so even separate connections and same-millisecond writes have a total order.
  function writeRecency(tx: IDBTransaction, key: string, bytes?: number) {
    const metadata = tx.objectStore('metadata');
    const latest = metadata.index('touched').openCursor(null, 'prev');
    latest.onsuccess = () => {
      const sequence = Math.max(Date.now(), (latest.result?.value.sequence ?? 0) + 1);
      if (bytes !== undefined) {
        metadata.put({ id: key, bytes, touched: Date.now(), sequence });
        evict(tx);
      } else {
        const row = metadata.get(key);
        row.onsuccess = () => {
          // A concurrent eviction must never resurrect a deleted payload.
          if (row.result) metadata.put({ ...row.result, touched: Date.now(), sequence });
        };
      }
    };
  }
  function evict(tx: IDBTransaction) {
    const views = tx.objectStore('views');
    const cursor = tx.objectStore('metadata').index('touched').openCursor(null, 'prev');
    let size = 0, count = 0;
    cursor.onsuccess = () => {
      const row = cursor.result;
      if (!row) return;
      size += row.value.bytes;
      count++;
      if (count > maxEntries || size > maxBytes) {
        views.delete(row.primaryKey);
        row.delete();
      }
      row.continue();
    };
  }
  return {
    async get(key: string): Promise<unknown> {
      const db = await database();
      if (!db) return undefined;
      return new Promise(resolve => {
        try {
          const tx = db.transaction('views', 'readonly');
          const request = tx.objectStore('views').get(key);
          tx.oncomplete = () => {
            resolve(request.result);
            if (request.result !== undefined) {
              // Resolve the payload first; recency is a separate best-effort write.
              try { writeRecency(db.transaction('metadata', 'readwrite'), key); } catch { /* Optional cache. */ }
            }
          };
          tx.onabort = tx.onerror = () => resolve(undefined);
        } catch { connection = undefined; resolve(undefined); }
      });
    },
    async put(key: string, value: unknown): Promise<void> {
      const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
      if (bytes > maxBytes) return;
      const db = await database();
      if (!db) return;
      return new Promise(resolve => {
        try {
          const tx = db.transaction(['views', 'metadata'], 'readwrite');
          const views = tx.objectStore('views');
          views.put(value, key);
          writeRecency(tx, key, bytes);
          tx.oncomplete = tx.onabort = tx.onerror = () => resolve();
        } catch { connection = undefined; resolve(); }
      });
    },
  };
}

/** Serialize writes and drop the oldest waiting write when the queue is full. */
export function backgroundWrites(limit = 16) {
  const queue: (() => Promise<void>)[] = [];
  let running = false;
  async function drain(first: () => Promise<void>) {
    try { await first(); } catch { /* Storage is optional. */ }
    while (queue.length) {
      try { await queue.shift()!(); } catch { /* Storage is optional. */ }
    }
    running = false;
  }
  return (write: () => Promise<void>) => {
    if (!running) {
      running = true;
      // Yield through a task so promise consumers can render network data first.
      setTimeout(() => { void drain(write); }, 0);
      return;
    }
    if (queue.length >= limit) queue.shift();
    queue.push(write);
  };
}
