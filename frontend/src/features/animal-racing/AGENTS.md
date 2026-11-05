# Road Racing Minigame Guide

Follow `../AGENTS.md`, `frontend/AGENTS.md`, and the repository guide.
The game is named **Road Racing**. Approved requirements and implementation
details are in `docs/plans/2026-10-21-road-racing.md`.

- Shared question kinds, public shapes, content-language prompt text, and
  renderer contracts are defined in `server/src/questions/AGENTS.md`. Use the
  shared `QuestionView` and question components; Road Racing only supplies its
  racing-specific animal renderer and layout variant.

- Number every brainstorming and clarification question. Use concise numbered
  lists with short lettered choices where useful. Preserve pending numbers.
- Keep this game modular, following existing minigame page, setup, scene,
  API client, and server game/repository/route boundaries.
- Use shared kid navigation, controls, global UI language, and achievement
  collection components with the existing illustrated storybook design.
- Animal and terrain artwork follows Town Building's visual identity: flat
  pastel fills, oversized rounded heads, chubby compact bodies, short limbs,
  thick smooth warm-brown outlines, sparse detail, and at most one flat shading
  patch. No watercolor, grain, realistic textures, dense fur/feather/scale
  detail, glossy 3D, or layered lighting. Inspect Town's `animal-neighbors.png`,
  `avatars/kids/capybara-calm.webp`, and `avatar-frames/flowers.webp` first.
  The duck is Town's cream-white domestic duck with an orange bill and feet,
  never a green-headed mallard. The chicken is Town's butter-yellow chicken.
  The Highland cow's long fringe covers both eyes in every frame and portrait.
- Preserve species-specific foot anatomy when matching the art style. Rabbits
  have fur-covered forepaws and elongated hind feet; dogs, cats and foxes have
  rounded paws with subtle toe marks. Monkeys have fingers, thumbs and toes.
  Elephants have broad skin-colored rounded feet with small ivory toenails.
  Reserve hoof shapes for hoofed animals; never copy the cow's hoof caps onto
  unrelated species. Inspect every complete silhouette before review/integration.
- Keep all sprite cells square and uniformly scaled. Use measured alpha crops
  and uniform SVG scaling for picker/quiz art so wide slots cannot stretch it.
  Runtime run/swim sheets are 1024×768 with four 256px columns and three rows;
  portraits are 1024×512 with four columns and two rows. Measure generated
  subject bounds before packing; never assume the source obeys its grid.
  Maintain at least 20px transparent gutters in every packed frame. Source
  crops and exact prompts live in `public/minigames/road-racing/art-layout.json`
  and `art-prompts.json`. Badge frames retain the universal medallion style.
- Present the English and Vietnamese question-language choices as the same two
  circular country-ball controls used by Waddle Wall. Keep localized accessible
  names on the buttons instead of visible text labels beside the balls.
- Fit setup, race, quiz, pause, results, and replay controls within laptop
  and iPad landscape viewports without horizontal or vertical scrolling.
  Verify complete flows and control bounds at 1366×768, 1024×768, and 1180×820.
- Use the shared question kinds and choice/projection contract documented in
  `server/src/questions/AGENTS.md`; Road Racing supplies the approved rotation,
  short localized prompts and racing-specific visual feedback.
  Questions have no individual deadline. After one incorrect answer, keep the
  same question and choice order, keep every choice pressable, and mark tried
  wrong choices red with accessible text. A second wrong answer finishes the
  question, moves the correct answer into the previous-answer bubble, and
  applies a two-second slowdown; show the retry message after the first wrong
  answer. Correct on the first try adds a two-second boost, while retry-correct
  adds neither boost nor slowdown. Buff and slowdown icons remain within the
  three-effect cap, and all effects expire naturally without client-side
  payout or state changes.
