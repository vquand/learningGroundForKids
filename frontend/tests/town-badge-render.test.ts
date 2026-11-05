import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

test('the badge collection renders every server-defined town badge using its own atlas crop', async () => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    plugins: [react()],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  try {
    // Load the actual component and authoritative definitions in one module graph.
    const { TownAchievements } = await server.ssrLoadModule('/src/features/town-building/TownAchievements.tsx');
    const { TOWN_BADGES } = await server.ssrLoadModule('../server/src/town-building/game.ts');
    const client = new QueryClient();
    // Server rendering uses the store's initial anonymous snapshot. Cached data
    // exercises rendering without identity changes, API requests, or a database.
    client.setQueryData(['town', null, 'profile'], {
      badges: TOWN_BADGES,
      earned: { 'town-first-home': '2026-10-15T00:00:00Z', 'town-first-harvest': '2026-10-15T00:00:00Z' },
    });
    try {
      const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(TownAchievements, { profileId: 'profile' })));
      for (const badge of TOWN_BADGES) assert.ok(html.includes(badge.name), `Missing badge: ${badge.id}`);
      assert.equal((html.match(/href="\/minigames\/town-building\/badges.png"/g) ?? []).length, 5);
      assert.equal((html.match(/href="\/minigames\/town-building\/garden-badges.png"/g) ?? []).length, 2);
      assert.equal((html.match(/href="\/minigames\/town-building\/civ-badges-v1.png"/g) ?? []).length, 3);
      assert.ok(html.includes('Ghostly Sky'));
      assert.ok(html.includes('20/10/2026'));
      assert.equal((html.match(/womens-day-v1\/achievement-badges.png/g)??[]).length,4);
      assert.ok(html.includes('halloween-v1/ghostly-sky.png'));
      assert.ok(html.includes('viewBox="314 12 685 680"'));
      assert.ok(html.includes('viewBox="1172 12 685 680"'));
      assert.equal((html.match(/badge-collection-card is-earned/g) ?? []).length, 2);
      assert.equal((html.match(/badge-collection-card is-locked/g) ?? []).length, TOWN_BADGES.length - 2 + 1 + 4);
    } finally { client.clear(); }
  } finally { await server.close(); }
});
