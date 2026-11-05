import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { reviewCatalogPublication } from './catalog-publication-review-lib.mjs';

const args = process.argv.slice(2);
if (args.length && (args.length !== 1 || args[0] !== '--write')) throw new Error('Usage: review-catalog-publication.mjs [--write]');
const write = args[0] === '--write';
const dataDir = new URL('../data/', import.meta.url);
const report = { policy_version: 1, purpose: 'Disabled pending meaningful content enrichment; records and progress are retained.', by_category: {}, items: [] };
let changed = 0;
for (const filename of ['legacy-catalog.json', 'generated-catalog.json', 'expanded-catalog.json']) {
  const path = new URL(filename, dataDir);
  const items = JSON.parse(await readFile(path, 'utf8'));
  let dirty = false;
  for (const item of items) {
    const review = reviewCatalogPublication(item);
    if (!review.reason) continue;
    const title = item.translations?.find(t => t.lang === 'en')?.title ?? '';
    report.items.push({ file: filename, key: `${item.category}|${item.latitude}|${item.longitude}|${title}`, title, category: item.category, ...review });
    report.by_category[item.category] = (report.by_category[item.category] ?? 0) + 1;
    if (item.is_published === true) { item.is_published = false; dirty = true; changed++; }
  }
  if (write && dirty) await writeFile(path, `${JSON.stringify(items, null, 2)}\n`);
}
if (write) await writeFile(new URL('catalog-publication-review.json', dataDir), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ mode: write ? 'write' : 'dry-run', flagged: report.items.length, newly_disabled: changed, by_category: report.by_category, ...(write ? { report: fileURLToPath(new URL('catalog-publication-review.json', dataDir)) } : {}) }, null, 2));
