# Infinidrill — design discussion

Status: implemented locally on the feature branch; review and test evidence are
in `docs/plans/infinidrill-review.md`. User UAT is pending.
No commit, push, or publication has occurred.
Branch: `feature/infinidrill`.

## Terminology and world scope

- Earth is world stage 1 and the only world in this version. Mars, Venus, and
  other worlds will be designed later; do not implement their content now.
- The 18 math steps below are progression levels within Earth, not separate
  world stages. In the remaining draft, numbered "stages" in curriculum and
  formulas mean these progression levels. UI labels use "Earth" and "Level".
- The user accepted the proposed progression/mastery model: normal completion
  requires the level depth boundary and five first-try correct answers; five
  consecutive first-try answers under 15 seconds trigger a cave shortcut.

## Confirmed direction

- Browser math minigame for children under 10. Answering questions powers a
  chubby drill downward through a block-based underground scene.
- Minimal textured background behind foreground soil blocks of varied styles,
  using Terraria's layered terrain approach as a visual reference.
- Reuse the active child's avatar as the face in the cabin and their selected
  avatar frame as the cabin frame. Existing rendering is in
  `frontend/src/components/ProfileAvatar.tsx`.
- Numeric input uses an old-telephone-style number pad, with keyboard support.
- Wrong answers allow retries without hints. Show random thoughts from the
  animal in the cabin. Use a shared pool of common quotes plus smaller pools
  matching each animal's species/personality. Repeated thoughts may appear after
  more than 10 seconds idle before starting an answer.
- Depth unlocks harder questions; difficulty adapts to performance so struggling
  slows progression. Every session starts with single-digit addition; repeated
  fast, accurate answers accelerate progression.
- Proposed five-answer first-try accuracy streak retained, with the user changing
  the speed threshold to under 15 seconds. Precise timing aggregation and depth
  thresholds remain to be finalized.
- A/B choices occur every seven questions: A continues drilling; B offers an extra math question
  at the current difficulty. Success gives one free cosmetic upgrade chosen
  from three random distinct unowned upgrades. A wrong B answer loses that
  opportunity. Count only correctly completed main questions toward this cadence;
  retries and optional questions do not count.
- Drill heads and attached parts are cosmetic only.
- Upgrade slots include the drill head, cabin skin, accessory, engine, and
  tank-style wheel/tread assembly. Each slot has one fixed mounting position;
  upgrades replace its visual asset rather than stacking extra copies.
- Show an evolution-like glow-up, swap to the new visual, then reveal the part.
- Normal correct answers drill 2–3 blocks and collect minerals/metals encountered
  along the way. Harder questions yield larger mineral quantities so children can
  afford more expensive skins/parts. Exact reward amounts remain open.
- An always-visible workshop button pauses play and opens a prerequisite tree.
  Clicking a node shows details and required materials. Purchased prerequisites
  determine which upgrades follow. Free rewards can bypass prerequisites for
  ownership, but remain in the stash until prerequisites are unlocked for use.
- Different colors count as different parts. Once all upgrades are owned, free
  upgrade opportunities award resources instead.
- All session state resets each session: depth, resources, upgrades, and
  difficulty. No permanent progression in this version.
- Division must be exact: `6 ÷ 3` and `6 ÷ 2` are valid, `5 ÷ 3` is not.
- Zero is allowed, including answers such as `5 − 5 = 0`. No negative numbers or
  fractional results; division by zero is always prohibited.
- Complete the hardest math stage to reach Earth's core and celebrate.
- Visualize fast advancement as the drill finding a hollow cave and falling
  quickly. Show a nearby depth counter: one block equals 6 metres.
- Generate multiple foreground block textures and arrange them progressively
  with depth: dirt → harder dirt → rock → rock with lava → core-adjacent material.
  Terrain progression must visibly communicate drilling deeper into Earth.

## Intended curriculum

The precise interleaving of digit ranges and expression lengths remains open.
Preserve the requested progression from addition to subtraction, small-number
addition chains, subtraction chains, mixed addition/subtraction, multiplication,
and exact division. Grow from one-digit to two-digit operands and three-/four-
number expressions, then single-digit multiplication, two-digit dividends with
single-digit divisors, then three-digit addition/subtraction with one-digit,
two-digit, and multiple two-digit operands.

## Proposed curriculum for review

