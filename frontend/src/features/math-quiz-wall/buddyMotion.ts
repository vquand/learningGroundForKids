export interface BuddyMotion { x: number; target: number; direction: number; phase: 'idle' | 'walking' }
export function initialBuddyMotion(): BuddyMotion { return { x: 0, target: 0, direction: 1, phase: 'idle' }; }
export function buddyPose(s: BuddyMotion): 'rear' | 'left' | 'right' { return s.phase === 'idle' ? 'rear' : s.direction < 0 ? 'left' : 'right'; }
export function stepBuddyMotion(previous: BuddyMotion, target: number, dt: number, paused = false): BuddyMotion {
  if (paused) return previous;
  const s = { ...previous };
  if (target !== s.target) { s.target = target; s.direction = Math.sign(target - s.x) || 1; s.phase = 'walking'; }
  if (s.phase === 'walking') {
    const distance = target - s.x, step = Math.min(Math.abs(distance), 7 * dt);
    s.x += Math.sign(distance) * step;
    if (Math.abs(target - s.x) < .005) { s.x = target; s.phase = 'idle'; }
  }
  return s;
}
