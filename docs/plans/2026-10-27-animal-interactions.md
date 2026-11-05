# Town animal interactions, barns and Town Storage (2026-10-27)

Branch `feature/animal-interactions`. Points chosen from the numbered brainstorm:
1, 2, 3, 4, 7, 8, 9, 11, 12, 13, 15, 16, 17, 18, 19.

## Server-owned (authoritative, saved)

### Storage (`server/src/town-building/storage.ts`)
- One storage shared by every map. Items: crops (per crop id), milk, and the
  existing water-care fish reserve (per species).
- Limits, counted per item kind:
  - no Town Storage built on any map: 10 of each item, 2000 of each building
    material (wood, rock, sand, metal, wool);
  - at least one Town Storage: 1000 of each item, 5000 of each material.
  Stamina is energy, not a building material, and is not capped here.
- Limits clamp new gains only. Amounts already above a limit stay; nothing is
  ever confiscated. Credits from source games (`creditTown`) clamp the same way.
- Spoiling: fish and milk keep 3 days (wall clock). Each gain is a dated batch;
  settling drops batches older than 3 days, oldest first. Using items consumes
  the oldest batch first. Fish already in the reserve before rollout get a
  batch dated at rollout, so nothing spoils retroactively. Preservation comes later.
- Crops: every harvested ripe crop is also stored (stamina reward unchanged).
- Town Storage blueprint `town-storage`, 2×2 building, front only, buildable
  any number of times on any map. Selecting one shows "Open storage", the only
  way to view the store.

### Barns (`server/src/town-building/barn.ts`)
- Farmhouse residents produce in real time like coop eggs: Dairy Cows → milk,
  sheep → wool. Highland cows and pigs produce nothing yet.
- One unit per 6 hours per barn, capacity 12. Fed barns produce twice as fast.
- `feed-animals {entityId}`: uses one stored favourite crop and adds one hour
  of "fed" time (at most 4 banked hours). Favourites: dairy cow corn/cabbage,
  Highland cow broccoli/potato, sheep peas/carrot, pig pumpkin/potato/tomato.
  Every species can be fed (hearts); only producing barns speed up.
- `collect-barn {entityId,generation}`: milk goes to storage (spoils in 3 days),
  wool goes to the wool material. Both respect the limits.
- Removing a barn with stock asks to collect first; switching species resets
  production.

## Client-only, decorative (never progress or rewards)
- 1 Cattle dog trails the cows home at dusk; Border Collie circles a far
  straggler sheep back (hearts).
- 2 Ducklings (2 per duck coop) and chicks (2 per chicken coop) follow their
  parents' trail; lambs (2 per sheep barn) in spring (16).
- 3 A goose honks and flaps at a dog that comes too close; the dog hops back.
- 4 Napping piles: a chick or duckling naps on a sleeping capybara's back or
  beside a sleeping sheep/cow; a napping cat curls up next to one.
- 7 Animals queue at a farm gate (one at a time); a nearby dog sits by the gate.
- 8 Grazing grass: seasonal tufts on free grass near barns, grow faster near
  many animals, cows/sheep nibble them to a stub, they regrow.
- 9 Hens peck ordinary bugs (ladybug/caterpillar) in covered patches with a
  "bug gone" sparkle. No bees.
- 11 Rabbits/cats hide in tall plants (ripe corn, ripe pumpkin); only ears
  show; tapping pops them out with a heart.
- 12 Capybara carries its fruit to a nearby friend; both get hearts.
- 13 Ducks visiting a floating garden take a short nap on it.
- 16 Seasons: spring lambs/chicks, summer ducks splash under bridges, autumn
  sheep roll in leaf piles, winter animals huddle closer.
- 17 A cow stops on a bridge to watch the fish; people behind it wait.
- 18 Rain: cats dash under a bridge or porch; sheep huddle into a fluffy ball.
- 19 The owl keeps night watch near a coop and hoots at a ghost that comes close.
- Fleece: sheep look fluffier as barn wool accumulates (medium/full fleece).

## Art (Codex imagegen, verified, then copied)
`output/animal-interactions/{babies,fleece,storage-icons,grass}`: duckling,
chick, lamb sheets; medium/full fleece sheep with huddle pose; Town Storage
building and icon; milk bottle/can, wool ball, feed bowl, ladybug, caterpillar;
seasonal grass tufts with growth stages; autumn leaf piles.
