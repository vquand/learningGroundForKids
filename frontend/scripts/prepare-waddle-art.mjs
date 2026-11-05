// Asset preparation only: preserve generated art, trim alpha margins, align feet
// and pack uniform animation cells. Requires the already-installed ImageMagick.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const version = process.argv[2] ?? 'v2';
if (!['v2', 'v3'].includes(version)) throw new Error('Use v2 or v3.');
const sourceDir = join(root, 'docs/artwork/waddle-wall', ...(version === 'v3' ? ['chubby-v3'] : []));
const outputDir = join(root, 'frontend/public/minigames/math-quiz-wall');
const cell = { width: 256, height: 192 };
const bodyHeight = 160;
const magick = args => execFileSync('magick', args, { maxBuffer: 64 * 1024 * 1024 });
const scratch = mkdtempSync(join(tmpdir(), 'plg-waddle-art-'));
const manifest = { columns: 6, rows: 3, cell, animals: {} };
try {
  for (const animal of ['capybara', 'cow', 'highland']) {
    const source = join(sourceDir, `${animal}-motion-${version}-source.png`);
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
        const component = { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, pixels: tail };
        Object.defineProperty(component, 'members', { value: queue.slice(0, tail), enumerable: false });
        components.push(component);
      }
    }
    if (components.length !== 18) throw new Error(`${animal}: expected 18 isolated generated frames, found ${components.length}`);
    const frames = [];
    for (let row = 0; row < 3; row++) {
      const rowFrames = components.filter(frame => Math.floor((frame.y + frame.height / 2) / height * 3) === row).sort((a, b) => a.x - b.x);
      if (rowFrames.length !== 6) throw new Error(`${animal}: invalid frame row ${row}`);
      frames.push(...rowFrames);
    }
    const paths = frames.map((frame, index) => {
      if (frame.width / frame.height * bodyHeight > cell.width - 8) throw new Error(`${animal} frame ${index} would clip`);
      const path = join(scratch, `${animal}-${index}.png`);
      // Adjacent source silhouettes can have overlapping bounding rectangles.
      // Extract this alpha component alone, preserving its antialiased edges.
      const mask = new Uint8Array(frame.width * frame.height);
      for (const at of frame.members) {
        const x = at % width, y = Math.floor(at / width);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const localX = x + dx - frame.x, localY = y + dy - frame.y;
          if (localX >= 0 && localX < frame.width && localY >= 0 && localY < frame.height) mask[localY * frame.width + localX] = alpha[(y + dy) * width + x + dx];
        }
      }
      const maskPath = join(scratch, `${animal}-${index}-alpha.pgm`);
      writeFileSync(maskPath, Buffer.concat([Buffer.from(`P5\n${frame.width} ${frame.height}\n255\n`), mask]));
      magick([source, '-crop', `${frame.width}x${frame.height}+${frame.x}+${frame.y}`, '+repage', maskPath, '-compose', 'CopyOpacity', '-composite', '-compose', 'Over', '-resize', `x${bodyHeight}`, '-background', 'none', '-gravity', 'south', '-extent', `${cell.width}x${cell.height}`, path]);
      return path;
    });
    const name = `${animal}-motion-${version}.webp`;
    magick(['montage', ...paths, '-tile', '6x3', '-geometry', '+0+0', '-background', 'none', '-quality', '90', join(outputDir, name)]);
    const luminance = Number(magick([join(outputDir, name), '-alpha', 'off', '-colorspace', 'gray', '-format', '%[fx:mean]', 'info:']).toString());
    if (luminance < .02) throw new Error(`${animal}: frame packing lost the generated colors`);
    manifest.animals[animal] = { source: `${animal}-motion-${version}-source.png`, sourceWidth: width, sourceHeight: height, sourceBounds: frames, output: name, bytes: statSync(join(outputDir, name)).size };
  }
  if (version === 'v2') magick([join(sourceDir, 'arena-garden-v2-source.png'), '-resize', '1024x1024', '-quality', '92', join(outputDir, 'arena-garden-v2.webp')]);
  writeFileSync(join(sourceDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(manifest.animals).map(([id, value]) => [id, { frames: value.sourceBounds.length, bytes: value.bytes }]))));
} finally { rmSync(scratch, { recursive: true, force: true }); }
