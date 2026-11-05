export function minecraftLayout(width: number, height: number) {
  const wallWidth = Math.max(1, width), wallHeight = Math.max(1, height);
  const rows = Math.max(2, Math.round(wallHeight / 48));
  const blockSize = wallHeight / rows;
  return { rows, columns: Math.ceil(wallWidth / blockSize), blockSize };
}
