import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { KID_AVATARS, resolveKidAvatar, normalizeKidAvatarId } from "../src/lib/kidAvatars.ts";

test("kid avatar catalog has 39 unique, safe, local options", () => {
  assert.equal(KID_AVATARS.length, 39);
  assert.equal(new Set(KID_AVATARS.map(({ id }) => id)).size, 39);

  for (const avatar of KID_AVATARS) {
    assert.match(avatar.id, /^[a-z0-9-]{1,32}$/);
    assert.match(avatar.src, /^\/avatars\/kids\/[a-z0-9-]+\.webp$/);
    assert.ok(avatar.name.trim());
    assert.ok(avatar.category.trim());
    assert.notEqual(avatar.id, "capybara-chill");
  }
});

test("every selectable kid avatar has a committed static image", () => {
  const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));

  for (const avatar of KID_AVATARS) {
    const imagePath = resolve(publicDirectory, avatar.src.slice(1));
    assert.ok(existsSync(imagePath), `${avatar.id} image is missing at ${imagePath}`);
  }
});

test("new animal avatars use preprocessed transparent sources", () => {
  assert.deepEqual(
    KID_AVATARS.filter((avatar) => "transparent" in avatar && avatar.transparent).map(({ id }) => id),
    ["dairy-cow", "highland-cow", "yellow-chick", "snake", "spider", "chicken", "swan", "duckling", "fish"],
  );
});

test("licensed characters are replaced by original farm animals, preserving saved selections",()=>{
 for (const [oldId,newId] of [['kuromi','dairy-cow'],['my-melody','highland-cow'],['hello-kitty','yellow-chick']]) {
  assert.equal(normalizeKidAvatarId(oldId!),newId);
  assert.equal(resolveKidAvatar(oldId!)?.id,newId);
 }
 assert.ok(KID_AVATARS.every(a=>String(a.category)!=='Sanrio'&&!['kuromi','my-melody','hello-kitty'].includes(a.id)));
 assert.equal(resolveKidAvatar('not-an-avatar'),undefined);
});
