# Town pets and wildlife

Requested implementation on `feature/town-pets-and-wildlife`; no release actions.

- Small house / large house / Town Hall support up to 1 / 2 / 3 individually
  selected pets. The selection dialog drafts changes and saves them together;
  repeated breeds are allowed in different slots. An empty selection is allowed.
- Dogs: Golden Retriever, Shiba Inu, Border Collie, Samoyed, Vietnamese village
  dog. Cats: British Shorthair, Ragdoll, Persian, Scottish Straight, Munchkin.
  Birds: parrot and white owl. Farmhouses additionally support two pigs.
- A free small house is installed once for new towns and legacy towns without
  a residential building. No material debit or construction achievement. Never
  recreate it after demolition. Existing placements/progress remain intact.
- Pet selections are server-validated against host capacity and the fixed menu,
  persisted in existing town JSON under the existing ownership/revision lock.
  Switching costs nothing, earns nothing, and preserves residents on movement.
- Day pets roam/run, then return to sleep at night; white owls sleep in daylight
  and roam/fly at night. Birds occasionally perch on reachable nearby trees.
  Rain sends pets home. Unknown local daylight retains daytime behavior.
- Capybaras occasionally approach an adjacent fruit tree, give it a gentle
  nudge, and catch a falling fruit on their head. This is decorative, never loot.
- Shrub foregrounds partly mask passing ground animals; airborne animals remain
  above them. Sparse spring butterflies, summer tits/swallow visitors, autumn
  sparrows, winter robins, and occasional night owls follow the supplied season
  and home-city day/night. River fish swim and occasionally jump within water.
- Use generated transparent art matching the inspected town animal/avatar art.
  Respect reduced motion, viewport constraints, and existing achievement rules.

Verification: server validation/unit gates; decorative behavior/crop tests;
real Chromium multi-pet save/cancel/reload/move flows at 1366×768, 1024×768,
1180×820 plus seasons/night/rain/reduced motion; all frontend/server gates.

## Local verification completed

- Frontend unit suite, app typecheck, hosting typecheck, Vercel build and normal
  compatibility build pass. Server suite, typecheck and build pass; guarded
  disposable PostgreSQL run passes all 277 tests with no skips.
- All 14 existing/new Town browser flows pass in Chromium, including pet
  save/cancel/clear/reload/move, seasonal/daylight/rain controls and reduced
  motion at 1366×768, 1024×768 and 1180×820. No page/asset errors or required
  scrolling; all tested controls fit and can be hit.
- Additional browser pixel checks pass for shrub foreground occlusion and the
  capybara's head fruit after a simulated tree visit. Screenshots inspected in
  `/tmp/plg-town-pets/`, including `shrub-occlusion.png` and
  `capybara-head-fruit.png`. Crop corrections remove neighboring paws/wings.
- Generated source art, alpha and every species/pose crop inspected. Prompts,
  file paths and measurements are in `PET_ASSETS.md` and `petAtlas.ts`.
- Implementation lives on `feature/town-pets-and-wildlife`. No cloud resources,
  production migrations or publishing performed. On October 14 the user completed
  UAT, said `confirmed`, and authorized committing/pushing the feature branch and
  returning a PR creation URL. Merge and deployment remain separate actions.

## October 14 UAT follow-up

- Fish turn continuously and face their actual swimming/jumping direction.
- Grass tufts, flowers and shrubs cover animals' lower bodies; road tiles clear
  vegetation in both drawing passes until the road is removed.
- Dense generated pine/broadleaf woodland and mountain ranges surround the
  town, using looped strips with natural alpha overlap. Display exactly three
  scenery columns on each side and four rows above/below; fit the complete
  46×28 scene without expanding forests/fields into spare viewport space.
- River and shoreline continue through side scenery beyond the town. Only the
  original town grid accepts construction/selection; scenery remains decorative.
- Sheep flock; ducks/geese follow a trail; cattle, pigs and capybaras form looser
  groups; chickens forage apart and rabbits use pairs. Dogs/cats/birds retain
  individual activity preferences, with cat naps and species/breed running rates.
- Border Collies gather reachable sheep flocks sequentially: meet a flock,
  escort it to the next, wait for stragglers, then merge. Six sheep from three
  farmhouses form staggered pairs and show occasional hearts. Original host
  ownership stays intact; everyone returns to their own home at night or in rain.
- All twelve home pets and pigs have measured front/back walking frames;
  parrots and owls also have directional flight. Capybaras can nudge every
  reachable fruit-bearing species: lemon, apple or cherry, with matching fruit.

Animal habits draw on [Penn State Extension's flocking/herd description](https://extension.psu.edu/working-safely-around-farm-animals),
[RSPCA's social duck/goose guidance](https://www.rspca.org.uk/adviceandwelfare/farm/farmanimals/ducksandgeese),
[Merck's cat resting behavior](https://www.merckvetmanual.com/en-us/veterinary/behavior/behavior-of-cats/social-behavior-of-cats),
and [AKC's Border Collie herding description](https://www.akc.org/dog-breeds/border-collie/).
Formation shapes, sequential recruitment and hearts are requested storybook
interpretations, rather than claims about literal animal behavior.

Follow-up verification: frontend unit suite and both typechecks pass; all 19
Town Chromium checks pass, including exact scenic bounds/non-interaction,
Border Collie formation/hearts, capybara fruit, three foliage foreground types,
and the full existing flows at the required laptop/iPad sizes. Generated artwork,
directional crops and screenshots were inspected. Builds remain local only.
