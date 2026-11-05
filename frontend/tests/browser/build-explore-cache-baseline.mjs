// Rebuild the catalog-in-browser reference without discarding the earlier
// uncommitted SVG/interaction performance work in this shared checkout.
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const frontend = fileURLToPath(new URL('../../', import.meta.url));
const isolated = await mkdtemp(resolve(tmpdir(), 'plg-explore-cache-reference-'));
await cp(resolve(frontend, 'src'), resolve(isolated, 'src'), { recursive: true });
await mkdir(resolve(isolated, 'tests/browser'), { recursive: true });
for (const name of ['explore-performance-harness.html', 'explore-performance-harness.tsx']) {
  await cp(resolve(frontend, 'tests/browser', name), resolve(isolated, 'tests/browser', name));
}
await symlink(resolve(frontend, 'node_modules'), resolve(isolated, 'node_modules'));
await cp(resolve(frontend, 'package.json'), resolve(isolated, 'package.json'));
await cp(resolve(frontend, 'postcss.config.mjs'), resolve(isolated, 'postcss.config.mjs'));
const reference = '5a259465d815c0946f43fe713a0840fd5571cb09';
const restored = {};
for (const path of ['src/components/Map/WorldMap.tsx', 'src/pages/MapPage.tsx']) {
  const source = execFileSync('git', ['show', `${reference}:frontend/${path}`], { cwd: frontend, encoding: 'utf8' });
  await writeFile(resolve(isolated, path), source);
  restored[path] = createHash('sha256').update(source).digest('hex');
}
const dist = resolve(isolated, 'build');
await build({ root: isolated, configFile: false, plugins: [react()], logLevel: 'warn', build: {
  outDir: dist, copyPublicDir: false, rollupOptions: { input: resolve(isolated, 'tests/browser/explore-performance-harness.html') },
} });
const metadata = { reference, restored, note: 'Current source copied, with only WorldMap and MapPage restored to the uncached catalog renderer. Earlier SVG/artwork/interaction improvements remain in both builds.',
  earthHash: createHash('sha256').update(await readFile(resolve(isolated, 'src/components/Map/IllustratedEarthLayer.tsx'))).digest('hex') };
await writeFile(resolve(isolated, 'reference.json'), JSON.stringify(metadata, null, 2));
console.log(JSON.stringify({ dist, metadata }));
