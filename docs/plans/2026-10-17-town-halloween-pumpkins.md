# Town Halloween pumpkin helpers

Branch: `feature/town-halloween-pumpkins`.

## Accepted behavior

- Use each child's server-resolved home-city calendar. Remind them to grow
  pumpkins on October 27–29. Ghosts work October 30–31 only, on dry evenings
  and nights. Remove seasonal decorations on November 1. No offline harvesting.
- Ghosts harvest real ripe pumpkins, grant the ordinary two stamina per pumpkin
  and replant only the harvested slot. One harvested pumpkin creates exactly
  one lantern. More ready pumpkins produce more lanterns, placed gradually.
- Keep the existing cute, round, friendly ghost style, warm cocoa outlines and
  soft faces. Animate flying, picking up and hanging; never redesign as horror.
- Reuse each lantern image on a ghost and on a wooden hook/post near buildings,
  roads, trees and riverbanks. Include several friendly faces. Add a subtle glow at night.
- Pumpkin growth still takes 300 active Town seconds. Permit pumpkin planting
  and growth during October 27–31 in both hemispheres, without changing other
  crops' seasonal eligibility. Unknown home clock cannot unlock holiday seeds.
- Cap installed and reserved lanterns together at 100. Favor house fronts,
  road intersections, trees and riverbanks, with stable random variation and
  at least three tiles of spacing so lights spread across town.
- If no safe hanging spot remains or the cap is reached, leave ripe pumpkins for the kid rather than
  consuming crops without placing lanterns. No unrelated inventory economy.

## Implementation constraints

Keep dates, eligibility, active time, ripe-slot reservations, harvest rewards,
replanting and lantern records server-owned in existing Town JSON. Use the
garden CPU worker and existing bounded active lease. Durable reward/job
transitions increment the revision and use the existing town-row transaction;
duplicate ticks, parallel tabs, process changes, manual harvest and animal bites
must not duplicate pumpkins or stamina. Ghost harvests do not claim the manual
harvest achievements. No new SQL schema is expected.

Up to three helper jobs run concurrently. A helper approaches a ripe pumpkin,
picks/carves it, carries the separate lantern and hangs it. Reserve individual
slot generations and a clear decoration site. Advance only on verified active
time; rain/daylight pauses work. A missed lease/resume never catches up offline.
At pickup a job consumes one mature slot, grants two stamina and resets that
slot once; the completed carry/hang phase installs its single lantern. Never accept client job,
time, harvest, reward, decoration-count or completion commands.

Installed decorations are cosmetic and do not block construction, road gestures,
building taps or movement. Keep normal server-verified crop progress separate
from decorative browser interpolation and previews. Preview can demonstrate
a finite harvest of actual ripe pumpkins from its starting snapshot, resetting
only its crop drawings. It cannot harvest real crops or grant progress. Honor
reduced motion with calm fixed poses and attached lanterns.

Generate raster art with built-in ImageGen, preserve the friendly ghosts, record
exact prompts, isolate alpha and pack uniform cells with shared anchors. Use
the existing private artwork catalog and same-origin Town image cache. No cloud
uploads/provisioning or release actions before a new user confirmation.

## Validation required

Test home-local dates/year rollover, both hemispheres, daylight/weather and
missing/stale data, seed eligibility/growth, one pumpkin to one lantern,
stamina/replanting, slot-generation races, checkpoint/resume/duplicate ticks and
November cleanup. Test renderer cache stability, sprite frames and reuse,
night glow, reduced motion and cosmetic-only previews. Verify reminder and
garden actions in both languages at laptop/iPad landscape sizes and a phone.
Run frontend/server baseline gates and meaningful guarded database integration.

Flying ghosts and their carried lanterns draw above crops, bushes, trees and
ground residents. Installed posts keep their ground placement. Mouse-wheel
zoom is available in both viewing and editing modes, preserving selected
placement and canceling unfinished strokes before navigating.

Installed posts and their glow are alpha-masked by closer houses and trees,
while ghosts/carried lanterns remain in the flying layer. Return flights face
actual travel direction. The preview no longer creates phantom harvests on a
loop: each snapshot pumpkin produces at most one lantern.

## Connected fence strips

Add `remove-fence-network` alongside the existing road command, with only the
selected entity ID as input. The owned-town revision transaction computes its
cardinal connected fence component and removes it atomically without refund or
achievement changes. Preserve single-fence removal; hide both actions while
viewing. Corners, branches and loops connect; gaps/diagonals and other objects
do not. Localize the editing action and verify its bounds in both languages.

## Verification (2026-10-17)

- Frontend unit suite: 90 files passed; application and hosting typechecks pass.
- Server suite: 345 tests passed, with no skips, against a newly created isolated
  local database on port 55433. The database was removed afterward. Includes
  two-process pumpkin rewards, restart/checkpoint recovery, and authenticated
  concurrent connected-fence deletion. UAT data was not reset or migrated.
- Server build and compiled Halloween/worker/fence tests pass. Vercel and
  compatibility frontend builds pass; existing large-map chunk warnings remain.
