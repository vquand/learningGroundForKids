# Town Building Minigame Agent Guide

## Common entities and mandatory self-review

These rules govern the whole Town building module, frontend and server,
including the original Town, Lake and every future map or event. Map and event
guides inherit them.

- Maintain one common implementation per building or entity type. Reuse its
  rendering, simulation, interactions, dialogs and server rules wherever that
  type appears. Search the existing common code before adding an implementation.
  Do not recreate the same entity in another map or event, even under a new name.
- Express behavior differences through environment or event context: terrain,
  habitats, weather, seasons, time and event policies/capabilities supplied to
  the common implementation. Keep genuinely unique map/event behavior in small
  adapters or policies that extend the shared entity. Do not copy its base code
  or introduce parallel implementations selected by map/event ID. Preserve
  event isolation and pinned editions under ADR-008.
- When an existing implementation needs a capability, extend or extract the
  common code and update its consumers in the same change. Future maps and
  events must use that common path; do not defer consolidation until later.
- Before reporting any Town change to the user, self-review the complete change,
  including new/untracked files. Trace affected entity consumers across all
  maps/events and check for copied renderers, simulations, action handlers,
  dialogs and server rules. Confirm that differences come from environment or
  event context and that every affected consumer uses the common implementation.
  Fix duplication introduced by the change before reporting completion.
- Verify shared behavior and each changed environment/event extension on all
  affected maps. Report the reviewed common paths, checks performed and any
  unresolved findings; passing tests alone do not establish code reuse.
- Every Town UI change that adds or touches an icon, artwork, or icon component
  must use the common `.town-icon` classes and never rely on a parent to size a
  bare SVG or image. After implementation, measure rendered icon sizes in a
  real browser at 1366×768, 1024×768 and 1180×820 by running the icon-size
  browser script and guard test; look for oversized or collapsed icons. An
  unsized `EggIcon` once rendered as a giant egg in the River raft dialog.

## Poultry and map exits

- Follow `docs/plans/2026-10-25-lake-poultry.md` for real-time coop eggs, the
  non-stacking chicken crop bonus, synchronized duck raft visits and friend
  takeaway. Keep all awards server-verified; browser motion and egg previews
  never change balances or progress. Use the shared receipt animation.
- Every area buff/debuff is listed in `AREA_EFFECTS` (server `areaOfEffect.ts`)
  with its source, terrain, reach and a strict `targets` whitelist; rules call
  `affects`/`emits` instead of ad-hoc id checks. Special homes (the Friendly
  raft, river baskets) are never whitelisted, so no area ever changes them.
  Duck coops use the one map-agnostic `duckHelpArea` on every map with water;
  the area shows even when nothing inside can benefit.
- The edit side panel is `TownBuildingPalette`: icon group tabs (never a
  dropdown) ending with the Building book, a responsive blueprint grid that
  pages only when tiles do not fit, and the shared `BuildingDetailCard` pinned
  to the bottom at most 60% of the panel. The card shows art, a large name,
  the description from `buildingDescriptions.ts` (read-aloud button on touch
  devices), building or moving cost, and a chubby progress bar from
  `buildingProgress.tsx`/raft progress. The book reuses the same card.
- A shore duck coop's help area is `duckHelpCoverage`: the closest 18 reachable
  water tiles, grown as a cone that is widest against the coop and narrows into
  the lake. Show it only on water when the coop is selected. Ducks only visit
  (and the server only boosts) rafts overlapping that area; inland coops help
  no rafts.
- Selection highlights follow the sprite's alpha via `drawSelectionOutline` for
  buildings and rafts alike; never fill or stroke the object's tile footprint.
- Available coop eggs use the shared `TownStatusLayer` egg icon sticker above
  the roof on every map, with a brief jiggle every three seconds. No egg basket
  is painted beside a coop. Follow the scene camera/frame clock, hide the
  sticker when no eggs are available, keep it non-interactive and localized,
  and disable its jiggle for reduced motion. Friend-takeaway-raft baskets remain stock
  presentation; neither visual changes production, harvesting or rewards.
- Place Town's lake exit and Lake's return arrow in their ambient river strips
  outside the active grid. Keep them aligned during pan/zoom, usable within the
  viewport and clear of selected-building controls at all required sizes.
- Select placed buildings by tapping the map. Do not restore the developer
  object-selection dropdown in the child-facing toolbar.
- Land garden plots show a hovering chubby chicken face when inside chicken
  coverage and a gloomy insect face when inside either insect raiser's range.
  Both indicators may appear together. Use thick cream silhouette sticker
  borders, without circular backgrounds, placed over the upper crop row.
  Floating gardens use the same duck and insect sticker treatment; show duck
  help only after a verified bonus and insect risk only for floating raisers.
  Keep them attached through camera/zoom,
  non-interactive, localized and calm under reduced motion.
- Insect-covered plots always lose a quarter of their crops (rounded up) per
  growth cycle, server-verified; only which crops is left to chance. Use the shared generated `withered-plant-v1.png` for every
  species: a sparse dry stem with two or three damaged leaves and no identifiable
  vegetable. Never flatten, skew, desaturate or recolor a healthy crop as its
  withered state. Render it until Harvest; harvesting replants
  it and pays for healthy ripe crops only. No lost-crop rewards, river stock,
  automatic event harvesting or invented progress. See the gardening-effects
  plan. Ground animal sprites behind buildings respect building alpha/depth;
  enclosed residents never spawn within an occupied footprint.
- Demolishing any stocked fish/plant raft releases its contents with a short
  cosmetic animation, then they leave. Never require emptying it first and
  never award harvests, reserves, refunds or progress from demolition. Moving
  a valid raft preserves its contents, growth and identity with ordinary costs.

## Building rotation and doors

- A building's facing is `Entity.direction` (`front`, `left`, `back`, `right`;
  absent means `front`, the original artwork, so older saves are unchanged).
  Rotate order is clockwise on screen: front (door south) → left (west) →
  back (north) → right (east). `server/src/town-building/direction.ts` is the
  single source for which blueprints turn: house, large-house, farmhouse, coop,
  animal-habitat, school, tools-smith, grocery, bakery, meat-shop and
  vegetable-shop turn four ways; town-hall, library and infirmary toggle
  front↔back; trees, roads, fences, patches and rafts never turn, and R does
  nothing for them. Do not add per-building rotation rules anywhere else.
- Rotation happens only while building or moving in Editing mode, through the
  context toolbar's Rotate button or the R key. Build and Move commands carry an
  optional `direction`; the server validates it against the blueprint, so a
  direction-only change in place is an ordinary move at half cost. A turned
  preview that does not fit shows the normal red state and never shifts itself.
- Quarter turns swap `width`/`length`. Read footprints through
  `entityFootprint()`/`placementError(...direction)`, never `blueprint.width` for
  a placed entity. The door is `entityDoor()` (the tile outside the middle of the
  facing edge); `civEntrance()`, animal gathering (`entityDoorPoint()`), the
  north-door exemption in `animalWalkable()` and Halloween lantern priority all
  derive from it. Shops still only need a road within two clear steps of the
  door; placement is never blocked, an unreachable door keeps the owner calling.
- Artwork for left/right/back comes from `buildingViews.ts` (measured crops from
  `building-directions-v1.json` and the coop/farmhouse/haven notes) and is
  loaded only for entities that face that way. Turned art is fitted to the
  turned footprint with the same aspect-preserving rule as the front.
- Never rotate or mirror anything but the building itself. The return-clock,
  Garden/egg status stickers and the wooden resident/service boards stay upright
  and face the viewer; boards stand at the near corner on the door's side (left
  for west and north doors) and the clock is centred over the turned footprint.
- Signpost alpha masks use ordinary depth for outdoor walkers and animals in
  other shelters: animals legitimately behind a board are hidden by its alpha.
  The owner ID and interior-only flag additionally keep the board in front of
  its own shelter residents even at the doorstep. Keep ordinary
  building/roof occlusion and the interior's structural frame masks unchanged.
- Visit projections must pass `direction` through, and cross-map transfers keep
  the facing and validate the destination with it.

## Friend town visits

- Follow `docs/plans/2026-10-23-friend-town-visits.md`. Place Visit friends directly
  right of Back to Playground. Use exactly one friend-space button on both Town
  maps. Every Visit starts in the friend's Town, even when choosing from a lake.
  The friend's unlocked ambient river arrow opens that same friend's lake; its
  return arrow leads back to their Town. Never shortcut the picker into a lake.
- The centered paginated dialog shows avatar/name, saved Town name and Visit.
  Separate Town and Lake column headers use three little houses and a small
  lake. Below them show Town prosperity and the saved lake development stage,
  or a locked lake indicator. These icons convey status and are not navigation
  shortcuts. Keep localized accessible labels/tooltips and aligned columns.
  Most recent recorded
  activity sorts first, kid name breaks ties; never display activity timestamps.
- During visits use the blue navbar, owner name left of Town name, and the same
  picker with Back to my town. Keep scene interaction to pan/zoom, with no construction, storage, harvest,
  help, event greetings or progress heartbeats. Explicit river gifts/pickups and
  the arrival audit are separate authorized operations.
- Scope private queries by family/session, viewer and target. Recheck accepted
  friendship and both sides' family/profile scopes on the server for every read,
  including custom avatars. Clear inaccessible cached scenery after errors.
- Reuse existing avatars, prosperity artwork and Town achievements. Visiting
  introduces no achievement or browser-supplied reward/progress claim. Check both UI languages
  and list/visit/return/error flows at all required landscape sizes.

## Shared Town rules and individual maps

- Existing entity types have one shared implementation across maps. Use
  `buildingRender.ts`, `sharedAnimalWorld.ts`, `animalRender.ts` and the shared
  `civWorld.ts`/`civRender.ts` for coops, chickens, ducks, geese, farm animals,
  pets, buildings and NPCs. Wooden resident/service boards and dynamic contents
  belong to those shared renderers. Extend behavior through owning-map habitat,
  live environment or additional steering (such as Lake duck raft visits),
  never by copying the base entity into a map directory. Verify changes on both
  maps. See `docs/plans/2026-10-25-shared-town-entities.md`.

