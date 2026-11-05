import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const publicDirectory = new URL('../public/', import.meta.url);
export const catalogFile = new URL('../server/artwork/catalog.json', import.meta.url);
const roots = ['minigames', 'illustrations', 'item-category-illustrations', 'avatars', 'avatar-frames'];
// The login illustration and global language selector must work before sign-in.
const publicImages = new Set(['illustrations/rice-grain-explorer-pastel.png', 'minigames/math-quiz-wall/country-balls-v2.png']);
const contentTypes = { '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.avif': 'image/avif' };

export async function generateCatalog() {
  const entries = {};
  async function visit(directory) {
    for (const file of (await readdir(new URL(directory + '/', publicDirectory), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = directory + '/' + file.name;
      if (file.isDirectory()) { await visit(path); continue; }
      const extension = /\.[^.]+$/.exec(file.name)?.[0].toLowerCase();
      const contentType = contentTypes[extension];
      if (!file.isFile() || !contentType || publicImages.has(path) || path.startsWith('illustrations/seasonal/')) continue;
      const bytes = await readFile(new URL(path, publicDirectory));
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      entries[path] = { key: `artwork/${sha256}${extension}`, sha256, size: bytes.length, contentType };
    }
  }
  for (const root of roots) await visit(root);
  return { version: 1, entries };
}

export async function verifiedCatalog() {
  const saved = JSON.parse(await readFile(catalogFile, 'utf8'));
  const current = await generateCatalog();
  if (JSON.stringify(saved) !== JSON.stringify(current)) throw new Error('Artwork catalog is stale. Run npm run artwork:catalog --prefix frontend and review the changes.');
  return saved;
}

export function catalogFingerprint(catalog) {
  return createHash('sha256').update(JSON.stringify(catalog)).digest('hex');
}

export async function prepareArtworkBuild(outDir, env) {
  if (env.ARTWORK_BLOB_ENABLED !== 'true') return;
  const catalog = await verifiedCatalog();
  const receipt = `${env.BLOB_STORE_ID}:${catalogFingerprint(catalog)}`;
  if (!/^store_[A-Za-z0-9]+$/.test(env.BLOB_STORE_ID ?? '') || env.ARTWORK_BLOB_VERIFIED_CATALOG !== receipt) {
    throw new Error('Private artwork build requires BLOB_STORE_ID and ARTWORK_BLOB_VERIFIED_CATALOG from a successful artwork:verify run.');
  }
  // Check the entire output before removing anything. A stale copy must fail closed.
  for (const [name, entry] of Object.entries(catalog.entries)) {
    const file = await readFile(path.join(outDir, name));
    if (createHash('sha256').update(file).digest('hex') !== entry.sha256) throw new Error(`Artwork output changed: ${name}`);
  }
  for (const name of Object.keys(catalog.entries)) await rm(path.join(outDir, name));
  console.log(`Private artwork: omitted ${Object.keys(catalog.entries).length} verified images from deployment output.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const catalog = await generateCatalog();
  await writeFile(catalogFile, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`Cataloged ${Object.keys(catalog.entries).length} images (${(Object.values(catalog.entries).reduce((sum, entry) => sum + entry.size, 0) / 1048576).toFixed(1)} MiB). No uploads performed.`);
}
