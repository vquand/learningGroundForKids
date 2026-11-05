# Town Building: shared learning rewards and a little town

## Status and objective

Design choices reviewed through questions 1–8 on `feature/town-building`.
Implemented locally with generated assets, server-verified source rewards,
additive PostgreSQL migration 0017, and browser/database tests. No release,
cloud provisioning, commit, or push has occurred. The guarded local development
migration is applied; production data is untouched.
This feature follows the Vercel/Render/Neon architecture and preserves existing
minigames. Children earn resources through learning, then spend them to create
a cozy 2D town on a 20-wide × 40-long logical tile map.

## Confirmed decisions and remaining proposals

- Confirmed: each child profile has its own persistent town and a common storage
  shared across that child's games.
- Rock and stone mean the same resource (`rock`). Sand, metal, wool, wood,
  rock, and stamina remain separate balances. Unused resources can accumulate
  for later blueprints; starter buildings consume only stamina, wood, and rock.
- Stamina is stored construction energy, without decay, a cap, or a cooldown.
- Confirmed: construction is immediate after confirmed payment. Buildings and trees are
  decorative in this first version; there is no passive resource generation,
  town simulation, required road connection, or real-time construction timer.
- Resources begin accruing after the feature is installed. No retrospective
  grant from unverified historic play. Existing server-saved Done items count
  toward blueprint eligibility under the existing learning rules.
- Confirmed: elevated front-facing 2D view, similar to Stardew Valley, with
  exactly two zoom levels: overview and close placement. Use a square tile grid
  with visible building fronts and roofs, not an isometric diamond or side view.
  Preserve the app's rounded pastel illustrated art rather than copying pixel art.
  Display the logical 40-tile length across the landscape and 20-tile width
  into scene depth. This display mapping preserves the requested map dimensions.
- Confirmed: a move costs half of each material in the building's original paid
  construction recipe, rounded up independently. Removal gives no refund.
- Confirmed: lower the initially proposed construction costs and blueprint
  learning thresholds by about 30%. Use `Math.ceil(initialValue * 7 / 10)`
  independently for each value; zero remains zero. Resource earning rates are
  unchanged. The one-rock road remains one rock after integer rounding.

## Proposed earning economy

These are starting tuning values used by the implementation; lower construction costs
and learning thresholds rather than reducing the resources earned from games.
The reward ledger deduplicates verified events inside source transactions.

| Source | Verified event | Proposed grant |
| --- | --- | --- |
| Infinidrill | Newly excavated sand/dirt cell | 1 sand |
| Infinidrill | Newly excavated rock cell | 1 rock |
| Infinidrill | Each 10 newly earned rocks, with per-child carry across digs/replays | 1 additional sand; keep all rock |
| Infinidrill | Newly excavated metal-bearing cell | 1 metal, plus its ground material |
| Shoo Shoo UFO | Completed correct word, easy | 2 wood + 1 wool |
| Shoo Shoo UFO | Completed correct word, medium | 6 wood + 3 wool (3× easy) |
| Shoo Shoo UFO | Completed correct word, hard | 14 wood + 7 wool (7× easy) |
| Waddle Wall | Server-verified passed wall, easy / medium / hard | 1 / 3 / 5 each of wood and wool |
| Food and Drink | Finished server-verified recipe | 5 stamina + 1 per completed optional step, capped at 8 per recipe |
| Travel the World | Distinct item has server-saved Done state | Adds one permanent item to blueprint milestone progress |

Infinidrill terrain classification must explicitly map its existing material
families to this economy. The first implementation awards sand from the two
upper dirt families (rows below 120) and rock from deeper terrain. Metal deposits must be deterministically
server-issued and persistently deduplicated alongside both head and laser cuts.
Do not turn existing nuggets/diamonds into metal or change their upgrade use.
Metal-bearing cells use a stable 6% coordinate-hash occurrence rate; sand and rock can
accrue even from digs that have no existing valuable deposit.

