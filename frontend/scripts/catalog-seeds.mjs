import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CATALOG_SEED_DIR = fileURLToPath(new URL('../data/catalog-seeds', import.meta.url));
export const CATALOG_SEED_CATEGORIES = ['food', 'monument', 'landmark', 'music', 'movie', 'phenomenon', 'animal'];

async function readSeedDirectory(directory) {
  try {
    return await readdir(directory);
  } catch (cause) {
    throw new Error(`Unable to read catalog seeds directory "${directory}": ${cause.message}`, { cause });
  }
}

export async function listCatalogSeedFiles(categories = CATALOG_SEED_CATEGORIES, seedDir = CATALOG_SEED_DIR) {
  // A missing checkout/input must never look like a valid empty catalog.
  await readSeedDirectory(seedDir);
  const files = [];
  for (const category of categories) {
    const directory = join(seedDir, `${category}_data`);
    for (const filename of await readSeedDirectory(directory)) {
      if (filename.endsWith('.json')) files.push(join(directory, filename));
    }
  }
  return files.sort();
}

export async function loadCatalogSeeds(categories = CATALOG_SEED_CATEGORIES, seedDir = CATALOG_SEED_DIR) {
  const files = await listCatalogSeedFiles(categories, seedDir);
  return Promise.all(files.map(async file => JSON.parse(await readFile(file, 'utf8'))));
}
