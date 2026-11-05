import assert from "node:assert/strict";
import test from "node:test";

import { removeAvatarBackdrop } from "../src/lib/avatarBackdrop.ts";

test("removes only the edge-connected illustration background", () => {
  const width = 5;
  const height = 5;
  const rose = [255, 190, 205, 255];
  const outline = [70, 30, 20, 255];
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      pixels.set(x === 0 || y === 0 || x === 4 || y === 4 ? rose : outline, (y * width + x) * 4);
    }
  }
  pixels.set(rose, (2 * width + 2) * 4); // A similarly colored detail enclosed by the character.
  pixels.set([251, 188, 203, 255], (0 * width + 1) * 4); // A compressed background pixel.

  const result = removeAvatarBackdrop(pixels, width, height);

  assert.equal(result[(0 * width + 0) * 4 + 3], 0);
  assert.equal(result[(0 * width + 1) * 4 + 3], 0);
  assert.equal(result[(1 * width + 1) * 4 + 3], 255);
  assert.equal(result[(2 * width + 2) * 4 + 3], 255);
  assert.equal(pixels[3], 255, "the source pixels are not modified");
});
