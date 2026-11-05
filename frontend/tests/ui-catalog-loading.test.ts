import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { createUiLanguageChoice } from '../src/lib/uiLanguageChoice.ts';

let server: ViteDevServer;
let loadUiLanguage: typeof import('../src/i18n/uiText.ts').loadUiLanguage;
let uiText: typeof import('../src/i18n/uiText.ts').uiText;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  ({ loadUiLanguage, uiText } = await server.ssrLoadModule('/src/i18n/uiText.ts'));
});

after(async () => { await server.close(); });

test('Vietnamese UI copy loads on demand while English stays synchronous', async () => {
  assert.equal(uiText('Playground', 'en'), 'Playground');
  await loadUiLanguage('vi');
  assert.equal(uiText('Playground', 'vi'), 'Sân chơi');
});

test('a rejected Vietnamese catalog load can be retried and falls back to English meanwhile', async () => {
  let attempts = 0;
  const retryServer = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true },
    plugins: [{
      name: 'test-vietnamese-catalog',
      enforce: 'pre',
      resolveId(source: string, importer?: string) {
        if (source === './vi.json' && importer?.includes('/src/i18n/uiText.ts')) return '\0test-vietnamese-catalog';
      },
      load(id: string) {
        if (id !== '\0test-vietnamese-catalog') return;
        attempts += 1;
        if (attempts === 1) return 'throw new Error("catalog unavailable")';
        return 'export default { Playground: "Sân chơi" };';
      },
    }],
  });
  try {
    const retryModule = await retryServer.ssrLoadModule('/src/i18n/uiText.ts?retry-test');
    await assert.rejects(retryModule.loadUiLanguage('vi'), /catalog unavailable/);
    assert.equal(retryModule.uiText('Playground', 'vi'), 'Playground');
    const failedCatalog = retryServer.moduleGraph.getModuleById('\0test-vietnamese-catalog');
    assert.ok(failedCatalog);
    retryServer.moduleGraph.invalidateModule(failedCatalog);
    await retryModule.loadUiLanguage('vi');
    assert.equal(retryModule.uiText('Playground', 'vi'), 'Sân chơi');
    assert.equal(attempts, 2);
  } finally {
    await retryServer.close();
  }
});

test('latest interface-language choice wins when catalog loads finish out of order', async () => {
  const pending = new Map<string, () => void>();
  const applied: string[] = [];
  const choose = createUiLanguageChoice(
    language => new Promise<void>(resolve => pending.set(language, resolve)),
    language => applied.push(language),
  );
  const vietnamese = choose('vi');
  const english = choose('en');
  pending.get('en')!();
  assert.equal(await english, 'applied');
  pending.get('vi')!();
  assert.equal(await vietnamese, 'stale');
  assert.deepEqual(applied, ['en']);
});
