import type { BaitId } from './catalog.js';
import type { LevelId, Operator } from '../questions/types.ts';

export type FishingLevel = Extract<LevelId, 'addsub-2d1d' | 'add-2d' | 'addsub-20' | 'sub-2d' | 'mul-2to5' | 'mul-1d' | 'div-1d'>;

/** The only question configuration Fishing owns: bait selects a shared level and operator. */
export const BAIT_LEVELS = {
  baby: { level: 'addsub-2d1d', operators: ['+'] },
  beginner: { level: 'add-2d', operators: ['+'] },
  leafy: { level: 'addsub-20', operators: ['−'] },
  chewy: { level: 'sub-2d', operators: ['−'] },
  bouncy: { level: 'mul-2to5', operators: ['×'] },
  crunchy: { level: 'mul-1d', operators: ['×'] },
  master: { level: 'div-1d', operators: ['÷'] },
} as const satisfies Readonly<Record<BaitId, { level: FishingLevel; operators: readonly [Operator] }>>;
