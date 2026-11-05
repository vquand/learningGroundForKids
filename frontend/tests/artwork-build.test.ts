import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, copyFile, link, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogFingerprint, prepareArtworkBuild, publicDirectory, verifiedCatalog } from '../scripts/artwork-catalog.mjs';

test('private artwork builds remove only cataloged images and preserve public login artwork', async () => {
  const catalog = await verifiedCatalog();
  const output = await mkdtemp(path.join(tmpdir(), 'plg-artwork-build-'));
  const publicFiles = ['illustrations/rice-grain-explorer-pastel.png', 'illustrations/seasonal/spring-pastel-chubby.png', 'minigames/math-quiz-wall/country-balls-v2.png', 'minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md'];
  const names = [...Object.keys(catalog.entries), ...publicFiles];
  try {
    for (const name of names) {
      await mkdir(path.dirname(path.join(output, name)), { recursive: true });
      const source = fileURLToPath(new URL(name, publicDirectory)), target = path.join(output, name);
      // Hard links are only a speed shortcut; temp directories on another device need a copy.
      await link(source, target).catch(error => error?.code === 'EXDEV' ? copyFile(source, target) : Promise.reject(error));
    }
    await prepareArtworkBuild(output, {});
    await access(path.join(output, names[0]!));
    await assert.rejects(() => prepareArtworkBuild(output, { ARTWORK_BLOB_ENABLED: 'true', BLOB_STORE_ID: 'store_test' }), /successful artwork:verify/);
    await access(path.join(output, names[0]!));

    const env = { ARTWORK_BLOB_ENABLED: 'true', BLOB_STORE_ID: 'store_test', ARTWORK_BLOB_VERIFIED_CATALOG: 'store_test:' + catalogFingerprint(catalog) };
    const damaged = path.join(output, names.at(-5)!);
    const saved = await readFile(damaged);
    await unlink(damaged); // Never write through a hard link to the source original.
    await writeFile(damaged, 'invalid copied image');
    await assert.rejects(() => prepareArtworkBuild(output, env), /Artwork output changed/);
    await access(path.join(output, names[0]!));
    await writeFile(damaged, saved);

    await prepareArtworkBuild(output, env);
    for (const name of Object.keys(catalog.entries)) await assert.rejects(() => access(path.join(output, name)));
    for (const name of publicFiles) await access(path.join(output, name));
    // Source originals remain available for local development and rollback builds.
    await access(new URL(names[0]!, publicDirectory));
  } finally { await rm(output, { recursive: true, force: true }); }
});
