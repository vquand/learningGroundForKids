import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

test('all eighteen Road Racing badges crop 256px cells without shifting the original sixteen', async () => {
  const server = await createServer({ configFile: false, root: fileURLToPath(new URL('..', import.meta.url)), plugins: [react()], server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true } });
  try {
    const { AchievementBadgeArt } = await server.ssrLoadModule('/src/features/achievements/AchievementBadgeArt.tsx');
    const { ROAD_ACHIEVEMENTS } = await server.ssrLoadModule('../server/src/road-racing/achievements.ts');
    const png = await readFile(new URL('../public/minigames/road-racing/badges.png', import.meta.url));
    assert.equal(png.subarray(12, 16).toString(), 'IHDR');
    const atlasWidth = png.readUInt32BE(16), atlasHeight = png.readUInt32BE(20);
    assert.deepEqual([atlasWidth, atlasHeight], [1024, 1280]);
    assert.equal(ROAD_ACHIEVEMENTS.length, 18);
    assert.deepEqual(ROAD_ACHIEVEMENTS.slice(16).map((badge: { badgeIndex: number }) => badge.badgeIndex), [16, 17]);
    for (const [index, badge] of ROAD_ACHIEVEMENTS.entries()) {
      assert.equal(badge.badgeIndex, index);
      assert.ok(index >= 0 && index < badge.badgeColumns * badge.badgeRows);
      assert.equal(atlasWidth / badge.badgeColumns, 256);
      assert.equal(atlasHeight / badge.badgeRows, 256);
      for (const size of [64, 96]) {
        const html = renderToStaticMarkup(createElement(AchievementBadgeArt, {
          source: badge.badge, index: badge.badgeIndex,
          columns: badge.badgeColumns, rows: badge.badgeRows, size,
        }));
        const backgroundSize = html.match(/background-size:([\d.]+)% ([\d.]+)%/);
        const position = html.match(/background-position:([\d.]+)% ([\d.]+)%/);
        assert.ok(backgroundSize && position);
        const renderedWidth = size * Number(backgroundSize[1]) / 100;
        const renderedHeight = size * Number(backgroundSize[2]) / 100;
        const scaleX = renderedWidth / atlasWidth, scaleY = renderedHeight / atlasHeight;
        assert.equal(scaleX, size / 256);
        assert.equal(scaleY, size / 256);
        // CSS percentages use the excess background size, not the full image.
        const sourceX = (renderedWidth - size) * Number(position[1]) / 100 / scaleX;
        const sourceY = (renderedHeight - size) * Number(position[2]) / 100 / scaleY;
        assert.ok(Math.abs(sourceX - index % 4 * 256) < 1e-8, `column for ${badge.id}`);
        assert.ok(Math.abs(sourceY - Math.floor(index / 4) * 256) < 1e-8, `row for ${badge.id}`);
        if (index < 16) {
          const oldPositionY = Math.floor(index / 4) / (4 - 1);
          const oldSourceY = (size * 4 - size) * oldPositionY / (size / 256);
          assert.ok(Math.abs(sourceY - oldSourceY) < 1e-8, `original crop for ${badge.id}`);
        }
      }
    }
  } finally { await server.close(); }
});
