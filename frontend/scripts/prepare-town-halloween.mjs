// Source isolation/crop/packing only; generated pixels are never redrawn.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const sourceDir = join(root, 'docs/artwork/town-halloween-v1');
const outputDir = join(root, 'frontend/public/minigames/town-building/halloween-v1');
const scratch = mkdtempSync(join(tmpdir(), 'plg-halloween-art-'));
const magick = args => execFileSync('magick', args, { maxBuffer: 64 * 1024 * 1024 });
const manifest = {}, runtime = {};
try {
  for (const config of [
    { key: 'ghost-motion', columns: 6, rows: 3, cell: [192, 192], fit: [160, 160], anchor: 'center' },
    { key: 'lanterns', columns: 3, rows: 2, cell: [160, 192], fit: [140, 170], anchor: 'north' },
    { key: 'lantern-posts', columns: 3, rows: 1, cell: [192, 256], fit: [170, 230], anchor: 'south' },
  ]) {
    const source = join(sourceDir, `${config.key}-source.png`);
    const [width, height] = magick(['identify', '-format', '%w %h', source]).toString().split(' ').map(Number);
    const alpha = magick([source, '-alpha', 'extract', '-depth', '8', 'gray:-']);
    const seen = new Uint8Array(width * height), queue = new Int32Array(width * height), components = [];
    for (let start = 0; start < alpha.length; start++) {
      if (seen[start] || alpha[start] < 24) continue;
      seen[start] = 1; queue[0] = start;
      let head = 0, tail = 1, x0 = width, x1 = 0, y0 = height, y1 = 0;
      while (head < tail) {
        const at = queue[head++], x = at % width, y = Math.floor(at / width);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        for (const next of [x ? at - 1 : -1, x + 1 < width ? at + 1 : -1, y ? at - width : -1, y + 1 < height ? at + width : -1]) {
          if (next < 0 || seen[next] || alpha[next] < 24) continue;
          seen[next] = 1; queue[tail++] = next;
        }
      }
      if (tail > 1000) {
        const component = { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
        Object.defineProperty(component, 'members', { value: queue.slice(0, tail) }); components.push(component);
      }
    }
    if (components.length !== config.columns * config.rows) throw new Error(`${config.key}: expected ${config.columns * config.rows} subjects; found ${components.length}`);
    const frames = [];
    for (let row = 0; row < config.rows; row++) {
      const line = components.filter(frame => Math.floor((frame.y + frame.height / 2) / height * config.rows) === row).sort((a, b) => a.x - b.x);
      if (line.length !== config.columns) throw new Error(`${config.key}: malformed row ${row}`);
      frames.push(...line);
    }
    const scale = Math.min(config.fit[0] / Math.max(...frames.map(frame => frame.width)), config.fit[1] / Math.max(...frames.map(frame => frame.height)));
    const paths = frames.map((frame, index) => {
      const path = join(scratch, `${config.key}-${index}.png`), maskPath = join(scratch, `${config.key}-${index}.pgm`);
      const mask = new Uint8Array(frame.width * frame.height);
      for (const at of frame.members) {
        const x = at % width, y = Math.floor(at / width);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const localX = x + dx - frame.x, localY = y + dy - frame.y;
          if (localX >= 0 && localX < frame.width && localY >= 0 && localY < frame.height) mask[localY * frame.width + localX] = alpha[(y + dy) * width + x + dx];
        }
      }
      writeFileSync(maskPath, Buffer.concat([Buffer.from(`P5\n${frame.width} ${frame.height}\n255\n`), mask]));
      magick([source, '-crop', `${frame.width}x${frame.height}+${frame.x}+${frame.y}`, '+repage', maskPath, '-compose', 'CopyOpacity', '-composite', '-compose', 'Over', '-resize', `${scale * 100}%`, '-background', 'none', '-gravity', config.anchor, '-extent', config.cell.join('x'), path]);
      return path;
    });
    const output = join(outputDir, `${config.key}.webp`);
    magick(['montage', ...paths, '-tile', `${config.columns}x${config.rows}`, '-geometry', '+0+0', '-background', 'none', '-quality', '90', output]);
    const rects = frames.map((_, index) => [index % config.columns * config.cell[0], Math.floor(index / config.columns) * config.cell[1], ...config.cell]);
    runtime[config.key] = { width: config.columns * config.cell[0], height: config.rows * config.cell[1], rects,
      ...(config.key === 'lantern-posts' ? { hooks: frames.map(frame => [(config.cell[0] - frame.width * scale) / 2 + frame.width * scale * .91, config.cell[1] - frame.height * scale * .7]) } : {}) };
    manifest[config.key] = { source: `${config.key}-source.png`, sourceWidth: width, sourceHeight: height, frames, scale, ...runtime[config.key], bytes: statSync(output).size };
  }
  writeFileSync(join(sourceDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(root, 'frontend/src/features/town-building/halloweenAtlas.json'), JSON.stringify(runtime, null, 2) + '\n');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(manifest).map(([key, value]) => [key, { frames: value.frames.length, bytes: value.bytes }]))));
} finally { rmSync(scratch, { recursive: true, force: true }); }
