# Pigs and Highland cows: mushrooms, poop boosts and flower bushes (2026-10-27)

Branch `feature/animal-interactions`.

## 1. Pigs forage mushrooms (decorative, client-only)
- Now and then (about once every few minutes per farmhouse) a roaming pig walks
  to the nearest reachable forest edge (`forestWorld`, the decorative forest
  strips / map trees), disappears among the trees for a few seconds, and comes
  back carrying a mushroom on its snout (like the capybara's head fruit).
- Back near its farmhouse it drops the mushroom: a small mushroom prop on the
  grass that stays about a minute, then fades. Hearts on nearby pigs.
- Never saved, sent or rewarded. Reduced motion: no trips.

## 2. Poop on crops (server-owned boost, event based)
- Pigs and Highland cows only. When the server's shared animal simulation
  (`animalWorld` contacts in `gardenSimulation` / `garden.ts`, like the
  chicken/duck visit boosts) has one of them standing on a vegetable patch, it
  may poop there: deterministic seeded chance, at most once per animal per 3
  active minutes, and at most once per patch per growth cycle (no stacking).
- Effect: every growing, non-withered slot of that patch gains 30 growth seconds
  (= 6 heartbeats of 5 s), capped at ripe. Saved on the patch (`poop:{slot,at}`)
  and cleared on harvest/replant. Never accepted from the client.
- Look (client): a small brown ball at the slot with a thin wiggling line or two
  above it (tiny flies), drawn in code, calm under reduced motion.

## 3. Highland cow poop on grass becomes a flower bush (server-owned)
- Highland cows (not pigs) may also poop on free grass (no building, road,
  fence, raft, water) during the same simulated contacts; at most one per cow
  per 3 active minutes, at most 8 waiting droppings plus bushes per map.
- Saved on the map (`droppings:[{x,y,at}]`). At the next local sunrise after it
  appeared (05:00 home time, `homeClock`) it becomes a small grass bush with a
  few flowers (`bushes:[{x,y,since}]`).
- Bushes can be eaten: when a grazer (dairy cow, Highland cow, sheep) stands on
  one in the simulation it is eaten and removed (a short nibble on screen).
- Bushes never block building; placing something on that tile removes it.

## Art (imagegen, style of the existing game)
- `mushroom-v1.png`: a cute mushroom (cream stem, red cap with cream dots) and a
  brown-cap variant; small, readable at 1/3 tile, transparent.
- `flower-bush-v1.png`: small round grass bush with a few flowers, four seasonal
  variants (spring/summer/autumn/winter), matching `grass-tufts-v1.png` and
  `terrain-minimal-v2.png`.
- Poop and flies are drawn in code (no gross art).

## Tests
- Server: poop chance/cooldowns, once-per-cycle cap, +30 s capped at ripe,
  cleared on harvest; grass dropping becomes a bush exactly at the next local
  05:00 (time zone aware), bushes eaten by grazers, caps, building removes.
- Frontend: mushroom trip state machine; poop/bush rendering; browser check.

## 4. Highland cow barns make yarn — its own product (server-owned)
Highland cows occasionally make yarn through the existing barn production: one
per 12 hours, up to 6, twice as fast while fed. Yarn is distinct from sheep wool:
it is collected into Town Storage as its own item (it does not spoil; item
limits apply) with its own russet yarn icon on the roof sticker, the Collect
button and the storage tile.

## What was built

- One shared `animalHabits.ts` simulation runs through `mapTick` for Town/Lake:
  12% seeded chance per 5 active seconds while standing; one shared 180-second
  cooldown per pig/Highland cow; once-per-cycle +30s crop boosts; 8 grass props
  per map; next home-time 05:00 conversion, grazer removal and placement cleanup.
  Cooldowns persist in the map clock independently of stripped animal positions,
  and carry their remaining time when a farmhouse moves maps. Friend views show
  the same public prop scenery with activity timestamps/contact history redacted.
- Common decorative pig forage trips use reachable forest/tree edges, a 4s
  hidden search, carried mushroom, nearby hearts and a 60s prop with a 10s fade.
  Trips start every 150–270 display seconds per farmhouse when eligible; reduced
  motion cancels them. No new commands, saved decorative progress or rewards.
- Existing `barn.ts` now has product-specific rates/capacities. Highland yarn
  takes 12h (6 max), feeding doubles speed; Collect stores yarn separately from
  wool with item limits 10/1000 and no spoilage. Shared details, roof sticker,
  Collect icon/button and Storage tile support yarn in English/Vietnamese.
  Newly committed milk/yarn/wool collection uses the shared artwork/+N storage
  animation with a stable revision key; reads/replays produce no receipt. Animal
  changes require collecting waiting products first.
- Three generated sheets (7 cells) have measured crops, true alpha, raw images,
  exact prompts/retries and notes in `output/animal-interactions/pig-highland/`.
  Review: `review-sheet.png`; provenance: `ANIMAL_INTERACTIONS_ASSETS.md`.
  Subtle fill variation remains at full resolution after three attempts.
- Regression coverage includes seed/cycle/cooldown/ripe caps, harvest/replant,
  durable cooldowns, home sunrise including DST, grazing, capacity, placement,
  map isolation, yarn rate/feeding/storage/replay and rendering/localization.
  Browser regression extends `frontend/tests/browser/town-animal-moments.test.ts`
  for both maps at 1366×768, 1024×768 and 1180×820; execution is pending outside
  this sandbox. Existing Town achievement groups/reports are unchanged.

Implementation file map (paths relative to the repository):
- `server/src/town-building/`: `animalHabits.ts`, `barn.ts`, `storage.ts`,
  `game.ts`, `garden.ts`, `gardenSessions.ts`, `areaOfEffect.ts`, `mapTick.ts`,
  `visits.ts`, `maps/view.ts`, `maps/land.ts`, `maps/lake/types.ts`,
  `maps/lake/visits.ts`, `events/runtime.ts`, `AGENTS.md`.
- `frontend/src/features/town-building/`: `animalMoments.ts`, `animalRender.ts`,
  `momentRender.ts`, `momentAtlas.ts`, `townAtlas.ts`, `townImageFiles.ts`,
  `BarnUi.tsx`, `TownStatusLayer.tsx`, `scene/MapScene.tsx`,
  `scene/MapWorkspace.tsx`, `TownVisitView.tsx`, `townReward.ts`,
  `TownRewardBar.tsx`, `townReward.css`, `TownMapLayout.tsx`, `AGENTS.md`.
- `frontend/src/i18n/vi.json`; `frontend/server/artwork/catalog.json`;
  `frontend/public/minigames/town-building/{mushroom-v1,flower-bush-v1,highland-yarn-v1}.png`
  and `ANIMAL_INTERACTIONS_ASSETS.md`; art sources/review under the work folder.
- `server/tests/{town-animal-habits,town-barns-storage}.test.ts`;
  `frontend/tests/{town-animal-moments,town-pig-highland-render}.test.ts`;
  `frontend/tests/browser/town-animal-moments.test.ts`; this plan.

Validation: focused server/frontend tests and both typechecks (including hosting)
pass; server and both frontend build modes pass. Full suites each pass 123 of 124
file-level test entries: frontend `explore-performance-report` is blocked by
`spawnSync EPERM`; server `node-adapter` is blocked by local `listen EPERM`.
Browser source syntax checks pass; browser execution remains pending user UAT.
Shared entity review covers Town, Lake, event harvests, visits, transfers and the
single barn/collection/reward path. No code-review findings remain. No commit,
push, deployment, migration, cloud change or branch switch was made.