- This guide governs the whole Town feature. Shared map architecture is in
  [`maps/AGENTS.md`](maps/AGENTS.md); each map adds its unique rules in its own
  implementation directory. The second map is
  [`maps/lake/AGENTS.md`](maps/lake/AGENTS.md).
- Original-map specifics in this guide (the fixed river/mountain mask, west
  stone gate, original scenery and seasonal visitor placements) apply to the
  original Town map. Keep shared ownership, storage, construction, achievements,
  controls, art, weather, localization and viewport rules on every Town map.
- Add future map implementations under `maps/<map-id>/`, with their own
  `AGENTS.md` linking this guide and the shared map guide. Do not add lake/future
  map rendering or simulation branches in `scene/MapScene.tsx`.

## One map architecture (mandatory)

Behavior comes from the building, animal or plant, the terrain and water depth,
the environment and events — never from a map name. The map is always passed
explicitly (`mapId`/`MapDefinition`); `entity.mapId` is a legacy save field that
no code reads.

- Server: `maps/view.ts` (`landView`/`mergeLand`) presents any map as a TownState
  view, so one rule set runs everywhere. `mapTick.ts` (`tickMap`) is the single
  simulation (crops, contacts, animals, fish, plants, shops, events) with one
  lease/clock per map. `water/` holds raft, fish, plant and duck rules for any
  map's water; a river is shallow water everywhere. Only a blueprint's `maps`
  list restricts it (Town Hall: Town). Every area/contact effect is in
  `AREA_EFFECTS`.