Every source awards only after server verification. Infinidrill currently has
server-owned excavation and UFO has server-owned word grading. Food and Drink
currently uses a browser reducer, so server recipe sessions/grading are a
prerequisite, not a client completion report. Confirmed Travel rule: reuse the
existing server-saved Done state; do not add another town-specific quiz gate.
`progress.get` returns `{ done: boolean }`, derived from the presence of a
`profile_progress` row; `progress.list` returns `done_item_ids`. The existing
`progress.mark` requires an 80% server-graded quiz pass only for items configured
with `quizRequired`. Preserve that behavior. The town reads the owned profile's
database progress, never a browser-supplied boolean or count. Count each distinct
item once; persist first-Done credit so deleting/re-marking cannot inflate
milestones. Already saved Done items qualify on first town initialization.
Unlocks remain permanent if an item is later unmarked.

Animate mined material from excavated tiles to a shared storage indicator;
animate wood/wool after a confirmed word win and stamina after a confirmed
recipe finish. Honor reduced motion and announce rewards accessibly. Present
sand/rock/metal in drill tiles with the established pastel texture style.
Infinidrill cannot spend these resources; its existing valuable loot remains.

## Starter blueprints and costs

All four are unlocked by default; unlocking never pays their building costs.

| Blueprint | Footprint (width × length) | Stamina | Wood | Rock |
| --- | --- | ---: | ---: | ---: |
| Normal house | 2×3 | 7 | 9 | 5 |
| Farmhouse | 2×4 | 11 | 13 | 6 |
| Chicken coop | 2×2 | 4 | 6 | 2 |
| Lemon tree | 2×2 | 4 | 2 | 0 |

Confirmed costs are approximately 30% below the initial proposal, rounded up
per material to preserve integer costs. Small costs may remain unchanged.
Suggested pacing: a coop requires roughly one drink, three easy words, and a
small amount of mining. Costs should be tuned after observing actual mining
throughput. Lemon-tree wood represents supports and a planter.

Dirt road: 1×1, free. Rocky road: 1×1, 1 rock. Both are decoration only.
Placement must be inside the map and cannot overlap buildings or trees. Road
replacement must charge only a real change to rocky road, not repeated clicks
on an existing rocky tile. No cost is paid before placement confirmation.

## Reviewed Travel blueprint thresholds

Use cumulative distinct server-saved Done items, counting across countries and
categories so a child is not blocked by travel destination. Unlock permanently.

| Learned items | Unlock | Proposed footprint |
| ---: | --- | --- |
| 4 | Apple tree | 2×2 |
| 7 | Large house | 3×4 |
| 14 | Infirmary (fantasy medical building) | 3×3 |
| 21 | School | 3×4 |
| 35 | Town Hall | 4×4 |
| 53 | Cherry blossom tree | 2×2 |
| 70 | Library | 3×3 |

Thresholds use the same approximately 30% reduction, rounded up.
Show the next blueprint and progress, for example “School: 17 / 21 items
learned.” Suggested later-building costs should grow gently from starter
costs and can introduce wool, sand, and metal; finalize each recipe before
implementing the catalog. Locked previews remain visible with their condition.

## Town interaction and viewport

Use a fixed landscape shell: storage bar, town scene, and a compact paginated
build palette. Select a blueprint, show a footprint preview, choose a legal
tile, and confirm Build. Touch placement must work without hover. Invalid
placements show a readable reason without spending resources. Keep Build,
Cancel, storage, and the selected blueprint visible together.

For each cost show owned/needed/missing, with a direct earn button:

- Wood or wool → Shoo Shoo UFO (`/shoo-shoo-ufo`).
- Rock, sand, or metal → Infinidrill (`/infinidrill`).
- Stamina → Food and Drink (`/food-and-drink`).
- Locked blueprint → existing Travel the World entry, resolved from app routing
  during implementation, preserving profile and town return context.

Keep the requested footprint selected when a child returns. Reload authoritative
storage on return. No browser-supplied reward claims in return links.

An 800-tile overview can make individual tiles too small to tap. Use exactly
two zoom levels: a full-town overview and a close placement view. Provide a
two-state zoom toggle, direction buttons, and a reset-view button; keep every
control in the viewport. Do not add continuous zoom or extra intermediate levels.
Camera navigation is separate from page scrolling. Paginate palettes and prompts, preserve safe areas and
art proportions, and verify every state at 1366×768, 1024×768, and 1180×820.

Confirmed editing rules: instant construction, paid movement, and removal
without refund, with a removal confirmation. For each material, movement costs
`Math.ceil(originalCost / 2)`; zero stays zero. Persist the original paid cost
server-side with each building so later catalog tuning cannot silently change
its movement cost. Show integer costs and shortages before confirmation.

Examples using the reviewed reduced starter recipes:

