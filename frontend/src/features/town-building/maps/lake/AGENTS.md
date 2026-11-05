# Town Lake Implementation Guide

Follow the [shared Town map rules](../AGENTS.md) and
[Town common guide](../../AGENTS.md). The design source is
`docs/plans/2026-10-23-town-lake.md`; matching authoritative rules live in
`server/src/town-building/maps/lake/AGENTS.md`. This directory is reserved for
the second map and owns its map controller, scene, building data, land renderer
and artwork. The persistent shared Town screen owns all page layout and chrome.

## Questions and unique map rules

- Number every brainstorming/clarification question, including tool prompts;
  keep numbers unique per batch and preserve pending numbers. Use concise
  numbered lists and short lettered options when useful.
- Lake unlock is permanent once Flower prosperity is server-verified. Town's
  right-river arrow jumps every five visible seconds; reduced motion stays calm.
  Return through the incoming left river. No onward map at the outgoing river.
- Approximately 15% of the active map is left land, 50% central deep water and
  35% shallow water. Preserve both river passages. Depth and shore requirements
  belong to the selected raft and species, with specific invalid-place feedback.
- Surround the active grid with Town's non-buildable forest/mountain strip
  layouts and seasonal artwork. Preserve both river openings through the frame.
  Share grass colors/details, water ripples and rounded shoreline ribbon crops.
  Clicking the horizontally flipped Town arrow in the incoming river returns
  to Town; it follows the camera and honors reduced motion.
- Grids and tile-nudge controls appear only in editing mode on both Town maps.
  Cache the lake terrain by camera/layout/season/editing state; selection and
  fish motion do not rebuild terrain. Keep nudges, readout and actions in view.
- Any existing building that fits valid lake land can be placed/transferred.
  Preserve its identity, original costs, inhabitants, crops and business state.
  Reuse map-aware shared building/animal/gardening/business behavior.
- The small center island is buildable: two columns across by three rows, with its
  location owned by the server's `LAKE_ISLAND` definition. Keep it consistent
  with shoreline art, land placement, fish paths and habitat checks.
- After a newly committed complete fish/plant harvest, offer a localized modal
  to keep the same type or change it. Keeping fish stocks a fresh free batch;
  keeping plants continues their existing regrowth. Change opens the usual
  habitat/unlock-aware chooser. Reads, failures and partial fish harvests never
  open the prompt. Deduplicate by the successful server receipt; pause while
  choosing and keep every control visible at all required landscape sizes.
- Selecting a different type in a stocked nursery queues it on the server.
  Keep current residents and display the pending next-batch type. The last
  harvest automatically stocks that type and skips an already-answered prompt.
  Friendly companion rafts retain their one-species rule.
- Preserve far-to-near bottom scenery order: forest strip, closer forest strip,
  then mountains, exactly as Town. Outlet rocks are scenery blocking the next
  map; remove them when that destination becomes available.
- No manual pause button. Pause/checkpoint for hidden views and modals and
  resume on return. Keep an explicit Sync recovery for failed requests.
- The shared host places the Town storage strip below its persistent navbar.
  Lake has no independent header, footer inventory or storage link. Fly resource
  receipts to the same visible storage strip through the shared reward layer.
- Put tile nudges on the right. Hardware arrows and the four controls use one
  handler; never hijack arrow keys in inputs, selects or open dialogs.
- Use Town's icon buttons for construction, harvesting, moving and removing;
  retain localized accessible names, tooltips and usable touch targets.
- Put every selected-building action beneath its footprint in the scene,
  following camera pan/zoom. Keep the sidebar informational. Fish/plant chooser
  icons open a dialog; build/cancel, move/remove, harvest and inhabitants use
  the map overlay. Clamp controls inside the canvas, avoid the river arrow,
  and preserve 44px targets and localized accessible labels.
- Floating gardens use the six-pocket frame and measured plant anchors in
  `gardenArt.ts`, with independent growth overlays. Do not reuse the nursery
  cage for an empty garden. Fish/plant identities appear on the existing Town
  wooden sign board, not as text baked into artwork.

## Rafts, fish and progression

- Three categories: contained nursery, open friendly home, floating garden.
  Raft art adapts to real-inspired habitat and species; do not use an enclosed
  net for a fish meant to roam. Keep shadows visibly underwater, with occasional
  species-appropriate surface feeding/jumps/play and calmer resting behavior.
- Separate raft and species unlocks. Species options use verified Fishing
  Friends catches; unlocked stocking is free and never spends the fish bucket.
- Fish home raft unlocks after 100 individual fish harvested from nursery rafts,
  not 100 harvest clicks, fishing catches or plant harvests. It must also be
  built and have compatible free slots before receiving harvested fish.
- Each fish raft holds 16 small-species fish or four big-species fish. Size class
  belongs to the species, not its growth pose. Never overflow or delete fish.
