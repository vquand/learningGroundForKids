# Fishing Minigame Agent Guide

Follow `../AGENTS.md`, `frontend/AGENTS.md`, and the repository guide.

## Shared questions

Question generation, identity, grading, projection, bounded selection and saved-
data conversion are shared rules owned by `server/src/questions/AGENTS.md`.
Fishing only selects the bait configuration: baby → `addsub-2d1d` with `+` and
a result blank; beginner → `add-2d` with `+`; leafy → `addsub-20` with `−`;
chewy → `sub-2d`; bouncy → `mul-2to5`; crunchy → `mul-1d`; master → `div-1d`.
Baby addition uses a left operand from 10–98 and a right operand from 0–9 with
no carrying; baby hides only the result. Every other bait requests any solvable
blank. Keep typed input local, clear it after a wrong answer and when a new
question arrives, and never render private answers, operands or identity keys.

## Brainstorming and clarification

- Number every brainstorming and clarification question, including tool prompts.
  Keep numbers unique within each batch and preserve pending question numbers.
  Use concise numbered lists with short lettered choices where appropriate.
- The user approved the first-release bait/math and catch tables, rewards,
  eight-second automatic catch wait, and 60 pond / 180 river graduation targets.
  Future location content and mechanics remain proposals; preserve this scope.
- Design reference: `docs/plans/fishing-minigame.md`.

## Game and art direction

- Let the child choose Highland Cow, Capybara, or Dairy Cow as their fishing
  friend. Show the friend sitting beside the water holding a fishing rod.
- During setup and trip selection, show separate ready-for-the-trip artwork
  without an active rod or line. Use it in both preview and choice cards.
  Choosing or greeting a friend gives one brief chubby wiggle and a floating
  heart; repeating a greeting is cosmetic and does not mutate game progress.
  Reduced motion uses a still heart, then removes it after the same short delay.
- Highland Cow has long shaggy bangs completely covering both eyes in ready
  and fishing poses. Express its emotions through its mouth, body and emotes.
  Keep fur simple: a few large soft locks and rounded masses, flat pastel
  shading, minimal interior lines, and no fine hair strokes or busy texture.
- Fishing spots form a vertical list, with two choices per page as more spots
  are added. Selecting an unlocked spot updates the scene background; keep
  location unlocks and saved choices server-owned.
- Keep all fish, companions, environments, and future spooky themes cute,
  chubby, and cozy, with big eyes or simple `-.-` eyes. Use the app's pastel
  palette and thick warm outlines; include restrained fishing/picnic details.
- The first content release proposes a normal pond with an ambient frog and
  a river near town. Do not implement later locations without approved scope.
- Fishing has no daily cast cap, outing duration limit, comfort meter, or forced
  departure. Later weather/heat/cold are atmosphere until separately designed.
- Retain fish quantities for future aquarium and meal-making use, and preserve
  journal discoveries. Release turtles after recording their rewards/discovery.
  Those future aquarium/recipe systems are not part of the first release.
- Use large cartoon forehead sweat drops, wiggling/twirling annoyance squiggles
  for garbage catches, and floating hearts for successful fish/turtle catches.
  Put the annoyance squiggle inside a steady cream thought bubble with a thick
  warm outline and trailing dots; rotate only the inner squiggle. Pause the
  rotation with gameplay and keep it still for reduced motion.
  Keep reactions brief, cute, and cosmetic; they introduce no comfort meter or
  fishing limits. Give wrong math answers encouraging retry feedback.
- Present the approved no-fish outcome as pulling up cartoon garbage (for
  example, an old boot or small rounded can). Preserve its existing probability,
  one-bait cost, and zero stamina/points. Garbage is not retained fish inventory
  and does not introduce a cleanup reward system.
- Anchor transparent emote layers to each friend's head without clipping horns,
  ears, or scene bounds, or covering controls. Pause them with gameplay and use
  still emotes/short fades with reduced motion.
- Keep the question, keypad and Submit button inside the bottom of the
  right sidebar, leaving the companion scene unobscured. Scope keyboard input
  to this panel so language, navigation and open badge dialogs cannot grade.
  Use the label Submit. Keep live compatible unlocked bait counts and each
  location fish's retained quantity (including zero) visible above the question.
  Turtles are released visitors, not retained fish in this bucket tally.
  Present numbers as right-aligned column arithmetic with a rule above the
  result. Stack the question above the numpad, retaining 48px controls on iPad.
  Keep bait box and fish bucket at the top, with visible space before the question.
  Use the shared topbar Pause game icon/label and Resume/Leave dialog pattern
  from InfiniDrill. Back to Playground opens the matching quit confirmation;
  keep pause/quit controls out of the learning sidebar.
  Server-authored layouts hide exactly one operand or the result. Never expose
  hidden operands or answers through expressions or layout metadata. Render
  pre-layout saved questions in columns without changing their grading.
