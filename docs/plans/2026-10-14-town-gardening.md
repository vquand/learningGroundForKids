# Town vegetable patches

## Objective and confirmed choices
Add child-friendly vegetable gardening to Little Town on feature/town-vegetable-patches.
Ruộng rau is a vegetable patch. Each 2×2 turf grows four plants of one selected crop type, like a farmhouse
hosts one animal type. The crop-choice icon opens a seasonal crop menu. Harvest
collects all and only ripe plants of the clicked turf in one manual action,
awarding two stamina per ripe plant (up to eight); no automatic harvest.
Growth requires about 300 seconds of active Town play and pauses away.
An unprotected herbivore bite consumes that slot's crop and immediately replants
its selected seed from the beginning. Use a 60-second patch bite cooldown.
After manual harvest the same seed replants too. Seeds and replanting are free.
The Australian Cattle Dog is approved and must be chubby like existing dogs.

## Crops and presentation
Spring: carrot, peas. Summer: tomato, corn. Autumn: potato, pumpkin.
Winter: cabbage, broccoli. This is a simplified storybook seasonal calendar,
not regional agricultural advice. Planting and growth use the live server home
calendar; unavailable home calendars pause growth. Mature crops remain harvestable.
Use seed/sprout/leafy/flower-or-heading/ready stages. Tomato, peas and pumpkin
flower before fruit; cabbage and broccoli form heads/buds. Rain gives a gentle
leaf bounce, wind/cloud/light drive visual movement or resting poses, not reward
multipliers. No sunflower is necessary because every season has two vegetables.
A poultry visit grants a visible sprout/fast-growth icon: 25% faster for 30 active
seconds, refreshed without stacking. Only chickens and ducks grant this boost.
Cow, Highland cow, sheep and capybara visits can bite nonempty slots. A recruited
Border Collie sheep flock or Australian Cattle Dog cow herd never eats crops.
Actual server-simulated contact is required; pet presence alone is insufficient.

## Commands and data boundaries
Extend existing town JSON, preserving legacy defaults; no SQL schema changes.
Garden/animal tick uses server wall time and fixed-step shared movement. An
explicit resume establishes a baseline; heartbeats every five seconds admit at
most 15 seconds since the previous heartbeat. Gaps pause, with no offline credit.
Ticks share an expiring server memory lease without town row writes or revision
changes. Decorative movement runs independently in the browser; no positions
are sent to it or stored in town JSON. Real actions checkpoint verified crop
progress under the town row lock. A keepalive empty-body checkpoint also saves
growth once on pause/leave; unchanged checkpoints do not rewrite the row or
change construction revisions. Revision changes invalidate stale leases.
Process restart/lease eviction drops only unsaved progress since the last action
or pause, never committed harvests or badges. First tick starts a new baseline.
No client elapsed time,
animal coordinates, maturity, buff, stamina, season or achievements are accepted.
The browser preserves its animal timeline across crop checks and interpolates
20 Hz decisions at display cadence. Crop-only responses update dynamic plants
without reloading images or recreating navigation/static scenery. Appearance
previews remain visual only and never choose crops or progress seasons.
Seed and harvest commands identify the turf and its saved generation. Seed
changes replant all four plants. Harvest validates saved maturity for all plants,
resets only ripe plants and advances the turf generation atomically with credit.
Legacy mixed turfs adopt their first crop once, preserving maturity and rewards.
Fence wrap validates the whole ring and total wood before making one mutation.

## Construction and UI
Vegetable patch 2×2, initially unlocked, costs four wood. Wooden fence 1×1,
initially unlocked, costs one wood only. Fence strokes reuse cardinal road glide
with affordable preview and sequential authoritative placement. Roads and fences
cannot replace each other or coexist. Fence blocks animal ground routes.
Wrap around with fence constructs the full one-tile outer ring (12 fence tiles),
skipping existing fences; blocked terrain/road/building, edge or shortage aborts
all changes. Display exact remaining wood cost before the button. Removal gives
no refund. Relocating a patch retains slots and may leave its old fence in place.
Clicking a turf reveals Move, Choose crop, Harvest, Wrap fence and Remove as
matching icon buttons beside the tile. The sidebar has no placed-building action
buttons. Choose crop opens eight crop cards with off-season options disabled;
choosing a crop applies it to the entire turf and restarts growth. Harvest acts
directly without opening a dialog and is disabled when nothing is ripe. Keep all
controls visible without scrolling at the required laptop/iPad sizes, including
Vietnamese. Static sidebar information shows selected crop and ripe plant count.