- Browser: 9 Halloween flow/layout cases, one native-canvas alpha/depth/direction
  case, and 14 navigation/fence cases pass. Viewports include 1366×768,
  1024×768, 1180×820 and 390×844, with English/Vietnamese controls, button
  bounds/hit tests and no page scrolling in checked states. Verified foreground
  ghosts, shared carried lantern artwork, daytime/no-glow, November stale-state
  hiding, stable canvas/images across heartbeats and building/tree masking.
- Artwork catalog regenerated locally; no upload or cloud resource changes.
  Existing Town JSON stores the feature; no SQL migration is required.
- No commit, push or release performed. Local preview: set Night + Clear in
  Test appearance controls, then Preview Halloween with ripe pumpkins present.
  Preview harvests its starting snapshot once and never writes saved crops.

## Follow-up: continuous ghost jobs and blocked visitors

Ghost workers now retain their last position and rest for a randomized 3–7 active
seconds after delivery/cancellation. A new approach begins at that endpoint;
travel duration scales with distance. Shared trajectory math plus a renderer
speed limit of 2.5 tiles/second prevents server heartbeats from teleporting them.
Only one ghost may approach/pick from a patch at a time; distinct patches can
have separate helpers. Slot-generation reservations still prevent double harvest.
Retargeted carriers fly from their current position before installing the light.
The finite preview uses this same scheduler with a private crop snapshot.

The observed local NPC blockage was a large house at row 5/column 0 covering the
west entrance (row 7/column 0). A read-only layout simulation confirmed that
recovering decorative visitors to nearby clear ground lets all three walk away.
Town edits also invalidate routes through newly occupied tiles. No existing
building was moved or deleted, and server road/move-in requirements remain intact.

Follow-up verification: 347 server tests passed in a disposable local database,
plus source/compiled worker tests, frontend suite/typechecks/builds, continuous
rendered delivery→rest→next-pickup frame checks, finite-preview reservations and
blocked-entrance visitor regressions. No new SQL migration or release action.
Preview state also survives weather/calendar repaints; it resets only when the
preview is explicitly stopped/restarted or the Town session ends. The weather
repaint regression and NPC recovery at all three landscape viewports pass.

## Follow-up: apparently stuck evening NPCs

Reproduced three cosmetic scheduling bugs: a visitor repeatedly selected the
doorway it already occupied; guests ignored evening/night; reduced motion could
freeze a returning worker outdoors. Visitors now leave at evening/night (or
outside 08:00–20:00), reopening daytime visits the following morning. Workers
retain their individual business hours and immediately replan a homeward route
when work/rest begins. Reduced motion applies the final indoor/departed state.
Zero-length/current-tile visits and unreachable shops fall back to another
reachable nearby walk. The existing call pose indicates genuinely blocked
returns, with a bounded retry pause. No server or database contract changes.

Validation: focused scheduling/route regressions, frontend unit suite and both
typechecks, Vercel/compatibility builds, plus real-browser morning→evening
departure and reduced-motion rendering at 1366×768, 1024×768 and 1180×820.

## Event isolation and retained keepsakes (October 17 follow-up)

Implemented ADR-008: typed allowlisted event plugins, occurrence/edition pinning,
scoped verified effects and independent event JSON. The reusable ghost motion,
frame and drawing utilities accept explicit policies; the 2026 pumpkin edition
owns Halloween behavior. Legacy Halloween state is adopted automatically, while
its API field remains a compatibility projection. Later editions must explicitly
select their year and retain old saved-job interpreters.

New accepted requirement: retain a per-Halloween lantern-created count. Count
installed lanterns with deduplicated server receipts. More than 20 means 21 in
one year's event. Award **Ghostly Sky**, medium difficulty, in the named
**Halloween** achievement group. Persist history and the award after November 1;
start a new count next year. Shared parent/admin reports and kid badges display
verified progress; the admin catalog gets its existing idempotent migration
button. No SQL schema change or client-award route.

Validation for event isolation and Ghostly Sky:

- Full isolated-local PostgreSQL server suite: 355 tests passed, zero skipped.
  Includes concurrent API-process harvests, revision conflicts, retained 21st
  completion/award and the real shared Parent/Admin report SQL projection.
- Frontend suite: 91 test files passed; application/hosting/server typechecks and
  Render, Vercel and transitional compatibility builds passed.
- Real Chromium: 15 Halloween flow/render/preview regressions and six bilingual
  achievement checks (kid collection, Parent, Admin, idempotent catalog button),
  covering 1366×768, 1024×768 and 1180×820; planting also covers 390×844.
- Cross-event tests cover separate state, capabilities, failure rollback with a
  healthy event continuing, unknown versions, checkpoint edition pinning,
  different ghost motion/skin policies, receipt deduplication and yearly reset.
- Badge alpha/bounds inspected; exact built-in imagegen prompt and source saved
  locally. Artwork catalog regenerated without uploading. Builds retain the
  existing large-map-chunk advisory. No new dependency, cloud change, migration,
  commit or push.


User confirmed commit/push and PR handoff on October 17. No Neon SQL script is
needed: event state/history use the existing Town JSON column. After deployment,
install the reviewed Halloween definitions through Admin → Achievements →
Halloween → Migrate achievement data. This preserves all counters and awards.
The Town-only keepsake numerator excludes Halloween's separate badge group.
