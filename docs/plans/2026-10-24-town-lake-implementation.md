# Implementation plan: Town Lake

Status: implemented locally; automated checks passed and user UAT is pending. Requirements and
user decisions are in [the lake spec](2026-10-23-town-lake.md). Worktree:
`<repo>`, branch `feature/town-lake` from `main`.

## Architecture

- Common Town authentication, storage, revisions, construction, building
  behavior, environment and resource receipts remain shared.
- Shared map context supplies ID, dimensions, terrain/depth, protected passages
  and entry points. Legacy placements default to the original Town map.
- Lake runtime lives in `frontend/src/features/town-building/maps/lake/` and
  `server/src/town-building/maps/lake/`, each with its own guide linking common
  Town/map guides. Future maps use the same convention.
- Extract existing code only when a lake slice needs reuse. Preserve existing
  routes and the original Town's terrain/camera/animals/events throughout.
- Extend existing Town JSON if sufficient. Do not introduce an independent
  economy or automatically add SQL tables/dependencies for every map.

## Ordered slices

1. **Map geometry contract.** Define map identity/context, original-map defaults
   and lake terrain/depth/river passages.
   - Files: server `maps/types.ts`, `maps/registry.ts`, `maps/lake/terrain.ts`,
     `tests/town-map-terrain.test.ts`.
   - Acceptance: the original terrain remains unchanged; lake has the reviewed
     land/shallow/deep arrangement and protected incoming/outgoing passages.
   - Verify: focused Node geometry tests, then server typecheck. No dependencies.

2. **Map-scoped placement.** Add entity map membership and map-aware footprint,
   collision and road/fence placement helpers.
   - Files: `game.ts`, `fence.ts`, `maps/registry.ts`,
     `tests/town-map-placement.test.ts`, existing fence tests if required.
   - Acceptance: existing saves stay in Town; coordinates on different maps do
     not collide; no placement crosses land/depth/protected boundaries.
   - Verify: placement plus original construction/fence regressions. Depends on 1.

3. **Permanent lake unlock and map projection.** Persist first verified Flower
   unlock; expose additive map availability without breaking Town responses.
   - Files: `repository.ts`, `routes.ts`, `maps/lake/game.ts`,
     `tests/db/town-lake-unlock.test.ts`, `frontend/src/api/town.ts`.
   - Acceptance: existing Flower towns qualify; future prosperity loss does not
     relock; forged/foreign-profile access fails.
   - Verify: guarded DB and route authorization tests. Depends on 1–2.

4. **Navigation into the lake.** Add right-river entrance, visible five-second
   jump cadence, still reduced-motion state, separate lake page/scene and return.
   - Files: frontend `TownBuildingPage.tsx`, `TownScene.tsx`,
     `maps/lake/LakePage.tsx`, `maps/lake/LakeScene.tsx`, `maps/lake/lake.css`.
   - Acceptance: only unlocked navigation opens; both maps preserve their view;
     the inactive map stops ticking and all controls fit.
   - Verify: isolated agent-browser at the three required landscape sizes,
     keyboard/touch and reduced motion; frontend typecheck. Depends on 3.

Checkpoint: original Town still loads/builds; lake unlock and round trip work.
Keep runtime test evidence local, not in the repository.

5. **Atomic cross-map relocation.** Validate origin/destination, existing paid
   move cost and both footprints in one existing Town transaction.
   - Files: server `game.ts`, `repository.ts`, `routes.ts`,
     `tests/db/town-map-move.test.ts`, frontend shared placement controls.
   - Acceptance: any fitting blueprint can move; identity/occupants/crops remain;
     invalid/stale/retried moves cannot duplicate or double-spend.
   - Verify: guarded DB concurrency/move regressions and browser trip. Depends on 2–4.

6. **Map-aware neighbors.** Generalize business access and pedestrian paths to
   the selected map's terrain/entry rather than the original stone gate.
   - Files: server `civ.ts`, `tests/town-civ.test.ts`,
     frontend `civWorld.ts`, `civRender.ts`, shared map context adapter.
   - Acceptance: moved ready shops retain readiness; new lake shops have valid
     local arrival/help/opening-hours behavior; roads do not join across maps.
   - Verify: path/move-in regressions and both-map shop browser flow. Depends on 5.

