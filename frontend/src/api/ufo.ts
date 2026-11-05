import { coreRequest } from './core.ts';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Animal = 'cow' | 'highland' | 'sheep' | 'capybara';
export interface UfoSettings { language?: 'en' | 'vi'; difficulty: Difficulty; animal: Animal; background: 'farm' | 'forest' | 'lake' }
export interface UfoWord { language?: 'en' | 'vi'; id: string; word: string; clue: string; definition: string; difficulty: Difficulty }
export interface UfoAchievement { id: string; name: string; description: string; current: number; target: number; earned: boolean; logo: number }
export interface UfoState { townReward?: import('../../../server/src/town-building/game').Cost; revision: number; achievements: UfoAchievement[]; stats: { solved: number }; session: null | (UfoSettings & { guessed: string[]; hints: number; danger: number; charges: number; solved: number; status: 'playing' | 'solved' | 'captured'; clue: string; letters: string[]; answer: string | null; definition: string | null; celebrationEndsAt: number | null; shooReadyAt: number }) }
export type UfoAction = { type: 'guess'; letter: string } | { type: 'hint' | 'shoo' | 'next' };
const base = (profile: string) => `/api/v1/profiles/${encodeURIComponent(profile)}/ufo`;
export const fetchUfo = (profile: string) => coreRequest<UfoState>(base(profile));
export const startUfo = (profile: string, revision: number, settings: UfoSettings) => coreRequest<UfoState>(`${base(profile)}/start`, { method: 'POST', body: JSON.stringify({ revision, settings }) });
export const actUfo = (profile: string, revision: number, action: UfoAction) => coreRequest<UfoState>(`${base(profile)}/action`, { method: 'POST', body: JSON.stringify({ revision, action }) });
export const listUfoWords = () => coreRequest<UfoWord[]>('/api/v1/admin/ufo/words');
export const saveUfoWord = (word: Omit<UfoWord, 'id'>, id?: string) => coreRequest<UfoWord>(`/api/v1/admin/ufo/words${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(word) });
export const deleteUfoWord = (id: string) => coreRequest<void>(`/api/v1/admin/ufo/words/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const loadUfoMaster = () => coreRequest<{ added: number }>('/api/v1/admin/ufo/words/master', { method: 'POST' });
