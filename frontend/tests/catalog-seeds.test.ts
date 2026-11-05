import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CATALOG_SEED_DIR, listCatalogSeedFiles, loadCatalogSeeds } from '../scripts/catalog-seeds.mjs';

test('catalog seed directory is independent of the working directory', () => {
  assert.equal(CATALOG_SEED_DIR, fileURLToPath(new URL('../data/catalog-seeds/', import.meta.url)).replace(/\/$/, ''));
});

test('seed readers load JSON deterministically and ignore non-JSON files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'plg catalog seeds '));
  try {
    await mkdir(join(directory, 'food_data'));
    await writeFile(join(directory, 'food_data', 'z.json'), '{"title":"Z"}');
    await writeFile(join(directory, 'food_data', 'a.json'), '{"title":"A"}');
    await writeFile(join(directory, 'food_data', 'notes.txt'), 'not a seed');
    assert.deepEqual(await listCatalogSeedFiles(['food'], directory), [join(directory, 'food_data', 'a.json'), join(directory, 'food_data', 'z.json')]);
    assert.deepEqual(await loadCatalogSeeds(['food'], directory), [{ title: 'A' }, { title: 'Z' }]);
    await writeFile(join(directory, 'food_data', 'bad.json'), '{');
    await assert.rejects(loadCatalogSeeds(['food'], directory), SyntaxError);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('missing root or category seed directories fail loudly with the exact path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'plg-missing-seeds-'));
  try {
    for (const root of [join(directory, 'absent'), directory]) {
      const expectedPath = root === directory ? join(root, 'food_data') : root;
      for (const reader of [listCatalogSeedFiles, loadCatalogSeeds]) {
        await assert.rejects(reader(['food'], root), (error: Error) => error.message.includes('catalog seeds directory') && error.message.includes(expectedPath));
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('retired D1 seed entry point refuses to run before touching data', async () => {
  const errors: string[] = [];
  const processState = { exitCode: 0 };
  const source = await readFile(new URL('../scripts/seed-d1.mjs', import.meta.url), 'utf8');
  runInNewContext(source, { process: processState, console: { error: (message: string) => errors.push(message) } });
  assert.equal(processState.exitCode, 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /deprecated/i);
  assert.match(errors[0]!, /npm run db:seed:local --prefix server/);
});