7. **Map-aware gardens and animals.** Separate worker simulation/contact state
   by map and preserve checkpoint/active-map behavior.
   - Files per focused subtask: server `garden.ts`, `gardenSessions.ts`,
     `gardenSimulation.ts`, animal terrain helpers and focused map tests.
   - Acceptance: moved patches retain growth; animals cannot contact another
     map's patch; worker deadlines/leases and original gardening remain valid.
   - Verify: garden worker and guarded harvest/concurrency tests. Depends on 5–6.

8. **Raft catalog and free stocking.** Define three raft types, depth/shore
   rules, species size classes/capacities and verified fishing-catch unlocks.
   - Files: server `maps/lake/catalog.ts`, `maps/lake/game.ts`,
     `maps/lake/commands.ts`, `tests/town-lake.test.ts`, integration adapter.
   - Acceptance: locked species stay inspectable; free stocking never changes
     Fishing Friends; enforce 16 small or four big residents and habitat rules.
   - Verify: focused reducer/route tests and guarded authorization/provenance
     tests. Build the matching lake palette/picker in a separate ≤5-file subtask.
   - Dependencies: 1–3, then integrate through 4–7.

9. **Growth, reserve and the 100-fish unlock.** Add bounded active lake growth,
   mature nursery collection, reserve and compatible friendly-raft transfer.
   - Files per focused subtask: `maps/lake/simulation.ts`, `maps/lake/game.ts`,
     existing simulation/repository adapter and focused domain/DB tests.
   - Acceptance: harvest removes residents and pays once; individual harvest
     count unlocks the friendly blueprint at 100; reserve avoids pre-unlock/full
     destination dead ends; transfer never counts/awards a second harvest.
   - Verify: 99→100 and batch crossing, hidden/resume, competing tabs, restart,
     replay, capacity and no-offline-growth cases. Depends on 8.

10. **Insect sources and +20% feeding coverage.** Implement 1×1 shore sources,
    fitted raft modules, authoritative circular range and one capped boost.
    - Files per focused subtask: `maps/lake/feeding.ts`, catalog/command adapter,
      simulation adapter and focused feeding tests; frontend selection/range
      presentation follows in its own small subtask.
    - Acceptance: selecting a source displays its real circle; time within any
      active source gives exactly 1.2× fish growth, independent of overlap;
      moving/removing sources affects future progress only.
    - Verify: edge-of-circle, moving fish/source, multiple-source, paused-map,
      stale revision, no plant/payout/capacity multiplier cases. Depends on 9.

Checkpoint: full nursery→reserve→100 unlock→build friendly raft→transfer flow
works with correct storage, growth and feeding range at required viewports.

11. **Fish, plant and weather artwork/behavior.** Produce referenced sprite
    sheets for shadows, surface/resting poses, habitat-adapted rafts and insects.
    - Files per small art/renderer subtask: lake atlas metadata, lake renderer,
      source art README, catalog entries and required image files.
    - Acceptance: distinct fish/habitat silhouettes, morning/afternoon/night
      behavior, live weather shelter/surfacing and calmer reduced motion; growth
      never pauses because of clock/weather; heartbeats do not restart scenes.
    - Verify: visual inspection, alpha/crops, asset checks, private-artwork local
      build, both languages and landscape browser checks. Depends on 8–10.

12. **Lake development and achievements.** Implement egg/small/chubby map
    milestones and the complete Lake Friends group with verified progress.
    - Files per subtask: lake achievement module, achievement catalog,
      report summary adapter, metrics/tests; artwork and frontend badge wiring
      follow as their own small presentation subtask.
    - Acceptance: universal badge artwork, clear conditions/difficulty, permanent
      correct counts, one idempotent admin migration, full kid/Parent/Admin group
      with earned/progress status from the same authoritative projection.
    - Verify: catalog idempotency/preservation, both child-report tests, source
      award tests and badge dialogs in a real browser. Depends on 9–11.

## Final verification

Run the seven build/test/typecheck commands from the spec, required guarded
database suites, and a complete agent-browser flow at 1366×768, 1024×768 and
1180×820. Include all selection, locked, construction, growth, collection,
full/reserve, cross-map, badge, weather and reduced-motion states. Check console
errors, relevant network calls and control bounds; no horizontal/vertical scroll.

Keep raw evidence under `/tmp`; record concise results in authored documents.
Do not run production migrations or create/upload cloud resources. Do not
commit, push, merge or publish until the user says `confirmed`.

## Implemented modules and validation