- Friends: capybara, crocodile, duck, goose, dairy cow, highland cow, chicken.
  Race the chosen animal against five other animals on a fixed-distance course
  targeting two minutes. Animals have terrain strengths. Keep duck, goose,
  and chicken: they may briefly fly over rocks, but never fly indefinitely
  or bypass the course's running/swimming sections.
  On land, the crocodile always runs as a quadruped. Its side-view sprite and
  animation must show two forelegs and two hind legs clearly participating in
  the gait; never depict it running upright, on two legs, or with hidden limbs
  that make the pose read as bipedal.
  Use one balanced course with land, water, and rocks; each animal should
  have a comparable overall winning chance. Terrain transitions and rock jumps are automatic:
  predefined animation speeds up with verified correct answers.
- Render a left-to-right side view with six horizontal swimlanes. Randomize the
  chosen animal's lane among all six at race start; its lane background is blue
  and the five opponent lanes are orange. Track terrain remains recognizable.
  Follow the chosen animal near center-left as the world scrolls. During a
  speed burst the camera briefly lags, letting the animal advance on screen,
  then smoothly recovers the center-left framing. Opponents can leave the
  viewport; do not force all six contestants to remain visible.
  Make the field feel like a cute, crowded race rather than six tiny isolated
  icons. Render large animal silhouettes in an overlay above the lane scenery,
  allow neighboring racers to overlap visually, and retain lane color/borders
  so each racer's assigned lane remains understandable. Keep the chosen animal
  visually identifiable through its blue lane and player marker.
- Race movement uses a proper per-animal sprite sheet with four frames for each
  of three rows: normal run, fast run, and full-buff ultra run. Select rows from
  the current boost state and animate across discrete frames. Keep the animal's
  identity, scale, baseline, facing direction, and limb count consistent across
  every frame. Full-buff frames include the glow, lightning, and spinning-leg
  motion while preserving a readable animal silhouette.
- Offer three server-owned race difficulty levels on setup: **Egg (Easy)**,
  **Hatched (Medium)**, and **Chicken (Hard)**. Egg is the default. Chicken
  preserves the original opponent pace configuration exactly; Egg and Hatched
  progressively slow the opponents so younger children can win without
  sustaining maximum boost stacks. Store the selected level in the race state
  and never accept a mid-race difficulty change. Opponent pace variations are
  predetermined and independent of the child's answers, with terrain strengths
  balanced over the complete course. Target steady accurate play being
  competitive and idle play finishing last.
- Pausing or switching tabs forfeits the current race; the kid must restart.
  Do not freeze the race for later resumption. Bind forfeiture and reward
  eligibility to server-owned race state. On return show a gentle, slightly sad
  popup explaining the race cannot count and offer a fresh race. Forfeited
  races grant no resource reward or achievement progress; preserve achievements
  earned in earlier completed races. Keep badge browsing/setup outside the live
  race. Leaving a race or completing it below first resets the consecutive-win
  streak; restarting cannot preserve a streak from a forfeited race.
  Proposed return copy: "Aw, we missed you!" / "You stepped away, so this race
  won't count. Your animal friend would love another try!" with "Race Again"
  and "Back to Playground" actions. Localize both English and Vietnamese.
- Show a compact centered ordering row of six chubby faces, first place on the
  far right through last on the far left. Anchor rank zero at the right edge
  and slide subsequent rank slots leftward. Use evenly spaced rank slots, never a progress
  line or distance-proportional placement. Stable animal keys and a transform
  transition slide faces into their new slots when racers overtake. Break exact
  ties consistently. Preserve server-owned arrival order using `finishedAt`;
  crossing the finish must not cause a jump to the far end of the row. Mark the
  child's face with the blue outline and localized You tag. Include every
  contestant even outside the main camera view. Respect reduced motion.
- Give every animal separate running and swimming sprite sheets. Each sheet has
  normal, fast, and full-buff ultra rows. Swimming frames use paddling, gliding,
  wakes, and droplets; never reuse a land-running gait in water. Water wakes
  render below and behind the animal rather than drawing a line across it.
