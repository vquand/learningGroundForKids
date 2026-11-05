# Town civ houses

## Objective and accepted design

Extend the existing Town into a calm, aquarium-like community for small kids.
Trade is pretend. Kids place buildings, watch people, explore a separate
interior scene, and occasionally help with a small task. No stock economy,
technology eras, wages, illness meters, or absence penalties.

Seven businesses: grocery, bakery, meat shop, vegetable shop, tools shop with
smith, school, clinic/pharmacy. Reuse existing `school` and `infirmary` IDs,
costs and unlocks. One worker each for grocery, meat, vegetables and school;
two each for bakery, tools/smith and clinic/pharmacy. The approved ten-person
art concept has big heads, small torsos, stick arms/legs, two eyes and a mouth.

Every building has two matching exterior states: structurally complete but
empty/unfurnished, then equipped/stocked with its purpose sign after move-in.
Interiors are separate show scenes; they do not create an inventory economy.
Living quarters may be upstairs, behind or in nearby homes according to size.

## Move-ins and daily life

- A small car/truck enters from outside immediately after construction,
  regardless of business hours. It uses a road component connected to the town
  boundary, parks at the reachable road cell closest to the destination's
  front entrance, then the owner carries belongings over a clear route.
- The remaining off-road walk must be at most two cardinal steps. Buildings,
  water, protected mountains and fences cannot be crossed. If no suitable road
  exists, wait at the entrance/nearest reachable parking cell. Show a large
  bottom-of-canvas call: “Hello over there! I'm stuck! Please bring a road
  closer to my shop!” with portrait and Show me. Do not cover building controls.
- Automatically resume when a road edit makes access possible. After moving
  in, residents prefer roads but may use walkable ground without the two-tile
  restriction. Movement preserves identity; deleting a host removes its people.
- Business-specific home-city hours affect work, breaks and rest. Short
  30–90-second errands run while watching; show a small return clock when all
  workers are away. Equipped art stays equipped through breaks and closures.
- Ordinary townspeople and visitors pretend to buy, deliver, work and sightsee.
  Prosperity admits a small bounded number of visitors, keeping the map calm.

## Concrete implementation defaults

These values complete routine choices under the user's instruction to continue:

| New blueprint | Footprint (rows × columns) | Learn | Cost: stamina / wood / rock / sand / metal |
| --- | --- | --- | --- |
| Grocery | 2×3 | 0 | 8 / 10 / 6 / 0 / 0 |
| Bakery | 2×3 | 7 | 11 / 13 / 8 / 4 / 0 |
| Meat shop | 2×3 | 7 | 9 / 11 / 7 / 0 / 0 |
| Vegetable shop | 2×3 | 0 | 8 / 10 / 5 / 0 / 0 |
| Tools shop and smith | 3×4 | 14 | 14 / 16 / 12 / 0 / 3 |

School and Infirmary retain their existing recipes/unlocks. Existing copies
receive the new move-in state without a charge or retroactive construction
award. Arrival driving takes roughly 0.4 seconds per road tile, walking 0.65
seconds per tile, then four active seconds unpacking. Pause progress away;
never accumulate offline ticks or penalize time away.

Work hours: bakery 05–15, groceries 08–21, meat 07–17, vegetables 07–18,
smith/tools 08–17, school 08–16, clinic/pharmacy 08–20 (saved home-city time).
One 30–90-second errand in a short deterministic work cycle; different roles
are staggered. Missing home-clock information cannot invent a precise clock.

Help is a small server-validated three-action putting-away task, with an
active-time cooldown. It spends no materials and awards no client-reported
scores. Prosperity help credit is capped once per distinct business type.

Hidden prosperity combines distinct equipped business types (10 each),
their distinct-role population (up to 15), and helped business types (2 each).
It ignores duplicate-copy farming. Display only one large Seed/Sprout/Bud/
Flower icon next to the saved town name, at thresholds 0/25/50/75. Removing
buildings can reduce it; leaving the game cannot. Guests are decorative and
do not independently award progress. No invented prosperity on legacy clients.