## Structure and tasks
1. Shared deterministic animal/forest helpers plus cattle herding and fence routing.
2. Authoritative garden rules, commands, ticks and database/replay/concurrency tests.
3. Generated crop stages and chubby cattle dog atlas with inspected crop metadata.
4. Whole-turf crop chooser, direct bulk harvest, fence drawing/wrap and heartbeat.
5. Extend Town achievements with First Harvest and Garden Basket (20 harvests),
   using the existing named Town group and admin-only idempotent migration.
6. Localization, docs, browser flows and all baseline gates; local UAT on 5173.

## Tests and risks
Prove no offline or duplicate-tab growth, no forged or duplicate harvest reward,
season gating and retained maturity, contact-only buff/bites, dog protection,
fence blocking and atomic wrapping, saved slot continuity, migration idempotence,
ownership and strict input. Verify real browser placement, slots, manual harvest,
fence gestures/dialog bounds, reduced motion and keyboard controls.
Large herds require bounded simulation and resident navigation caching. Rendering
uses shared behavior rules but never reconciles decorative positions to server ticks. The scoped
season/progression exception applies to gardening only; other scenery/preview
behavior stays cosmetic. No production migration, cloud change, commit or push.

## Verification evidence
- Frontend unit suite passed; frontend and hosting typechecks passed.
- Server guarded local suite: 289 tests passed, none skipped. Includes concurrent
  harvest/retry, overlapping tick, blocked-wrap rollback, ownership, strict body
  validation, and preview isolation against disposable plg_test.
- Full existing/new Town browser suite: 22 flows passed. Additional garden suite
  covers seven English/Vietnamese flows at all three required landscape sizes.
  Screenshots inspected: /tmp/garden-dialog-1024.png, /tmp/garden-town-1024.png,
  /tmp/garden-vi-1024.png. All actionable controls fit without page/dialog scroll.
- Server build, active Vercel build and compatibility frontend build passed.
- scripts/start-uat.sh verified existing local accounts/progress preserved and
  healthy frontend 5173 / API 10000. No SQL migration or cloud changes.
- New gardening badges use the existing Town catalog migration button; old five
  badge identities, indices and earned timestamps remain stable.


## Crowd performance and persistence revision
- User approved independent frontend movement while retaining server-verified
  boosts/bites. No periodic animal-position or town-state database writes.
- Reproduced with 46 residents in real Chromium at 1180×820 and 4× CPU slowdown.
  Before: two garden responses created 52 extra sprite images (26 each), rebuilt
  the canvas and restored backend animal positions. After: zero extra images,
  uninterrupted renderer, p95 frame interval 16.7 ms, maximum 33.4 ms, no >50 ms
  frames in the isolated 11-second profile. Timing is evidence, not a CI assertion.
- Node's same 46-resident decision profile: p95 1.07→0.40 ms; cached parsed
  navigation cells and tree-path searches restricted to species that use trees.
  Natural pauses, deterministic routes, seeds, dog protection and rewards remain.
- Guarded database tests inspect PostgreSQL xmin: overlapping heartbeats never
  rewrite town rows or advance revision; edits/pause persist crop progress,
  repeated unchanged checkpoint is read-only, restart cannot credit offline
  time, and concurrent harvests cannot duplicate stamina.

- Final guarded server suite: 291 tests passed, none skipped. All 28 existing/new
  Town browser flows passed; additional crowd regression verifies zero sprite
  reloads, reduced-motion crop repaints and exactly one checkpoint on leaving.
  Frontend unit suite, frontend/hosting/server typechecks and server/Vercel/
  compatibility builds passed. Local 5173 UAT reused existing accounts/progress.
