/** Run with: node --import ../server/node_modules/tsx/dist/loader.mjs tests/browser/fishing-preview.ts */
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { fishingFixture } from './fishing-fixture.ts';
const fixture = fishingFixture();
fixture.reset('ready');
const server = await createServer({ configFile: false, root: fileURLToPath(new URL('../../', import.meta.url)), cacheDir: '/tmp/plg-fishing-preview-cache', plugins: [react(), fixture.plugin], server: { host: '127.0.0.1', port: 5179, strictPort: true } });
await server.listen();
process.stdout.write('Fishing preview: http://127.0.0.1:5179/tests/browser/fishing-harness.html\n');
