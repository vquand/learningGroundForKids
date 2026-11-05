export const AVATAR_FRAMES = [
  { id: null, name: "No frame", src: null },
  { id: "tet", name: "Tết", src: "/avatar-frames/tet.webp" },
  { id: "christmas", name: "Christmas", src: "/avatar-frames/christmas.webp" },
  { id: "flowers", name: "Flowers", src: "/avatar-frames/flowers.webp" },
  { id: "love", name: "Love", src: "/avatar-frames/love.webp" },
  { id: "explorer", name: "Explorer", src: "/avatar-frames/explorer.webp" },
  { id: "tank", name: "Toy tank", src: "/avatar-frames/tank.webp" },
  { id: "submarine", name: "Submarine", src: "/avatar-frames/submarine.webp" },
  { id: "space", name: "Space", src: "/avatar-frames/space.webp" },
  { id: "ufo", name: "UFO", src: "/avatar-frames/ufo.webp" },
  { id: "car", name: "Toy car", src: "/avatar-frames/car.webp" },
  { id: "plane", name: "Airplane", src: "/avatar-frames/plane.webp" },
  { id: "jet", name: "Jet", src: "/avatar-frames/jet.webp" },
  { id: "volcano", name: "Volcano", src: "/avatar-frames/volcano.webp" },
  { id: "helicopter", name: "Helicopter", src: "/avatar-frames/helicopter.webp" },
] as const;

export type AvatarFrameId = Exclude<(typeof AVATAR_FRAMES)[number]["id"], null>;

export function isAvatarFrameId(value: string | null | undefined): value is AvatarFrameId {
  return typeof value === "string" && AVATAR_FRAMES.some((frame) => frame.id === value);
}