- Frontend: `scene/MapScene.tsx` is the one scene (only `MAP_TERRAIN` differs);
  `scene/MapWorkspace.tsx` is the one selection, building, glide, detail card,
  action and dialog workspace; pages only supply data, transport and chrome
  (names, Women's Day, river friends, exits). `scene/useMapHeartbeat.ts` keeps
  every map's lease. Add a map by registering its terrain and scenery, not by
  forking these.
- Halloween runs on every map with that map's own occurrence; Women's Day is
  Town-only (`maps:['town']`). Ducks: water duty only when their shore area holds
  a whitelisted raft, otherwise they roam and help land crops.

## Persistent Town screen

- All Town maps live inside the same mounted `TownMapScreen` / `TownMapHost`.
  Navigation changes the active map adapter; keep the navbar, inventory bar,
  canvas bounds, editing/grid controls and palette frame in place with identical
  sizes, colors, fonts and backgrounds. Do not recreate page chrome in map files.
- Shared edit/grid mode and cosmetic weather previews persist across map
  changes. Keep live clocks separate from previews for gardening/business rules.
- Map adapters may vary terrain/map data, available buildings, weather/animal
  behavior, unlock conditions and advancement. Common building interactions,
  costs, server authority and shared UI behavior remain in their common modules.
- Browser regressions must check DOM identity and exact bounds/styles while
  switching both directions in viewing and editing modes at all required sizes;
  visual similarity or independent screenshots are insufficient.

## UI consistency across all Town maps

These rules apply to the original Town, Lake and every future Town map. Map
implementation guides inherit them and document only map-specific differences.

- Put every selected-building function directly beneath its footprint on the
  map: build/cancel, move, cross-map move, remove/confirm/keep, harvest, crop or
  plant selection, fish selection/stocking/transfer, animals and shop entry.
  Keep removal confirmation in the same action group. The sidebar contains
  blueprint browsing, object navigation, information, costs, requirements and
  progress; never duplicate building function buttons there.
- Use the shared Town pictograms for building functions instead of text action
  buttons. Keep localized accessible names and tooltips, keyboard focus and
  disabled states. Preserve the existing square control styling and at least
  44×44 CSS-pixel touch targets; existing 50×50 Town controls stay usable.
  Chooser icons open the appropriate crop, plant, fish or animal dialog, while
  direct actions such as harvest remain beside the building.
- Use `TownMapDialog` for map choice dialogs. Center them in the viewport,
  keep all current controls visible, and show validation in the shared message
  area inside the dialog. Choosing a crop/plant only selects it; an explicit
  Plant action commits it. Habitat-incompatible choices use a muted,
  `aria-disabled` state and cannot select or submit. Keep them focusable/tappable
  so an attempt can explain the requirement in friendly language inside the
  dialog without issuing a failing request. Never show raw API JSON to a child.
- Anchor action groups to the selected footprint through camera pan, continuous
  zoom, canvas centering and viewport changes. Measure their actual width and
  height, clamp them inside the visible canvas and avoid navigation arrows or
  other controls. Wrap when necessary without shrinking touch targets. Actions
  must remain independently tappable; no scenery or overlay may cover them.
- Show the placement grid, tile-coordinate readout and four footprint-nudge
  buttons only in editing mode. Put nudges and their readout on the right below
  the map, following the original Town layout. Hardware arrow keys and the four
  buttons invoke the same bounded movement handler. Preserve normal arrow-key
  behavior in text inputs, selects, editable content and open dialogs.
- Keep ordinary viewing free of construction controls. Maintain useful viewing
  actions such as harvest, inhabitants and interiors. Do not add manual map
  pause/resume buttons: checkpoint and pause automatically for hidden/departing
  views and blocking dialogs, then resume active viewing when they close or
  the child returns. Keep explicit Sync/retry recovery for failed requests.
- Reuse Town terrain artwork, seasonal grass colors/details, water ripples,
  shoreline ribbons, forest and mountain strips across maps. Preserve the same
  camera, proportions, warm outlines and rounded pastel style for new assets.
  Shape shores with connected rounded corners and bends; keep visual smoothing
  consistent with authoritative buildable land, water depth and river passages.
- Surround each map with an immersive, non-buildable ambient frame. Reuse the
  original Town's foreground stacking: far forest, nearer forest, then bottom
  mountains. Preserve sprite silhouettes, natural overlap and river openings.
  Each map may declare a different active size or layout; the original Town's
  fixed dimensions do not constrain future maps. Keep square tiles and camera
  bounds derived from that map's active grid and scenery frame.
- Use the shared cute arrow artwork for available map exits, oriented toward
  the destination; flip the same artwork for a return in the opposite direction.
  Anchor arrows to their passage, support touch/keyboard use and a jump every
  five visible seconds, and honor reduced motion. An unavailable onward route
  has no travel action; scenery such as removable rocks may mark its boundary.
- Reuse the wooden content signboard on inhabited or planted buildings, with
  the current animal, fish or plant pictogram. Keep labels outside raster art.
  Give functionally different building types distinguishable silhouettes or
  structural details, including empty states and growth/occupancy changes.
- Selecting a building or attachment with an area effect shows its coverage
  aligned with the same map camera and zoom. Areas are whole tiles, never
  circles: build them with server `areaOfEffect.ts` (`radiusArea`; the duck cone
  is `duckHelpCoverage`)
  and draw them with `drawCoverageArea`, whose dashed border runs (static under
  reduced motion). An object is affected exactly when one of its tiles is
  covered, so the drawing and the rule always agree. Each effect keeps to its
  terrain: land effects (chickens, garden insects, egg help) cover land tiles
  only; water effects (fish feeding, floating-plant insects, ducks) cover
  water tiles only. A source with both shows both parts. Overlapping coverage
  never implies an extra bonus when the effect does not stack.
- Make each map prosperity/growth icon a keyboard- and touch-accessible button
  that opens the shared wooden Community project board. Fetch board data only
  when opened. Show concrete next-stage tasks, quantities, eligible building or
  item names and materials to collect; show task progress and completion. Town
  may present one valid recommended combination and explain that alternatives
  can work. Completed maps show an encouraging complete message. Never display
  the internal prosperity score, weights or hidden thresholds. Keep the board
  readable and usable at required landscape sizes without hiding actions.
- Run decorative animation, fish swimming, surface jumps and all visual movement
  from the frontend frame clock. Never send animation frames or display positions
  to the server. Send authoritative, validated requests when a meaningful
  gameplay action changes recorded state.
- Reuse the live home-city clock, weather, seasons, lighting and reduced-motion
  behavior across maps. Keep map-specific growth stages visually consistent
  with Town while allowing appropriate stage artwork. Never invent known live
  weather or earned progress when their authoritative data is unavailable.
- Verify viewing/editing, selection, placement/cancel, all building dialogs,
  harvest, removal confirmation, map navigation, zoom/pan and return/resume at
  1366×768, 1024×768 and 1180×820 in English and Vietnamese. Check actual control
  bounds, tap targets and absence of required scrolling or covered controls.
  Use the required isolated headless agent-browser workflow and keep evidence
  local, following the frontend/repository verification rules.

## Vietnamese Women’s Day visitors

- Server event `womens-day`, pinned edition `2026-v1`, appears October 19–21 using
  the server-supplied home-city date, independently of season or device date.
  Register lifecycle in the shared server event host, like Halloween. Store only
  occurrence/edition identity, per-child intro dates and verified receipts;
  animation/planting remain cosmetic client state.
  Never change the real calendar or save cosmetic activity as earned progress.
- `TownTimedEventLayers.tsx` registers the edition visual adapter. Missing, stale
  or unsupported server records render nothing. New editions get isolated art,
  policy and adapters rather than reinterpreting an existing pinned edition.
- `womensDayWorld.ts` owns isolated clear-ground routes, three planting helpers,
  and at most 16 flower clusters beside homes/roads with the Halloween-inspired
  minimum three-tile spacing. Keep Halloween edition behavior independent.
- Hang at most five generated balloon/flower decorations on placed trees;
  towns with no placed tree use the ambient forest. Flowers/decorations never
  occupy tiles, spend resources, or award badges. Existing Town achievements
  and Parent/Admin reports remain authoritative and unchanged.
- `WomensDayCelebration.tsx` owns accessible tap/keyboard greetings, language
  switching, bounded speech bubbles, and reduced-motion presentation. Hide
  visitor interaction while editing or when another Town interaction blocks it.
- Shared chubby hearts live in `components/emotes/HeartEmote.tsx` for React
  and canvas. Reuse their glyph/pop effect rather than duplicating heart art.
- Phrases were generated with AGY headless and reviewed in both languages.
  English keys live in `womensDayPhrases.ts`, Vietnamese in `i18n/vi.json`.
  Production art prompts/crops are in the edition's public asset README.
  Raw AGY output and browser/test evidence stay under `/tmp`, never committed.
- Seven two-eye-only slime sprites use distinct accessories and the chicken
  maximum size of .78 tile; keep touch targets at least 44px without enlarging art.
- Permanent group `womens-day-2026` is titled `20/10/2026`; include the date in
  descriptions only. Visit and 3/5/7 distinct greetings are server-verified,
  deduplicated receipts, never browser counts. Include the complete group in
  Town, universal, Parent and Admin collections and the admin migration list.
- Center the Town brand and daily celebration card. The 19th prepares, the 20th
  celebrates, the 21st says goodbye. Persist dismissal per child/home-calendar
  date. Event-bound icon-only View card beside Back reopens today's card and
  disappears October 22; it never changes the once-per-day automatic behavior.

## Civil houses and neighbors

- Reviewed extension: `docs/plans/2026-10-16-town-civ-houses.md`. Seven ordinary
  businesses, ten named chubby people, empty/equipped exterior states and separate
  show interiors. Keep the aquarium-like play simple; no inventory economy.
- Roads connected to the permanent west stone gate (row 7, column 0) bring owners by car/truck. Park at the reachable
  road nearest the entrance. Initial move-in alone permits at most two cardinal
  clear-ground walking steps. Inaccessible owners wait and call from afar;
  show the large localized road bubble below the canvas with Show me.
- Render verifies bounded active move-in time in the existing garden worker and
  memory lease. Revision-lock ready transitions and awards; checkpoint partial
  time on pause. No client elapsed time, completion or prosperity input.
- Ordinary people walk clear ground freely and prefer roads; different home-city
  opening hours and short errands show return clocks. Browser animation survives
  heartbeats. Exclude both garden and civ progress from static layout keys.
- Prosperity uses distinct operational types, residents and capped help variety.
  Only its discrete Seed/Sprout/Bud/Flower stage is returned/displayed. Absence
  never lowers prosperity. Cap outside visitors at three decorative people.
- Three-step help is server-validated and has an active-time cooldown. Preserve
  existing Town achievement indices 0–6; append New Neighbor, Helping Hand,
  Lively Street using `civ-badges-v1.png`. Existing authenticated admin migration
  and shared parent/admin projection include all three verified achievements.
- New PNGs must use the private artwork catalog and same-origin authenticated
  Vercel Blob reader. Bundle crop JSON only. Never bake raster bytes into JS or
  upload/provision cloud resources from this branch. Omit art only with the
  pipeline's successful verification receipt. Asset briefs/crops are in
  `art/town-building/civ-buildings/README.md` and `civ-people/README.md`.

Follow `../AGENTS.md`, `frontend/AGENTS.md`, and the repository guide.
The reviewed feature design is `docs/plans/2026-10-11-town-building.md`.
The active backend architecture remains
`docs/plans/2026-09-19-vercel-render-neon.md`.

## Brainstorming and clarification

- Number every brainstorming and clarification question, including tool prompts.
  Keep numbers unique within each batch and preserve pending question numbers.
- Present concise numbered lists with short lettered choices where appropriate.

## Viewing and editing modes

- `TownRelaxingView` owns the optional relaxing fullscreen mode above all map
  controllers, including friend visits. Its native fullscreen element must stay
  mounted during Town/Lake travel; never fullscreen the replaceable scene itself.
  Available map arrows remain usable and keep the mode active. All other actions
  are disabled/hidden except the top-right exit. Pan/zoom remains cosmetic.
- Keep Town's top-right controls in this order: Fullscreen, Badges, Language.
  Fullscreen sits immediately left of Badges; preserve the shared Badges/Language
  adjacency and reserve all three slots. Keep 48px controls and localize them.
- Relaxing mode removes DOM readiness/buff/debuff stickers and canvas status
  effects (countdown clocks, sleep/dream, hearts, speech, coverage, selection and
  previews), plus bars, panels, notices, dialogs and reward flights. Keep world
  art and ambient motion; river objects and event characters become scenery.
  Use the shared renderer presentation flags, never a second renderer or simulation.
- Escape, the exit button and browser fullscreen exit restore ordinary layout,
  statuses, focus and the saved edit/view setting. Unsupported/denied native
  fullscreen uses the same viewport presentation. Do not persist the mode or
  create commands, progress or rewards from entering/exiting it. Check both
  maps, visits, reduced motion and all required viewports with
  `tests/browser/town-fullscreen.agent-browser.mjs`.
- Preserve selection, placement, direction, footprint and unfinished road drafts
  while relaxing; pause their interaction instead of clearing workspace state.
  Escape dismisses an open dialog first, and exits fullscreen only when none
  is open. Restore the current mode's notice on return. Failed-request messages
  remain visible and announced in every mode, including relaxing, in reserved
  layout space that cannot cover map controls.

- Fresh sessions start in viewing mode. Keep three separate sections in this
  order: home-city time/season/weather, material bar, then the icon-only Build /
  Done editing toggle. Build and weather sit outside the material bar. Editing reveals
  the blueprint palette and movement/removal controls. Leaving editing cancels
  selection, placement, demolition confirmation and unfinished road/fence strokes.
  Remember an active edit session through same-tab material-earning trips.
- In landscape, keep one persistent right panel and identical canvas bounds
  when selecting/deselecting buildings or entering/leaving editing. Put idle
  instructions at its bottom, with the current map overview above: building count,
  planted or empty land/floating plot count, and road/bridge lengths in tiles.
  Combine every catalog type in each category, scoped to that map; do not count
  trees, fences, decorative plants or preview objects. Selected cards include a separate Building details
  section with the shared information/cost content; there is no inspector button
  or separate building-details popup. Keep Town and Lake on this common path.
- Put map controls at the canvas's bottom-left ambient frame, including when
  letterboxed. Show the nudge pad and tile coordinates only while a blueprint
  is being placed or an existing building is being moved, never in idle editing.
  Editing nudges form a directional pad (up, left/right, down),
  with 48px buttons and a translucent connecting circle. Keep its empty space
  transparent to pointer input and leave the river exit clear. Keep tile actions
  clear of that toolbar. Weather opens a shared
  accessible popup containing the condition icon/name, saved city, server-supplied
  Celsius temperature (or unavailable), freshness and MET Norway/CC BY 4.0 credit.
  Keep weather attribution out of the map footer; hourly means forecast intervals,
  not a promise of hourly provider-model updates.
- Both viewing and editing support two-finger pinch zoom and two-finger pan.
  In editing, one finger retains placement/road/fence gestures until a second
  finger arrives; cancel unfinished strokes and suppress taps for the remainder
  of that pinch. A remaining finger may continue panning until all fingers lift.
- Viewing hides the construction palette and provides mouse drag, touch pan,
  pinch zoom, wheel zoom and keyboard navigation. Keep gestures inside scenery
  bounds. Zoom is continuous from 1× to 2×; the toolbar retains Overview and
  Zoom in presets. This supersedes the earlier strict two-level gesture rule.
- Building taps in viewing still offer pets/animals, crop selection/harvest and
  shop interiors. Never offer or send build, move, remove, remove-line, build-line or
  wrap-fence operations outside editing. The mode is a UX safeguard; Render
  continues independently validating every construction command and material cost.
- Distinguish taps from drags with a small threshold; suppress taps after any
  drag/pinch/cancellation. Preserve one-finger continuation after a pinch, cancel
  multi-touch road strokes, and flush/cancel queued gestures on release/mode exit.
  Coalesce viewport updates to display frames and keep the renderer/image cache
  alive. Viewing skips placement checks; normal animal animation still runs.
- Pure math regressions: `tests/town-viewport.test.ts`. Browser coverage:
  `tests/browser/town-view-mode.test.ts`, including both languages, same-position
  toggle, safe viewing actions, cancellation, desktop wheel/drag and touch pinch.

## Implementation and security

- Use React/TypeScript, existing profile gates, same-origin API clients, and
  existing game/menu conventions. Lazy-load the town route. Keep pure layout
  and placement helpers separate from React rendering.
- Render owns storage, construction costs, blueprint eligibility, and town
  placement. Derive profile ownership from the authenticated server session.
  Never trust browser balances, rewards, difficulty, completion, learned counts,
  building costs, or achievement claims. No direct database/provider calls.
- Award materials only from server-verified source-game events. Deduplicate
  event awards persistently; a retry, reload, replayed request, or parallel tab
  must not duplicate them. New legitimate rounds may earn their own rewards.
- Construction must atomically validate the blueprint, footprint, bounds,
  overlap, available resources, and revision before spending and placing.
  Prevent negative balances and concurrent double spending.
- Preserve source-game contracts, existing drill loot and upgrades, and earned
  progress. Town materials cannot be spent on Infinidrill equipment.
- Show each shortage with required/owned/missing amounts and a link to the
  source minigame. Preserve the pending blueprint when leaving and returning.
- Allow browsing with no blueprint selected. Clicking the selected blueprint,
  the tile's close button, or Escape clears placement without
  spending resources. After selecting a blueprint and a tile, show nearby
  hammer/chisel build and close buttons, clamped within the visible canvas.
  Group square blueprint buttons under Buildings, Trees, and Roads, in that
  order, with details below. Keep build/cancel actions beside the selected tile;
  do not duplicate them in the sidebar. Selecting a placed object shows a green
  glowing asset-silhouette outline and Move/Demolish icons. Move starts relocation;
  Building/tree demolition requires confirmation and never refunds resources.
  Show a lock on locked blueprints, allow inspecting their learning requirement
  and costs, and block canvas tile selection and footprint movement for them.
  Disable building for shortages, locked blueprints, invalid tiles, or pending
  requests. Use the same server-authoritative command as the sidebar action.
- The 20×40 terrain reserves exactly 120 river tiles and 40 mountain tiles;
  640/800 tiles remain buildable. Never allow building or roads on scenery.
- Dirt roads are free; rocky roads cost rock. Both are decorative only.
- Roads use transparent centered sprites over the seasonal terrain. Pick and
  rotate the isolated/end/straight/90-degree/three-way/four-way sprites from
  adjacent road tiles; support connected left/right/U-turns and mixed road types.
  Do not replace the whole ground tile with road color. Preserve terrain around
  the path. Mountains, river and building footprints remain blocked.
- Clicking a placed road in browse mode, or while its own road type is selected,
  shows Move and the dedicated Road removal icon. Clicking Road removal removes
  that tile immediately through the server; Escape deselects without removing.
  Road removal gives no refund and clears selection after the server confirms
  removal. Buildings still require confirmation. Neighboring
  road sprites reconnect automatically. Selecting a different road type still
  allows replacement, and dragging retains gliding behavior.
- Road selection supports mouse/touch gliding. Preview a connected path,
  deduplicate crossed tiles, stop at scenery/buildings or the material budget,
  and commit on release using sequential server-verified commands and returned
  revisions. Existing roads of the same type cost nothing. Pointer cancellation
  spends nothing. Never optimistically credit or spend stored materials.
- Roads, fences and bridges (one "Roads, fences and bridges" group) share one glide-to-build stroke sent as a single `build-line` request, plus single-tile removal ("Remove this road/fence/bridge tile") and "Remove the whole line" (`remove-line`).
- Wood and stone bridges (2 wood / 2 rock per tile) stand only on river or lake water, never on reserved river tiles, rafts or under floating structures. On construction every bridge touched by a stroke, tap or move must reach dry land on a side (`bridgeAnchorError`, checked once per stroke so a glide may start on the water). Bridges work like roads: people, land animals and vehicles cross them and they join road networks (`isPassable`/`isRoadLike`).
- A shore insect raiser (insect nest) may stand on a bridge tile with bridge on at least 3 of its 4 sides; that bridge cannot be removed while the nest stands on it.
- A bridge is square deck platforms over the water: land animals walk on top of them (no swim ripple), while raft fish, wild river fish, release drifts and swimming ducks and geese pass under them (`clipUnderBridges`). A swimmer only hides behind decks on its own row or in front of it, so its body stays drawn over decks behind it.
- A wooden fence with fence on both opposite sides can become a farm gate (`make-gate`, 3 wood). The gate stays in its fence line, carries its own dirt road, lets animals, people and vehicles pass, and swings open while one is within reach (`farmGateArt.ts`). It is never offered in the palette (`palette:false`).
  The authenticated server computes the complete cardinally connected component
  of that road's blueprint type, including branches and loops. Gaps, diagonal
  contact and other road types stop traversal. One revision-checked transaction
  removes the component, gives no refund, and preserves buildings and badges.
  Never accept a browser-supplied removal list or road-type override.
- Reviewed construction costs and blueprint thresholds are approximately 30%
  below the original proposal: round each reduced value up to a whole number,
  keeping zero at zero. Use the updated tables in the design; do not apply the
  reduction a second time. Keep source-game earning rates unchanged.
- Each child profile has its own town/storage. Use a Stardew Valley-like elevated
  front-facing square-grid view with Overview/Zoom in presets and bounded pinch zoom
  and the existing rounded pastel illustrated art, not pixel-art substitution.
- Reuse server-saved item Done state for blueprint milestones, preserving the
  existing learning requirements. Do not add a new town quiz gate or trust a
  browser-supplied learned boolean. Count each distinct item once permanently.
- Building movement costs `Math.ceil(originalMaterialCost / 2)` independently
  for every material, including stamina. Display whole numbers only. Use the
  original paid recipe saved by the server. Invalid/canceled/no-op moves spend
  nothing; moves preserve entity identity and do not count as new builds.
  Removal gives no refund; buildings/trees require confirmation, roads remove
  immediately when their dedicated removal icon is clicked.
- Use `rock` as the proposed canonical material for both rock and stone; do
  not create two independent balances without an explicit design change.
- Do not provision cloud resources, run production migrations, commit, push,
  merge, or publish before the user's required `confirmed` release instruction.

## Visual identity and asset production

- Terrain uses the avatar/frame style: flat pastel fills, smooth rounded/chubby
  elements, relatively thick warm-brown outlines, and very sparse detail. No
  watercolor, grain, realistic texture, glitter, pixel art, layered lighting,
  gradients, or dense grass/leaf patterns. Keep most ground visually plain;
  use strong outlines for props and shoreline. Show a faint square tile grid
  beneath buildings only while editing, so placement cells stay readable at
  every zoom level; hide the grid while viewing.
- Use the separate shoreline ribbon asset for land/water transitions with
  diagonal transitions and rounded connected bends. Rotate the ribbon along
  the contour so straight and diagonal asset sections join without gaps.
  Keep the authoritative protected river tile mask
  unchanged when smoothing its visual contour.
- Match existing rounded pastel kid avatars with flat friendly 2D illustration,
  warm brown outlines, soft fills, at most one flat shading patch, and readable silhouettes. Inspect `frontend/public/avatars/kids/capybara-calm.webp`
  and `frontend/public/avatar-frames/flowers.webp` before generating art.
- Generate raster town assets with ImageGen using inspected reference images.
  Use one consistent camera angle, scale, light direction, ground anchor, and
  outline weight for every building, tree, road, and material icon. Avoid
  realistic/glossy 3D, neon, emoji substitutes, and text baked into sprites.
- Check species anatomy in every animal pose. In the approved sitting/sleeping
  chicken, duck and goose sprites, legs and feet are fully tucked beneath the
  feathers and invisible; do not draw mammal-like paws or exposed orange foot
  lumps. Walking/perching poses retain their appropriate bird feet. When
  correcting a shared atlas, preserve unrelated sprites pixel-for-pixel and
  retain existing crop bounds unless code changes are authorized.
- Store art under `frontend/public/minigames/town-building/`. Record exact
  prompts, reference paths, footprints, anchors, measured crop rectangles, and
  alpha verification in an asset README. Preserve transparent sprite gutters
  and artwork proportions; verify assembled scenes in a real browser.
- Buildings and trees follow the flat, chubby avatar/frame style too. Measure
  isolated subject crops instead of assuming equal generated cells. Suppress
  terrain decorations throughout occupied footprints so placed sprites have
  clean ground underneath, including transparent portions of their silhouette.
- The confirmed default camera is elevated front-facing 2D with visible
  fronts/roofs. Directional installations retain that fixed camera and use
  direct front/side/rear views as specified below; never introduce a
  three-quarter yaw merely to reveal an entrance.
- Animate confirmed rewards from their source to storage; respect reduced
  motion. Pending requests must not display newly earned balances as confirmed.

### Universal Town asset generation lessons: footprint and directional views

These rules apply to all Town assets, on every map and event. The coop trials
and user-approved direct side profile are documented in
`art/town-building/COOP_DIRECTIONS.md`.

- Before generation, inspect the existing asset and establish its authoritative
  tile footprint, camera, facing convention and ground anchor. Put these
  constraints explicitly in every generation/edit prompt. Preserve the
  physical footprint in every orientation: a 2×2 building remains compact
  and square in world space, including attached access ramps. Do not turn its
  side into a long shed or compensate for wrong geometry by stretching art.
- Rectangular installations swap their ground dimensions on quarter turns.
  Use explicit height×width notation: the newly approved farmhouse restores
  the large three-section 2×4 front/rear and 4×2 left/right installation. Keep
  its existing server footprint and saved placements. The older 2×3 single-barn
  artwork approval is superseded by the 2026-10-27 user/child preference. Redraw
  rotated architecture; never rotate the bitmap or stretch its silhouette.
- Inventory the reference's distinct structural volumes before prompting.
  Preserve their count, relative heights and connections unless the user
  explicitly redesigns the structure. The 2026-10-27 approved farmhouse uses
  the OLD three-section front: preserve the low left wing and tall centre
  pixel-for-pixel; the low right roof shelters three hay rolls in a one-above-two
  pyramid, with no wall/window beneath it. Rear hay bay is left, with no rear
  door. Sides add a canopy to the preserved single-left source; right is its
  exact mirror. Follow FARMHOUSE_DIRECTIONS.md and its side companion. Account for
  physical occlusion without inventing floors or revealing hidden far roofs.
- Installation rotation means rotating the object on the ground plane under
  a fixed camera. Keep walls upright and gravity consistent. Left/right/top/
  bottom describe the entrance's direction in map/screen coordinates; top
  does not mean an aerial camera or an upside-down image.
- For direct cardinal building views, request **straight-on orthographic
  elevation, no three-quarter view, no yaw, no tilted/isometric perspective**.
  A direct side profile shows one side wall, not an angled front and side
  together. A gabled coop's side shows its roof slope face-on and its ramp
  edge-on; keep the ramp short and inside the installation's footprint.
- Respect occlusion. A side-facing doorway may be hidden edge-on; an entrance
  facing away is hidden behind the rear wall. Do not add a visible doorway to
  the wrong wall, expose a hidden ramp or tilt the camera just to show them.
  If the user requests a facing-direction cue, a half-open door leaf may
  project from the correct edge without changing the camera or adding a door
  to the near wall. The approved animal farm uses this cue on its left/right
  views; derive the opposite view from the approved one by horizontal mirroring.
- Resolve camera/footprint uncertainty with one representative view before
  generating the remaining directions. When the user is reviewing a trial,
  incorporate their feedback before launching dependent variants. Use the
  approved view as the reference for matching opposite directions; preserve
  its compact proportions, outline weight and sparse detail. Do not carry
  elongated or angled rejected drafts forward as references or final assets.
- Inspect each final silhouette, perspective, ramp, alpha and measured crop.
  Anchor at the object's actual ground contact, not the center of an
  asymmetric ramp-inclusive canvas. Save selected assets and exact prompts
  beside the existing shared artwork. Keep rejected trials outside the
  project. For asset-only requests, leave consuming code unchanged and state
  that runtime integration and assembled-scene verification remain pending.

## Seasons, weather, and test previews

- Follow the saved home city's local calendar and hemisphere for the four
  seasons. Reuse saved home city/country, not a Travel destination or device GPS.
  The server supplies season/weather; browsers never call providers directly.
- Reuse `useTownEnvironment` across owned Town/Lake maps. Poll the same-origin
  API only while the map document is visible and focused; pause friend-visit
  queries likewise. Never schedule provider refreshes while nobody needs them.
  The server shares ten-minute city/country forecast caches across profiles and
  respects MET's later Expires. Use shared `TownWeatherAttribution` on owned maps
  and visits, linking MET Norway and CC BY 4.0; identify this as an hourly forecast.
- Spring has light-green grass/leaves and flowers; summer has fuller deeper
  greens and species-specific fruit; autumn has thinner grass/canopies and
  yellow/gold deciduous foliage; winter has sparse grass and mostly bare
  deciduous trees. Evergreen/lemon trees retain species-appropriate foliage.
- Generate seamless seasonal tiles with consistent dimensions/edges, and tree
  variants with fixed roots/anchors/footprints. Keep sparse decoration stable
  across reloads and both zoom levels. Use separate surface and weather layers.
- Rain follows saved home-city weather. Winter may have stable occasional
  storybook snow days even without real snowfall. Local rain remains visible
  on those days over light snow cover. Actual snowfall uses snow precipitation.
  Distinguish snow cover from precipitation. Never imply stale/unavailable data
  is current weather. Seasons/weather are visual and cannot affect progression.
- Keep precipitation gentle and placement/roads/controls readable. Respect
  reduced motion with static surface treatments. Keep gesture zoom within the two presets.
- Show quick season/weather/snow-cover controls and Reset to live only with the
  server-derived preview capability. Server authorization requires `NODE_ENV=test`,
  an explicit enabled preview flag, authenticated admin, and profile ownership.
  Temporary previews cannot change real city/calendar or saved game data.
- Browser UAT must include every season, precipitation/snow-cover combinations,
  evergreen/deciduous trees, and the test toolbar at all required viewport sizes.

## Achievements

- Maintain the named `Town Building · Little Town` achievement group. Every
  definition needs a badge, explicit unlock condition, and obtainment difficulty.
- The admin achievement list must have an authenticated, admin-only migration
  button for this group. Install/update reviewed server-owned definitions
  idempotently, preserving earned badges, timestamps, and player progress.
  Never accept browser-supplied definitions.
- Definitions are catalog-only until authoritative construction/progress rules
  implement their unlocks. Do not present catalog definitions as earnable early.
- Follow `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`:
  illustrated text-free cream medallions, shared storybook frame, linework,
  palette, and detail level. Vary the central pictogram. Keep names, difficulty,
  and unlock conditions as adjacent UI text. Inspect the UFO badge reference.

## Viewport and verification

- In landscape, keep the combined navbar/status rows and their gap within 18%
  of viewport height (from 600px tall) and 128px on larger screens. Preserve
  48px navigation controls, scale artwork/text with the available height, and
  show material balances without the redundant items-learned statistic.
- Give the map no inner container padding and keep the map/panel bottom inset
  at 6px plus any larger safe area. Preserve square tiles and aspect ratio.
  Compact blueprint tiles stay at least 44px square; reserve at least 1.3 rows
  above the detail card and measure pagination from the actual CSS tile size.
  Keep one idle hint and avoid repeating it in the detail card and footer.

- First entry waits for both Town and home-environment data plus decoded scene
  and palette artwork. Show `TownLoading` until the complete first scene is
  ready; never display a guessed spring while fetching the real season. Failed
  data/artwork offers retry. Loader copy is localized and motion is optional.
- `useTownArtwork` owns a profile-session image cache through same-origin URLs
  in `townImageFiles.ts`; reuse decoded images across scene updates. Do not
  create Image objects or reset canvas dimensions on selection. Selection,
  placement, camera and tile actions update paint refs and invalidate cached
  drawing; they do not restart the renderer or animation timeline.
- Browser regression `tests/browser/town-loading.test.ts` delays environment,
  download and decode independently, checks failure/retry, and instruments
  backing-canvas resets across selecting/moving/canceling buildings.

- Render each map with one uniform tile scale (the original Town has 40
  columns by 20 rows; other maps use their declared dimensions). Tiles
  must remain square at every viewport and zoom; letterbox unused canvas space
  rather than stretching the map. Keep protected mountain artwork free of grid
  lines and arrange it on irregular foothills rather than a rectangular patch.

- Fit all current controls and the play area together on laptop and iPad
  landscape screens without vertical or horizontal page scrolling. Cover setup,
  storage, blueprint selection, placement, shortages, pause/help, success,
  failure, achievements, and return/replay prompts.
- Size to available viewport height/width, browser chrome, and safe areas.
  Preserve readable text, artwork proportions, and usable touch targets.
  Prompts cannot obscure controls. Keep grouped square blueprint buttons and
  their details visible together instead of hiding actions below a scrolling panel. Camera movement, if approved, stays inside the map.
- Verify complete flows in a real browser at 1366×768, 1024×768, and 1180×820;
  check every actionable button's bounds and absence of required scrolling.
- Run all frontend gates in `frontend/AGENTS.md` after code changes. Run server
  tests, typecheck, and build for reward/API changes. Use guarded disposable
  PostgreSQL for database tests, never production.

## Implementation map

- `TownBuildingPage.tsx`: grouped blueprints, selection, server commands,
  material shortages, weather previews and sequential road-glide commits.
- `scene/MapScene.tsx`: square canvas geometry, sprites, selection actions,
  pointer capture, weather and cached rendering for every map.
- `roadGlide.ts` / `roadArt.ts`: connected affordable strokes and all sixteen
  road-neighbor layouts; `shoreline.ts`: diagonal bank ribbon placement.
- `terrainAtlas.ts` / `structureAtlas.ts`: inspected crop metadata. Asset
  provenance and prompts live in `art/town-building/README.md`.
- `server/src/town-building/`: authoritative construction, rewards, drinks,
  local-calendar/weather rules, ownership validation and persistent storage.
- Browser regression: `node tests/browser/town-building.test.ts` from
  `frontend/`. Covers eleven flows including mouse/touch gliding, direct road
  removal, building confirmation, locked blueprints and seasonal tree rendering.

## Town names and animal neighbors

- Residential pets: small house 1, large house 2, Town Hall 3 slots. Draft each
  slot in the existing select → animal button → dialog flow and save the whole
  selection together. Allow empty slots and duplicate breeds. Server validates
  fixed pet IDs and host capacity with ownership, revision and transaction checks.
  Store selections in town JSON. Moving preserves pets; removal deletes them.
- Grant one free starter house once on initialization/backfill. Existing homes
  satisfy the grant; no cost, construction badge, or recreation after removal.
- Farmhouses also support two pigs. All day animals, including existing farm/
  coop/haven animals, return home at evening/night and sleep with dedicated
  resting artwork; white owls rest during daylight and wake at evening/night.
  Rain shelters pets; ducks/geese retain their existing daytime rain behavior.
- Generated walking/running/flying/perching/sleeping sheets live alongside the
  original animal art. Source crops are measured in `petAtlas.ts`, pose selection
  is in `animalSprite.ts`; exact prompts/provenance are in `PET_ASSETS.md`.
- Capybara nudges, head fruit, bush occlusion, seasonal visitors and river fish
  are decorative only, never rewards or client-reported achievement progress.
  Preserve the named Town Building achievement group and its admin-only,
  idempotent migration; never add cosmetic activity claims to award logic.
  Keep all future badge art consistent with the universal badge prompt above.
- Use home-city environment for schedules. Spring butterflies, summer great
  tits/swallow, autumn sparrows, winter robins and occasional night owls stay
  sparse; rain hides airborne visitors. Fish stay inside protected river cells.
  Respect reduced motion and verify pet dialogs without scrolling at all three
  required laptop/iPad landscape sizes.

### Surrounding scenery and social behavior

- Show exactly three decorative columns on each side and three rows above
  the original 40×20 town; end the bottom view at the mountain foot (3.2 rows).
  Fit the canvas to this 46×26.2 visible frame at overview and clamp both zoom
  levels to these scenery bounds. Add staggered mountains behind the top range
  and forest rows between the bottom trees and mountains, hiding bare gaps.
  The decorative walking world may extend beyond this visible crop. Always
  retain both zoom presets, bounded intermediate gesture scales and square tiles. Do not expand scenery into unused
  viewport space. Keep action buttons aligned with the centered canvas.
- Use generated pine/broadleaf forest strips (three seasonal 2×8 variants) and
  mountain strips. Preserve crop proportions and transparent silhouettes. Tall
  southern scenery overlaps northern neighbors; never clip art to rigid tile
  bands or rotate tree strips sideways. Stagger the side treeline naturally.
- Extend river banks/water through side scenery to the canvas edges. Construction
  remains inside the authoritative town grid: scenery cannot be placed, selected,
  moved or demolished. Pets use connected decorative paths and return home;
  visiting birds may use ordinary forest trees. No scenery entities persist.
- Grass tufts, flowers and shrubs cover only a passing ground animal's lower
  body. Installed roads suppress tile vegetation consistently in both cached
  ground and foreground passes; removing a road restores the stable hashed prop.
- Sheep flock closely; ducks/geese follow their leader's breadcrumb trail;
  cows/pigs/capybaras form loose groups, chickens forage with space, and rabbits
  use loose pairs. Dogs/cats/birds have independent breed/species activity rates;
  cats may nap. Existing evening/rain/reduced-motion rules still apply.
- Border Collies meet reachable farmhouse sheep flocks one at a time, escort
  recruited sheep to the next flock, wait for stragglers, then merge the next.
  Use a staggered paired formation with occasional decorative hearts. Each sheep
  retains its original host and returns there at bedtime/rain. Herd state is
  client-only, resets when appropriate, and never awards progress or badges.
- All house pets and pigs require front/back walking frames; parrots/owls also
  use front/back flight poses. Never mirror or slide a side sprite north/south.
- Capybaras may visit any reachable fruit-bearing tree: lemons all year, apples
  and cherries in summer/autumn. Drop the selected tree's corresponding fruit.
  Forest pines and ordinary broadleaf trees never produce fruit.

- Town names are two server-validated words, with ten adjective and ten noun
  options. Legacy towns use Sunny Meadow. Display the same saved name in the
  town header and the Playground activity card. Names are free to change.
- Farmhouse residents: two Dairy Cows by default, or two Highland Cows/sheep/pigs.
  Coops: four chickens by default, or four ducks/geese. Animal haven (2×3,
  unlocked initially, cost stamina 8 / wood 10 / rock 4): two capybaras by
  default, or four rabbits. One species per building, selected with an animal
  head button beside Move/Demolish. Switching and upkeep cost no materials.
- Store only the chosen species on each host; derive counts from the server
  rules. Existing hosts without a species use their default. Moving preserves
  residents; demolition removes that host's residents. Never accept client
  population counts, rewards, names outside the menus, or extra animal species.
- Animal motion is decorative client-side state, not progress. Use the measured
  transparent animal atlas, preserved proportions, deterministic host/animal
  identities, and connected cardinal paths around occupied footprints and
  mountains. Ducks/geese can swim in reachable nearby river cells. Geese may
  make short low flights. Capybaras walk slowly and sleep; rabbits hop quickly;
  ducks waddle and chickens step. If surrounded, animals rest on their porch.
- Keep animal drawing separate from cached terrain, never changing buildability.
  Motion respects reduced-motion settings, cancels frames on unmount, and keeps
  local paths near the host. No animal textures, frames or avatar backgrounds.
- Names/species live in existing town JSON; no SQL schema migration is required.

## Halloween visitors

- Spawn six original cute ghosts on October 30 and October 31 only.
  Determine eligibility from Environment.localDate, the server-derived saved
  home-city calendar. Do not use browser UTC/device dates, season overrides,
  learned counts, materials or progression for holiday eligibility.
- Ghosts are free flying helpers and never collide with construction or
  consume placement tiles, and never receive pointer events. Keep them in the map layer
  beneath controls. They float/tilt gently; reduced motion displays static ghosts.
- Use the generated transparent Halloween sprite sheet in the same simple flat
  pastel, warm thick-outline style. The supplied stock sheet is concept-only;
  no copied figures, watermark, lettering, frames or speech bubbles.

- Local Vite development has a temporary Preview Halloween toggle, guarded by
  import.meta.env.DEV in both control and renderer. It demonstrates a finite
  harvest of the actual ripe-pumpkin snapshot, resets only its drawing copy,
  and never modifies server dates/environment, persisted town or weather.
  Production builds do not expose the control or honor that preview flag.

- Selected buildings and trees glow around their actual sprite alpha silhouette,
  not the rectangular footprint. Keep destination footprints for placement
  previews only; preserve sprite proportions and transparent gutters.

## Follow-up animation, signs, and local lighting

- Capybara idle uses the original atlas; resting uses `animals-sleep.png` with
  the other existing animals. Walking uses the separate two-frame
  `capybara-walk.png` sheet. Never alternate standing and sleeping to simulate
  walking. Keep the torso height stable.
- Farm/coops/Animal haven and pet homes (including the starter/main house,
  large house and Town Hall) show a square wooden board on a short stake at the
  front-right of their existing footprint, beside the doorway. Never cover the
  entrance with a floating plaque. Use the generated signpost and head-only
  portraits; derive faces from server-selected animals/pet slots, never their
  wandering pose/state. Empty pet homes have no animal sign. Keep one, two or
  three selected pet heads inside the same square board without stretching them.
  Future functional civ buildings use the same freestanding wooden board with
  an icon for their purpose (groceries, bread, meat, vegetables, tools/smith,
  school, clinic/pharmacy). Signs have no baked-in words and do not consume extra map tiles.
  Use the empty `coop-neutral.png` artwork; no chicken is baked into duck/goose homes.
- The Farmhouse retains its authoritative 2×4 footprint and uses the wide
  `farmhouse-wide-v2.png` sprite in both map and palette. Its shared front key
  is `FARMHOUSE_ART.file`; turns use `farmhouse-left-v5`, `farmhouse-right-v5` and
  `farmhouse-back-v4` (plus their shelter `-empty` variants) through
  `SHELTER_VIEWS` in `shelterInterior.ts`, with measured alpha≥32 crops. Preserve its aspect
  ratio and measured crop in `structureAtlas.ts`; do not stretch the old square
  barn or change saved footprints to make the artwork fit.
- Civ people use huge rounded heads, small torsos, stick arms/legs and faces
  with only two eyes and a mouth (one visible eye in profile, none from back).
  Reference/generated sheets are in `public/minigames/town-building/civ-people/`.
  Treat them as assets awaiting runtime integration. Preserve measured source
  crops and foot anchors; generated rows/cells are not guaranteed equal.
  Use actual left/right/front/back walking frames, dedicated neutral idle,
  carrying, work and social poses. Do not substitute a work/carry pose for idle.
- The agreed civ cast adds a clinic/pharmacy with a doctor, using the existing
  Infirmary blueprint identity. Some buildings host one person, others two.
  Owner arrival, schedules, help requests, visitors and prosperity are planned
  behavior, not implemented progress. Do not infer or award them from animation.
- Planned visible prosperity is one large Seed → Sprout → Bud → Flower icon
  beside the saved Town name, with an accessible localized description. Keep
  the numeric value hidden. Growth stages can regress from town changes, never
  from time away; the flower never automatically resets to seed like a timer.
  `prosperity-growth-v1.png` is prepared art, not an authoritative town value.
- Home-city time of day is server-derived from its IANA zone; never the browser
  timezone. MET cloud cover/day-night symbols are bounded untrusted forecast inputs.
  Unknown weather remains unknown. Scene-wide color washes affect scenery,
  buildings, animals and weather, while UI controls remain readable.
- Test appearance buttons are visible only in local Vite DEV or when the server
  grants its authenticated test-environment preview capability. They override
  appearance only, without saved-state, materials, clock/date or provider calls.
  Reset to live restores the current home conditions. No production-user controls.

## Rain shelter and atmosphere

- Rain-sensitive cows, sheep, chickens, and rabbits walk along valid ground
  paths to close shoulder-to-shoulder spots by their own entrance, face home,
  then rest. Never teleport during normal motion. Capybaras return slowly and
  sleep near home. Ducks and geese keep roaming/swimming closer to home; no
  new goose flights start in rain. Departures stagger once rain clears.
- Front/back atlases provide two walking steps for each species. Use measured
  isolated alpha bounds in `directionalAtlas.ts`, preserve sprite proportions
  and foot anchors. Side sleeping capybara is not a walking frame.
- Halloween guests appear only on dry nights during October 30–31.
  Preview overrides the date only. For UAT use Night + Clear + Halloween
  preview. Fade guests out for rain, snow, or daylight.
- Cloud coverage adds slow chubby shadow masks over map terrain only, using
  multiply blending. No opaque clouds or UI shading. Reduced motion freezes
  shadows and calms animal movement.
- Asset provenance and generation briefs: public town `ANIMAL_ASSETS.md`.
  Pure regression tests cover rain routing, waterbird exceptions, departure,
  Halloween eligibility, shadow drift, crop bounds, and reduced motion.

## Vegetable patches and cattle dogs

- Reviewed extension: `docs/plans/2026-10-14-town-gardening.md`. Gardening is the
  scoped exception to the old cosmetic-only season/animal rules above. Other
  scenery, ambient wildlife, preview controls and source-game rewards stay
  cosmetic or retain their existing verification rules.
- Use server-owned 2×2 turfs with four plants of one crop type, eight seasonal
  seed IDs and
  roughly 300 seconds of active Town growth. Pause off-season and away; mature
  ripe plants wait for a manual turf Harvest action. Collect all ripe plants
  atomically for two stamina each, replanting only those harvested. A bite consumes that slot and immediately replants,
  with a 60-active-second patch cooldown. Never accept client growth/contacts.
- Chickens/ducks physically visiting grant a visible sprout/up-arrow buff,
  25% faster for 30 active seconds without stacking. They can pass under fences.
- Shared `server/src/town-building/animalWorld.ts` runs server contacts and browser
  independent browser animation. Garden heartbeats every five seconds are visible/focused-only,
  resume without catch-up, and share the session request guard. They check crops
  in an expiring server memory lease without database writes or position sync.
  Save verified growth with town actions or one keepalive pause/leave checkpoint.
  Revision changes invalidate stale leases; never trust browser progress. Appearance previews never supply garden progress seasons.
- Wooden fence costs one wood per tile only. Draw like roads, but never replace
  roads. Auto-wrap validates the entire 12-tile outer ring atomically, skipping
  installed fence tiles. Reject blocked cells/edges/shortages without spending.
  Animals enclosed during a new fence installation return to their home's
  reachable entrance when the changed layout reconstructs their paths.
- Chubby Australian Cattle Dog guides actual reachable dairy/Highland cow herds;
  Border Collie guides sheep. Only recruited leaders protect crops.
- First Harvest (one manual harvest, easy) and Garden Basket (20, medium) are
  earnable server-verified additions to the named Town Building group. Reuse its
  existing admin-only idempotent catalog migration, preserving all old awards.
  Follow the universal text-free illustrated collectible badge prompt; keep
  existing five badge indices stable and use `garden-badges.png` for the two new.
- New sprites and alpha crop measurements are in `GARDEN_ASSETS.md` and
  `gardenAtlas.ts`. No hand-drawn replacement for the generated dog/crop art.
  `GardenDialog.tsx` chooses one crop for the whole turf; the separate Harvest
  tile icon collects all ripe plants directly. Verify
  its complete flow, fence gestures and all 13 pets without scrolling at
  1366×768, 1024×768, 1180×820, including English/Vietnamese and reduced motion.

- All blueprint categories share one square button size at a given viewport and
  a 6px horizontal/vertical gap. Use fixed shared tracks for full-width Buildings
  and two-column secondary categories, preserving readable headings. Keep
  removal confirmation visible when the palette is taller. Verify tall desktop
  (1366×1240) as well as the required laptop/iPad sizes.
- Selecting a vegetable patch shows Wrap around with fence beside Move and
  Demolish in the tile action group, using the authored fence icon, localized
  label/wood cost and the same server-validated wrap command. Disable it for
  blocked cells, shortages, pending requests, or an already complete perimeter.
  Tile action groups size to their contents and clamp using that measured width.

- The blueprint sidebar has no placed-building function buttons. Clicking a
  placed object reveals Move, Choose crop and Harvest (vegetable patches), Wrap, animal choices
  and Remove beside its tile. Choose crop opens the seasonal crop menu; Harvest collects all ripe plants
  directly and is disabled when none are ripe. Building removal confirmation and Keep it stay in
  the same tile action group. The sidebar retains catalog selection and static
  information/resource guidance only. Harvest is an icon-only 50×50 tile button,
  matching its neighbors, with a localized tooltip and accessible name.

- Appearance previews retain a separate local animal timeline across garden
  heartbeats. Forced Morning/day/rain must remain active until Reset to live.
  All decorative movement is browser-owned, including outside previews.
  Do not restore animal positions from API responses or rebuild the renderer
  for crop-only updates. Interpolate fixed movement steps at display cadence.
  Keep crop paint data separate from static scenery/navigation dependencies.
  Server garden growth, seed eligibility, contacts and rewards always use live
  home conditions; the preview never changes progress. Browser regression must
  test a forced Morning through two live night heartbeats, then Reset.

## Portrait Town layout

- In portrait orientation, put the Town map above a full-width palette. Arrange
  Buildings, Trees, Roads, Gardening and Fences horizontally below it, with
  uniform square blueprint buttons and the existing six-pixel tile gaps.
  Wrap categories only when available width requires it; portrait tablets
  should fit all five categories across one row without horizontal scrolling.
- Give the map the available width and keep its aspect ratio. Keep construction
  details/costs compact below the palette, and show every active tile action,
  shortage link, crop chooser and keepsake control within the viewport.
- Test English/Vietnamese at 744×1024, 768×1024, 820×1180 and 834×1194; test
  placement, harvest, locked/shortage guidance, dialogs and appearance controls.
  Rotating to landscape restores the existing palette beside the Town map.

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

## Fixed scenery, tile interiors and person animation

- Ambient forest/mountain strips have world-owned coordinates and variants in
  `sceneryLayout.ts`. Never index variants or layer counts by viewport offsets.
  Keep the permanent stone approach outside the town at row 7, columns −3…−1,
  with a matching treeline opening. Render's road graph starts at row 7/column 0;
  do not invent access from a disconnected edge or change player road ownership.
- Small shop interiors use 4×5 square cells; larger two-worker rooms and the school
  use 6×5. Each working person occupies one clear 1×1 cell. Benches/racks use
  2×1 cells, cabinets/anvils/ovens use 1×1, and examination beds use 1×2.
  Keep all positions/footprints integral, non-overlapping and reachable from the
  door. CSS grid, floor and people must use the same measured cell size.
- Use the specialized `civ-interior-specialized-v3.png` atlas, retaining v2 only
  for school desks/chalkboard. Never reintroduce diagonal whole-room backgrounds
  or enlarge furniture to compensate for an oversized room. Preserve fixture art
  proportions. Floor tiles fill cells edge-to-edge: stone/concrete for smiths,
  hardwood for school/books and groceries, terracotta for bakery/produce, washable
  ceramic for clinic/butcher. Brief and measured crops are recorded with the art.
- Building return clocks have no text, digits or time labels. Both hands sweep
  counterclockwise with decreasing remaining time. Interpolate between unchanged
  home-clock minute samples without resetting on heartbeats. Unknown clocks do
  not invent a countdown; all clock animation remains decorative.
- `civInteriorLayout.ts` assigns each role to its own reachable fixture. Keep
  work actions appropriate to that role and stagger action/rest timing. Honor
  worker schedules and live reduced-motion changes. Decorative work never
  supplies server progress or achievements.
- Walking anchors follow measured silhouette/head centers, never uneven source
  cell centers. Preserve original PNGs and matching source/runtime JSON manifests.
  Consume remaining movement distance across cardinal waypoints; no snapping,
  per-frame position rounding or lost travel at tile boundaries.
- Verify scenery stability through continuous zoom/edge pans, every shop interior
  and all controls at 1366×768, 1024×768 and 1180×820. Regression entry points:
  `tests/browser/town-civ-polish.test.ts`, `tests/town-civ-interiors.test.ts`.

## Sleep indicators and sheep-counting dream

- Show one drifting, growing/fading zzZ stream per sleeping home/species group,
  using only members whose browser animal simulation says `sleeping`. Do not
  mark awake rain-sheltering animals as asleep. Group anchors follow the sleepers;
  no simulation, saved progress or reward changes come from the effect.
- At overview (1×), sleeping sheep show zzZ like other herds. As continuous zoom
  passes 1.15×–1.65×, crossfade sheep zzZ into a cloud-shaped thought bubble;
  close views show the bubble instead of duplicate letters. Zooming out reverses
  the transition. Other species always retain zzZ. Keep overlays in map bounds,
  beneath controls, and skip offscreen groups.
- The dream uses `sheep-dream-jump-v1.png`: six dedicated crouch/takeoff/tucked/
  stretched/descent/landing poses, measured crops and body anchors in
  `sheepDreamAtlas.ts`. Never slide a neutral standing/walking sheep as the jump.
  Keep its fixed source scale while changing poses and following the flight arc.
  Crouch and landing remain planted. The cloud uses a scalloped closed outline
  with thought dots, not a rounded rectangle. Render the entire dream group at
  50% of its original width and height, scaling the sheep, fence, thought dots
  and stroke widths together so the original proportions remain intact.
- Preserve original generated alpha pixels and the same-origin private artwork
  catalog. Preload the jump sheet only for actual sheep homes. Source prompt and
  manifest sit beside the PNG. No upload or publication without confirmed.
- Reduced motion keeps readable static zzZ or a static airborne dream pose,
  depending on zoom. Stop rendering on unmount and retain animation across ordinary
  paints/heartbeats. Regression files: `tests/town-animal-sleep.test.ts`,
  `tests/browser/town-sleep.test.ts` at all three required landscape sizes.

## Halloween pumpkin helpers (October 2026)

- Kid-built `halloween-lantern` is a separate 1×1 blocking construction in the
  Roads group, unlocked by default on home-calendar October 30–31. It costs one
  wood and one harvested pumpkin from shared storage. Reuse `lanternLayout.ts`
  and `lanternRender.ts` with the existing post/lantern atlases on every map;
  its two facings mirror only that assembly. Both facings share the event's
  cached warm night glow, masked by nearer building/tree alpha; built posts
  stay in the building layer and are never repainted by the glow layer.
  It can stand on grass or any free
  bridge deck; nests and other constructions cannot overlap it. Move/remove the
  lantern before moving/removing its supporting bridge. The ordinary saved-recipe
  move rule includes its pumpkin. November cleanup removes it without refunds.
  It is not a ghost delivery and does not increment Ghostly Sky. Existing
  Halloween achievements and Parent/Admin reporting retain their verified rules.

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
- More real pumpkins create more lanterns. Clear grass beside buildings, roads
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

- `remove-line` (roads and fences) accepts only a selected line entity ID through the
  existing authenticated revision-checked Town action endpoint. Render derives
  the full cardinal component of that fence type, including branches/corners
  and loops. Gaps, diagonal contacts, roads and buildings stop traversal.
- Retain single-fence removal. Offer both only in editing mode; bulk removal
  increments one revision, gives no refund, preserves crops and earned badges,
  and clears selection. Never accept a browser-supplied deletion list or type.
- Test strict payload/auth/ownership, stale concurrent requests and preserved
  unrelated entities, plus English/Vietnamese button visibility and bounds at
  the required laptop/iPad viewports.

## NPC errands and evening departures

- Decorative outside visitors roam during home-city daytime (08:00–20:00,
  ending at evening/night). They walk back to the west gate and leave; they
  return the next morning. Unknown clocks do not invent opening hours.
- Worker schedules retain each business's own server-owned opening hours.
  When a work/rest return begins, replace stale outward errand routes immediately.
  Reduced motion skips the journey and applies the indoor/hidden state; it must
  not freeze workers or departing guests outdoors indefinitely.
- Never select the actor's current tile as a new destination. Try reachable
  open-shop entrances, then a different reachable nearby tile. A zero-length or
  unreachable shop path must not trap the actor in a repeated idle loop.
  Genuine blocked returns show the existing call pose and retry after a pause.
- Regressions: `tests/town-civ-world.test.ts` and
  `tests/browser/town-npc-schedule.test.ts` (three landscape viewports).
  Decorative schedules and routes do not write progress or change server help,
  prosperity, achievements, business hours, or move-in requirements.

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

## Friend river sharing and reports

- River baskets and the friend takeaway raft render inside the common MapScene
  overlay slot with its canvas ref. Measure the actual fitted canvas bounds,
  including its centering offset, and clip the river layer to those bounds.
  Never project against the larger stage. Recheck owner/visitor mode changes,
  resize, zoom and pan. Crop cost artwork uses the same `town-material-icon`
  dimensions as construction materials, including in the building book.

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

## Map overview and harvest-all UI contract (2026-11-02)

- The idle right panel is shared by Town and Lake. `TownMapSummary` reads only saved state and
  keeps Roads and Bridges as separate rows; it also reports animal houses from the shared
  `BLUEPRINTS` animal-host rules and fish houses from Lake nursery/fish-home rafts. Omit zero rows,
  show one localized empty status when all rows are zero, and keep each row's localized label in
  both `aria-label` and `title`. Do not add divider lines or counts to icon artwork.
- `TownHarvestAll` reads the server projection `harvestReady` and never infers readiness or accepts
  client product data. It sends `{type:'harvest-all', category, mapId}` through the existing action
  path with its current revision, uses 48px controls, shows the reduced-motion-safe pending flight,
  and renders actual `HarvestReceipt.products` rows plus `notReplanted`/`notCollected` notes.
- Only a newly committed receipt with `duplicate:false` and a positive server reward may feed the
  stable receipt ID and reward to `TownRewardBar`; reloads, duplicate/zero/failure/visit states do
  not replay reward animation. Storage-full, empty and stale errors stay localized and stale
  responses refetch the page.

## Barns, Town Storage and animal moments (2026-10-27)

- Plan: `docs/plans/2026-10-27-animal-interactions.md`. Art provenance and exact
  prompts: `art/town-building/ANIMAL_INTERACTIONS_ASSETS.md`.
- Server-owned: barn milk/wool/yarn (`barn.ts`), feeding with stored favourite crops,
  the shared storage, its limits and 3-day spoiling (`storage.ts`). The browser
  only projects counts (`barnWaiting`) and never credits anything.
- Town Storage is the only way into the storage dialog (`BarnUi.tsx`); every
  copy on every map opens the same store. Milk, wool and russet yarn stickers reuse the egg
  sticker treatment above the farmhouse roof.
- `animalMoments.ts` is the one place for decorative animal moments: babies
  (chicks, ducklings, spring lambs), naps and snuggles, goose honks, gate queues
  and gate-holding dogs, grazing tufts, bug pecks, hide-and-seek in tall ripe
  corn/pumpkin (tap to pop out), fruit sharing, duck naps on floating gardens,
  seasonal moments, cows watching fish from bridges (people wait), rain dashes
  and huddles, the owl's night watch, fleece by barn wool. It nudges live
  residents and dresses their samples (`AnimalShow`: look, scale, lift, peek);
  `animalRender` draws them, `momentRender` draws the ground and overlay. It is
  never saved, sent or rewarded, and does nothing under reduced motion.
- Hollow Animal Haven and barn shelter (`shelterInterior.ts`, plan `docs/plans/2026-10-27-hollow-animal-haven.md`):
  one blueprint/direction table drives art, slots, clipping and preloading for havens
  and farmhouses. Inside residents are clipped to the interior mask and the hollow
  frame is cut out of them, so posts and the porch lip always stay in front. Windows
  show full-size residents' tops only (ears, upper back), never miniatures. Havens always
  show their interior; a barn shows its door-open interior only while a resident rests
  at home (`shelteredHostIds`, computed per frame in `MapScene` and part of the static key).
- The Halloween notice has an "Okay" button; dismissal is remembered per year and
  phase in browser storage (grow reminder vs lantern notice), never on the server.

## Pig and Highland habits (2026-10-27)

- Plan: `docs/plans/2026-10-27-pig-and-highland-habits.md`. Extend the common
  modules for all maps: `animalMoments` owns purely decorative pig mushroom
  trips, `animalRender` uses its existing head/carry anchor, `momentRender`
  draws mushrooms and saved crop/grass poop and seasonal flower bushes.
- Pig trips are per farmhouse every 150–270 active display seconds when a
  forest/tree edge is reachable. Hide 4 seconds, return via real navigation,
  leave a mushroom for 60 seconds (fade last 10), hearts near pigs. Cancel on
  rest/rain, lost reachability/host, map change and reduced motion. Never send,
  save or reward these moments. Decorative `grass` is not a server bush.
- Server owns droppings, bushes, growth/cooldowns and grazing. Render confirmed
  state only; flies stay still with reduced motion. Nibbles are cosmetic.
- Highland barns reuse the single production/Collect/roof-sticker path: yarn
  1/12h, cap 6, fed double speed. `BarnUi` renders the non-spoiling yarn storage
  item independently from sheep wool, using `highland-yarn-v1` in all three UI
  locations and authored Vietnamese strings. `townReward.ts` derives cosmetic
  milk/yarn/wool feedback only from new successful server responses, using
  `TownRewardBar` and stable map/revision keys. Friend props redact activity time.
  Measured crops are in `momentAtlas`;
  provenance and remaining art defects in `ANIMAL_INTERACTIONS_ASSETS.md`.

## Vegetable shop interior trade

- The vegetable shop is traded only from the shared `CivInterior`: selecting the
  building and using `Visit inside` opens the existing interior beside the
  constants-backed vegetable rack. Do not restore a detail-card trade button or
  a standalone trade dialog; visits/read-only views must not gain trade access.
- `vegetableShopArt.ts` owns the approved rack path, dimensions and measured
  crate fractions. Crop buttons use the garden `crop-growth` ripe sprites, and
  every new season, crop, payment or reaction icon uses `.town-icon` with an
  explicit `--xs`/`--sm`/`--md`/`--lg`/`--xl` size. Landscape must fit the
  interior/rack columns at 1366×768, 1024×768 and 1180×820; portrait may use
  internal scrolling and stacks the columns.
- Quotes, payments, purchase confirmation, error states, receipt gating and
  reward flights remain server-authoritative. Never display hidden price/value
  units or calculate rewards in the browser. Linh's bounce and crop bubble are
  cosmetic, timer-cleaned and reduced-motion safe; only a new non-duplicate
  receipt may trigger the shared `TownRewardBar` flight.

## Xmas snow sculptures (2026-11-03)

- Follow `docs/plans/2026-11-03-xmas-snow-sculptures.md`. Ten 1x1 snow sculptures
  (`snow-snowman`, `snow-rabbit`, `snow-owl`, `snow-penguin`, `snow-fox`,
  `snow-lamb`, `snow-duckling`, `snow-bear`, `snow-tree`, `snow-angel`) live in
  the Roads/decorations (`lines`) group in `TownBuildingPalette`.
- Artwork is at `public/minigames/town-building/xmas/snow-<name>.png`. Nine
  sculptures are 1024×256 four-frame sheets (front, right 3/4, back, left 3/4 at
  256×256 each); `snow-tree` is a single static 256×256 frame and does not rotate
  in the UI (`R` and rotate button are disabled). All sculptures anchor to the 1×1
  tile ground baseline with selection outlines and occluder passes.
- Palette entries display front-facing icons via `.town-icon` and `.town-sprite`,
  with localized child-friendly descriptions and cost cards showing 5 stamina
  plus materials, crops, wool, yarn, and fish.
- Outside the event window (December 20 – January 6 on server home-city calendar),
  sculpture entries are disabled with friendly error message: "Snow sculptures are
  only available from December 20 to January 6."
- The DEV-only `Preview Xmas` / `Stop Xmas` toggle (`aria-label="Preview Xmas sculptures"`)
  in `TownBuildingPage` turns on winter snow scenery and treats the client window as open.
  A prominent warning notes that building in preview writes real sculptures to the server
  (allowed only when `NODE_ENV=test` and `TOWN_ENVIRONMENT_PREVIEW_ENABLED=true`).
  Preview alone never grants rewards or modifies persisted state.
- Tapping a placed sculpture plays small cosmetic sparkles, pauses nearby animals
  so they look towards it, and shows a brief `HeartEmote` above resident NPCs. All
  reactions are strictly cosmetic, honor `prefers-reduced-motion`, and clear timers
  on unmount.

- The event preview buttons (Preview Halloween, Preview Xmas) are owned by the shared `MapWorkspace`, so every map (Town, Lake and future
  maps) shows the same test toolbar entries with the same behavior. Never re-create them in a map page; a page may only add its own
  extra buttons through `chrome.testControls`, which render after the common ones.

- Town scenery is baked, not drawn from strips at runtime: `frontend/scripts/bake-town-ring.mjs` (run with
  `node --import ../server/node_modules/tsx/dist/loader.mjs scripts/bake-town-ring.mjs`) composites the existing forest and mountain
  strips into `public/minigames/town-building/town-ring/<season>-back|front.webp` and writes `townRing.generated.ts`. Strips are
  placed whole; a verify-and-fix loop nudges or drops any strip that would put an opaque pixel in the town grid or in the river or
  arrival-road gaps and re-measures the composite, so the bake fails instead of shipping clipped trees. Re-run it (and
  `npm run artwork:catalog --prefix frontend`) whenever the strip art, atlas or gap positions change. The old strip drawing remains
  only as a fallback while the ring images load, and for the Lake map until it gets its own ring.

## Multi-size WebP art (Town canvas)

- Canvas art is served as three pre-scaled lossy WebP tiers per image: `name@s.webp`, `@m`, `@l` (plan:
  `docs/plans/2026-11-03-town-webp-sizes.md`). Generate them with `node scripts/convert-town-art.mjs <key> --px-per-tile N`
  (or `--plan file.json`); the script updates `townArtManifest.json`. Never upscale; a tier equal to a larger one is aliased.
- The tier comes from device pixels per tile (`townArtTier.ts`: small <= 48, medium <= 96, large > 96) reported by `MapScene`
  through `townArtStore.ts`. It starts small and only upgrades. Atlas rectangles stay in base-pixel coordinates; `townArtScale.ts`
  rescales 9-argument `drawImage` source rectangles for registered variants. Offscreen buffers must size from `artBaseSize(image)`.
- New canvas art: add the PNG, convert it with the script, and regenerate the artwork catalog. Art drawn by DOM/CSS/own loaders
  (Lake, vegetable shop, badges, friend baskets) is still PNG until rewired through `townImageUrl`.
- Originals live in `art/town-building/` (see its `INDEX.md`), not in `public/`; `window.__townArtTier` (dev builds) shows the tier.
