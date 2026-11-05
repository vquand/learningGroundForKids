import type { Pool } from 'pg';
import { COOKING_RECIPES } from './cookingConfig.js';
import { FOOD_AND_DRINK_RECIPES } from '../town-building/drink-recipes.js';

export interface KitchenCompletions { counts: Record<string, number> }
const recipes = [
  { id: 'burger', title: 'Cozy cheeseburger' },
  ...COOKING_RECIPES.map(({ id, title }) => ({ id, title })),
  { id: 'cabbage-rolls', title: 'Cabbage rolls' },
  ...FOOD_AND_DRINK_RECIPES.map(({ id, title }) => ({ id, title })),
];

/** Count verified successful batches, not attempts, reward claims or browser state.
 * Existing journal titles support history from before recipe IDs were recorded.
 * The latest saved session also preserves a known success predating the journal.
 */
export async function readKitchenCompletions(pool: Pool, profileId: string): Promise<KitchenCompletions> {
  const result = await pool.query<{ recipe_id: string; count: number }>(`
    WITH recipes AS (SELECT * FROM jsonb_to_recordset($2::jsonb) AS r(id text,title text)),
    successes AS (
      SELECT r.id AS recipe_id, split_part(e.event_key, ':', 2) AS session_id
      FROM adventure_events e JOIN recipes r ON
        e.data->>'recipeId'=r.id OR (NOT(e.data ? 'recipeId') AND e.data->>'subject'=r.title)
      WHERE e.profile_id=$1 AND e.game='kitchen' AND e.kind='meal_finished'
        AND split_part(e.event_key, ':', 1) IN ('kitchen','drink','cabbage')
      UNION
      SELECT r.id, s.state->>'sessionId' FROM kitchen_sessions s JOIN recipes r
        ON r.id=CASE WHEN s.recipe_id='steak' THEN 'pan-seared-steak' ELSE s.recipe_id END
      WHERE s.profile_id=$1 AND ((s.state->'game'->>'step'='serve' AND r.id='burger')
        OR (s.state->'game'->>'status'='completed' AND r.id<>'burger'
          AND COALESCE(s.state->'game'->>'grillDoneness','')<>'burnt'))
      UNION
      SELECT r.id, s.state->>'sessionId' FROM town_drink_sessions s JOIN recipes r
        ON r.id=s.state->'game'->>'recipeId'
      WHERE s.profile_id=$1 AND s.state->'game'->>'status'='completed'
      UNION
      SELECT 'cabbage-rolls', state->>'sessionId' FROM cabbage_roll_sessions
      WHERE profile_id=$1 AND state->>'phase' IN ('result','served')
        AND state->>'outcome' IN ('okay','perfect')
    ) SELECT recipe_id, count(DISTINCT session_id)::integer AS count
      FROM successes WHERE session_id IS NOT NULL AND session_id<>'' GROUP BY recipe_id
  `, [profileId, JSON.stringify(recipes)]);
  const counts = Object.fromEntries(recipes.map(recipe => [recipe.id, 0]));
  for (const row of result.rows) counts[row.recipe_id] = row.count;
  return { counts };
}