- Float positions use the measured painted line endpoint in each companion's
  idle/casting sprite coordinates. Move the whole companion/float frame for
  breathing; animate ripple water without disconnecting the float.
- Keep lotus leaves at the far pond shore and the frog farther up the scene,
  leaving open water around every float position. The frog sits on its own
  generated transparent `frog-lotus-leaf.png`. `PondFrog` composes separate leaf
  and frog layers, independent of the background. Preserve the leaf when
  swapping its frog child for future expressions; animate only the frog body.
  The open water-filled fish bucket is a separate 152px square prop layer,
  replacing the earlier picnic basket. Keep the water visible and draw it in
  front of the companion; use Fish bucket consistently in inventory copy.
- Catch possibilities show icons and names without probability percentages;
  the empty outcome is labeled No fishy. Keep server-owned catch odds unchanged.
  Show local progress as a 36px bar with the current/target count centred inside;
  keep its descriptive label accessible without a visible caption.

## Authoritative progress and rewards

- Render owns issued math questions, answer grading, bait balances, catch
  probabilities, casts/results, fish records, fishing points, location unlocks,
  graduation, and stamina rewards. Never trust browser claims for these.
- Use authenticated, profile-owned, revisioned actions. Deduplicate rewards
  and preserve a committed cast/result across reloads and repeated requests.
- Credit approved stamina to Town Building atomically with the verified catch;
  never deduct or grant stamina based only on a client animation or claim.
- Commit retained fish quantities and journal records with catch progress and
  rewards exactly once. Turtles do not enter fish inventory. Future fish use
  must debit server-owned quantities without replaying catch rewards.
- No production migrations, cloud changes, commit, push, or publish without
  the repository's required user confirmation.

## Achievements and reporting

- Maintain a named Fishing Friends achievement group. Every achievement needs
  a badge, explicit unlock condition, and obtainment difficulty.
- Register with the authenticated admin-only catalog migration using reviewed
  server-owned definitions. Repeated migrations must be idempotent and preserve
  earned badges and player progress; never accept browser-supplied definitions.
- Catalog definitions are not earnable until server-verified grading/progress
  exist. Label catalog-only badges as not yet earnable and unavailable progress
  as unavailable, without invented counts or client-awarded badges.
- Include the complete group in kid badges and both Parent Space and Admin
  Space child reports using the shared server-owned report projection.
- Follow `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`:
  illustrated text-free storybook medallions with the common frame, linework,
  palette, and detail level. Put names, difficulty, and conditions outside art.
- Use the shared generated Badges icon beside the language selector.

## Viewport and interface requirements

- All setup, companion/location/bait selection, math, fishing, pause, results,
  failure, and replay controls must fit laptop and iPad landscape viewports
  without horizontal or vertical scrolling. Keep current controls and artwork
  visible together with readable type and usable touch targets.
- Account for browser chrome, safe areas, and the global language/Badges slots.
  Paginate collections and choices when needed; preserve artwork proportions.
- Verify complete flows in a real browser at 1366×768, 1024×768, and 1180×820.
  Check every current action's bounds and confirm no scrolling is needed.
- Use shared child navigation and English/Vietnamese interface translations;
  keep the selected math-learning language independent of interface language.

## Implementation and local verification

- `FishingPage.tsx` renders setup, scene, bait controls and server-owned results;
  `FishingPanels.tsx` contains inline sidebar math and modal trip/collection panels.
- `useFishingSession.ts` scopes requests/cache to family session and kid profile,
  serializes revisioned commands, pauses on blur/hidden and requires explicit
  resume. A failed command requires Sync before another command; never retry an
  uncertain answer/cast blindly. Lost replies may already have committed.
- Approved browser-safe content comes from `server/src/fishing/catalog.ts`.
  `viewCatalog.ts` only adapts that catalog for display. Do not duplicate odds,
  reward amounts or grading in the browser.
- Generated friends, catches and props use square-cell atlases; preserve the
  cell aspect ratio and verify rods, ears/horns and head emotes in every pose.
