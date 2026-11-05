import { coreRequest } from './core.ts';
import type { MinikuSize } from './miniku.ts';
export interface MinikuPuzzle { id: string; size: MinikuSize; givens: number[]; enabled: boolean; revision: number; ownerFamilyId: string | null }
export const fetchMinikuPuzzles = (admin: boolean) => coreRequest<MinikuPuzzle[]>(`/api/v1/${admin ? 'admin' : 'parent'}/miniku/puzzles`);
export const updateMinikuPuzzle = (puzzle: MinikuPuzzle, admin: boolean) => coreRequest<MinikuPuzzle>(`/api/v1/${admin ? 'admin' : 'parent'}/miniku/puzzles/${encodeURIComponent(puzzle.id)}`, {
  method: 'PATCH', body: JSON.stringify({ givens: puzzle.givens, enabled: puzzle.enabled, revision: puzzle.revision }),
});
export const fetchMinikuSettings = () => coreRequest<{ hints: boolean }>('/api/v1/parent/miniku/settings');
export const updateMinikuSettings = (hints: boolean) => coreRequest<{ hints: boolean }>('/api/v1/parent/miniku/settings', { method: 'PATCH', body: JSON.stringify({ hints }) });

export const createMinikuPuzzle = (puzzle: MinikuPuzzle, admin: boolean) => coreRequest<MinikuPuzzle>(`/api/v1/${admin ? 'admin' : 'parent'}/miniku/puzzles`, { method:'POST', body:JSON.stringify({ size:puzzle.size, givens:puzzle.givens, enabled:puzzle.enabled }) });
