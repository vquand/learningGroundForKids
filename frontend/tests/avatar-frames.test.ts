import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { AVATAR_FRAMES, isAvatarFrameId } from "../src/lib/avatarFrames.ts";

test("avatar frame catalog starts with No frame and has fourteen themed frames", () => {
  assert.deepEqual(AVATAR_FRAMES[0], { id: null, name: "No frame", src: null });
  assert.deepEqual(AVATAR_FRAMES.slice(1).map(({ id }) => id), [
    "tet",
    "christmas",
    "flowers",
    "love",
    "explorer",
    "tank",
    "submarine",
    "space",
    "ufo",
    "car",
    "plane",
    "jet",
    "volcano",
    "helicopter",
  ]);
  assert.equal(new Set(AVATAR_FRAMES.map(({ id }) => id)).size, AVATAR_FRAMES.length);
});

test("every themed avatar frame points at a committed transparent image", () => {
  const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));

  for (const frame of AVATAR_FRAMES.slice(1)) {
    assert.match(frame.src ?? "", /^\/avatar-frames\/[a-z0-9-]+\.webp$/);
    assert.ok(existsSync(resolve(publicDirectory, frame.src!.slice(1))), `${frame.id} frame image is missing`);
  }
});

test("avatar frame parsing only accepts registered frame IDs", () => {
  assert.equal(isAvatarFrameId("tet"), true);
  assert.equal(isAvatarFrameId("made-up-frame"), false);
  assert.equal(isAvatarFrameId(null), false);
});
