import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { WALL_MATERIALS } from '../../src/features/math-quiz-wall/wallMaterial.ts';
const { chromium } = createRequire(import.meta.url)(process.env.PLG_PLAYWRIGHT_MODULE || 'playwright');
let browser: any, server: Awaited<ReturnType<typeof createServer>>, origin: string;
before(async () => {
  await mkdir('/tmp/plg-wall-openings', { recursive: true });
  server = await createServer({ configFile: false, plugins: [react()], root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  await server.listen(); const address = server.httpServer!.address(); assert.ok(address && typeof address !== 'string'); origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); });

test('generated wall alpha opens the intended lane and has irregular material edges', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/tests/browser/math-wall-openings-harness.html`);
    for (const [material, sheet] of Object.entries(WALL_MATERIALS)) {
      const checks = await page.evaluate(async ({ src, contentTop }: { src: string; contentTop: number }) => {
        const bitmap = await createImageBitmap(await (await fetch(src)).blob());
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0);
        const sample = { alpha(x: number, y: number) { return ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3]!; } };
        const width = bitmap.width, height = bitmap.height / 4;
        return [0, 1, 2, 3].map(frame => {
          const y = frame * height + height * (contentTop + .7 * (1 - contentTop));
          const lanes = [0, 1, 2].map(lane => sample.alpha(width * (lane + .5) / 3, y));
          const openingWidths = [.2, .4, .6, .8].map(depth => {
            const atY = frame * height + height * (contentTop + depth * (1 - contentTop));
            const center = width * (frame - .5) / 3;
            let left = Math.floor(center), right = left;
            while (left >= 0 && sample.alpha(left, atY) < 12) left--;
            while (right < width && sample.alpha(right, atY) < 12) right++;
            return right - left;
          });
          return { lanes, openingWidths };
        });
      }, sheet);
      for (let frame = 0; frame < 4; frame++) {
        for (let lane = 0; lane < 3; lane++) assert.ok(lane === frame - 1 ? checks[frame].lanes[lane] < 12 : checks[frame].lanes[lane] > 128, `${material} frame ${frame}, lane ${lane}`);
        if (frame) assert.ok(new Set(checks[frame].openingWidths).size > 1, `${material} opening ${frame} has a varying contour`);
      }
    }
  } finally { await page.close(); }
});

for (const [width, height] of [[1366, 768], [1024, 768], [1180, 820], [390, 844]]) {
  test(`full and three lane openings stay registered at ${width}x${height}`, async () => {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors: string[] = []; page.on('pageerror', (error: Error) => errors.push(error.message));
    try {
      await page.goto(`${origin}/tests/browser/math-wall-openings-harness.html`);
      await page.waitForFunction(() => typeof (window as any).showWall === 'function');
      for (const wall of ['brick', 'stone', 'garden', 'blocks']) {
        let fullBounds: any;
        for (const frame of [0, 1, 2, 3]) {
          await page.evaluate(({ wall, frame }: any) => (window as any).showWall({ wall, lane: frame ? frame - 1 : 1, result: frame ? 'pass' : null }), { wall, frame });
          const node = page.locator(`.math-moving-wall[data-wall-frame="${frame}"]`); await node.waitFor();
          assert.equal(await node.evaluate((el: HTMLElement) => getComputedStyle(el).clipPath), 'none');
          const bounds = await node.boundingBox(); assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= height);
          if (!frame) fullBounds = bounds;
          else { assert.ok(Math.abs(bounds.width - fullBounds.width) < 1); assert.ok(Math.abs(bounds.x - fullBounds.x) < 1); }
          assert.equal(await page.locator('.math-wall-answer-zone.is-opening').count(), frame ? 1 : 0);
          const artwork = await (wall === 'blocks' ? node : node.locator('.math-wall-art')).evaluate((el: HTMLElement) => ({ background: getComputedStyle(el).backgroundImage, mask: getComputedStyle(el).maskImage }));
          assert.match(wall === 'blocks' ? artwork.mask : artwork.background, new RegExp(`wall-openings-${wall}-v1.webp`));
          assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth), false);
          await page.screenshot({ path: `/tmp/plg-wall-openings/${wall}-${frame}-${width}x${height}.png` });
        }
        await page.evaluate((wall: any) => (window as any).showWall({ wall, lane: 0, result: 'splash' }), wall);
        await page.locator('.math-moving-wall[data-wall-frame="1"]').waitFor();
      }
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}
