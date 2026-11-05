import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("burger sprite regions stay inside real PNG sheets", () => {
  const sprites = JSON.parse(readFileSync(new URL("../src/features/cooking/burger/burgerSprites.json", import.meta.url), "utf8")) as Record<string, { sheet: string; size: number[]; crop: number[] }>;
  assert.equal(Object.keys(sprites).length, 35);
  for (const [name, sprite] of Object.entries(sprites)) {
    const png = readFileSync(new URL(`../public/minigames/cooking/burger/${sprite.sheet}.png`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", name);
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    assert.deepEqual(sprite.size, [width, height], name);
    const [x = -1, y = -1, w = 0, h = 0] = sprite.crop;
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= width && y + h <= height, name);
  }
});
