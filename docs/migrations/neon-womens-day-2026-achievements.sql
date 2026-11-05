-- 20/10/2026 Town celebration: achievement catalog data only.
-- Paste this entire file into the target Neon SQL Editor.
-- Requires the existing public.achievement_definitions table.
-- No schema/Drizzle ledger migration is needed: event state uses Town JSON.
-- Safe to repeat; does not modify child progress, earned badges or Town state.
-- Equivalent to the admin achievement group's "Migrate achievement data" button.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

INSERT INTO public.achievement_definitions (id, group_id, definition)
SELECT id, 'womens-day-2026', jsonb_build_object(
  'id', id, 'name', name, 'description', description,
  'difficulty', difficulty, 'metric', metric, 'target', target,
  'badge', '/minigames/town-building/womens-day-v1/achievement-badges.png',
  'badgeIndex', badge_index, 'badgeColumns', 2, 'badgeRows', 2
)
FROM (VALUES
  ('womens-day-2026-guest', 'Celebration Guest',
   'Visit Town during the 20/10/2026 celebration.',
   'easy', 'womensDay2026Visited', 1, 0),
  ('womens-day-2026-three', 'Flower Hello',
   'Greet 3 different blobs during the 20/10/2026 celebration.',
   'easy', 'womensDay2026Greeted', 3, 1),
  ('womens-day-2026-five', 'Bouquet Buddies',
   'Greet 5 different blobs during the 20/10/2026 celebration.',
   'medium', 'womensDay2026Greeted', 5, 2),
  ('womens-day-2026-seven', 'A Town of Friends',
   'Greet all 7 different blobs during the 20/10/2026 celebration.',
   'medium', 'womensDay2026Greeted', 7, 3)
) AS reviewed(id, name, description, difficulty, metric, target, badge_index)
ON CONFLICT (id) DO UPDATE
SET group_id = EXCLUDED.group_id, definition = EXCLUDED.definition;

COMMIT;

-- Expected: four rows, matching the deployed API's reviewed definitions.
SELECT id, group_id, definition->>'name' AS name,
       definition->>'difficulty' AS difficulty, definition->>'target' AS target
FROM public.achievement_definitions
WHERE group_id = 'womens-day-2026'
ORDER BY (definition->>'badgeIndex')::integer;
