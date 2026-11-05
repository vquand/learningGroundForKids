# Infinidrill implementation review

Branch: `feature/infinidrill`. Local implementation only; UAT is pending.
Entry: Playground → Infinidrill, `/infinidrill`.

## Scope and review

GPT-5.6 Luna agents produced gameplay logic/tests, the UI, generated raster
artwork, and browser tests. The parent agent independently reviewed the code,
sampled arithmetic bounds, played the full expedition through browser tests,
inspected screenshots, and corrected the findings below.

- Corrected carrying/borrowing edge cases and repeat-question generation so
  every operand, answer, and intermediate result stays in its level's bounds.
- Reset mastery on all level changes; preserved cave events when an optional
  challenge coincides with a level transition; verified practice rewards.
- Verified first-try streaks, exact division, the 15-second boundary, 6 m/block,
  90-answer fast progression through all 18 Earth levels, and the 2,160 m core.
- Kept optional rewards in the stash until the complete prerequisite chain is
  owned; checked balances, duplicate submissions, and the all-owned fallback.
- Corrected both generated atlases' uneven source rectangles, preserved sprite
  proportions, and rendered square foreground blocks with depth-based materials.
- Placed the selected avatar/frame in the generated cabin, anchored all five
  part slots, and delayed the asset swap until peak glow. Workshop previews show
  the reveal, named prerequisites, materials, and ownership states.
- Started question clocks after animation readiness; excluded pause/workshop
  time; locked submissions during transitions; fixed keyboard focus behavior.
- Corrected idle thought cadence, expiry, typing dismissal, animal/common pools,
  and custom-avatar fallback. Quotes contain no answers or hints.
- Corrected the results-screen button styling and made the core visibly glow.

Authentication follows existing FamilyGate/ProfileGate routing. Profile reads
use the existing family-scoped same-origin API. Game state and cosmetic rewards
are temporary, session-local values: no database, score, inventory, or provider
writes were introduced. No server or cloud resource changes were required.

## Validation

- `npm test --prefix frontend -- tests/browser/infinidrill.test.ts`: 280 tests
  passed, including 5 browser tests and 30 gameplay/world/review tests.
- `npm run typecheck:hosting --prefix frontend`: passed.
- `npm run build --prefix frontend -- --mode vercel`: passed.
- `npm run build --prefix frontend`: passed.
- `git diff --check`: passed.

Browser coverage uses Chromium at 1366×768, 1024×768, and 1180×820. Checks cover
setup, retry, keypad/keyboard, pause, idle thoughts, the workshop tree and detail
panel, stash prerequisites, purchases, glow-up, optional choices/rewards,
challenge failure, cave transitions, core completion, replay, physical keyboard
input after keypad focus, modal tab trapping, exit cancellation, and reopening
the game from the Playground. Tests check
button bounds, unobscured touch targets, document overflow, image failures,
console errors, and the absence of persisted API writes.

Screenshots are under `/tmp/plg-infinidrill-browser/`, including
`play-1024x768.png`, `workshop-selected-equip-1024x768.png`,
`cave-fall-1024x768.png`, and `core-1024x768.png`.

The extra `npm run typecheck --prefix frontend` check still reports a pre-existing
unused `EMOJI_OPTIONS` import at `frontend/src/pages/ProfilePickerPage.tsx:39`.
That import is present in HEAD and this unrelated file was left unchanged.
No new Infinidrill app type errors remain. Existing build warnings concern
large map chunks and the Node module-registration deprecation.

## Handoff

### Downward tread mounting

Tank tracks are mounted vertically on the right side of the machine. Their
left-facing source art is rotated 90 degrees counterclockwise to face downward.
The fixed anchor applies to starter and upgraded tracks in all assembled views,
and keeps the cabin avatar/frame clear. Browser checks verify the downward
orientation and right-side placement at each required viewport. Screenshots were
inspected; all 280 tests, hosting typecheck, and both builds pass.

### Pastel terrain and V-shaped excavation

Foreground terrain now uses the built-in ImageGen `terrain-atlas-v2.png`, with
pastel colors and fewer details. The prompt/reference set is in
`terrain-art-v2-prompt.md`. The underground texture has a subtle 2px blur, rendered
in contiguous material bands rather than one blur layer per small tile.

Each previous block is divided into 2×2 visual tiles, half the width and height.
The UI labels these as three-metre tiles; gameplay continues using its original
six-metre depth units and unchanged progression/rewards. Excavation narrows from
six microtiles to four and then two near the tip, forming a stepped V while
leaving the wider persistent shaft behind. Cleared regions use one overlay per
row rather than one per empty cell, and viewport culling remains bounded.

Six world-model tests and the camera browser flow verify tile size, V geometry,
blur, pastel asset loading, and culling. The required landscape sizes and the
tall layout were checked. `pastel-v-shaft-1024x768.png` and the other viewport
variants show the new scene. All 280 tests, hosting typecheck, and both builds pass.

### Underground camera and viewport culling

The camera now follows depth in world block coordinates. Foreground terrain
surrounds the drill; mining removes center cells, exposes a separately generated
underground wall, and leaves a persistent shaft. Texture fragments move away and
expire. Cave shortcuts reveal naturally hollow terrain, with a gentle bouncing
drill and springy falling motion. The math controls stay stationary.

Only intersecting rows and labels are mounted. Passed cave metadata and old
debris are removed; stable world-coordinate variants prevent tiles changing
appearance when entering view. The camera shows about ten block rows, including
in tall layouts, so the surface leaves view at depth rather than remaining above
the drill. Layout measurements happen before paint.

Five model tests and the new browser flow verify camera movement, material depth,
shaft clearing, bounded row counts, debris expiry, cave pruning, and removal of
the sky/sun/surface rows. All five browser tests pass at the required landscape
sizes; the camera/culling flow also passes at 1024×1366. Screenshots include
`underground-trail-1024x768.png`, `underground-trail-1024x1366.png`, and
`drilling-bounce-1024x768.png`. Total tests: 279 passed.

### Drill art revision

The drill and all 20 upgrade parts now use the regenerated
`drill-parts-atlas-v2.png`: 25 starter/upgrade sprites with warm brown outlines,
pastel fills, and simple shading matched to the kid avatar and tank/space frames.
All five cabin windows have genuine transparency for the existing avatar/frame.
Measured source crops and the cabin overlay were updated for the new sheet.
The chassis was flattened to match, and the three setup feature tags were removed.
The minigame `AGENTS.md` now requires these style references for future assets.

The built-in ImageGen prompt and reference paths are recorded in
`frontend/public/minigames/infinidrill/drill-art-v2-prompt.md`.
The revised artwork and tag removal passed all 273 tests, including all four
browser tests at the required viewports; hosting typecheck and both builds passed.
Setup, gameplay, and workshop screenshots were visually inspected after replacing
the art. The local preview remains at `http://localhost:5173/infinidrill`.

The feature is ready for user UAT. No commits, pushes, merges, cloud provisioning,
or publication have occurred. Future worlds (Mars, Venus, etc.) remain outside
this Earth version. Curriculum thresholds, depth, rewards, and costs can be tuned
from playtesting feedback.