The planned slices are implemented through shared `maps/types.ts`,
`maps/registry.ts`, `maps/land.ts`, the lake `catalog`, `types`, `game`,
`behavior`, `achievements`, `repository`, `commands` and `routes` modules.
The lake presentation owns `LakePage`, `LakeView`, `LakeScene`, `landRender`,
art crops and CSS. Existing Town navigation accepts a generic destination.
The existing Town JSON row stores the lake; no schema migration is needed.

- Permanent Flower unlock, verified catch gates, 16/4 capacity, habitat/shore
  validation, active-only growth, capped feeding, reserve/companion transfers,
  the individual 100-fish milestone, cross-map placement and once-only rewards
  have focused and disposable PostgreSQL coverage.
- Parent and Admin report routes return the same full eleven-badge Lake Friends
  group, with server-held metrics and earned state.
- Full frontend/server suites pass. App and hosting type checks and server
  build pass. Vercel and compatibility frontend builds pass. Raw logs/evidence
  stay outside versioned files. Existing large-chunk build notices remain.
- The agent-browser flow passes at 1366×768, 1024×768 and 1180×820 in both
  languages, including actual building relocation, nursery harvest, friendly
  unlock/build, reserve transfers, feeding circles and badges. Night/rain,
  night/snow, unavailable weather, reduced motion and asset responses pass.
- The new material recipes average 30.75 versus Town's 25.67 (+19.8%). A
  regression checks this target. Only the four new lake building types use it.
- UAT runs from this persistent worktree at `http://localhost:5173` via
  `scripts/start-uat.sh`. The launcher now refreshes an outdated frontend
  bind mount when changing worktrees; existing accounts/volumes remain intact.

Original temporary work was recovered from local tool records after `/tmp`
was cleared. Feature source now lives in the persistent worktree above.
No commit, push, upload or cloud provisioning has been performed.

## UAT visual follow-up

The lake now uses the original Town's seasonal ground colors, sparse terrain
sprites, water ripples, rounded shoreline ribbon and forest/mountain strip
layouts. The non-buildable scenery frame extends outside the 20×40 active
grid using Town's existing 46×26.2 visual-world framing. Both rivers continue
through the frame; server footprints/depths remain authoritative. A horizontally
flipped copy of the Town arrow returns from the incoming river, including by
keyboard, with the same visible jump cadence and reduced-motion behavior.

Both maps show the shared placement grid only while editing. Lake editing adds
the four tile-nudge controls and coordinate readout; selection initializes the
move footprint at the object's current position. The lake's static terrain is
cached independently from fish animation and selection. Browser checks cover
the frame, both-direction river navigation, controls/coordinate changes,
view/edit switching and all three required landscape sizes.

The next UAT pass adds a buildable three-column/two-row island at row 9,
column 22. Its six land tiles replace deep water (394 deep tiles remain),
using the same authoritative habitat/footprint rules as the main shore. A
browser flow transfers a Town house onto it. Rounded outer lake corners use
one continuous shoreline, and Town's foreground order is restored at the
bottom: far trees, near trees, then foreground mountains. Reused rock props
block the outgoing river; remove this barrier when a future map is unlocked.

Manual pause/resume controls are removed. Visibility/focus and modal lifecycle
still checkpoint growth; closing badges, pet/crop/shop or transfer dialogs
resumes active lake viewing. Error recovery remains through Sync. Four nudge
buttons sit on the right, and hardware arrows invoke the identical bounded
nudge function while editing, with form inputs/dialogs retaining their keys.

Building interaction buttons use the shared Town pictograms and keep localized
accessible names/tooltips. Floating gardens have six separate planting pockets
in an empty frame, with species sprites anchored to measured slot positions and
scaled through growth. The existing wooden animal-home signpost is reused on
stocked fish rafts and planted gardens with the fish/plant pictogram inside.
The 3×2 garden appearance does not change stocking limits, plant payouts or the
one-species-per-raft rule. New PNGs are cataloged locally without uploading.


Selected-building controls now follow the footprint on the map, including
fish/plant chooser icons, collection, movement, removal and inhabitants.
Chooser icons open dialogs; the sidebar keeps information and progress.
Action rows follow zoom/pan, clamp inside the canvas and avoid the river arrow.

The saved insect-raiser ID now displays as Shore insect raiser. A separate
1×1 Floating insect raiser uses the existing floating insect-tray sprite,
accepts shallow/deep water and unlocks after 16 verified lifetime nursery fish
harvested. Both standalone source forms share radius four and maximum
+20% fish growth without stacking. The new recipe is 25 wood, 3 rock, 3 metal,
1 wool and 4 stamina; five lake blueprints average 31 material units (+20.8%).