- Paint terrain once across the full track, beneath transparent lane overlays.
  All sections use the same world texture origin. Never restart the background
  at lane boundaries or clip a different shoreline inside each lane. Use one
  smooth continuous irregular curve per section boundary, with matching
  adjacent edges and a one-pixel overlap to prevent antialiasing gaps.
  Build sections from repeatable raster tiles: warm dirt, blue water, and large
  concrete pavers. Do not synthesize terrain textures with CSS/SVG patterns.
  Opposite edges of each lossless raster repeat cell must match on both axes.
  Use reflected-neighbor packing when preparing generated tiles, preserving the
  base motif scale, and verify edge pixels plus the assembled repeated surface.
  Obstacles are rounded side-view raster rocks; the internal `fence` terrain
  identifier remains for compatibility with server-owned race state/timing.
  As the player enters the final stretch, ease the camera back so the finish
  line settles near the right side and the racers visibly rush toward it.
- Show one, two, or three lightning icons above each racer's back for its
  current visual boost level. Use verified active stacks for the child and the
  server-owned pace/speed state for opponents.
- Keep racers on a still first frame whenever the race is finished, forfeited,
  or otherwise inactive. Align the feet near each swimlane's vertical center
  so large sprites overlap as a pack without sitting on lane divider lines.
  Highland cow art always keeps its eyes hidden beneath its long forehead hair.
  Every sprite-sheet cell needs an internal transparent gutter so no adjacent
  frame fragment can bleed into the current animation frame.
- Speed boosts and slowdowns have at most three combined active effects. Each
  lasts exactly two seconds from its own award and expires independently. Never
  extend an existing effect. A first-try correct answer adds a boost only when
  `buffs < 3 - debuffs`; a forced finish after two wrong answers adds a slowdown
  unless three are already active, removing the soonest-expiring boost when
  necessary. Player speed is 8 + 3n for `n = buffs - debuffs >= 0`, and
  `8 × 0.5^(-n)` for negative n. Opponents are unchanged.
  At two stacks add a glow; at three add lightning and spinning Beyblade-like
  legs, inspired by the user's reference. Build spinning legs as separate assets
  composited for two-legged and four-legged animals, rather than baking the
  effect into every animal sprite. Keep animal identity readable.
- Award achievements plus Stamina, Wood, and Wool. Material payouts depend on
  final position, with higher ranks earning more. First place grants 60 stamina,
  40 wood, and 40 wool. For each resource, second = first / 1.30, third = first /
  1.40, fourth = third * .95, fifth = third * .95 * .95. Calculate using unrounded
  values and ceil each final amount independently. Reviewed payouts by place
  (stamina, wood, wool): 1st (60,40,40), 2nd (47,31,31), 3rd (43,29,29),
  4th (41,28,28), 5th (39,26,26), 6th (0,0,0). Last place receives no resource
  reward, but completed last-place races count toward achievements, including
  a first-last-place badge. No minimum-correct-answer threshold has been approved. Credit only
  a server-verified final result once, atomically and idempotently; never award
  resources for abandoned or unfinished races or browser-reported positions.
- Keep question selection, grading, timing, race outcomes, progress, resource
  rewards, and achievement eligibility server-owned. Authenticate and authorize
  profile ownership; never accept client scores or completion claims.
- Provide a named achievement group with badges, explicit unlock conditions,
  and difficulty levels. Catalog-only groups remain visibly not yet earnable;
  Road Racing definitions are server-verified only after eligible races finish.
- Register its reviewed server definitions with the authenticated admin-only
  catalog migration. The single catalog button lets the backend select outdated
  groups. Repeated runs preserve earned badges and progress; never accept
  browser-supplied groups or definitions.
- Badge artwork follows
  `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`:
  text-free illustrated collectible medallions with the shared frame, linework,
  palette, and detail level, varying only the central pictogram. Render names,
  difficulty, and unlock conditions outside the icon.
- Include the complete group in both Parent Space and Admin Space kid reports
  through the shared server-owned projection. Keep badge artwork, names,
  conditions, difficulty, earned status, and progress consistent. Unsupported
  progress is unavailable, never fabricated.

## Reviewed achievement conditions

Use the named **Road Racing** group and the eighteen definitions below. The first
sixteen conditions were approved earlier; the two slowdown conditions complete
the current reviewed group.
The eighteen badges use `/minigames/road-racing/badges.png`: 1024×1280,
four columns and five rows of 256px cells. Keep the first sixteen indexes 0–15;
Slow and Steady is index 16 and Snail Survivor is index 17. The final two cells
are transparent. Every renderer must read grid dimensions from server metadata.
All conditions require server verification and completed eligible races;
in-race milestones are pending until that race completes, never awarded from
a forfeited run. Completed sixth-place races remain eligible.

