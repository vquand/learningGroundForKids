import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { reviewCatalogPublication } from '../scripts/catalog-publication-review-lib.mjs';

const item = (description: string, facts: string[] = [], history = description) => ({
  is_published: true, translations: [{ lang: 'en', title: 'Neogaeornis wetzeli', description, history }], fun_facts: facts,
});
test('fossil metadata and recycled filler do not qualify as an explanation', () => {
  const first = 'Neogaeornis wetzeli is a fossil animal taxon associated with Concepcíon.';
  const second = 'Fossil records help scientists study ancient life and environments.';
  const record = item(`${first} ${second}`, [first, second, 'The item can be compared with other places and topics in the learning catalog.']);
  const before = JSON.stringify(record);
  assert.equal(reviewCatalogPublication(record).reason, 'generated-filler-without-substantive-explanation');
  assert.equal(reviewCatalogPublication(record).substantive_words, 0);
  assert.equal(JSON.stringify(record), before, 'review is read-only');
});
test('length alone and repeated facts do not disable a substantive explanation', () => {
  const description = 'This bird swam in shallow coastal water and used its webbed feet to paddle. Its narrow beak helped it catch small fish beneath the surface.';
  assert.equal(reviewCatalogPublication(item(description, [description])).reason, null);
  const concise = item('This bird lived near the coast.');
  concise.translations[0].history = description;
  assert.equal(reviewCatalogPublication(concise).reason, null, 'independent history can provide the missing substance');
  assert.equal(reviewCatalogPublication(item('A coastal bird.', ['It had strong legs.'])).reason, 'too-little-explanatory-content');
});
test('coordinates, classification and source links cannot pad empty content', () => {
  const record = { ...item('Animal species.'), category: 'animal', latitude: 1, longitude: 2,
    rich_fields: { classification: 'species of mammal', sources: [{ url: 'https://example.test/long-source-title', publisher: 'Reference' }] } };
  assert.equal(reviewCatalogPublication(record).reason, 'too-little-explanatory-content');
});
test('published checked-in records pass the review and the reported fossil stays available for enrichment', async () => {
  let found = false;
  for (const file of ['legacy-catalog.json', 'generated-catalog.json', 'expanded-catalog.json']) {
    const records = JSON.parse(await readFile(new URL(`../data/${file}`, import.meta.url), 'utf8'));
    for (const record of records) {
      const title = record.translations.find((t: any) => t.lang === 'en')?.title;
      if (title === 'Neogaeornis wetzeli') { found = true; assert.equal(record.is_published, false); assert.ok(record.translations[0].description); }
      if (record.is_published) assert.equal(reviewCatalogPublication(record).reason, null, title);
    }
  }
  assert.ok(found);
});
