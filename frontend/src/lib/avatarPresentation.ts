export function avatarBackgroundStyle(color?: string): { backgroundColor?: string } {
  return color ? { backgroundColor: color } : {};
}
