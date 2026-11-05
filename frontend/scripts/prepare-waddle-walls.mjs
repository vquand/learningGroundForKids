// Pack generated wall states without redrawing, clipping or stretching openings.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const sourceDir = join(root, 'docs/artwork/waddle-wall/wall-openings-v1');
const outputDir = join(root, 'frontend/public/minigames/math-quiz-wall');
const scratch = mkdtempSync(join(tmpdir(), 'plg-wall-openings-'));
const magick = args => execFileSync('magick', args, { maxBuffer: 32 * 1024 * 1024 });
const cell = { width: 900, height: 300 }, manifest = {}, runtime = {};
try {
  for (const material of ['brick', 'stone', 'garden', 'blocks']) {
    const source = join(sourceDir, `${material}-source.png`);
    const [width, height] = magick(['identify', '-format', '%w %h', source]).toString().split(' ').map(Number);
    const alpha = magick([source, '-alpha', 'extract', '-depth', '8', 'gray:-']);
    const bands = [];
    let start = -1;
    for (let y = 0; y <= height; y++) {
      let opaque = 0;
      if (y < height) for (let x = 0; x < width; x++) if (alpha[y * width + x] > 128) opaque++;
      if (opaque > width * .04 && start < 0) start = y;
      if (opaque <= width * .04 && start >= 0) {
        if (y - start > 20) bands.push({ y: start, height: y - start });
        start = -1;
      }
    }
    if (bands.length !== 4) throw new Error(`${material}: expected four isolated state rows, found ${bands.length}`);
    let x0 = width, x1 = 0;
    for (let x = 0; x < width; x++) {
      let opaque = 0;
      for (const band of bands) for (let y = band.y; y < band.y + band.height; y++) if (alpha[y * width + x] > 128) opaque++;
      if (opaque > 12) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    }
    const sourceWidth = x1 - x0 + 1, scale = cell.width / sourceWidth;
    if (Math.max(...bands.map(band => band.height)) * scale > cell.height) throw new Error(`${material}: artwork would clip vertically`);
    const frames = bands.map((band, row) => {
      const path = join(scratch, `${material}-${row}.png`);
      magick([source, '-crop', `${sourceWidth}x${band.height}+${x0}+${band.y}`, '+repage', '-resize', `${cell.width}x`, '-background', 'none', '-gravity', 'south', '-extent', `${cell.width}x${cell.height}`, path]);
      // All three lane centers must stay in the same frame coordinates. On
      // arrival only the selected passage should become transparent.
      const packed = magick([path, '-alpha', 'extract', '-depth', '8', 'gray:-']);
      const sampleY = cell.height - Math.round(band.height * scale * .3);
      for (let lane = 0; lane < 3; lane++) {
        const value = packed[sampleY * cell.width + Math.floor((lane + .5) / 3 * cell.width)];
        if (lane === row - 1 ? value > 8 : value < 128) throw new Error(`${material} row ${row}: incorrect lane ${lane} transparency`);
      }
      return path;
    });
    const name = `wall-openings-${material}-v1.webp`;
    magick(['montage', ...frames, '-tile', '1x4', '-geometry', '+0+0', '-background', 'none', '-quality', '90', join(outputDir, name)]);
    const contentTop = (cell.height - Math.round(bands[0].height * scale)) / cell.height;
    runtime[material] = { src: `/minigames/math-quiz-wall/${name}`, width: cell.width, height: cell.height * 4, contentTop };
    manifest[material] = { source: `${material}-source.png`, sourceWidth: width, sourceHeight: height, x: x0, cropWidth: sourceWidth, rows: bands, cell, ...runtime[material], bytes: statSync(join(outputDir, name)).size };
  }
  writeFileSync(join(sourceDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(root, 'frontend/src/features/math-quiz-wall/wallSprites.json'), JSON.stringify(runtime, null, 2) + '\n');
  console.log(JSON.stringify(runtime));
} finally { rmSync(scratch, { recursive: true, force: true }); }