## Architecture and storage

- Existing React/Vite frontend, Render ownership/session boundary, Neon town
  JSON, atomic row locks and revisions. No SQL schema migration needed.
- Shared browser-safe catalog/path/schedule helpers; Render verifies move-in
  time and help sequence. Browsers never submit coordinates, elapsed time,
  role counts, completion, prosperity, or awards.
- Reuse the bounded worker and active lease for Town activity. Persist phase
  completion atomically; checkpoint partial progress on exit. Recheck durable
  revisions before accepting worker results and coalesce concurrent tabs.
- All new PNGs use `frontend/server/artwork/catalog.json` and the existing
  authenticated Vercel OIDC Blob reader (ADR-007). Keep immutable source PNGs
  in the repository for development, but omit cataloged images from enabled,
  verified release builds. Do not import PNG bytes/base64 into JS or function
  bundles. Only crop/frame metadata is bundled. Do not upload or change cloud
  configuration from this feature branch; release still requires `confirmed`.
- Existing source-game rewards, animal behavior, learned milestones, storage,
  garden leases and paid placement contracts remain intact.

## Achievements and reports

Extend `Town Building · Little Town` with New Neighbor (first verified move-in,
easy), Helping Hand (help three distinct business types, medium), Lively Street
(all seven business types equipped, hard). Use universal text-free collectible
medallion artwork with exact unlock text/difficulty outside icons. Preserve
existing badge indices and all awards. Existing admin-only idempotent group
migration installs reviewed definitions, never browser definitions. The shared
server child-report projection must expose the same group and current verified
business/resident/help counts in both Parent Space and Admin Space.

## Ordered tasks and acceptance

- [x] Shared catalog and server move-in/path tests. All seven businesses,
  road-component connectivity, two-step clear walking limit, no time-away gain,
  different opening hours, idempotent help and bounded prosperity.
- [x] Persist lifecycle through authenticated Town activity. Strict request
  schemas, stale revisions, concurrent tabs, restart/checkpoint behavior and
  legacy normalization covered against guarded disposable PostgreSQL.
- [x] Generate matching empty/equipped building pairs, car/truck directions,
  role/purpose icons, interior fixtures and achievement medallions. Measure
  alpha crops, anchors, provenance; regenerate/review the Blob catalog offline.
- [x] Render construction → vehicle → wait/call or walk → unpack → equipped
  building; stable animation across heartbeats, correct directions and reduced
  motion. Add schedules, return clocks and bounded visitor life.
- [x] Add separate interiors, short help flow, prosperity header and complete
  admin/parent achievement reporting, English and Vietnamese throughout.
- [x] Verify complete flows at 1366×768, 1024×768, 1180×820 and existing tablet
  portrait sizes; every active control visible without page scrolling. Verify
  source builds, API security, existing regression suites and Blob omission.

## Commands and boundaries

`npm test --prefix frontend`, `npm run typecheck:hosting --prefix frontend`,
`npm run build --prefix frontend -- --mode vercel`, `npm run build --prefix frontend`.
`npm test --prefix server`, `npm run typecheck --prefix server`,
`npm run build --prefix server`. Use a disposable guarded TEST_DATABASE_URL
for DB tests. For user-requested local UAT run exactly `scripts/start-uat.sh`.
Use existing TypeScript conventions (`type Entity`, pure exported helpers,
strict Zod commands, parameterized queries); localize UI via uiText/uiMessage.
No packages, cloud resources, production data changes, commits, pushes or
publication are needed for implementation. No release before `confirmed`.

## Verification evidence (local feature branch)

- Frontend: 84 test files passed, including actual badge rendering, asset crop
  bounds/provenance parity, directional walking, Blob catalog/build omission,
  authenticated artwork reads and compatibility contracts. App and hosting
  typechecks passed. Vercel and compatibility builds passed.
- Server: all 316 tests passed with guarded disposable local `plg_test`, including
  move-in checkpoint/restart, row-lock revision/concurrency, request tampering,
  foreign-profile rejection and unchanged resources. Typecheck/build passed.
  Additional shared parent/admin report assertions passed after catalog updates.
