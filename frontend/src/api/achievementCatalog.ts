import { coreRequest } from './core.ts';
import type { GameReport } from '../../../server/src/parent-reports/contracts';
export interface AchievementGroup {
  id: string; name: string; earning: 'server-verified' | 'catalog-only'; installed: number; needsMigration: boolean;
  achievements: Array<{ id: string; name: string; description: string; badge: string; badgeIndex?: number; badgeColumns?: number; badgeRows?: number; difficulty: string }>;
}
export interface AchievementCatalogMigration {
  groups: AchievementGroup[];
  migratedGroups: number;
  installed: number;
}
export const fetchAchievementCatalog = () => coreRequest<AchievementGroup[]>('/api/v1/admin/achievements');
export const migrateAchievementCatalog = () => coreRequest<AchievementCatalogMigration>('/api/v1/admin/achievements/migrate', { method: 'POST' });
export const fetchProfileAchievementGroups = (profileId: string) => coreRequest<GameReport[]>(`/api/v1/profiles/${encodeURIComponent(profileId)}/achievement-groups`);
