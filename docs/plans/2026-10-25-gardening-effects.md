# Garden area effects and child-facing map controls

User decisions: remove the placed-object dropdown; retain map taps. Plots may
have chicken and insect effects simultaneously, represented by a hovering
chubby chicken face and a gloomy insect face. Use a 25% chance per growth
cycle of losing one crop under an insect raiser. The lost crop stays visibly
withered until manual Harvest, which replants it. Animals must not walk through
or paint over buildings in front of them.

## Rules

- Both shore and floating insect raisers use the existing four-tile coverage
  measured from plot centers. Overlaps do not stack. Chicken coverage retains
  the once-per-crop-cycle 60-second growth bonus independently.
- A plot covered by an insect area always loses 25% of its crops (rounded up)
  once per cycle, the first moment it has a ripe crop; only which slots wither
  is chosen by a stable pick. Saved plot identity and generation determine it; client time,
  positions, outcomes or reward quantities are never accepted. Retrying,
  overlapping sources and replaying an unsaved lease cannot reroll a cycle.
  Placing a source beside an already mature plot does not damage it retroactively.
- At most one slot withers between plot harvests. It retains its crop identity,
  stops growing and uses the shared generated `withered-plant-v1.png`: a dry
  stem with three damaged drooping leaves, without recognizable crop features.
  Preserve its original pixels and proportions; do not flatten/recolor crops.
  Harvest resets healthy ripe and withered slots, preserving unripe slots.
  Only healthy crops award stamina, harvest counts, badges or river stock.
  A withered-only cleanup gives no reward. Event helpers skip withered slots.
- Indicators are cosmetic and non-interactive. They follow the map frame clock,
  camera and zoom and honor reduced motion. Garden growth remains authoritative.
- Navigation keeps ground residents outside building footprints. Completely
  enclosed animals stay hidden until legal ground reopens. Shared alpha/depth
  masking hides residents behind closer building/tree silhouettes while keeping
  transparent gutters and foreground/airborne residents visible.

## Verification

Focused tests cover combined/non-stacking coverage, exact cycle/replay rules,
off-season and zero-time exclusion, harvest/replant, source disappearance,
healthy-only sharing, database checkpoint/move persistence and concurrent
once-only rewards. Animal tests cover occupied-footprint paths, layout recovery
and completely enclosed residents. Browser checks exercise actual map taps,
both faces and withering, healthy harvest/replant, zoom, English/Vietnamese,
reduced motion and pixel-level animal/building alpha ordering at 1366×768,
1024×768 and 1180×820. Raw evidence stays under `/tmp`.

## Raft handling follow-up

The user also approved direct demolition of stocked fish or plant rafts. Their
contents briefly spread into the water and fade away, with no harvest reward,
reserve transfer, refund or permanent wild population. A server-confirmed
revision supplies a cosmetic release receipt; repeated snapshots cannot replay
it. Moving a stocked raft preserves fish/plant identities and growth under
ordinary habitat and movement-cost validation. Focused domain/database tests
cover preservation, no rewards and concurrent once-only removal; browser tests
cover the full movement/removal animation at the required landscape sizes.

Local validation: 490 frontend and 531 backend tests pass, including guarded
local PostgreSQL integration tests. Application/hosting type checks, server
build and both frontend builds pass. The garden/animal browser flow verifies
both effects, healthy-only harvest/replant, localized hints, zoom and reduced
motion, including an alpha-mask pixel check. The raft browser matrix verifies
stocked nursery/friendly/garden movement, release/expiry, preserved contents and
no payouts at all three landscape sizes. Existing lake construction/navigation
and plant choosers pass with canvas taps replacing the removed dropdown.
Manual user UAT remains pending; changes are uncommitted and unpublished.

## Sticker and floating-garden follow-up

The user requested thick silhouette sticker borders instead of circular status
disks. Preserve the Town faces/style, lower them onto the upper crop row and
use the same treatment for verified duck help and floating-garden insect risk.
These remain decorative, localized and tied to the scene camera/frame clock.

Only on-water insect raisers damage plant rafts. A covered raft always
withers 2 of its six plants (25%, rounded up), at maturity or the first moment it is
covered, including maturity reached by a verified duck bonus. A separate saved plant cycle prevents moves, visits,
overlaps and retries from rerolling. Superseded rule: the pick is chance, the loss is guaranteed.
Use the shared generic withered sprite until Harvest. The user explicitly
specified that each healthy plant pays full stamina: six healthy plants give
24, one withered gives 20, two withered give 16. Harvested plant counts include
healthy pockets only. Harvest replants all six and clears damage and duck help.
Shore raisers retain their fish bonus and land-garden risk, but do not damage
floating gardens. No historical awards/counts are reconstructed.

Follow-up validation: 490 frontend and 538 backend tests pass, including saved
damage and concurrent healthy-only harvests in disposable PostgreSQL. Both
frontend builds, application/hosting/server type checks and server build pass.
The browser matrix verifies land/raft stickers, withered artwork, full rewards
per healthy plant, replanting and reduced motion at all three landscape sizes.
The local UAT launcher confirms the existing stack/accounts on port 5173.
Manual user UAT remains pending.

## Harvest choice and island follow-up

Offer keep/change after a newly committed final nursery harvest or plant
harvest. Keep stocks the same free fish species or resumes the existing plant
regrowth; change opens the shared chooser with normal server checks. Successful
action receipts own the prompt, so initial reads, failures, duplicate responses
and partial fish harvests do not open it. Modal choice pauses lake growth.

The user subsequently specified that selecting another fish type before
harvest queues the next batch. Save it as server-owned `nextFish`, keep current
fish untouched, show it in details and automatically stock it only after the
last current fish is harvested. Selecting the current species cancels the
queue. Habitat/unlock/capacity checks and once-only rewards remain authoritative.
An already queued choice skips the post-harvest question.

Rotate the six-tile center island to two columns across and three rows down.
Terrain rendering and server placement share `LAKE_ISLAND`, with the existing
top-left tile retained. No accounts, buildings or progress are deleted.