- Harvest removes mature fish from nursery slots. Send to a compatible built
  fish home raft when requested/available, otherwise retain in the lake reserve.
  This works before the 100-fish unlock. Nursery residents do not stay behind
  and produce extra copies. Show each server-confirmed destination clearly.
- Demolition can release remaining fish or plants directly. Animate only a
  newly committed deletion, then let the contents fade/leave; do not create
  permanent wild residents, harvest receipts or reserve copies. Duplicate
  responses and reads never replay the effect. Respect reduced motion.
  Moving a stocked raft carries its fish/plants and growth with it.
- Growth occurs only during active lake viewing. Weather and resting schedules
  change behavior without slowing/pausing growth. The lake development indicator
  is fish egg → small fish → cute chubby fish; distinguish this from fish age.

## Insects, clock and weather

- Insect raiser/attractor: standalone one-by-one shore or floating building.
  Clicking either shows a circular feeding range aligned with map camera/zoom.
- The server uses each fish raft center and any source within radius four to
  apply 1.2× fish growth, maximum +20% total. Raft location keeps eligibility
  authoritative without server fish paths. Overlap never stacks, changes payout
  or affects plant growth speed/capacity. Only floating insect raisers damage
  plant rafts: a 25% decision per growth cycle withers 1–2 distinct plants out
  of six. Shore raisers and legacy attachments never damage raft plants.
  Render the shared withered sprite in the affected pockets until Harvest.
  Each healthy plant gives its normal full 4 stamina; withered plants give
  nothing. Harvest replants all six and resets the verified duck bonus.
  Duck and insect silhouette stickers can coexist over the upper plant row;
  use thick cream borders and no circular disks.
- Read the exact shared `town-environment` query/cache and Town environment API;
  never derive a separate lake forecast or clock. Show the same local time,
  season, cloud cover, rain/snow and snow-cover status as Town. Reuse its
  cloud-shadow, precipitation, snow and lighting rules on the lake canvas.
  Author per-fish habitat, depth, food, shelter and morning/afternoon/night
  activity. Weather changes shelter, movement and surfacing frequency. Keep
  schedules/weather independent of growth speed and avoid requiring night visits.
- Keep preview appearance cosmetic. Missing live clock/weather must not be
  represented as known sunny/daytime conditions. No offline growth or starvation.

## Achievements, artwork and verification

- Maintain the named Lake Friends group with server-verified conditions,
  difficulty and a badge per achievement, including the 100-fish milestone.
  Include the complete group in lake/universal badges and both Parent/Admin
  reports through shared projections and the single admin catalog migration.
- Catalog definitions alone are not earnable; label unsupported progress as
  unavailable. Preserve all existing Town/Fishing awards and catch counts.
- Follow the universal text-free medallion prompt at
  `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md` and
  Town's private artwork pipeline. Preserve sprite aspect ratios and gutters;
  record prompts, references, anchors, measured crops and alpha checks.
- Use the shared reward bar only for newly committed stamina receipts. Check
  locked/unlocked, nursery/free stocking/growth/harvest, reserve, friendly-raft
  unlock/build/transfer, all depths, weather/time/rest states, circles and
  overlapping bonuses at 1366×768, 1024×768 and 1180×820. No scrolling or covered
  actions. Test English/Vietnamese, reduced motion and keyboard/touch controls.
- Follow the shared agent-browser and automated gate requirements. Generated
  evidence remains local; no commit, push or publish without `confirmed`.

- Preserve the saved `insect-raiser` ID for Shore insect raiser compatibility.
  The 1×1 Floating insect raiser unlocks at 16 lifetime nursery fish harvested,
  accepts shallow/deep water and shares the four-tile feeding range and
  non-stacking +20% bonus. Do not offer or accept new fish-raft attachments;
  previously saved attachments remain compatible with old progress only.
- Lake names use one approved adjective and the server-owned child name:
  `Kidname's adjective lake`. Edit through the shared header rename control.
- Deep water has stable irregular zigzag borders with varying bend spacing.
  Use the authoritative terrain spans to paint it; it stays one connected body
  around the island and covers approximately half of the active map.
- Render at most six representative fish per raft, with spaced nursery swim
  lanes so shadows remain readable. This visual budget never changes real
  capacity (16 small or four big fish), growth, collection or reserve counts.
- Round depth shelves with the shared Town shoreline geometry and a subtle
  underwater transition ribbon. Preserve the authoritative habitat tiles;
  visual rounding must not change placement, shore access or protected rivers.

- All fish animation clocks and swim paths are browser-owned, frame-driven,
  smooth across server updates, and frozen cleanly for hidden/paused/reduced
  motion. Server updates record authoritative gameplay state and fixed-location
  feeding; they never calculate fish positions or render animation frames.

- Do not poll, heartbeat or persist fish/plant growth on a timer. The browser
  animates visible growth locally. Checkpoint active elapsed time on a real map
  pause/leave and when validating a child gameplay action; server time plus the
  active viewing session remains authoritative. Never send animation frames or
  elapsed time from the client.
