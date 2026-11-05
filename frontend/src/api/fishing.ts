import { coreRequest } from './core.ts';
import type { PublicQuestion } from '../../../server/src/questions/projection.ts';
export type FishingCompanion = 'highland' | 'capybara' | 'cow';
export type FishingLocation = 'pond' | 'river';
export type FishingBait = 'baby' | 'beginner' | 'leafy' | 'chewy' | 'bouncy' | 'crunchy' | 'master';
export type FishingFish = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'T1' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
export interface FishingState {
  revision: number; serverNow: number; running: boolean; companion: FishingCompanion; location: FishingLocation; selectedBait: FishingBait;
  bait: Record<FishingBait, number>; points: Record<FishingLocation, number>; inventory: Partial<Record<FishingFish, number>>;
  discovered: Record<FishingLocation, FishingFish[]>; stats: { casts: number; caught: number; garbage: number; questions: number };
  earnedBaits: FishingBait[]; friendCatches: FishingCompanion[]; earned: Record<string, string>;
  question: { id: string; baitId: FishingBait; publicQuestion: PublicQuestion; attempts: number } | null;
  cast: { id: string; baitId: FishingBait; location: FishingLocation; remainingMs: number; paused: boolean; phase: 'waiting' | 'result'; fishId?: FishingFish | null; garbageIndex?: number; stamina?: number; points?: number; revealRemainingMs?: number } | null;
}
export type FishingCommand = { type: 'select-companion'; companion: FishingCompanion } | { type: 'select-location'; location: FishingLocation }
  | { type: 'select-bait' | 'question'; baitId: FishingBait } | { type: 'answer'; questionId: string; answer: number; continuePractice?: boolean | undefined }
  | { type: 'cast' | 'tick' | 'pause' | 'resume' | 'dismiss-question' };
const base = (profileId: string) => `/api/v1/profiles/${encodeURIComponent(profileId)}/fishing`;
export const fetchFishing = (profileId: string) => coreRequest<FishingState>(base(profileId));
export const actFishing = (profileId: string, revision: number, command: FishingCommand) => coreRequest<FishingState>(`${base(profileId)}/action`, { method: 'POST', body: JSON.stringify({ revision, command }) });
