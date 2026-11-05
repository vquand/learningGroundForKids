import type { BaitId, CompanionId, FishId, LocationId, RetainedFishId } from './catalog.js';
import type { PublicQuestion } from '../questions/projection.ts';
import type { Question } from '../questions/types.ts';

export interface FishingQuestion {
  id: string;
  baitId: BaitId;
  question: Question;
  attempts: number;
}

export type FishingCommand =
  | { type: 'select-companion'; companion: CompanionId }
  | { type: 'select-location'; location: LocationId }
  | { type: 'select-bait'; baitId: BaitId }
  | { type: 'question'; baitId: BaitId }
  | { type: 'answer'; questionId: string; answer: number; continuePractice?: boolean | undefined }
  | { type: 'cast' | 'tick' | 'pause' | 'resume' | 'dismiss-question' };

export interface FishingPublicState {
  revision: number;
  serverNow: number;
  running: boolean;
  companion: CompanionId;
  location: LocationId;
  selectedBait: BaitId;
  bait: Record<BaitId, number>;
  points: Record<LocationId, number>;
  inventory: Record<RetainedFishId, number>;
  discovered: Record<LocationId, FishId[]>;
  stats: { casts: number; caught: number; garbage: number; questions: number };
  earnedBaits: BaitId[];
  friendCatches: CompanionId[];
  earned: Record<string, string>;
  question: { id: string; baitId: BaitId; publicQuestion: PublicQuestion; attempts: number } | null;
  cast: {
    id: string; baitId: BaitId; location: LocationId; remainingMs: number;
    paused: boolean; phase: 'waiting' | 'result';
    fishId?: FishId | null; garbageIndex?: number; stamina?: number; points?: number; revealRemainingMs?: number;
  } | null;
}

export interface FishingProgress extends Omit<FishingPublicState, 'serverNow' | 'question' | 'cast'> {
  recentFacts?: string[];
  lastActivityAt: number;
  nextCastAt: number;
  question: FishingQuestion | null;
  cast: (NonNullable<FishingPublicState['cast']> & {
    outcome: FishId | null; garbageVariant: number; companion: CompanionId; lastTickAt: number;
  }) | null;
}