- Existing Town/pet Chromium regressions: 19 passed after final palette fixes.
  New neighbor flows cover stuck owner → road → arrival → equipped art → interior
  → three-step help → keepsakes, both languages and reduced motion. Checked
  1366×768, 1024×768, 1180×820, 744×1024 and 1366×1240. Existing portrait/garden
  suite additionally covers 768×1024, 820×1180 and 834×1194 and rotation.
- Review screenshots are local `/tmp/plg-civ-browser/`, plus existing Town/garden
  evidence paths. No accounts, production data, volumes or cloud resources reset.
- Offline Blob plan: 288 catalog paths, 279 unique images, 186.8 MiB. Only crop
  metadata is bundled. Real upload/verification and enabled release omission are
  deliberately left to the confirmed release workflow; no cloud upload occurred.

## Follow-up: continuous canvas and first-entry loading (2026-10-16)

The old canvas effect depended on selection, footprint, camera, action and
language props. Each selection restarted the renderer, reassigned backing
canvas dimensions, and created new Image objects. A browser regression measured
20 backing-canvas resets across a select/move/cancel sequence. Images could be
unready on the first repaint. Separately, the page rendered a spring fallback
while the home-environment request was still pending.

Selection/camera/action state now enters the existing renderer through paint
refs. Cached scenery can redraw without replacing the image cache, animation
timeline or backing canvas. Size assignments occur only for real dimension
changes. Scene assets and blueprint artwork share a profile-session cache of
same-origin, decoded images; the existing Vercel Blob catalog/reader is retained.

First entry waits for Town data, home-environment data and image decoding before
mounting the map. A small animated house/cloud/sprout and dots show while waiting.
English/Vietnamese, reduced motion, error/retry and navigation are supported.
Failed weather or artwork does not reveal a guessed season. Activity heartbeats
begin after the Town is ready. Subsequent updates retain the visible scene.

Verification: seven Chromium cold-start/selection/failure/retry checks passed;
29 existing Town, neighbor and garden browser cases passed. Eighty-five frontend
test files, app/hosting typechecks and both Vercel/compatibility builds passed.
Screenshots: `/tmp/plg-town-loading/`. No backend, database, cloud or release
changes are part of this follow-up.

## Follow-up: viewing and editing modes (2026-10-16)

Requested behavior: an alternating Edit town / Done editing control in one fixed
map-heading slot. Fresh sessions view the Town; an already active same-tab edit
session survives material-earning trips. Editing exposes catalog placement,
relocation, demolition and road/fence construction. Done cancels unfinished work.
Viewing retains animal/pet changes, planting/harvesting and shop visits, while
hiding the palette and blocking layout commands. Construction validation and
ownership remain entirely server-owned; the local mode is a UX safeguard.

Viewing supports mouse drag, one-finger pan, two-finger pinch, continued panning
with the remaining finger, wheel zoom and keyboard navigation. Zoom is continuous
within 1×–2×, with the existing two toolbar presets. Clamp every view to scenery
bounds, keep focal points stable, suppress taps after gestures, and never send
construction requests while navigating. Coalesce pointer/wheel changes to a
single update per display frame; reuse the existing renderer and decoded images.
Synchronize changed palette dimensions before hit testing and rendering.

The main expected benefit is clearer interaction and fewer accidental edits.
Viewing skips placement checks and blueprint DOM work. Animal/wildlife simulation
and animation still run, and the larger viewing canvas can paint more pixels;
this change is not a claim of a measured frame-rate improvement.

Regression coverage includes pure focal-zoom/pan/bounds math and real mouse,
wheel and touch input at 1366×768, 1024×768, 1180×820 and 744×1024, with both
interface languages. Existing construction, source-game returns, neighbors,
gardening, pets, four portrait sizes and first-entry loading retain their checks.