Validation for the building-action and insect-source UAT pass: frontend 474/474;
server 444 passed with 26 database tests skipped (no disposable test DB configured).
Both frontend typechecks, server typecheck/build, active Vercel build and Sites
compatibility build passed. Headless agent-browser flows passed at 1366×768,
1024×768 and 1180×820, including anchored action bounds/tap targets, fish/plant
choosers, collection, building transfer, removal confirmation, floating insect
construction/range/removal and modal resume. Focused server coverage checks the
15→16 unlock boundary, rejected land/river placement, shallow/deep moves and the
non-stacking bonus across shore, floating and legacy saved sources. Local screenshots
and logs remain under /tmp; no assets uploaded and no commits or publication.


Lake animation now advances from a capped frontend requestAnimationFrame clock,
independent of API refresh cadence. Fish and plant growth previews also advance
locally. The backend performs no recurring lake heartbeat writes: it checkpoints
active viewing time on pause/leave or a validated player action, and derives
feeding from raft centers. The browser sends neither positions nor elapsed-time
claims; validated harvest/build/move actions retain server-owned progress.

Town and Lake read the same `town-environment` query and home-city environment
service, so local clock, season, cloud cover, rain/snow, snow cover and freshness
remain shared. Lake rendering reuses Town's cloud-shadow and lighting rules;
map-specific weather behavior is limited to how lake fish shelter, swim and
surface. Future maps may define their own environment only when their design
calls for it.


The persistent Town screen replaces the previous per-map page shells.
`TownMapScreen` stays mounted for `/town-building/*`; `TownMapHost` owns one navbar,
material strip, workspace/canvas slot, editor/grid state, catalog UI, inspector,
weather status and appearance preview. Map controllers publish data/actions and
render terrain/building/animal content into fixed slots through `TownMapLayout`.
Lake has no independent page layout, navbar, materials, control sizing or palette
CSS. Common category pagination keeps construction choices and actions visible.
Browser coverage asserts the same actual DOM nodes, exact section/canvas bounds,
computed colors/fonts, and edit state across both navigation directions, at all
three required landscape sizes. Cosmetic weather previews persist in the host;
gardening and business UI continue to use the live environment.

The shared edit entry now says Build. Lake renaming uses the authenticated
profile name plus one approved adjective, displayed as `Kidname's adjective
lake`; free-text owner/name claims are rejected. New fish-raft insect attachment
commands and controls are removed. Shore and floating insect buildings remain
available, and older saved attachments retain compatibility.

`TownMapDialog` now owns centered map chooser/transfer modals and their in-dialog
validation area. Plant choices preview the same full-footprint habitat check as
the server. Unsuitable choices look unavailable and explain their requirement
when tapped, without selecting or posting. Selection stays local until the child
presses Plant; Cancel and Escape leave the garden unchanged. English/Vietnamese
checks cover initial state, expanded requirement messages and all action bounds.

Deep water now has stable uneven shelves with varied bend spacing, one connected
body around the buildable island and 391 deep tiles (48.9% of the active map).
Rendering uses the authoritative spans/terrain mask, including river and island
exclusions. Reloading never rerolls habitat under existing buildings.

Current validation: frontend 476/476; server 449 passed, with 26 guarded DB tests
skipped in the ordinary suite. Six relevant integration checks then passed on
the disposable local `plg_test` database, covering lake persistence/concurrency,
ownership, rewards, names, Town construction/animals, notifications and reports.
Both frontend typechecks, server typecheck/build, Vercel build and compatibility
build passed. Browser flows verify the persistent shell and chooser/project-board
states at 1366×768, 1024×768 and 1180×820, including English/Vietnamese, keyboard
actions, unavailable plant hints and explicit planting. Evidence stays local.

The next visual UAT refinement caps each raft at six representative fish
shadows. The user confirmed that this is cosmetic: capacity remains 16 small
or four big fish. Nursery shadows use spaced, gently moving lanes inside the
net. Deep shelves now reuse Town's rounded bank geometry with a subtle blue
transition ribbon; habitat tiles and protected passages remain unchanged.
Validation: 478 frontend tests, both typechecks and both builds passed. The
focused headless browser check passed at all three required landscape sizes,
including a 16-resident nursery displayed as a quieter representative school.
