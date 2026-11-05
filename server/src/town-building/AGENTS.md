# Town Building Server Guide

## Common entities and mandatory self-review

- The [module-wide common entity and self-review rules](../../../frontend/src/features/town-building/AGENTS.md#common-entities-and-mandatory-self-review)
  apply to all server code for the original Town, Lake, future maps and events.
  Reuse one implementation per building/entity type; supply environment or event
  policies/capabilities for behavior differences instead of duplicating domain
  rules, simulations or command handlers. Preserve ADR-008 event isolation.
- Before reporting a Town change, review changed and new/untracked server files
  and their map/event consumers for duplicate entity code. Fix duplication
  introduced by the change, verify affected shared paths and report any
  unresolved findings together with the validation results.

## Poultry

- Follow `docs/plans/2026-10-25-lake-poultry.md`. Settle saved egg production
  before changing species, maps or insect coverage. New coops receive no
  historical eggs. Read projections never persist production or award stock.
- Egg harvest uses revision and generation checks; friend takeaway rechecks
  both accepted friendship scopes, locks Town rows in stable order and commits
  one stock debit, one stamina credit and a durable retry receipt atomically.
  Private host balances, learning progress and reserves never appear in visits.
- Garden insect coverage includes shore and floating insect raisers, where a plot in range
  always loses a quarter of its crops (rounded up; 1 of 4) once per cycle, the
  first moment it has a ripe crop, even if the raiser arrived later. Only which
  crops wither is left to chance, never how many or whether, and more raisers do
  not raise the loss. Use the server-issued plot identity/generation so retries, overlaps,
  checkpoints or a lost worker lease cannot reroll the outcome. Chicken and
  insect effects coexist. No retroactive damage to already mature crops.
- Withered slots remain until manual Harvest, then replant without stamina,
  harvest/achievement counts or river stock. Automatic helpers cannot harvest
  them. Keep normal ripe-slot partial harvests and revision/generation checks.
- Ground animals require legal, unoccupied navigation cells. Hide residents
  when completely enclosed; never use an inside-building fallback spawn.

## Friend town visits

- `visits.ts` uses accepted friendships with both child/family scopes checked in
  either direction. Derive viewer family from the session and verify ownership;
  unknown, unrelated and revoked targets return the same 404. Recheck list,
  visit and uploaded-avatar reads. Responses are no-store.
- Project only profile display data, saved Town name, prosperity stage, the
  saved lake stage (null when locked) and scene
  entities. Never return balances, learned IDs, awards, paid recipes, raw event
  histories, home-city labels or credentials. Scene reads never initialize/save Town state, tick growth, spend resources,
  help neighbors or award achievements. Explicit river pickups credit only
  server-derived stamina through their separate transactional endpoints.
- Sort six-row pages by latest recorded action then kid name/ID without exposing
  timestamps. Keep owner mutation endpoints ownership-only. Test scope matrices,
  ordering, pagination, revocation, avatar media and unchanged stored rows in the
  guarded disposable database. Design: `docs/plans/2026-10-23-friend-town-visits.md`.

## Shared Town rules and individual maps

- All maps reuse `animalWorld.ts`, the species behavior catalog, poultry rules
  and `civ.ts`. Resolve animal terrain/scenery through `maps/animalHabitat.ts`
  and NPC navigation through its `MapDefinition`. Obstacles, trees and herd
  recruitment stay within the owning map. A transferred host rebuilds its
  navigation context; never carry a previous map's paths or terrain policy.
  Map extensions add environment-specific behavior without copying the entity.

- This is the common server guide for all Town maps. Map boundaries are defined
  in [`maps/AGENTS.md`](maps/AGENTS.md). The lake has its own implementation guide
  at [`maps/lake/AGENTS.md`](maps/lake/AGENTS.md).
- The fixed original Town terrain, original west gate and original-map event
  placements below apply only to that map. Every map shares authoritative
  ownership, storage, construction, revision, reward, achievement and live
  environment requirements; each map supplies its own terrain/access rules.
- Keep future maps in `maps/<map-id>/` and add their own linked `AGENTS.md` before
  brainstorming/implementation. Common Town transactions stay shared rather
  than copied into independent map-specific economies.

Follow the repository guide and
`frontend/src/features/town-building/AGENTS.md`, including its numbered-question,
achievement, visual consistency, and viewport requirements.
`docs/plans/2026-10-11-town-building.md` contains the reviewed design choices.

- Validate the fixed 20×40 terrain mask: 120 river tiles, 40 mountain tiles,
  640 buildable tiles. Building, moving, and road placement all respect the mask.
- Keep materials, blueprints, placements, and achievement eligibility server-owned.
  Validate same-origin authenticated requests and profile/family ownership.
- Use the reviewed construction costs and blueprint thresholds, already reduced
  by approximately 30% and rounded up per value. Do not reduce them again or
  lower source-game earning rates. Keep all persisted quantities integral.
- Use a shared authoritative reward service from verified game transactions;
  never expose an endpoint that accepts earned quantities or completion claims.
- Persist unique source-event identities. Credit rewards and source progress in
  one transaction; deduplicate retries and overlapping excavation. Preserve
  deduplication across source-game resets. A later genuine run is a new event.
- InfiniDrill grants one additional sand per ten newly earned rocks. Keep all
  rock, carry the private per-child remainder in source progress across replays,
  and never base the bonus on spendable Town balances or client quantities.
- Lock affected balance/town rows in consistent order. Construction checks
  revision, server-defined cost, eligibility, footprint bounds, and collisions
  before atomically debiting resources and saving the building. Reject stale
  revisions with no partial writes. Free roads still require validated placement.
- Distinct blueprint progress reuses existing server-saved Done items under
  their existing learning rules, with no added town-specific quiz requirement.
  Initialize from saved profile progress and persist first-Done credit so
  removing/re-marking cannot inflate milestones or revoke unlocked blueprints.
  Never accept browser-supplied learned booleans/counts. Food and Drink needs
  server-issued recipe sessions and verified actions before awarding stamina.
- Store each building's original paid construction recipe. Moving costs half
  of each original material cost, rounded up independently with integer math;
  include stamina and preserve zero costs. Atomically validate destination,
  ownership, revision, and balances before debiting and moving the existing
  entity. Exclude itself from overlap checks. Invalid/canceled/no-op moves and
  retried requests cannot spend resources. Removal gives no refund; movement
  cannot duplicate construction achievements.
- Catalog definitions are not earnable until server rules exist. The admin-only
  catalog migration selects outdated groups from server definitions and installs
  reviewed definitions idempotently without changing awards or player progress.
- `remove-line` accepts only a selected road or fence entity ID; `build-line` carries up to 200 tiles of one road or fence blueprint, applied all-or-nothing in one revision.
  Compute cardinal connectivity of the same blueprint type from locked saved
  state and remove the whole component in one revision-checked transaction.
  Keep other road types, diagonal-only neighbors, balances and earned badges.

## Calendar, weather, and test environment

- Resolve saved profile home city/country to approximate city coordinates and
  IANA timezone server-side. No GPS or exact child address. Validate geocoding
  and weather responses. Reject ambiguous locations; prompt the parent to set
  a city if missing. Provider URLs are server-owned and credentials runtime-only.
- Filter geocoding by country and normalized exact city name. A unique exact
  GeoNames `PPLC` capital may win over neighbouring localities/airports; partial
  queries and genuinely ambiguous exact places must remain unresolved. Retain
  a configured city label when lookup fails instead of claiming it was not saved.
- Use server time in the home timezone and month-based seasons: northern spring
  Mar–May, summer Jun–Aug, autumn Sep–Nov, winter Dec–Feb; reverse for the south.
  Equator uses the northern calendar. Refresh at local midnight and town resume.
- Use MET Norway Locationforecast compact hourly forecasts, with an identifying
  application User-Agent and approximate city coordinates (at most four decimals).
  Keep Open-Meteo geocoding separate from forecasts. Validate units/timestamps;
  select only the hourly interval containing server time, never a future dry
  interval or divided six-hour total. Expose forecast issue/validity timestamps;
  legacy `observedAt` stays null because a forecast is not an observation.
- Validate temperature, wind, cloud cover and precipitation independently,
  including each statistic's units and bounds. Invalid/missing optional values
  become null without discarding valid neighbouring statistics or hourly points.
  Precipitation needs a valid current hourly period, amount in mm and symbol;
  otherwise return null and unavailable weather, retaining other valid stats.
  Never infer clear weather from missing precipitation or a six-hour total.
- Use bounded timeouts, a shared normalized city/country cache, concurrent-request
  deduplication, and a one-hour retained-data limit (extended to MET's later Expires). Refresh successful forecasts
  no sooner than ten minutes or MET's later Expires. Send If-Modified-Since and
  reuse validated payloads on 304; advance hourly intervals from cached forecasts.
  Fetch only on authenticated demand for saved profile cities. No cron, idle
  refresh, profile-wide prefetch or per-child provider cache. The current single
  API instance shares this bounded process cache across Town, Lake and visits;
  multiple API instances would require a distributed cache to retain that limit.
  Expose freshness, not raw provider data or secrets. Missing weather must not
  become a false claim of clear weather or block construction.
- Failed lookups retry after 1, 2, 4,
  then at most 5 minutes, respecting provider Retry-After (bounded to one day).
  Share provider cooldowns across cities for each allowlisted endpoint. One
  four-second deadline covers headers and the bounded JSON body. Log sanitized
  `TOWN_WEATHER_<GEOCODING|FORECAST>_<reason>` codes, HTTP status and allowlisted
  DNS/connect codes, plus one recovery event. Never log profile IDs, cities,
  coordinates, full URLs, response bodies or arbitrary error messages. These
  shared rules apply to Town, Lake, visits and seasonal event weather alike.
- Separate precipitation from snow cover. Stable profile/local-date storybook
  snow days may occur in winter; real rain takes precedence over fictional
  snowfall, while actual reported snowfall renders snow. No weather reward hooks.
- Preview mutations require `NODE_ENV=test` AND
  `TOWN_ENVIRONMENT_PREVIEW_ENABLED=true`, authenticated admin, and target-profile
  ownership. Reject overrides on production/development even if the flag is set.
  Do not rely on hidden UI, URL flags, browser storage, or trusted client headers.
- Keep preview state scoped to admin session/profile, expiring after 30 minutes,
  with Reset to live. Return a server-derived capability; use no-store responses.
  Separate environment state from construction revisions. Never change saved
  calendar/location, entity data, materials, milestones, or achievements in preview.
- Test calendar/timezone boundaries, both hemispheres, weather validation/failure/
  freshness, rain/snow precedence, stable snow dates, and preview authorization,
  expiry, Reset, and isolation. Weather must remain independent of database builds.

## Verification

- Run `npm test --prefix server`, `npm run typecheck --prefix server`, and
  `npm run build --prefix server`. Test concurrency, retry deduplication, ownership,
  forged reward claims, and all-or-nothing construction against a guarded
  disposable PostgreSQL database. No production migrations or cloud provisioning.

## Names and animals

- `set-pets` saves at most 1 / 2 / 3 fixed-menu pet IDs on house / large-house /
  Town Hall under the existing authenticated ownership/revision transaction.
  Empty selections and duplicate breeds are valid; caller counts, awards and
  unknown species are rejected. Switching is free; moving preserves selections.
- Initialize/backfill one free starter house once, using a server-owned marker
  in town JSON. Existing residential buildings satisfy the grant. Never debit
  resources, award construction badges, or repeat the grant after demolition.

- Validate rename and set-animal commands against shared menu/host rules under
  the same authenticated ownership, revision and transaction checks as builds.
- Renaming/switching never spends materials or awards badges. Species determine
  population; do not accept caller-provided counts. Town names/species extend
  existing JSON state, so legacy towns and hosts must retain default behavior.
- The owned /town/name endpoint exposes only the selected words to the dashboard.

- Lighting uses homeClock with the resolved city's validated IANA timezone and
  server time, refreshed independently of the ten-minute weather cache. Bound
  cloud_cover to 0–100 and is_day to 0/1; never invent cloud conditions on errors.
  Keep known local clock/calendar when weather is unavailable, and unknown clock
  when the home city cannot be resolved. Lighting never affects town revisions.

## Authoritative gardening

- `garden.ts`, `animalWorld.ts`, `animalBehavior.ts`, `forestWorld.ts`, and
  `fence.ts` implement the reviewed vegetable-patch extension. The pure movement
  helpers are shared with independent frontend decoration and must remain browser-safe.
- This gardening feature is the scoped exception to the old cosmetic-only
  animal/season rules. Resolve the live home calendar separately from admin
  appearance preview keys; missing home clocks pause growth, never fabricate
  a planting season. Wind remains bounded optional provider data for visuals.
- Garden ticks accept only a resume boolean; authenticate ownership and keep
  active growth/contact simulation in a bounded, two-minute server memory lease.
  Credit server elapsed time only while intervals are ≤15 seconds; resume/gaps
  give zero catch-up. Concurrent tabs share one lastTick per API process. Ticks
  neither change construction revisions nor write town rows. Never send/store
  animal positions. A durable revision change invalidates a stale lease, so
  another process cannot replay a harvest. Save verified plant progress under
  the town row lock on real actions and an authenticated empty-body checkpoint
  on pause/leave; unchanged checkpoints do not write. Checkpointing cannot make
  an in-flight build stale. Restart/lease loss drops unsaved growth only; first
  tick always establishes a baseline. Private simulation drives contacts; no
  client coordinates, completion, seed cost, elapsed time, reward amounts or
  seasons are trusted.
- Run production garden ticks through `gardenSimulation.ts`/`gardenWorker.ts`,
  never synchronously on the API event loop. Reuse one CPU worker per process;
  admit at most eight running/queued jobs with a ten-second total deadline and
  bounded worker heap. Coalesce a profile's in-flight heartbeats. Overload,
  timeout or worker failure must reject safely without saving partial progress
  or falling back to synchronous work. Keep exact fixed-step timing/contacts.
- Simulation holds no database lock or pool connection. Recheck the durable
  revision after the worker completes and discard obsolete results. Serialize
  harvest/edit/checkpoint operations behind that profile's tick; preserve
  ownership, no-offline-growth and once-only harvest guarantees. Verify source
  TS/Node 22 and compiled JS worker startup, session responsiveness in a crowded
  valid town, bounded admission, failure recovery and in-flight harvest races.
- Every turf has one crop type and a generation. Harvest validates revision
  and turf generation, collects all ripe plants, credits two stamina per plant
  and resets only those plants in one transaction. Seed changes reset all plants.
  One-time JSON normalization homogenizes legacy mixed turfs without losing
  growth, materials, harvested counts, or earned badges. Preserve counts/awards across removing or moving patches.
- Fence tiles cost one wood only and cannot overlap/replace roads. Quick wrap
  verifies the complete perimeter and aggregate wood before placing anything.
  Chickens/ducks can pass below fencing; larger ground animals cannot. Recruited
  Collies protect sheep; Australian Cattle Dogs protect both cow types.
- Extend the existing named Town achievement group with two server-verified
  gardening awards, clear conditions/difficulty and universal-style badge art.
  Reuse the authenticated admin-only idempotent catalog migration; preserve old
  badges and indices. JSON state extension requires no SQL schema migration.

## Parent and admin achievement reporting

- Whenever a minigame is added and its achievements are produced, include the
  minigame and its complete achievement group in the kid profile reports in
  **both Parent Space and Admin Space**. This is part of adding the minigame,
  not a later optional task. Keep names, badge artwork, unlock conditions,
  difficulty, earned status and progress consistent across both spaces.
- Use the shared server-owned child-report projection and the universal activity
  identity/design language. Test both reports when adding a group; registering
  it only in the admin achievement catalog is insufficient.
- Keep catalog-only definitions visibly labeled as not yet earnable. Show
  unsupported progress as unavailable, never invented completion counts or
  earned badges. Earned status must come from server-verified progress.

## Halloween pumpkin helpers (October 2026)

- Kid-built `halloween-lantern` uses common land construction on every map:
  default unlock, 1×1, Roads catalog group, one wood plus one stored harvested
  pumpkin, October 30–31 home calendar only. Validate and debit both costs inside
  the existing revision/ownership transaction; persist `paidCropCost` for moves
  and transfers. It blocks walking, can stand on any free bridge deck, cannot
  overlap a nest, and protects its supporting bridge from move/remove/transfer.
  Shared map ticks, owned state reads and actions remove expired lanterns on
  every saved map with a durable revision. Use only the live home-city clock,
  never appearance/preview dates. Persist the construction's event year (legacy
  lanterns belong to 2026); expire only for a valid civil date on/after November
  1 of that year, including later years. Earlier, malformed and unknown dates
  never expire lanterns. Moves/transfers preserve the occurrence year.
  No refunds or ghost achievement receipts are generated. Existing ghost
  decorations remain nonblocking and retain their own pinned event behavior.

- Reviewed behavior: `docs/plans/2026-10-17-town-halloween-pumpkins.md`. Use the
  server home-city calendar: October 27–29 planting reminder, October 30–31
  harvesting on live dry evenings/nights, November 1 decoration removal.
  Allow pumpkin planting/growth October 27–31 in both hemispheres; other crops
  retain normal seasons. Never derive eligibility from device dates/previews.
- The existing garden CPU worker owns individual ripe-slot generation
  reservations, up to three active helper jobs, pickup/replant, two stamina per
  pumpkin, and one installed lantern per harvest. All job/reward transitions
  persist through revision-checked transactions. Lease/checkpoint time is
  bounded; rain/daylight/resume cannot create offline progress. These automatic
  harvests do not count as manual-harvest achievements. No new SQL schema.
- More real pumpkins create more lanterns. Clear grass beside buildings, roads, bridge decks (not one carrying an insect nest)
  and riverbanks bounds available posts. Cap installed plus reserved lanterns
  at 100; leave ripe crops untouched at the cap or without a spaced site.
  Favor house fronts, road junctions, trees and riverbanks; use stable random
  variation and at least three tiles between posts to distribute them. Decorations do not reserve construction cells or intercept taps.
- Preserve cute round ivory ghosts, soft faces and cocoa outlines. Raster
  animation/provenance: `docs/artwork/town-halloween-v1/`. Reuse lantern sprites
  while carried and installed; add restrained runtime halos only in darkness.
- All ghosts and carried lanterns paint in a flying foreground layer after
  crops, ground residents, shrubs and trees, below controls. Ground animals
  cannot repaint vegetation over other flying/perched animals. Installed posts
  remain grounded and their sprites/halos are masked by the alpha of closer
  buildings and trees. Returning ghosts face their actual travel direction.
  Reduced motion uses calm poses. Heartbeats never rebuild
  the renderer, backing canvas, static scene or cached images.
- The development-only Halloween preview is cosmetic: no crop/reward writes.
  Test appearance overrides never grant planting or harvesting eligibility.
- Mouse-wheel zoom works in viewing and editing modes, keeps the pointer
  anchor/selected placement, and cancels unfinished road/fence strokes before
  zooming. Pinch and touch navigation retain their existing behavior.

## Ghost scheduling and visitor recovery

- A delivered/canceled ghost rests for a deterministic random 3–7 active seconds
  before considering another pumpkin. Persist worker rest endpoints/deadlines
  in existing Town JSON; resume and weather pauses cannot skip active cooldowns.
- New jobs start from the worker's actual last endpoint, with distance-based
  approach/carry durations. Share job timing/position math between worker and
  renderer. Bound visible movement to 2.5 tiles/second across heartbeats; never
  replace the position with a new target or a fixed home origin.
- Reserve individual slot generations and allow only one approaching/picking
  ghost per vegetable patch. Other ghosts wait or use another patch; carrying
  ghosts release the approach slot. Invalidated jobs retire at their current
  route position and rest before replanning. Retargeted deliveries start from
  their current position, without an immediate installation.
- Preview uses the same scheduler incrementally against a private crop snapshot,
  including exclusive reservations, rests and travel. It never regrows preview
  crops, loops phantom harvests, writes real state, or grants player rewards.
- On layout changes, revalidate decorative NPC positions/routes against clear
  ground. Recover blocked spawns to nearby clear ground and discard paths through
  new footprints. A blocked west entrance in an existing town must not strand
  outside guests. Existing buildings remain in place; server move-in/road access
  requirements are unchanged. Moving an obstructing building reopens the gate.

## Connected fence removal

- `remove-line` accepts only a selected road or fence entity ID through the
  existing authenticated revision-checked Town action endpoint. Render derives
  the full cardinal component of that fence type, including branches/corners
  and loops. Gaps, diagonal contacts, roads and buildings stop traversal.
- Retain single-fence removal. Offer both only in editing mode; bulk removal
  increments one revision, gives no refund, preserves crops and earned badges,
  and clears selection. Never accept a browser-supplied deletion list or type.
- Test strict payload/auth/ownership, stale concurrent requests and preserved
  unrelated entities, plus English/Vietnamese button visibility and bounds at
  the required laptop/iPad viewports.

## Isolated timed events and Halloween records

- Follow ADR-008 (`docs/decisions/ADR-008-town-timed-events.md`). Register local
  typed plugins in `server/src/town-building/events/index.ts`. The generic host
  owns lifecycle/capabilities; plugins get only their own state and frozen world
  snapshots. Never pass a full TownState into an event behavior module.
- Persist live state under `events[eventId]` with occurrence and exact edition.
  Preserve pinned editions across reload/deploy. Add a reviewed new edition and
  year selector for changed annual content; unknown editions never fall back.
  The legacy `halloween` response field is a projection, not durable authority.
- Reuse `ghostMotion.ts`/`ghostAnimation.ts` with explicit event-owned immutable
  policies and asset/frame adapters. Keep pumpkin/calendar/placement rules in
  the Halloween 2026 edition; do not change another event's behavior or artwork
  through a global ghost tuning variable. Keep shared-core contract tests.
- Keep `eventHistory[eventId][occurrence]` after decoration cleanup. Record one
  server completion receipt per installed lantern; retries/reloads must dedupe.
  Counts are per year. The server-verified **Halloween** achievement group has
  **Ghostly Sky**, medium difficulty: create more than 20 (21) lanterns in one
  Halloween event. A reserved/carried lantern does not count yet. Earned badges
  remain after November 1 and must appear in kid, Parent and Admin collections.
- Use the existing authenticated admin-only catalog migration for Halloween;
  repeated runs preserve counts/earned badges. Never accept browser counts or
  receipt/award claims. Badge artwork follows the universal text-free storybook
  medallion prompt; generated source/prompt are in the Halloween art directory.
  Event JSON extensions need no SQL migration. No cloud upload before confirmed.

## Vietnamese Women’s Day event

- `events/womensDay2026.ts` registers `womens-day` with the shared timed-event
  host and pinned `2026-v1` edition, like Halloween. The home-city calendar
  selects October 19–21 each year; unknown clocks never start an occurrence.
- Persist occurrence/edition/year identity and per-child intro dates in existing
  Town JSON, with permanent verified achievement receipts in event history. The
  module has no harvest/material capability; only authenticated visit/greet
  interactions record reviewed 2026 achievement receipts. Cosmetic ticks do not
  bump revisions. Existing host cleanup removes only its
  ended record. Animation and flower planting remain local presentation.
- Keep edition policy immutable; reviewed changed annual content requires a
  new edition/selector and matching frontend visual adapter. Unsupported
  editions freeze on the server and render nothing in the client.
- Cover registry/worker dispatch, reload, recurring years, cleanup isolation
  alongside Halloween, unchanged balances/badges and visual projection guards.
  No SQL migration or cloud resource is needed for this JSON event record.

- Group `womens-day-2026` is titled `20/10/2026`: visit plus 3/5/7 unique visitor
  greetings. Keep years in descriptions, permanent awards and receipt history
  after cleanup, and never grant 2026 awards from another occurrence. Individual
  gameplay commands use the event host's atomic interact capability, strict
  payload validation and the existing profile transaction/lock. No client counts.
- Intro dismissal is per child/profile and trusted home-calendar date (19–21),
  never family-wide. Bound dates to the current occurrence, deduplicate retries,
  and never award from a dismissal. Cover sibling isolation and reload in DB tests.
- Include all four badges in the common kid/Parent/Admin projection and existing
  admin-only idempotent catalog migration. Keep raw receipt lists out of reports.

## Xmas snow sculptures

- Timed event `xmas` registers in `events/index.ts` with pinned edition `2026-v1`.
  The live home-city calendar selects December 20 through January 6 inclusive.
  The occurrence ID is the starting year (e.g. January 3, 2027 belongs to occurrence
  `2026`). Unknown clocks, appearance overrides, and previews never start the event
  for normal play.
- Ten 1×1 rotatable decorations (`snow-snowman`, `snow-rabbit`, `snow-owl`,
  `snow-penguin`, `snow-fox`, `snow-lamb`, `snow-duckling`, `snow-bear`, `snow-tree`,
  `snow-angel`) use common land construction on every map (Town and Lake).
  Each has default unlock, blocks walking, supports bridge decks like `halloween-lantern`,
  supports four cardinal facings, and costs exactly 5 stamina plus materials/storage items:
  wood/rock from `materials`, crops from `storage.crops`, wool/yarn from `storage.wool`/`storage.yarn`,
  and fish from `storage.fish` / `maps.lake.reserve`. Validation and debits occur in one
  transaction; unaffordable costs or insufficient stamina reject with a clear error and no write.
- Cap: maximum 100 installed snow sculptures per child across all maps combined.
- Melt: On or after January 7 (valid civil date on the live home clock only), map ticks,
  owned state reads, and actions remove all sculptures across every saved map with a durable
  revision; no refund and no receipts are generated. Earlier, unknown, or preview dates never melt.
- Durable records: `eventHistory.xmas[year]` persists total, byType counts, distinct builtTypes,
  maxSimultaneous, and deduplicated installed completion receipts that survive event cleanup.
- Achievements group `xmas-2026` ("Xmas 2026") contains 7 server-verified badges:
  *Snowy Friends* (easy, 1 sculpture), *Snow Parade* (medium, all 10 types),
  *Winter Wonderland* (hard, 20+ installed at once), *Snowman Army* (hard, 20 snowmen),
  *Rabbit Warren* (medium-hard, 15 rabbits), *Owl Parliament* (medium, 12 owls),
  *Penguin Colony* (medium, 10 penguins). Registered via the idempotent admin achievement
  catalog migration and included in the shared child-report projection for both Parent Space
  and Admin Space kid reports.
- Admin preview: `allowPreview` enables building sculptures during preview only when
  `NODE_ENV=test` and `TOWN_ENVIRONMENT_PREVIEW_ENABLED=true` are active for admins;
  preview dates alone never open the window for non-admins.

## Cabbage Roll achievements

- Follow the recipe guide in `frontend/src/features/cooking/cabbage-rolls/AGENTS.md`.
  Its four badges are earnable on the server-verified three-roll Serve transition.
  Persist lifetime counters and first timestamps in existing session JSON, retain
  them on Start/Replay, and commit them with the unique stamina receipt under
  the recipe row lock. Retries, Stop, reads, practice and abandoned batches award
  nothing. Never accept browser outcome, achievement or completion claims.
- Shared child/Parent/Admin projections read only the saved achievement object.
  No SQL migration or historical reconstruction is needed. Existing saved
  sessions without the field have no recorded prior badge progress.

## Friend river sharing and reports

- Follow `docs/plans/2026-10-23-friend-town-visits.md`. Visitor writes are limited
  to explicit friendship-authorized visit audits, preset gifts and stock pickups.
- Unlock the friend takeaway raft after 50 new verified fish catches, permanently; never
  backfill. Keep ten fresh uncollected items per Town and thirty daily pickups
  per picker across all friends, with UTC day boundaries stated in the UI.
- Split existing stamina values using separate ceiling operations (30%/70%).
  All credits, stock and quota are server-owned, transactional and retry-safe.
- Keep perishable stock separate from durable visitor/pickup history. Arrival
  watermarks produce one centered report per new batch, including gift/no-gift,
  exact items and provider earnings. The raft reopens it and seven-day charts.
- Use generated storybook artwork with recorded prompts; crayon-style charts
  and all dialogs must fit required landscape sizes, with localized 48px controls.
  Animate only newly committed picker receipts through TownRewardBar.

- Gift contents appear inside individual baskets immediately on delivery. Show
  the first three clearly and one fixed silhouette group for any overflow count.
  Eligible friends get another empty basket; keep all pending gifts in the list.
  Expire baskets five days after delivery, opened or not; keep the separate
  24-hour sending cooldown and never renew expiry through opening/retries.

- Group identical raft stock into ×quantities without stamina text. Visitors
  select one item per tile tap, at most five per pickup; expose minus controls
  only in the side basket. Batch pickup validates all IDs,
  friendship, freshness and quota in one transaction, rounds each share per
  item, and stores a durable retry identity. Never partially collect a batch.
  Keep single-item API compatibility and per-item visitor/report counts.

## Naming: two different rafts
- **Friend takeaway raft** (child-facing "Friendly raft" / "River raft"): the one fixed raft in the Town river. Never built, moved or removed; never in any AOE whitelist. Harvested eggs, fish catches and vegetables are stocked there and friends take them for stamina (`raft.ts`, `raftStock.ts`, `TownRiver.tsx`).
- **Fish home raft** (blueprint id `friendly`, unlocked at 100 harvested nursery fish): a buildable raft where grown companion fish live. Unrelated to takeaway.

## Barns and storage (2026-10-27)

- `barn.ts`: Dairy Cows make milk and sheep make wool, one per 6 hours per
  farmhouse up to 12, twice as fast while fed (one stored favourite crop banks
  one hour, at most four). Highland cows make distinct yarn at one per 12 hours, capacity 6 (also twice as fast while fed); pigs enjoy treats.
  `settleFarm` settles eggs, barns and storage together on every transaction;
  `farmProjection` is the read projection.
- `storage.ts`: one store for every map. Without a Town Storage each item caps at
  10 and each building material at 2000; with N >= 1 storages, items cap at 1000 + 2000*(N-1) and materials at 5000.
  Count storages across all maps. Limits clamp ordinary gains only, including
  `creditTown`. The sole confiscation exception is explicit Town Storage removal:
  preview exact overflow under the profile lock; reject with STORAGE_LOSS_CONFIRM
  without writes until confirmLoss and the matching lossConfirmation are supplied.
  Recompute and discard only overflow atomically with removal (oldest milk/fish
  batches first), one revision. Return storageRemovalReceipt even for no-loss
  removal. Move, rotate and transfer never discard stock. Stamina is not limited.
  Wool and yarn are distinct non-spoiling animal-product items using item limits.
  Wool costs stay in server-owned `cost`/`paidCost` recipes, but debit `storage.wool`
  atomically with materials and crop costs; moves ceil-half every original cost.
  On settle/load, absent `woolMigrated` moves legacy `materials.wool` into
  `storage.wool`, clamped to the current all-map item limit (excess lost), sets
  `woolMigrated:true`, and deletes the legacy key even when already marked.
  Storage removal reports wool overflow as kind `item`; no SQL migration.
  Milk and fish spoil 3 days after they were stored, oldest first; fish already
  in the reserve at rollout are dated then.
- Harvest-all (`harvestAll.ts`, `docs/plans/2026-11-02-town-harvest-all.md`) does not
  clamp crops or fish: a patch or nursery whose product would overflow storage, or
  a barn with no room, is skipped untouched and reported as `notCollected`. Barns
  keep the partial collect. Manual harvests keep the clamp rule above.

The child-facing contract is shared by Town and Lake: the projection exposes only boolean
`harvestReady` flags, while the authenticated revision-checked command derives targets, products,
storage decisions and rewards from server state. Frontend result rows must use `HarvestReceipt`;
client readiness, quantities, rewards and completion claims are never authoritative.

## Pig and Highland habits (2026-10-27)

- Follow `docs/plans/2026-10-27-pig-and-highland-habits.md`. Shared `animalHabits.ts`
  runs inside `tickMap` for every map. Standing pigs/Highland cows get one stable
  12% seeded check per five active seconds, with one shared 180-active-second
  cooldown. Crops get +30 seconds once per cycle, capped ripe; harvest/replant
  (including event harvest) clears `garden.poop`. Area targets stay whitelisted.
- Only Highland cows leave free-grass droppings. At most 8 waiting droppings plus
  bushes per map; the next local 05:00 converts them, including DST/resume.
  Dairy/Highland cows and sheep eat bushes. Props never block placement and
  successful land placement/transfers remove covered props.
- Cooldowns live in `gardening.animalPoop`, surviving `withoutAnimalPositions`.
  `landView`/`mergeLand` and `GardenSessions` preserve per-map props. Sunrise,
  droppings and grazing changes cross the durable revision boundary. No new
  client progress/position/weather/reward command is accepted. Transfer remaining
  cooldowns with the home; visit scenery redacts timestamps/contact history.
  Waiting barn stock must be collected before changing animals.

## Shop trade (2026-11-03)

- `shop.ts` is the common Vegetable shop counter for every map hosting a
  `vegetable-shop` entity. Town and Lake routes use the same quote, selector,
  profile serialization and durable row lock/save helpers. Always available,
  including outside business hours/events; validate the entity on the route's map.
- Owner-only GET `/town/shop/quote` or `/town/maps/lake/shop/quote` accepts
  strict `entityId`, `crop`, `quantity` (1–10) query parameters. Read only via
  SELECT: no initialization, normalization writes, reward or revision change.
  Return `ShopQuote` from browser-safe `shopTypes.ts` (including revision).
- POST each map's existing `/action` accepts `{revision,command:{type:'shop-trade',
  entityId,crop,quantity,confirmation}}`. It is a top-level action on both maps;
  no nested Lake land action or caller-selected map, products, payment or values.
  Recompute everything under the owned profile lock. Same-revision quote changes
  return `SHOP_QUOTE_CHANGED`; inadequate products `SHOP_NOT_AFFORDABLE`; inadequate
  room for the entire purchase `SHOP_STORAGE_FULL` (all 409, no write). Revision
  mismatch uses `TOWN_STALE`; missing/wrong-map shop uses `SHOP_NOT_FOUND` (409).
- Pay only stored wool/yarn, fresh stored milk and Lake reserve fish by species.
  Eggs are NOT payable: coop eggs harvest into stamina and the friend takeaway
  raft, not spendable Town storage. Never debit materials, stamina, unharvested
  barn/coop stock, resident fish or takeaway-raft items.
- Hidden values live in pure `shopPayment.ts`: wool 3, yarn 5, fish 4, milk 2
  (egg 1 reserved only). All eight garden crops sell for 4 when `cropMayGrow`
  accepts the trusted live home clock, otherwise 6. Unknown clocks cost 6;
  appearance preview keys/overrides never grant a price or trade capability.
- Bounded knapsack minimizes paid value, then item count, then oldest perishable
  units ahead of non-spoiling stock; equal timestamps use stable item IDs. No
  credit/change. Use shared storage settlement, itemLimit, storeCrop and
  spendStoredProduct (oldest-first batch consumption). Whole purchase or no debit.
- Commit one revision and a stable `shop:<mapId>:<crop>:<revision>` receipt.
  Retain the last 32 private `shopReceipts`, keyed by expected revision,
  confirmation, entity, map, crop and quantity; retry lookup precedes stale checks.
  Duplicates return `duplicate:true`, do not write and must not replay cosmetics.
  `townStatePayload` strips the ledger; visit projections expose scenery only.
- `shopTypes.ts` has type-only domain imports and a pure price helper; never
  import shop.ts/schema/routes into browser runtime modules. Receipt reward
  `{crop,amount}` resolves existing crop art/+N in the later TownRewardBar adapter.
  Reports, harvest counters, achievements and raft stock stay unchanged by trades.
  Town JSON only; no SQL migration. Verify pure selection, routes, no-write
  refusals/retries, both maps and guarded cross-repository DB concurrency.