| Name | Unlock condition | Difficulty |
| --- | --- | --- |
| First Finish | Complete one race | Easy |
| Full Charge | Reach three active boost stacks in a completed race | Easy |
| Podium Pal | Finish in the top three five times | Medium |
| Road Champion | Win a race | Medium |
| Animal All-Rounder | Complete a race with each of the seven animals | Medium |
| Victory Lap | Win ten races | Hard |
| Scenic Route | Finish last for the first time | Easy |
| Podium Potato | Finish top three as capybara | Medium |
| Snappy Finisher | Finish top three as crocodile | Medium |
| Quack on Track | Finish top three as duck | Medium |
| Honk on the Podium | Finish top three as goose | Medium |
| Moo-ve Over! | Finish top three as dairy cow | Medium |
| Shaggy Speedster | Finish top three as highland cow | Medium |
| Cluck and Collect | Finish top three as chicken | Medium |
| Hat-Trick Hero | Win three races in total | Medium |
| Three-Peat Feet | Win three consecutive races | Hard |
| Slow and Steady | Finish a race after receiving at least one slowdown | Easy |
| Snail Survivor | Finish top three in a race with peak two or more slowdowns | Hard |

Any completed non-win or forfeited race interrupts the consecutive-win streak.
Earned achievements are permanent. Track streak changes server-side so leaving
and restarting cannot preserve a streak or fabricate three consecutive wins.
- Run applicable frontend/server gates and routine browser checks through an
  isolated headless agent-browser session. Keep generated evidence local.
- Do not commit, push, merge, publish, or provision cloud resources until the
  user provides the repository-required confirmation for this work.

## Resource collection feedback

- Every server-awarded Town resource receipt must show the material artwork and
  large `+N` amount in the play area's center, then fly to a visible Town storage
  or inventory control. Use `TownRewardBar` with the scene selector and a stable
  server revision/receipt ID; InfiniDrill retains its deposit-to-inventory flights.
- Animate successful newly committed actions only. Initial reads, reloads,
  heartbeats without a new reward, duplicate responses, wrong answers, forfeits,
  practice mode and zero-resource results must not replay or invent rewards.
- Animation is cosmetic: never calculate payouts or write inventory from it.
  Keep controls usable, localize announcements, honor reduced motion and clear
  timers/layers on unmount. Check the full path at all required landscape sizes.

## Finish celebration and storage

- Keep the shared Town storage control on the right of the header beside Badges
  and the language country ball. Preserve the centred game title and Back slot.
- Completed races replace the track with a podium scene: first on the tallest
  centre step, second left, third right; show large animal art and clear 1/2/3.
  The other three contestants cheer below. Include each racer exactly once and
  mark the chosen friend, whether on the podium or in the crowd.
- Derive standings from server finish times/distances using `finalStandings`;
  preserve the server-awarded player place even for exact ties. Never award any
  new resources or achievements from the ceremony or repeat awards on reload.
- Keep reward totals, new badges and Race Again visible alongside the scene at
  all required landscape sizes. Reduced motion shows still friends/confetti.
  Reward flights originate from the podium when it replaces the track.

## Shared question configuration

Question kinds, levels, identity, choices, projection, bounded selection and
saved-data compatibility are defined in `server/src/questions/AGENTS.md`.
Road Racing chooses the reviewed rotation and keeps three server-returned
choices, localized prompts and the full nonrepeating race sequence.

## Animal picture questions

- Use the 27-species bilingual picture catalog: the original seven racers plus
  twenty approved question-only animals. Never add question-only animals to
  rosters, terrain strengths, portraits, or animal achievement requirements.
- Approved standalone art lives in `public/minigames/road-racing/question-animals/`
  with exact generation/edit prompts. Render complete square images with uniform
  scaling, including in feedback bubbles; preserve species-specific feet.
- Exhaust unseen picture species before falling back to another question kind.
  Keep three unique localized choices and server-owned grading; saved original
  seven-species questions remain compatible.