| Building | Move stamina | Move wood | Move rock |
| --- | ---: | ---: | ---: |
| Normal house | 4 | 5 | 3 |
| Farmhouse | 6 | 7 | 3 |
| Chicken coop | 2 | 3 | 1 |
| Lemon tree | 2 | 1 | 0 |

A 9-wood construction cost would mean 5 wood to move, never 4.5. Moving must
atomically check ownership, revision, destination bounds/occupancy, and balances
before debiting and updating the existing entity. The original footprint is
excluded from self-collision checks. Invalid/canceled moves, retries, and moving
to the exact same position cost nothing. Preserve the original building ID;
moving must not count as new construction or duplicate achievement progress.

## Calendar seasons and local weather

Confirmed additions: four seasonal tile/tree sets follow the real calendar in
the child's saved home location; the home hemisphere determines the season.
Exactly two zoom levels remain. Local rain appears in the scene. Winter has
occasional storybook snow days even where real snow is uncommon. Test-server
controls can switch season/weather quickly; production cannot override them.
These changes are visual only: no seasonal resource yield, building discount,
crop mechanic, stamina effect, construction restriction, or achievement change.

### Calendar and location

- Reuse the profile's `native_city` and `native_country_code`, not the currently
  viewed Travel destination. Resolve the saved city to approximate city-center
  coordinates and an IANA timezone on the server. Confirmed location choice:
  saved home city, with a parent-set city if missing. Do not request GPS, collect
  an exact child address, or change the existing disabled geolocation policy.
- Use server time converted to the saved city's timezone to determine local
  calendar date. Do not use server UTC month, an unvalidated browser clock,
  query parameters, or a client-submitted season as production authority.
- Use calendar month boundaries rather than astronomical equinox calculations:

| Local months | Northern hemisphere | Southern hemisphere |
| --- | --- | --- |
| March–May | Spring | Autumn |
| June–August | Summer | Winter |
| September–November | Autumn | Spring |
| December–February | Winter | Summer |

- The equator uses the northern schedule. The seasonal town remains a storybook
  four-season setting in tropical climates; precipitation follows home weather.
- If a home city is missing or cannot be uniquely resolved, ask the parent to
  choose it. Until then use a labeled default town calendar (northern schedule,
  UTC), with no claim of local weather. Do not guess precise coordinates or
  silently select an ambiguous city.
- Refresh on town entry, tab resume, and the next local midnight. Update scene
  appearance without changing entity IDs, paid costs, footprints, storage,
  learned progress, achievements, or a child's pending placement/move.

### Seasonal artwork

| Season | Ground tiles | Tree variants and decoration |
| --- | --- | --- |
| Spring | Light-green grass, small emerging plants, sparse flowers | Light-green new leaves; flowering species gain readable blossom clusters |
| Summer | Deeper green, fuller grass | Fuller darker-green canopies; summer-bearing species show fruit |
| Autumn | Less grass and more visible soil; scattered fallen leaves | Yellow/gold foliage and thinner crowns for deciduous species; species-specific fruit and leaf retention |
| Winter | Sparse grass, more exposed soil, muted colors | Deciduous trees mostly bare; evergreens retain their characteristic foliage; snow variants on selected days |

Species rules override a generic leaf-color swap. Lemon trees retain evergreen
foliage with a somewhat lighter/sparser winter canopy; do not render all trees
bare or yellow. Apple/cherry trees have deciduous seasonal silhouettes and
species-specific blossoms/fruit. Fruit is visual decoration, not an automatic
harvest reward. Define each species' blossom/fruit variants in its art manifest.

Generate seamless seasonal grass/soil tiles plus sparse flower/leaf detail
variants. Keep identical tile dimensions and connecting edges across all sets.
Use deterministic per-tile variation so zooming, refreshing, or changing weather
does not reshuffle decoration. Keep tree trunks, roots, anchors, scale, and
footprints aligned across every seasonal canopy. Separate ground, canopy,
roof/surface snow, and precipitation layers to avoid generating every possible
season/weather combination as a full atlas.

Roads retain dirt/rock identity and boundaries in every season. Snow uses a
light surface layer that leaves road routes, building fronts, grid selection,
placement validity, and controls readable. Keep foliage density genuinely lower
in autumn/winter rather than only recoloring summer assets.

### Rain and winter snow