All tuning below is proposed rather than approved. Use left-to-right +/− chains,
with nonnegative intermediate results. Multiplication/division appear separately.
Avoid repeating the immediately previous equation.

Each stage occupies 20 block positions (120 m); proposed final depth is 2,160 m.
This is a stylized game distance, not a geological scale.

| Stage | Question family | Example | End depth |
| --- | --- | --- | --- |
| 1 | One-digit addition, result ≤ 9 | 3 + 4 | 120 m |
| 2 | One-digit subtraction | 8 − 3 | 240 m |
| 3 | Three/four one-digit numbers, addition, result ≤ 30 | 2 + 4 + 3 + 5 | 360 m |
| 4 | Three/four one-digit numbers, subtraction | 9 − 2 − 3 − 1 | 480 m |
| 5 | Three/four one-digit numbers, mixed +/−, result ≤ 30 | 7 + 4 − 3 + 2 | 600 m |
| 6 | Two-digit ± one-digit, no carrying/borrowing | 24 + 3; 47 − 5 | 720 m |
| 7 | Two-digit ± one-digit, carrying/borrowing | 28 + 7; 32 − 6 | 840 m |
| 8 | Two two-digit numbers, addition, result ≤ 99 | 24 + 35 | 960 m |
| 9 | Two two-digit numbers, subtraction | 63 − 28 | 1,080 m |
| 10 | Three numbers mixing one/two digits, +/− | 32 + 14 − 8 | 1,200 m |
| 11 | Four numbers mixing one/two digits, +/− | 25 + 16 − 12 + 7 | 1,320 m |
| 12 | Multiplication with factors 0–5 | 4 × 3 | 1,440 m |
| 13 | Multiplication with factors 0–9 | 7 × 8 | 1,560 m |
| 14 | Exact division, dividend 0–99, divisor 1–9 | 6 ÷ 3; 42 ÷ 6 | 1,680 m |
| 15 | Three-digit ± one-digit | 326 + 7; 402 − 5 | 1,800 m |
| 16 | Three-digit ± two-digit | 345 + 27; 412 − 36 | 1,920 m |
| 17 | Three-digit start, two two-digit operands, +/− | 345 + 24 − 18 | 2,040 m |
| 18 | Three-digit start, three two-digit operands, +/− | 426 − 35 + 28 − 16 | 2,160 m |

Keep stages 6–11 intermediate results within 0–99 and stages 15–18 within
100–999. Generate division from integer divisor × quotient pairs, including
small familiar examples and two-digit dividends; never use a zero divisor.

## Accepted mastery model and proposed cave timing

- Normal correct answers drill 2 or 3 blocks, clamped to the stage boundary.
- Complete a stage after reaching its boundary and earning five first-try correct
  main answers there. These five do not need to be fast or consecutive.
- Five consecutive first-try correct main answers, each under 15 seconds, reveal
  a hollow cave if the boundary has not been reached. Fall through its remaining
  block positions to enter the next stage immediately.
- Time starts when the question is ready. Pause/workshop time is excluded.
  Wrong/slower answers reset the fast streak, without erasing mastery evidence
  or reducing depth. Reset mastery and streak counters on stage change.
- If depth reaches the boundary before five first-try correct answers, practice
  at a reinforced layer: correct answers still collect deposits but descent
  pauses until mastery is satisfied. Show "Practice to reach the next layer."
  This is the accepted practice pause at a progression-level boundary.
- Every drilled block and traversed cave position adds 6 m once. The counter is
  total depth below the surface, including falls. A cave fall gives no materials;
  rewards come from soil actually drilled. Optional questions affect neither
  depth, mastery, nor the fast streak.
- Animate drilling for roughly one second and falls for roughly 1.5 seconds.
  Disable submissions during transitions to prevent duplicate rewards.

## Proposed economy and upgrade tree

Use crystals for minerals and nuggets for metal. Each drilled soil block gives
crystals equal to the stage number. Every third destroyed block also gives
`1 + floor((stage − 1) / 6)` nuggets. Count destroyed blocks session-wide; cave
positions do not count. Display matching deposits before drilling.

Three blocks at stage 1 give 3 crystals; at stage 18 they give 54. When all parts
are owned, optional success instead gives `6 × stage` crystals and that stage's
nugget quantity. Parts never change rewards, drilling distance, or difficulty.

The starter machine is the common root of five independent branches. Each
part requires the preceding tier in its own branch to be usable.

