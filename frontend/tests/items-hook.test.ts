import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { keepPreviousData } from '@tanstack/react-query';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer;
let itemQueryOptions: typeof import('../src/hooks/useItems.ts').itemQueryOptions;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  ({ itemQueryOptions } = await server.ssrLoadModule('/src/hooks/useItems.ts'));
});

after(async () => { await server.close(); });

test('item queries retain the previous language while a fresh language is fetched', () => {
  const english = itemQueryOptions('item-1', 'en', 'family-1', 'profile-1');
  const vietnamese = itemQueryOptions('item-1', 'vi', 'family-1', 'profile-1');

  assert.deepEqual(english.queryKey, ['item', 'family-1', 'profile-1', 'item-1', 'en']);
  assert.notDeepEqual(english.queryKey, vietnamese.queryKey);
  assert.equal(english.placeholderData, keepPreviousData);
  assert.equal(english.staleTime, 5 * 60 * 1000);
});
