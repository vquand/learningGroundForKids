import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AVATAR_FRAMES, type AvatarFrameId } from "../src/lib/avatarFrames.ts";
import { KID_AVATARS } from "../src/lib/kidAvatars.ts";
import { backgroundSpritePosition, getKidProfileBackground, KID_BACKGROUND_THEMES } from "../src/lib/kidProfileBackground.ts";

const profile = (avatar_url: string, avatar_frame: AvatarFrameId | null = "space", color = "#123456") => ({
  avatar_type: "default" as const, avatar_url, avatar_frame, color, emoji: "🌟",
});

test("every chosen character uses its exact original face and every frame selects one theme", () => {
  for (const avatar of KID_AVATARS) {
    const result = getKidProfileBackground(profile(avatar.id));
    assert.equal(result.face?.id, avatar.id);
    assert.equal(result.face?.src, avatar.src);
    const [x, y, width, height] = result.faceViewBox.split(" ").map(Number);
    assert.ok(x! >= 0 && y! >= 0 && width! > 0 && height! > 0 && x! + width! <= 512 && y! + height! <= 512);
  }
  for (const frame of AVATAR_FRAMES.slice(1)) {
    assert.ok(frame.id);
    const result = getKidProfileBackground(profile("bear-panda", frame.id));
    assert.equal(result.themeIndex, KID_BACKGROUND_THEMES[frame.id]);
    assert.equal(result.themeId, frame.id);
  }
});

test("custom photos and unknown selections are not displayed as decorative faces", () => {
  assert.equal(getKidProfileBackground({ avatar_type: "custom", avatar_url: "https://example.test/photo", avatar_frame: null, color: "#abcdef", emoji: "🐼" }).face, undefined);
  const unknown = getKidProfileBackground(profile("constructor", "constructor" as AvatarFrameId, "red"));
  assert.equal(unknown.face, undefined); assert.equal(unknown.themeId, "meadow");
  assert.equal(getKidProfileBackground({ avatar_type: "emoji", color: "#ABC123", emoji: "🐼" }).face?.id, "bear-panda");
  assert.equal(getKidProfileBackground(profile("bear-panda", null, "oops")).tint, "59, 130, 246");
  assert.equal(getKidProfileBackground(profile("bear-panda", null, "#ABC123")).tint, "171, 193, 35");
});

test("portraits with bodies have face-only view boxes", () => {
  assert.equal(getKidProfileBackground(profile("capybara-calm")).faceViewBox, "0 0 512 512");
  assert.equal(getKidProfileBackground(profile("snake")).faceViewBox, "40 38 435 325");
  assert.equal(getKidProfileBackground(profile("swan")).faceViewBox, "103 15 287 287");
  assert.equal(backgroundSpritePosition(14, 4, 4), "66.66666666666666% 100%");
});

test("the single scenery atlas remains a bounded RGBA PNG", async () => {
  const bytes = await readFile(new URL("../public/illustrations/kid-profile/themes-flat-v2.png", import.meta.url));
  assert.ok(bytes.byteLength <= 2_200_000);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.readUInt32BE(16), 1536); assert.equal(bytes.readUInt32BE(20), 1024); assert.equal(bytes[25], 6);
}
);