Final verification: 86 frontend test files passed; app, hosting and server
typechecks passed; frontend compatibility/Vercel and server builds passed.
Server tests: 305 passed, 11 database-dependent cases skipped. The final combined
mode, portrait and loading browser run passed all 20 cases; construction,
neighbor, garden and pet browser regressions also passed. Build output retains
the existing large-chunk warnings. Changes remain local and uncommitted.

## Follow-up: fixed scenery, entrance, tiled interiors and editing pinch (2026-10-17)

Ambient strips previously selected their first position, variant and side-layer
count from viewport offsets. Crossing those thresholds replaced trees while
panning. `sceneryLayout.ts` now caches world-owned strip coordinates and variants
for all four sides, with camera/zoom applied only during painting. Mountains use
the same rule. The permanent west opening at row 7 carries a fixed three-tile
stone approach to column 0. Render derives road access only from that gate;
arrivals follow its cardinal approach before entering player-built roads.
Existing equipped homes, paid roads and earned progress remain intact. Neighbor
road guidance identifies the left entrance in English and Vietnamese.

Walking source cells were uneven, and using their centers as horizontal anchors
moved heads sideways between poses. All ten characters' sixteen directional walk
frames now use measured head silhouettes for horizontal alignment. Both manifests
match; original PNGs are unchanged. Movement consumes its full travel budget
across waypoints instead of dropping the remainder at every tile boundary.

`civ-interior-tiles-v2.png` is a new built-in ImageGen atlas with individually
measured floor and furniture crops. The exact brief is saved in
`civ-buildings/interior-v2-prompt.json`. Seven ten-by-eight orthogonal rooms use
whole-tile, non-overlapping furniture/appliance footprints, including vertical
1×2/1×3 and square 2×2 fixtures. No diagonal whole-room backdrop is used.
`civInteriorLayout.ts` assigns each worker to the appropriate counter, preparation
table, anvil, chalkboard or examination station. Role-specific work frames run
with staggered quiet pauses and live reduced-motion handling. Schedules and
server-verified help remain authoritative. New art follows the existing private
catalog and is preloaded only for towns containing a civic building; no upload,
cloud change or release receipt was created.

Editing supports two-finger pinch zoom in both directions within the existing
1×–2× bounds, plus two-finger panning. One finger retains ordinary building taps
and road/fence drawing. A second finger cancels unfinished strokes, suppresses
placement clicks, and enters navigation until all fingers lift; the remaining
finger may continue panning. Selected building/relocation coordinates survive
pinching. Camera updates reuse the existing frame-coalesced renderer and decoded
artwork. English/Vietnamese accessible map instructions include pinch zoom.

Verification: 404 frontend checks passed; app/hosting typechecks and both Vercel
and compatibility builds passed, retaining existing large-chunk warnings. Server
checks passed 306 tests with 11 database-dependent skips (no test database was
configured); server typecheck/build passed. Ten existing neighbor/help browser
flows passed across both languages, landscape/portrait and reduced motion. Five
new Chromium cases verified all seven interiors at 1366×768, 1024×768, 1180×820,
world-fixed scenery through pans/continuous zoom, and rendered head alignment
within three pixels for every character and direction. Additional viewing/editing
and construction checks cover pinch placement preservation, canceled road/fence
strokes, one-finger continuation, ordinary road drawing and all controls staying
inside the viewport. Review screenshots: `/tmp/plg-civ-polish/` and
`/tmp/plg-town-edit-pinch-*.png`. Work stays local on `feature/town-civ-houses`
per the user's explicit branch choice; no commit, push or publication occurred.

Editing pinch verification additionally passed all eight viewing/editing gesture
cases (including Vietnamese and portrait) and the eleven existing construction
cases. The three new touch cases first reproduced the missing editing zoom,
then verified pinch in/out, unchanged build coordinates, continued panning with
one remaining finger and cancellation of both road and fence strokes. A final
full-suite run exposed an existing random cabbage chopping fixture: its fixed
1,000 ms hit is invalid for one of six random presets. That command-mapping test
now explicitly uses preset 0; no cooking runtime behavior changed.


