import { coreRequest } from './core.ts';
import type { InfinidrillViewState } from '../features/infinidrill/types';
export interface InfinidrillAchievement {
  id: string; name: string; description: string; badge: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary'; earnedAt: string | null;
}
export interface InfinidrillState { townReward?: import('../../../server/src/town-building/game').Cost; townDeposits?: import('../../../server/src/town-building/rewards').TownDeposit[]; revision: number; game: InfinidrillViewState | null; achievements: InfinidrillAchievement[] }
const path = (id: string) => `/api/v1/profiles/${encodeURIComponent(id)}/infinidrill`;
export const getInfinidrill = (id: string) => coreRequest<InfinidrillState>(path(id));
export const sendInfinidrill = (id: string, revision: number, command: object) => coreRequest<InfinidrillState>(`${path(id)}/action`, { method: 'POST', body: JSON.stringify({ revision, command }) });
