# Town Lake Server Implementation Guide

Follow the [shared Town map rules](../AGENTS.md),
[common Town server guide](../../AGENTS.md), and the lake presentation guide at
`frontend/src/features/town-building/maps/lake/AGENTS.md`. The design is
`docs/plans/2026-10-23-town-lake.md`. This directory owns the second map's rules;
runtime is implemented in this directory.

- Number every brainstorming/clarification question, including tool prompts,
  with unique batch numbers and concise lettered options when useful.
- Persist the lake unlock once Flower prosperity is verified. Removing/moving
  buildings cannot revoke it. Qualify existing Flower towns safely, without
  inventing past achievements for states without evidence.
- Own lake terrain/depth/protected river passages, habitat compatibility,
  shore access, fish/plant catalogs, growth, insect effects and achievements.
  Share storage, construction, authentication and environment services.
- `LAKE_ISLAND` owns the buildable two-column/three-row center island. Its six
  tiles replace deep water; water habitats cannot overlap it. Existing land
  buildings use ordinary map-scoped costs/placement when moved onto the island.
- `set-next-fish` queues only a verified unlocked, compatible nursery species.
  Current fish remain unchanged. Selecting the current type cancels the queue.
  Moves must fit both current and queued habitats. Partial harvests retain the
  queue; the final harvest atomically reserves/rewards only the old fish and
  stocks new identities of the selected species at zero growth, bounded by
  species and lake capacity. New stock gives no harvest counts or rewards.
  Persist through reloads and retain revision/generation concurrency guards.
- Any existing blueprint fitting valid lake land remains eligible under its
  normal rules. Rafts separately validate complete footprints, required depth,
  shore access and species suitability. Mid-lake cages may require clearance;
  do not confuse cage depth with a fish's natural feeding depth preference.
- Fish-species unlocks derive from verified Fishing Friends catches. Free
  stocking after unlocking must not debit/increment fishing inventory or
  mutate catch totals, points, graduation or existing awards.
- Fish capacity is 16 small-species or four big-species residents per raft,
  independent of growth pose. Enforce on stocking, transfer and species change.
- New lake blueprints target about +20% average material units over original
  Town buildings/gardens, excluding stamina, trees, roads and fences. Current
  baseline is 25.67 and lake average 31 (+20.8%). Existing Town blueprints
  retain their recipes on shore.
- Harvest only mature nursery fish, remove those residents and increment a
  monotonic lifetime count by individual fish committed once. At 100 nursery
  fish harvested, permanently unlock the Fish home raft blueprint (id `friendly`). Fishing
  catches, plants, restocking, transfers, removals and reharvesting companions
  cannot increment the milestone. Preserve the count across moving/demolition.
- Persist harvested fish in a separate lake reserve if no compatible friendly
  raft is built or has capacity. A verified harvest can reach/unlock 100 without
  any fish home raft. Once built, transfer existing reserve fish atomically;
  never duplicate fish, count transfers as harvests, or repeat stamina awards.
- Active lake-viewing time alone advances growth. Weather/resting changes
  fish behavior, not base growth speed or eligibility. No night-only reward
  requirements, offline growth, hunger damage or cosmetic-preview bonuses.
- Use authoritative per-species habitat/activity/food records and live Town
  home-city clock/weather. Run swimming, roaming, shadow loops, surface jumps and rest poses entirely in
  the browser; animation frames and fish positions never go to the server. The
  server applies feeding from fixed raft centers and validates growth/collection.
- Insect source forms: standalone one-by-one shore or floating structure.
  Coverage is whole water tiles within four tiles (`raftArea`). Apply exactly
  1.2× fish growth if within any qualifying source; overlaps cap at +20% and
  never affect plant growth speed or capacity. Moving/removing a source changes
  future coverage only; no replay or retroactive progress.
- Only floating insect raisers can damage floating gardens: one 25% decision
  at maturity per server-owned plant cycle, with 1–2 distinct random pockets
  out of six withering. Use a cycle independent of raft revision/generation so
  moving cannot reroll. Duck growth crossing maturity uses the
  same decision. Never damage already mature plants retroactively.
  Each healthy pocket gives the full plant stamina (currently 4), withered
  pockets give zero and never increment harvested counts. Harvest replants all
  six, clears damage/duck help and increments the plant cycle atomically.
- Award all stamina, nursery counts, permanent unlocks and lake achievements in
  revision-checked once-only transactions. Scope each collection/transfer to
  server-held generations/resident identity, not client counts or maturity.
- Stocked nursery/friendly/floating-garden rafts may be demolished directly.
  Release their remaining contents without harvest counts, rewards, reserves
  or refunds. Row/revision checks still make removal once-only. Movement keeps
  content identities and growth, validates the occupied habitat and charges
  the existing move cost without harvesting or restocking.
- Maintain the Lake Friends group, including the 100-fish milestone, universal
  text-free medallion badges, conditions/difficulty, the one idempotent admin
  migration, and both Parent/Admin child reports. Definitions remain catalog-only
  until authoritative earning rules exist; unavailable progress stays unavailable.
- Cover 99→100, batched thresholds, retries, failed capacity/destination moves,
  reserve-before-unlock, free restocking, transfer without re-award, map isolation,
  16/4 limits, depth/shore/species checks, overlapping bonuses, map leave/resume,
  clock/weather/previews and concurrent tabs in focused and guarded DB tests.
  Run required server/frontend gates and all landscape browser checks from the
  shared guide. Keep evidence local; no commit/push/publish before `confirmed`.

- Preserve the saved `insect-raiser` ID for Shore insect raiser compatibility.
  The 1×1 Floating insect raiser unlocks at 16 lifetime nursery fish harvested,
  accepts shallow/deep water and shares the four-tile feeding range and
  non-stacking +20% bonus. Reject new attachment commands; preserve previously
  saved attachment effects only for old-save compatibility.
- Lake names accept exactly one allowlisted adjective. The authenticated
  profile owns the displayed child name; never accept an owner name in a command.
- Share the stable irregular deep-water spans with the renderer and all habitat
  checks. Keep the deep area connected around the island and near 50% of the map.

- All fish animation clocks and swim paths are browser-owned, frame-driven,
  smooth across server updates, and frozen cleanly for hidden/paused/reduced
  motion. Server updates record authoritative gameplay state and fixed-location
  feeding; they never calculate fish positions or render animation frames.

- Do not poll, heartbeat or persist fish/plant growth on a timer. The browser
  animates visible growth locally. Checkpoint active elapsed time on a real map
  pause/leave and when validating a child gameplay action; server time plus the
  active viewing session remains authoritative. Never send animation frames or
  elapsed time from the client.

## Duck help
- Ducks no longer visit rafts. A raft inside a water-duty coop's area simply grows
  30 seconds sooner once per cycle (fish and plants), applied by the server tick by
  day; ducks just paddle slowly around their water (also in rain) and shelter at the
  doorstep at night. There are no duck-visit commands or saved visit state.