- Village River uses `river-v2.png`, the five R1–R5 fish in `river-fish.png`
  (3×2, 512px cells; last cell empty) and `river-baits.png` (three 724px cells:
  Bouncy, Crunchy, Scholar). Keep the lower-left grassy bank open under the
  existing companion/bucket anchors. Preserve the original pond/common species,
  turtle and garbage art. Prompts live in `VILLAGE_RIVER_ART_PROMPTS.md`.
- Run focused API/copy tests with `node --test frontend/tests/fishing*.test.ts`.
  Run browser tests from `frontend/` with
  `node --import ../server/node_modules/tsx/dist/loader.mjs --test tests/browser/fishing.test.ts`.
  Set `PLG_CHROMIUM_EXECUTABLE` to the installed local Chrome when needed.
- The isolated `tests/browser/fishing-preview.ts` uses the real reducer in a
  Node-only Vite fixture. Its sample profile and deterministic data never enter
  production routes; it does not connect to the real kid database.

## Continuous session flow

- Start/Continue once per active session. Keep casting automatically using the
  selected stocked compatible bait, otherwise the easiest compatible bait in
  catalog order. Show a two-second catch reveal before the next eight-second cast.
- Math stays independent of fishing: opening or answering questions does not
  pause the friend. Serialize answers behind heartbeats without dropping input.
- Keep the running session armed when bait runs out. Show the annoyed squiggle
  and restart immediately when a verified answer supplies bait. Explicit pause,
  hidden tabs, navigation and dialogs require Continue; never farm offline.
- Friend choices remain available for saved casts. Changing a friend pauses and
  preserves the consumed bait, committed outcome and remaining wait. Location
  changes still require the current cast to finish.
- Fish reward points use the shared species table, from 1 for small common fish
  to 4 for large/rare catches. Stamina is separate. Preserve historical rewards.

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

## Fishing break and counts

- Keep only the current spot's graduation bar in the scene; omit the combined
  lifetime-points sticker. Pond/river points and graduation remain server-owned.
- Bait choice cards show a large `×N` count, without the repeated “in box” label.
- On every paused/break state, use the generated curled-up sleeping pose for the
  selected friend from `sleeping-friends.png`. Preserve Highland Cow's covered
  eyes and character identity. Hide active fishing floats and reaction emotes;
  keep the pose still for reduced motion. The original cast stays saved.
- Sleep atlas source prompt and coordinates are recorded in `SLEEP_ART_PROMPT.md`.
- Keep sleeping friends on the same 27% bank anchor as fishing friends. Hide
  the scene bucket while they sleep, restoring its normal bank position on resume.
  Never raise the animal to clear a prop or leave the bucket floating on the water.

## Starter math and bait display names

- Baby Bait uses result-only `addsub-2d1d` addition: left 10–98, right 0–9,
  and the ones digits never carry. Do not issue hidden-operand baby questions.
- Preserve grading for already-issued questions and all saved bait balances.
- Show Corn Bait (Mồi bắp) for persisted ID `beginner`, and Worm Bait (Mồi giun)
  for `chewy`. Keep IDs, odds, rewards, unlocks and asset slots unchanged.
- Fishing multiplication uses the shared single-digit levels. Bouncy retains
  2–5 factors; Crunchy uses `mul-1d`, so factors may be 0–9 and products reach
  81. Preserve division.

## Continuous and varied bait practice

- Submit grades the current response on the server. With continuePractice enabled,
  a correct answer grants one bait and returns a new question of the same bait
  type atomically. Keep the keypad open and clear/refocus input. Incorrect answers
  retain the same question and retry feedback; Close explicitly dismisses it.
- Persist the last six issued math facts privately, across reloads and dismissed
  questions. Reversed addition/multiplication operands and alternate missing-number
  positions count as the same fact. Exclude all six when issuing another question.
  Keep existing skill ranges/borrowing rules, private answers and replay protection.
- Sleeping companions hide the last catch/garbage bubble, reward and discovery
  labels. Keep committed catches, inventory, rewards and outcomes unchanged.

## Atlas clipping in shared icons

- Keep explicit source-coordinate clips on shared catch/prop sprites, including
  river fish. Outer SVG overflow alone exposes neighboring atlas pixels inside
  the letterbox when square sprites occupy rectangular slots. Preserve the
  measured crop, full fish silhouette, uniform scaling and original PNGs.
- Regression coverage: fishing-sprite-render.test.ts and the isolated
  fishing-sprites.browser.mjs gallery/pixel checks at rectangular icon sizes.
