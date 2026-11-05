import type { RandomSource } from './types.ts';

export const DEFAULT_RANDOM: RandomSource = Math.random;

export function int(random: RandomSource, minimum: number, maximum: number): number {
  if (maximum <= minimum) return minimum;
  const roll = Math.max(0, Math.min(0.9999999999999999, random()));
  return minimum + Math.floor(roll * (maximum - minimum + 1));
}

export function choose<T>(random: RandomSource, values: readonly T[]): T {
  if (values.length === 0) throw new RangeError('Cannot choose from an empty list');
  return values[int(random, 0, values.length - 1)]!;
}

/** Adapt the games' random(max) convention to the shared unit-interval source. */
export function fromBoundedRandom(random: (maximumExclusive: number) => number): RandomSource {
  const scale = 0x1000000;
  return () => Math.max(0, Math.min(scale - 1, random(scale))) / scale;
}
