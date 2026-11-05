/** Reusable flying-actor math. No event calendar, crops, rewards or artwork. */
export interface GhostPoint { x: number; y: number }
export interface GhostFlight {
  from: GhostPoint; to: GhostPoint; origin?: GhostPoint;
  startedAt: number; approachSeconds?: number; carrySeconds?: number;
}
export interface GhostMotionPolicy {
  readonly speed: number;
  readonly minimumTravel: number;
  readonly pickupSeconds: number;
  readonly placeSeconds: number;
  readonly legacyApproach: number;
  readonly legacyCarry: number;
  readonly restMin: number;
  readonly restMax: number;
}
export function stableNoise(seed: string): number {
  let hash = 2166136261;
  for (const letter of seed) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}
export function ghostTravelSeconds(a: GhostPoint, b: GhostPoint, policy: GhostMotionPolicy): number {
  return Math.max(policy.minimumTravel, Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) * 1.5 / policy.speed));
}
export function flightTiming(job: GhostFlight, policy: GhostMotionPolicy) {
  const approach = job.approachSeconds ?? policy.legacyApproach, carry = job.carrySeconds ?? policy.legacyCarry;
  return { approach, carry, pickupAt: approach + policy.pickupSeconds,
    hangStarts: approach + policy.pickupSeconds + carry,
    finishedAt: approach + policy.pickupSeconds + carry + policy.placeSeconds };
}
function mix(a: GhostPoint, b: GhostPoint, t: number): GhostPoint {
  const p = Math.max(0, Math.min(1, t)), ease = p * p * (3 - 2 * p);
  return { x: a.x + (b.x - a.x) * ease, y: a.y + (b.y - a.y) * ease };
}
export function flightPosition(job: GhostFlight, seconds: number, origin: GhostPoint, destination: GhostPoint, policy: GhostMotionPolicy): GhostPoint {
  const age = Math.max(0, seconds - job.startedAt), timing = flightTiming(job, policy);
  if (age < timing.approach) return mix(job.origin ?? origin, job.from, age / timing.approach);
  if (age < timing.pickupAt) return { ...job.from };
  return mix(job.from, destination, (age - timing.pickupAt) / timing.carry);
}
export function ghostRestSeconds(seed: string, worker: number, job: number, policy: GhostMotionPolicy) {
  return policy.restMin + stableNoise(`${seed}:rest:${worker}:${job}`) * (policy.restMax - policy.restMin);
}
export function ghostFacing(from: GhostPoint, to: GhostPoint, fallback = 1): number {
  return Math.abs(to.y - from.y) > .001 ? (to.y < from.y ? -1 : 1) : fallback;
}
export function stepFlyingMotion(from: GhostPoint, to: GhostPoint, delta: number, speed: number, reduced = false): GhostPoint {
  const distance = Math.hypot(to.x - from.x, to.y - from.y), step = speed * Math.max(0, Math.min(delta, .05));
  if (reduced || distance <= step) return { x: to.x, y: to.y };
  if (!distance) return { ...from };
  return { x: from.x + (to.x - from.x) / distance * step, y: from.y + (to.y - from.y) / distance * step };
}