## UAT revision: countdown hands and compact specialized interiors (2026-10-17)

Remove every text time label from building clocks. `civCountdown.ts` derives
remaining away/opening time and draws a number-free face whose two hands turn
counterclockwise as remaining time decreases. An unchanged HH:mm home-clock
sample retains a local interpolation age across heartbeats; unknown home clocks
produce no fabricated countdown. Server schedules and progress are unchanged.

Replace the 10×8 rooms with 4×5 square-cell small shops and 6×5 larger rooms.
Every person occupies one 1×1 cell beside its workstation. Benches/racks use
2×1, cabinets/anvils/ovens 1×1, and beds 1×2. Floor cells, people and furniture
share the same CSS grid rather than independent percentages. Fixture footprints
are non-overlapping, and every station has a cardinal path from the door.

New built-in ImageGen source `civ-interior-specialized-v3.png` supplies grocery
cabinet/checkouts, bread racks and kneading benches, produce packing benches,
chilled meat cases and cutting benches, anvils/forges/tool workbenches, bookcases,
examination beds and pharmacy cabinets/preparation counters. The source is
unaltered; measured alpha crops accommodate uneven generated spacing. Brief:
`civ-buildings/interior-v3-prompt.json`. The private catalog is regenerated offline;
no cloud upload or release receipt is created. School desks/chalkboard retain
reviewed v2 art. Stone/concrete serves the smith, hardwood the school/book area
and grocery, terracotta bakery/produce, ceramic the clinic/butcher.

Verification: 407 frontend checks passed; app/hosting typechecks and both build
modes passed (existing chunk warnings remain). Six Chromium cases include all
seven interiors at 1366×768, 1024×768 and 1180×820, measuring square floor cells,
1×1 worker bounds and every furniture footprint. Countdown rendering has zero
text calls and visibly changes between server heartbeats. Existing edge scenery
and walking alignment regressions also pass. Screenshots: `/tmp/plg-civ-v3/`.
Local UAT binds the source/public directories, so refreshing shows the updates.
Changes remain local/uncommitted; no account, progress or cloud changes.


## UAT revision: grouped sleep markers and sheep-counting dream (2026-10-17)

Sleeping animals now share one rising/growing/fading zzZ stream per home/species
herd, with staggered phases and anchors derived only from sleeping members.
Awake animals, including rain-sheltering animals that are not asleep, are excluded.
This is a decorative renderer change; schedules, animal paths, server contacts,
gardening, materials and achievements are unchanged.

At overview sheep use zzZ too. Zoom 1.15×–1.65× crossfades their letters into a
cloud-shaped thought bubble; the bubble replaces zzZ at close zoom, and zooming
out reverses it. Other species keep zzZ. The bubble has a scalloped outline and
thought dots, a tiny fence, and six generated jumping poses from
`sheep-dream-jump-v1.png`. The exact built-in ImageGen prompt and measured alpha
manifest live beside the PNG. Original pixels/alpha remain unchanged. Body-mass
anchors and a common source scale preserve proportions while knees tuck/extend;
preparation/landing stay planted and the airborne poses follow the jump arc.
Reduced motion displays static readable letters or one airborne dream frame.
Only sheep homes preload the new private-catalog asset. No cloud upload ran.

Verification: 413 frontend checks passed, app/hosting typechecks and both build
modes passed (existing chunk warnings remain). Four Chromium cases at 1366×768,
1024×768 and 1180×820, including reduced motion, verify one marker per herd,
overview-to-dream replacement and reversal, all six jump crops playing, awake
states with no sleep overlays, no missing artwork/page errors and no obstructed
controls or page scrolling. Screenshots: `/tmp/plg-town-sleep/`. Changes remain
local and uncommitted on the authorized town branch. Refresh local UAT to view.


UAT size refinement: the whole dream group now renders at 50% of its original
width and height. One canvas transform scales the cloud, dots, jumping sheep,
fence and stroke widths together, anchored above the same sleeping herd.
The aspect ratio, jump timing and zoom crossfade are preserved.