- Fetch modeled current weather through Render using a fixed provider adapter;
  the browser calls only the same-origin town environment API. City geocoding
  and weather responses are untrusted: validate coordinates, timezone, finite
  precipitation values, allowed codes, and observation timestamps. Do not accept
  a browser-supplied provider URL. Keep provider secrets in runtime config.
- Candidate provider: [Open-Meteo forecast documentation](https://open-meteo.com/en/docs),
  which documents coordinate/timezone inputs and current rain, showers, snowfall,
  and weather codes. Review deployment usage terms before final selection.
  This is modeled city weather, not a direct sensor outside the child's home.
- Check current conditions, not the day's total forecast, to decide whether to
  show rain now. Proposed cache cadence: 15 minutes per resolved city, shared
  across profiles; collapse concurrent fetches, bound timeouts, and rate-limit
  requests. Keep weather fetching independent of construction transactions.
- Gentle rain overlays apply in every season, with small readable ground
  ripples/splashes and subdued wet surfaces. No lightning flashes or overlays
  that obscure footprints, buildings, controls, or learning text. Respect
  reduced-motion preferences with static wet surfaces instead of moving drops.
- If local current weather reports snow, show snow. Otherwise winter has
  deterministic occasional storybook snow days, selected from profile ID and
  local date (proposed frequency: approximately one day in four). Snow-day
  selection stays stable across reloads and tabs and never uses rewards/RNG
  that could affect game progress.
- When real rain is reported on a storybook snow day, retain a light snow cover
  and show rain rather than replacing actual rain with fictional snowfall.
  When actual snowfall is reported, use snow precipitation. Store snow cover
  separately from precipitation (`none`, `rain`, or `snow`) so these cases are
  explicit and the test controls can exercise them.
- Show weather freshness honestly. On provider failure use the last valid
  condition for at most one hour, labeled as earlier weather; then mark local
  weather unavailable and remove asserted real precipitation. Calendar seasons
  and decorative winter snow continue; the town remains fully usable. Do not
  interpret missing weather as confirmed sunshine.

### Test-server environment controls

- Require both server `NODE_ENV=test` and explicit
  `TOWN_ENVIRONMENT_PREVIEW_ENABLED=true`. Default the flag to false. A
  production or development server must reject override requests regardless
  of URL/query arguments, browser storage, headers, or forged UI state.
- Gate overrides by authenticated admin access and target-profile ownership.
  Return a server-derived `canPreviewEnvironment` capability; render the compact
  preview toolbar only when true. UI visibility alone is not authorization.
- Provide one-tap season choices (Spring/Summer/Autumn/Winter), precipitation
  choices (Dry/Rain/Snow), snow-cover toggle, and Reset to live. Display a clear
  preview indicator. The toolbar and its current action buttons must fit all
  three required viewports in both zoom levels.
- Keep overrides temporary, scoped to the authenticated admin session and
  target profile, and expiring after 30 minutes; Reset clears them. Preview must
  not change saved city, real date, town data, balances, blueprints, rewards,
  achievements, or ordinary player scenes in other sessions.
- Treat environment version/override state separately from construction revision
  so automatic weather refresh or testing a season cannot invalidate a build.

### Proposed environment API contract and checks

Add a profile-owned same-origin GET environment response with `season`,
`localDate`, `timeZone`, `precipitation`, `snowCover`, `weatherSource`
(`live`, `stale`, `unavailable`, or `preview`), `observedAt`, `expiresAt`,
and `canPreviewEnvironment`. Only authorized test admins get a private preview
mutation accepting strict season/precipitation/snow-cover enums or Reset.
Never include provider credentials or exact home addresses. Private responses
use `no-store`; only the server's provider cache is shared by approximate city.

Tests cover all month boundaries and both hemispheres; timezone midnight,
December/January, leap days; missing/ambiguous city; deciduous/evergreen variants;
stable snow selection; real-rain precedence; malformed/stale/provider-failure
responses; cache limits; and unchanged resources/progress under environment
updates. API tests must prove overrides fail on production/development even
with the preview flag, and fail for anonymous/non-admin/cross-family requests
on test. Verify Reset, expiry, session isolation, and exactly two zoom levels.
Browser UAT checks all four seasons with dry/rain/snow/cover combinations,
tree species, both zoom levels, reduced motion, and unobscured controls at
1366×768, 1024×768, and 1180×820.

## Achievements and badge art

Named group: `Town Building · Little Town`. The following definitions are draft
catalog entries, not earnable achievements until server construction rules exist.

| Name | Unlock condition | Difficulty | Badge pictogram |
| --- | --- | --- | --- |
| First Home | Construct a normal house through a verified paid build | Easy | Cozy small house |
| Farm Friends | Own a farmhouse and chicken coop in the saved town | Medium | Barn and chick |
| Lemon Lane | Own three lemon trees in the saved town | Easy | Lemon tree and basket |
| Little Village | Own ten buildings, excluding trees and roads | Medium | Cluster of rooftops |
| Town Founder | Construct an unlocked Town Hall through a verified paid build | Hard | Town Hall with pennant |

Use the universal badge prompt and UFO badge reference: transparent text-free
storybook medallions with common frame, palette, linework, and detail density.
Generate a 5×1 atlas after design review; record measured cells and transparency.
Provide an admin-only migration button using reviewed server catalog definitions;
repeated installation updates definitions without deleting earned badges or
changing progress. Never accept achievement definitions from the browser.

Town buildings match existing rounded pastel avatar/UFO art. Inspect reference
images before ImageGen; use transparent sprites with consistent camera, anchors,
scale, and lighting. Store prompts and references with assets. The camera is
confirmed; generated assets and exact prompts are recorded in the town asset README.

## Technical plan and project structure

- `frontend/src/features/town-building/`: lazy town page, scene, build palette,
  storage display, placement helpers, CSS, and implementation guide.
- `frontend/public/minigames/town-building/`: generated atlases and asset README.
- `frontend/src/api/`: portable town/storage client using existing core requests.
- `server/src/town-building/`: reviewed blueprint/cost catalog, pure placement
  rules, routes, transactional repository, shared verified reward hooks, and
  calendar/weather environment service with server-gated test previews.
- `server/src/db/` and `server/drizzle/`: additive PostgreSQL storage, event
  ledger, town state, and first-Done milestone credit schema/migrations.
- Existing Infinidrill/UFO repositories: invoke shared rewards in verified action
  transactions. Add a server recipe engine and reuse existing saved Done progress.
- Existing admin achievement catalog: add reviewed town group and migration UI.
- `frontend/tests/`, `server/tests/`, `server/tests/db/`: existing test conventions.

Suggested same-origin contracts: authenticated profile-owned GET town/storage
state and POST town command with matching revision, blueprint ID, and tile
coordinates. The server looks up cost/footprint; clients never submit authoritative
balances, earned quantities, or eligibility. Preserve the existing error envelope.
Finalize payloads in the implementation plan after design review.

Persist inventory balances, placed entities, unlocked blueprint evidence, and
unique reward-event IDs. Lock and update source-game progress and reward credits
atomically. Building placement atomically checks bounds, occupancy, eligibility,
revision, and balances before debit and save. Persist deduplication beyond game
resets and distinguish legitimate later rounds with new server session/event IDs.

Code follows existing TypeScript naming and pure-engine separation, for example:

```ts
type TilePosition = { x: number; y: number };

function fitsTown(position: TilePosition, width: number, length: number): boolean {
  return position.x >= 0 && position.y >= 0
    && position.x + width <= 20 && position.y + length <= 40;
}
```

The snippet is illustrative; HTTP input must separately enforce integer bounds
and known blueprint IDs. Always use parameterized SQL, server session ownership,
strict payload validation, private response `no-store`, and revision checks.
No new dependencies are proposed.

## Implementation sequence after review

1. Finalize the technical task list using the reviewed design choices and
   reduced economy. Preserve source-game public contracts.
2. Add pure placement/cost rules, shared storage ledger, transactional repository,
   and API with security/deduplication/concurrency tests. No cloud provisioning.
3. Connect Infinidrill and UFO verified events with collection feedback; preserve
   drill upgrades, valuable loot, and word-game progression.
4. Implement server recipe verification and distinct saved-Done credits, then
   connect stamina grants and blueprint unlocks.
5. Generate and inspect cohesive art; build the town page, placement, shortages,
   earn links, and return flow. Include seamless four-season tiles, species
   variants, rain/snow layers, and exactly two zoom levels. Add reviewed
   achievements/admin migration and authenticated test-only environment controls.
6. Run frontend/server gates and complete browser UAT; tune earning/build costs
   using actual session durations. Keep release actions gated by `confirmed`.

## Commands and testing strategy

```bash
npm run dev:local --prefix server
npm run dev --prefix frontend
npm test --prefix frontend
npm run typecheck:hosting --prefix frontend
npm run build --prefix frontend -- --mode vercel
npm run build --prefix frontend
npm test --prefix server
npm run typecheck --prefix server
npm run build --prefix server
```

Use existing Node test suites for pure costs, footprints, overlap, and milestone
rules, per-material move rounding, and exactly two zoom levels. Disposable database
tests cover atomic spend, simultaneous builds/moves, invalid/no-op moves, reward
retries, laser/head overlap, source replay IDs, stale revisions, admin migration
idempotence, and unchanged earned awards. API tests cover anonymous requests,
cross-profile/family requests, invalid coordinates, forged quantity/difficulty/
completion claims, unknown blueprints, and insufficient materials.

Browser UAT covers all starter builds, shortages for each resource, earn-link
return, locked/unlocked blueprints, both road styles, invalid placement, network
failure/retry, refreshed persistence, two-tab contention, reduced motion, and
touch controls at all three required viewport sizes. No required page scrolling.

Always validate and verify; ask about unresolved design choices before dependent
implementation. Never commit/push/merge/publish before `confirmed`, provision
cloud resources from this branch, trust browser rewards, or run production seeds
or migrations. Routine local schema/code changes are within the feature scope.

## Success criteria

- Each verified source event credits the correct child's shared storage exactly
  once; no client-reported completion or identity can earn resources.
- Default blueprints have requested footprints and reviewed costs. Construction
  cannot double-spend, overlap, exceed bounds, or use locked blueprints.
- Shortages identify every missing material and lead to its source minigame,
  preserving the intended build and refreshing storage on return.
- Distinct verified learned items unlock reviewed blueprints permanently;
  repeated visits/quizzes/Done toggles cannot inflate progress. Existing saved
  Done items qualify without an additional quiz requirement.
- Collection art and town art fit existing games; badges follow the universal
  style and admin migration preserves all player data.
- All actionable controls fit required laptop/iPad landscape viewports in each
  state; all runtime gates and browser flows pass before release review.
- Calendar seasons follow the saved home city's local date and hemisphere;
  local rain and occasional winter snow are visual only. All species/tiles
  remain cohesive and readable. Preview controls work only on explicitly
  enabled test servers for authorized admins and cannot alter game progress.

## Design review record

All eight clarification questions are answered and incorporated above:

1. Per-child town and storage, shared across that child's games.
2. Stardew Valley-like elevated 2D view with exactly two zoom levels.
3. Reuse existing server-saved Done state; no additional town quiz gate.
4. Lower initial construction costs and learning thresholds by around 30%,
   using whole numbers. Earning rates remain unchanged.
5. Immediate construction; movement costs 50% of each original material cost,
   rounded up; removal without refund.
6. Calendar seasons follow the saved home hemisphere.
7. Rain uses the profile's saved home city; a parent sets the city if missing.
8. Occasional storybook winter snow is allowed even without actual local snow;
   reported local rain still appears.

## Implemented terrain and local UAT

The base is a fixed 20×40 map with a simple three-tile-wide meandering river
(120 tiles) and a small mountain corner (40 tiles). Exactly 640/800 tiles,
80%, are buildable. All building/movement/road commands share that terrain mask.

The active route is `/town-building`, with an entry on the playground. Source
collection is server-confirmed; Infinidrill town materials animate from mined
cells to Town storage, separately from diamonds/nuggets sent to drill Inventory.
Blueprint and placement/move intent survive earn-game round trips per profile.

Weather uses Open-Meteo modeled current conditions, with visible attribution,
CC BY 4.0 data notices, and per-process request budgets below free API limits.
A multi-instance deployment must coordinate quotas before scaling. The free API
is limited to noncommercial use; recheck its terms if subscriptions, advertising,
or commercial use are introduced. Season/weather previews require both test
NODE_ENV and an enabled flag, plus a session-authenticated admin owning the profile.

Local verification includes required frontend/server tests, hosting typecheck,
both frontend builds, server typecheck/build, disposable PostgreSQL tests,
complete town browser flows at 1366×768, 1024×768, and 1180×820, and source-game
regressions. Screenshots are saved in `/tmp/plg-town-browser/`.