| Tier | Head | Cabin skin | Accessory | Engine | Tank treads | Price per part |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Copper cone | Sunny yellow | Tiny flag | Copper housing | Rubber tracks | 20 crystals + 2 nuggets |
| 2 | Steel spiral | Ocean blue | Side lantern | Steel housing | Steel tracks | 60 crystals + 5 nuggets |
| 3 | Crystal crown | Forest green | Crystal antenna | Crystal housing | Crystal-edged tracks | 120 crystals + 8 nuggets |
| 4 | Star-shaped head | Sunset pink | Decorative twin boosters | Star housing | Star-pattern tracks | 200 crystals + 12 nuggets |

Proposed initial catalog: 20 parts across five slots, plus default starter assets.
Names, prices, and four-tier branch lengths remain tuning proposals.
Colors count as separate parts.
Cabin skins preserve the child's avatar and selected avatar frame.

Node states are locked, available to buy, owned/in stash, usable, and equipped.
A free part never needs to be purchased again. Once all its prerequisites are
usable, it becomes usable automatically. Buying requires prerequisites and both
resource balances. Details show the preview, missing prerequisites/materials,
and Buy or Equip action. Equipping is explicit; one part per slot, free swapping.

### Fixed assets and upgrade reveal

- Define stable anchors for head, cabin, accessory, engine, and the complete
  tank-style tread assembly. All assets in a slot share the same canvas/viewbox,
  scale convention, and attachment point. Swaps do not move the other parts or
  change the drill's collision/layout bounds.
- Treat the left/right tread pair as one interchangeable asset. Keep engine
  changes visible on the side of the chubby machine.
- On equipping a newly unlocked part, show the drill in a reserved preview area:
  soft glow builds around the affected slot, briefly becomes a bright silhouette,
  swaps the asset at peak glow, then fades to reveal the new visual with a small
  sparkle burst. Suggested duration: 1.5–2 seconds, with no flashing/strobing.
- Hold the selected upgrade in place throughout the reveal; do not accept a
  second equipment mutation until the swap completes. Animate visuals without
  delaying ownership/prerequisite bookkeeping or awarding resources again.
- A locked free reward goes to the stash without changing the drill; its equip
  reveal happens only after prerequisites are satisfied and the child equips it.
- Existing owned-part swaps may use a shorter glow. Reduced-motion mode uses an
  immediate swap with a static glow outline.
- Engine and tracks remain cosmetic: no speed, distance, handling, reward, or
  difficulty advantage. Preserve the avatar and avatar frame throughout reveals.

Free rewards sample any unowned part, including locked ones. If fewer than three
unowned parts remain, offer the remaining one/two without duplicates. Buying a
missing prerequisite can unlock already-stashed descendants.

## Proposed presentation, thoughts, and finish

- Side cutaway with terrain/drill on the left and equation/keypad on the right.
  Keypad rows: `1 2 3`, `4 5 6`, `7 8 9`, then backspace, `0`, submit.
  Enter submits; Backspace erases. Keep workshop and pause visible.
- Wrong main answers retain the equation, clear attempted input, and give neutral
  feedback without hints. No resource penalty or lost depth.
- Use the depth-based texture plan below, with a minimally textured background
  behind the foreground blocks. Finish above a glowing core chamber.
- Keep the 5-branch/4-tier workshop tree in view, with selected-node details beside
  it. The workshop pauses timers; returning restores the same question.
- Idle bubbles begin after more than 10 seconds before the first digit, then at
  25 seconds and every 20 seconds thereafter. Each lasts about three seconds;
  entering a digit dismisses it and suppresses idle thoughts for that question.
  Wrong-answer thoughts have a 10-second cooldown. Pause/workshop and A/B choices
  suspend thoughts. Avoid consecutive duplicate quotes.
- Common examples: "Is that a potato-shaped rock?", "My seat is getting wiggly."
  Rabbit examples: "Any carrots down here?", "My ears felt that bump!"
  Capybara examples: "A warm mud bath would be nice.", "Slow paws, steady drill."
  Match curated pools to existing avatar IDs; use common quotes for custom or
  unmatched avatars. Do not infer species from uploaded images. Never mock
  mistakes or reveal math hints.
- Reserve bubble space so thoughts never obscure controls or the equation.
- Core arrival shows depth, completed questions, collected resources, and the
  assembled drill, with Replay and Exit. Replay resets everything to stage 1.
  Core arrival takes precedence over a coinciding optional challenge.
