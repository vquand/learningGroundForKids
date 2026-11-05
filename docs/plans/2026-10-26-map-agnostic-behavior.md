# Map-agnostic behavior (2026-10-26)

Behavior is building + animal/plant + environment (terrain, water depth) + event,
never map-name based. A map only supplies terrain, scenery and reserved tiles.

## Decisions (user, 2026-10-26)
- Garden growth, animal contacts (grazing bites, duck crop boost), insect
  withering, events and time stepping are one shared simulation for every map.
- Ducks: a coop not touching water → ducks roam and boost land crops. A coop
  touching water whose area holds a whitelisted beneficiary → ducks stay on
  that water (except sleeping/sheltering) and visit rafts. No beneficiary →
  fall back to roaming.
- Insect raisers, nurseries, floating gardens, fish home rafts may be built on
  the Town river once the Lake and the blueprint are unlocked, when space and
  water depth fit. The Town river counts as shallow water.
- Only Town Hall is restricted (Town only).
- Map identity is passed explicitly; `entity.mapId` is legacy and never read.
- Client: one set of building tools, actions, detail content and scene layers
  (weather, Halloween, coverage) for every map. Women's Day card stays Town-only.
  Halloween runs on every map. Visits default to Town.
- Every area/contact effect is whitelisted in `AREA_EFFECTS`.

## Phases
- A (server): map world accessor, unified `tickMap`, shared lease/clock for
  both maps, water commands with `mapId`, map-aware placement, duck duty,
  contact effects in the registry, events per map, explicit map identity.
- B (client): shared building actions, detail content, raft actions/dialogs,
  road/fence glide and patch tools on every map, Town rafts.
- C (client): shared scene layers (weather, Halloween, raft drawing, coverage).
