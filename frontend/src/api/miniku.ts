import { coreRequest } from './core.ts';

export type MinikuSize = 3 | 4 | 5;
export type MinikuCell = number | null;
export interface MinikuBoard {
  size: MinikuSize;
  givens: number[];
  entries: MinikuCell[];
  status: 'playing' | 'complete';
  selectedIndex: number | null;
  conflictIndices: number[];
}
export interface MinikuAchievement {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  earnedAt: string | null;
}
export interface MinikuState {
  hints?: boolean;
  revision: number;
  serverNow: number;
  completed: number;
  completedBySize: Record<string, number>;
  board: MinikuBoard | null;
  achievements: MinikuAchievement[];
}
export type MinikuCommand =
  | { type: 'start' | 'new-puzzle'; size: MinikuSize }
  | { type: 'select-cell' | 'clear-cell'; index: number }
  | { type: 'set-cell'; index: number; value: number };
const path = (profileId: string) => `/api/v1/profiles/${encodeURIComponent(profileId)}/miniku`;
export const fetchMiniku = (profileId: string) => coreRequest<MinikuState>(path(profileId));
export const actMiniku = (profileId: string, revision: number, command: MinikuCommand) => coreRequest<MinikuState>(`${path(profileId)}/action`, { method: 'POST', body: JSON.stringify({ revision, command }) });