- Exiting an unfinished dig confirms abandoning the session because it is not
  saved. No permanent inventory or account progression is introduced.

## Remaining tuning proposals

- Exact level depth boundaries, stylized 2,160 m Earth core, resource quantities,
  upgrade prices, and the 20-part catalog need playtesting.
- Five branches remain independent in this draft; each requires its own prior
  tier. Cross-branch prerequisites are not currently proposed.
- Future worlds need separate curriculum, visuals, and progression designs.

## Terrain texture production and depth placement

Generate raster texture assets for multiple kinds of foreground blocks, rather
than relying on a single recolored dirt tile. Keep a consistent block size,
illustration style, light direction, and edge treatment across the whole set.
The user explicitly requires a progressive Earth drilling sequence.

Proposed layer mapping:

| Earth levels | Main material | Texture variations |
| --- | --- | --- |
| 1–3 | Soft dirt | Loose soil, root fragments, tiny pebbles |
| 4–6 | Harder dirt | Packed soil, clay bands, embedded stones |
| 7–10 | Rock | Rough stone, fractured stone, mineral-bearing stone |
| 11–14 | Deep hard rock | Dense dark stone, crystal pockets, metal veins |
| 15–17 | Rock with lava | Charred stone, glowing cracks, rock beside lava pockets |
| 18 | Core-adjacent rock | Dark crust with stronger warm glow near the core |

- Produce at least three base texture variants per material family. Ore/crystal
  overlays and lava accents can add variety without duplicating every base tile.
- Choose variants per block so adjacent tiles do not repeat conspicuously.
  Keep seams compatible and visual detail readable at actual game scale.
- Blend neighboring material families over several block rows near boundaries;
  deeper layers should become denser/darker before lava introduces warm light.
- Anchor material placement to world depth, not elapsed time or equipped parts.
  A cave shortcut crosses the relevant layers visibly and lands in the next
  depth-appropriate material. Cave walls retain surrounding layer textures.
- Keep background texture quieter and lower contrast than foreground blocks.
  Visible mineral/metal deposits must correspond to the actual block rewards.
- Lava is visual scenery in this version: no damage, death, timed hazard, or
  additional mechanic. Apparent rock hardness does not create equipment gates.
- Preserve clear drill, avatar, counters, equation, and control silhouettes;
  terrain detail and glow must not reduce their readability.
- Generate and review the texture set when asset production begins. No texture
  assets were generated during the design discussion. Implementation now uses
  generated `terrain-atlas.png` (six families, three variants each) and
  `drill-parts-atlas.png` (five slots, starter plus four upgrades each).
  Measured drill sprite rectangles preserve proportions and prevent neighboring
  sprite bleed; see `frontend/src/features/infinidrill/assets.ts`.

## Implementation requirements

- The camera follows physical depth, with foreground terrain surrounding the
  drill. Correct answers break/displace foreground blocks, exposing a quieter
  underground wall and leaving a shaft behind. The surface/sky leaves the view
  as depth increases. The drill bounces gently during descent and cave falls.
- Foreground art is pastel and low-detail. Visually split each former block into
  2×2 three-metre tiles without changing progression or rewards. Taper the dug
  region into a V at the drill tip. Give background walls a soft blur with subtle
  detail, grouped into material bands for efficient rendering.
- Keep only intersecting world rows, deposits, labels, and cave sections in the
  scene DOM. Remove expired debris and prune passed cave metadata. Math controls
  stay fixed while the underground scene moves.

- Follow `frontend/src/features/infinidrill/AGENTS.md`.
- All current controls and the play area must fit together without scrolling at
  1366×768, 1024×768, and 1180×820, including challenges and upgrade choices.
- Verify retry, idle thoughts, cave falls, challenge failure/success, stash,
  prerequisite unlocks, purchases, fixed-anchor asset swaps, glow reveals,
  reduced-motion reveals, pause, Earth core arrival, and replay.
- Check generator bounds, exact division, nonnegative intermediate results,
  duplicate-submit guards, nonnegative balances, and strictly cosmetic upgrades.
- Keep any API traffic same-origin and persisted rewards/progress authoritative
  on the Render API. Do not introduce direct database/provider browser calls.
- Do not commit, push, publish, or provision cloud resources without the required
  user authorization.
