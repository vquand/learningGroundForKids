import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { generatedCategoryIllustrationPath } from '../src/components/ItemDetail/itemIllustrations.ts';

const categories = ['animal', 'food', 'landmark', 'monument', 'phenomenon', 'music', 'movie'];

test('category fallback illustrations use the checked-in WebP assets', async () => {
  for (const category of categories) {
    const path = generatedCategoryIllustrationPath(category);
    assert.equal(path, `/item-category-illustrations/${category}.webp`);
    const file = await readFile(new URL(`../public${path}`, import.meta.url));
    assert.equal(file.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(file.subarray(8, 12).toString('ascii'), 'WEBP');
  }
});
