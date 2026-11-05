# Shared Town Map Guide

Follow the common [Town guide](../AGENTS.md), [feature guide](../../AGENTS.md),
frontend/repository guides and the matching server map guide. These instructions
govern the implemented multi-map boundary.

## Questions and map ownership

- Number every brainstorming/clarification question, including tool prompts,
  with unique numbers per batch and short lettered choices where useful.
- Each new map lives in `maps/<map-id>/` with its own `AGENTS.md` linking this
  guide and the common Town guide. That guide records only the map's unique
  terrain layout, unlocks, habitats, behavior, art and verification needs.
- Lake-specific scenes, CSS, sprites/crop adapters, panels and fish animation
  live in `maps/lake/`. Do not grow a single scene full of map-ID conditionals.
- Keep reusable navigation, storage, buildings, art loading, camera/gesture
  helpers, environment and reward presentation shared. Extract existing code
  only when required by a runnable map slice; avoid a broad unrelated move.
- Reuse the common building/content renderer and animal world/renderer for
  every existing entity. A new map supplies terrain/habitat and optional extra
  steering; it must not implement its own coop/chicken/animal/NPC presentation.
- Route all Town maps through one persistent `TownMapScreen` and `TownMapHost`.
  Map changes replace the controller/scene content inside this mounted screen.
  Never add independent page routes, page chrome, global loading screens or
  map-specific root CSS that remounts/resizes/restyles the screen on navigation.
- Keep the outer `TownRelaxingView` mounted during map travel. Reuse its quiet
  presentation and native fullscreen owner across maps and visits; map adapters
  must not create their own fullscreen lifecycle or bring back hidden HUD layers.
- `TownMapLayout` publishes a map adapter and portals scene/palette/details into
  fixed host slots. The host owns the navbar, material strip, canvas container,
  edit/grid state, footprint buttons/keyboard handling, palette presentation,
  map controls, weather information, inspector and appearance previews.
- Both maps must use the same dimensions, colors, background colors, fonts and
  responsive rules in viewing and editing modes. Preserve the actual host DOM
  elements across river navigation. Only map data, building catalogs, weather
  and animal behavior, unlock rules and level advancement vary by map.
- Use `TownBuildingPalette` for every catalog. The shared category/pagination UI
  keeps all current construction controls inside the viewport. Map adapters
  supply item artwork, identity, selection and server-backed unlock feedback.

## Shared map contract

- Use stable server-owned map IDs. Legacy entities without a map ID belong to
  the original Town. A map owns terrain, depth, protected passages, entry points
  and scene-specific entity presentation. Generic construction accepts a map
  context instead of embedding original Town dimensions or terrain checks.
- Separate shared building identity from placement: an entity has one map and
  one footprint. Cross-map move previews may show a destination ghost, but only
  the server's committed state places the actual building.
- Preserve per-map camera/viewing state and shared editing conventions. Clear
  unfinished selection/strokes on navigation; checkpoint and pause simulation
  for the departing map. No invisible/offline lake growth.
- Keep one shared child-owned storage and authoritative achievement projection.

## Shared idle harvest controls (2026-11-02)

Town and Lake use the same `MapWorkspace` idle panel. Keep the read-only overview above the
controls, show only server-projected `harvestReady` categories, and send the current-revision
`harvest-all` command through the owning page API. Controls must remain at least 44–48px and fit
without scrolling at the required landscape sizes. Receipt rows come from actual products; pending
flight and reward feedback are cosmetic, reduced-motion safe, cleaned up on unmount, and replay only
for a new non-duplicate receipt with a positive server reward.
  Map definitions are not extra accounts, databases, balances or reward APIs.
- Preserve Town's shared storage strip immediately below the map header on every
  map. Show every Town material balance, without an items-learned count, in the same
  order and presentation; map-only inventory summaries must not replace it.
- Reuse the home-city environment for every map. Interface language and map
  navigation must not alter the learning language, saved location or live clock.

## Shared UX, art and verification

- The [UI consistency rules in the common Town guide](../AGENTS.md#ui-consistency-across-all-town-maps)
  govern all maps, including building action placement, icon controls, editing
  grid/nudges, dialog lifecycle, shared terrain/scenery, exits and content signs.
  Keep that section authoritative; map guides add only their unique behavior.
- Preserve child Back, Badges and language controls, keyboard access, touch
  navigation, reduced motion and the Town's rounded pastel illustration style.
- Each map must have a named achievement group with badge, clear condition and
  difficulty for every achievement. Reuse the one authenticated admin migration
  and both Parent/Admin reports. Label definitions not yet backed by verified
  progress as catalog-only, not earnable.
- Badge artwork follows
  `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`:
  text-free illustrated medallions with the common frame, linework and palette;
  names, conditions and difficulty remain outside the icon.
- Use `TownRewardBar` for new server-confirmed resource receipts, centered in
  the current scene then flying to visible storage. Deduplicate by stable
  receipt/revision; reads, reloads, retries and zero rewards never replay it.
- All current controls and scene actions must fit without scrolling at
  1366×768, 1024×768 and 1180×820. Check every state, control bounds, both
  interface languages, console errors and relevant requests using the required
  isolated headless agent-browser workflow. Evidence stays local under `/tmp`.
- Continue required automated frontend/server suites. No commit, push, publish,
  cloud resources or production-data changes before the user's `confirmed`.
