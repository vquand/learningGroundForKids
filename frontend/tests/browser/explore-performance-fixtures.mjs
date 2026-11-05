import { readFile } from 'node:fs/promises';

export async function exploreFixtures() {
  const records = (await Promise.all(['legacy', 'generated', 'expanded'].map(async name =>
    JSON.parse(await readFile(new URL(`../../data/${name}-catalog.json`, import.meta.url), 'utf8'))))).flat();
  const catalog = records.filter(item => item.is_published !== false).map((item, i) => ({
    id: `catalog-${i}`, category: item.category, latitude: item.latitude, longitude: item.longitude,
    title: item.translations.find(t => t.lang === 'en')?.title ?? item.category,
    icon_slug: item.icon_slug, start_year: item.start_year, end_year: item.end_year,
    quiz_required: Boolean(item.quiz_required),
  }));
  const categories = ['animal', 'food', 'monument', 'landmark', 'music', 'movie', 'phenomenon'];
  const dense = Array.from({ length: 4000 }, (_, i) => ({
    id: `dense-${i}`, category: categories[i % categories.length],
    latitude: 20 + (i % 80) * .004, longitude: 0 + Math.floor(i / 80) * .004,
    title: `Dense learning item ${i}`, icon_slug: categories[i % categories.length],
    start_year: i % 2 ? 2024 : 1500, end_year: i % 2 ? 2026 : 1600, quiz_required: i % 3 === 0,
  }));
  return { catalog, dense };
}

export function apiFixture(path, items) {
  if (path === '/api/v1/items') return items;
  if (path.endsWith('/profiles')) return [{ id: 'kid-a', name: 'Ada', emoji: '⭐', color: '#597653', total_done: 1 }];
  if (path.endsWith('/progress')) return { done_item_ids: [items[0].id], wip_item_ids: [items[1].id] };
  if (path.includes('/progress/')) return { done: path.endsWith(items[0].id) };
  if (path.includes('/flashcards/')) return [];
  if (path.endsWith('/quiz')) return { difficulty: 'easy', questions: [] };
  if (path.includes('/quiz/')) return { status: 'not_available', has_quiz: false, passed: false, quiz_required: false };
  if (path.startsWith('/api/v1/items/')) {
    const item = items.find(item => path.endsWith(`/${item.id}`));
    if (!item) throw new Error(`Unknown fixture item: ${path}`);
    return { ...item, media: [], available_languages: ['en', 'vi'], translation: {
      title: item.title, description: 'A local deterministic learning item.', lang: 'en',
    }, fun_facts: [] };
  }
  throw new Error(`Unimplemented fixture API: ${path}`);
}
