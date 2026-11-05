import { coreRequest } from './core.ts';
import type { PublicQuestion } from '../../../server/src/questions/projection.ts';
export type MathAnimal = 'capybara' | 'cow' | 'highland';
export type WallStyle = 'brick' | 'blocks' | 'stone' | 'garden';
export type MathLanguage = 'en' | 'vi';
export interface MathSettings { animal: MathAnimal; wall: WallStyle; language: MathLanguage }
export interface MathAchievement { id: string; name: string; nameVi: string; description: string; descriptionVi: string; current: number; target: number; earned: boolean; logo: number }
export interface MathSession extends MathSettings {
  phase: 'playing' | 'resolved' | 'paused' | 'finished'; pausedFrom: 'playing' | 'resolved';
  remaining: number; deadline: number; lane: number; wave: number; score: number;
  difficulty: 'easy' | 'medium' | 'hard'; question: PublicQuestion;
  result: 'pass' | 'splash' | null; correctLane: number | null;
  earnedBadges?: MathAchievement[];
}
export interface MathState { townReward?: import('../../../server/src/town-building/game').Cost; revision: number; serverNow: number; best: number; achievements: MathAchievement[]; session: MathSession | null }
export interface MathLeader { name: string; score: number; self: boolean }
export type MathAction = { type: 'lane'; lane: number } | { type: 'settle' | 'next' | 'pause' | 'resume' | 'finish' };
const base = (profile: string) => `/api/v1/profiles/${encodeURIComponent(profile)}/math-wall`;
export const fetchMathWall = (profile: string) => coreRequest<MathState>(base(profile));
export const fetchMathLeaders = (profile: string) => coreRequest<MathLeader[]>(`${base(profile)}/leaderboard`);
export const startMathWall = (profile: string, revision: number, settings: MathSettings) => coreRequest<MathState>(`${base(profile)}/start`, { method: 'POST', body: JSON.stringify({ revision, settings }) });
export const actMathWall = (profile: string, revision: number, action: MathAction) => coreRequest<MathState>(`${base(profile)}/action`, { method: 'POST', body: JSON.stringify({ revision, action }) });
