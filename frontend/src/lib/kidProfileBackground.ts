import type { AvatarFrameId } from "./avatarFrames";
import { resolveKidAvatar, type KidAvatarOption } from "./kidAvatars.ts";
import type { Profile } from "../types/profile";

export const KID_BACKGROUND_THEMES = {
  tet: 1, christmas: 2, flowers: 3, love: 4, explorer: 5,
  tank: 6, submarine: 7, space: 8, ufo: 9, car: 10,
  plane: 11, jet: 12, volcano: 13, helicopter: 14,
} as const satisfies Record<AvatarFrameId, number>;

const EMOJI_AVATARS: Readonly<Record<string, string>> = {
  "🐼": "bear-panda", "🐰": "rabbit-snow", "🐇": "rabbit-snow", "🐱": "kitten-lilac", "🐈": "kitten-lilac",
  "🐻": "bear-cocoa", "🐻‍❄️": "bear-polar", "🐶": "corgi-gold", "🐕": "corgi-gold", "🦦": "otter-smile",
  "🐧": "penguin-blue", "🐍": "snake", "🕷️": "spider", "🕷": "spider", "🐔": "chicken",
  "🦢": "swan", "🦆": "duckling", "🐟": "fish", "🐠": "fish",
};

// Face-only windows for original portraits that also include a body or appendages.
const FACE_VIEW_BOXES: Readonly<Record<string, string>> = {
  snake: "40 38 435 325", swan: "103 15 287 287",
  spider: "88 72 341 349", fish: "53 86 358 363",
};

type BackgroundProfile = Pick<Profile, "avatar_type" | "avatar_url" | "avatar_frame" | "color" | "emoji">;

export function getKidProfileBackground(profile?: BackgroundProfile) {
  const rawColor = profile?.color ?? "";
  const color = /^#[0-9a-f]{6}$/i.test(rawColor) ? rawColor : "#3B82F6";
  const rgb = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  const avatarId = profile?.avatar_type === "default" ? profile.avatar_url
    : profile?.avatar_type !== "custom" ? EMOJI_AVATARS[profile?.emoji ?? ""] : undefined;
  const face: KidAvatarOption | undefined = resolveKidAvatar(avatarId);
  const themeIndex = profile?.avatar_frame ? KID_BACKGROUND_THEMES[profile.avatar_frame] : undefined;
  const hasTheme = typeof themeIndex === "number";
  return {
    face,
    faceViewBox: face && typeof FACE_VIEW_BOXES[face.id] === "string" ? FACE_VIEW_BOXES[face.id] : "0 0 512 512",
    themeIndex: hasTheme ? themeIndex : 0,
    themeId: hasTheme ? profile!.avatar_frame! : "meadow",
    tint: rgb.join(", "),
  };
}

export function backgroundSpritePosition(index: number, columns: number, rows: number): string {
  return `${(index % columns) / (columns - 1) * 100}% ${Math.floor(index / columns) / (rows - 1) * 100}%`;
}
