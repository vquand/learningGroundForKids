import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import type { AchievementCatalogRepository } from '../achievement-catalog.js';
import { achievementDefinitions } from './schema.js';

export function createAchievementCatalogRepository(pool: Pool): AchievementCatalogRepository {
  const db = drizzle(pool);
  return {
    async list() {
      const rows = await db.select().from(achievementDefinitions);
      return rows.map(row => ({ ...row.definition, id: row.id, groupId: row.groupId }));
    },
    async sync(group) {
      // Atomic upsert: concurrent/repeated runs retain the same stable IDs.
      // This table contains definitions only, never player awards or progress.
      await db.transaction(async tx => {
        await tx.insert(achievementDefinitions).values(group.achievements.map(definition => ({
          id: definition.id, groupId: group.id, definition,
        }))).onConflictDoUpdate({ target: achievementDefinitions.id, set: {
          groupId: sql`excluded.group_id`, definition: sql`excluded.definition`,
        } });
      });
    },
  };
}
