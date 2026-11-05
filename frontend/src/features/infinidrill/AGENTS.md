# Infinidrill Minigame Agent Guide

Follow `../AGENTS.md`, `frontend/AGENTS.md`, and the repository guide.

## Shared questions

Question identity, bounded selection, blank-solution rules, public projection,
opaque IDs and legacy saved-data conversion are defined in
`server/src/questions/AGENTS.md`. InfiniDrill supplies only its stage-to-level
configuration, expedition history and exhausted-layer behavior.

## Achievement badge visual contract

- Follow `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`
  for all Infinidrill badge art. Keep the shared illustrated medallion frame,
  linework, palette, and detail level; vary the central pictogram by achievement.
  Do not use monograms, lettering, emoji, or a separate frame style.

## Brainstorming and clarification

- Number every brainstorming and clarification question so the user can answer
  by number, including tool prompts. Keep numbers unique within each batch and
  preserve them when restating pending questions.
- Present questions as concise numbered lists. Use short lettered choices where
  they fit.

## Game boundaries

- Maintain the Infinidrill · Earth Expedition achievement group with ten badge
  designs, explicit unlock conditions, and obtainment difficulty levels.
- Register these definitions with the single idempotent, admin-only catalog
  migration. The backend selects outdated groups without changing player progress.
  Production earning uses server-issued questions and server-verified grading;
  never award persisted achievements from the browser reducer.

- Math answers drive downward drilling. Drill heads, added parts, and terrain
  provide visual rewards; confirm progression and resource rules before coding.
- Earth is the first world stage; math progression levels occur within it.
  Other planets are future scope. Keep head, cabin, accessory, engine, and
  tank-tread assets at fixed mounting points. Head tiers dig 3, 4, 5, 6, and 7
  visible three-metre tiles. Tiers 1 and 3 add one tile on a server-chosen side
  per dig. Each equipped cabin, engine, and tread tier adds one visible
  three-metre tile of depth per dig, stacking across slots. Equipped accessories
  fire an automatic diagonal laser on a server-chosen left/right side after a
  correct main answer. Laser tiers cut 1×2, 1×4, 3×4, and 3×6 visible tiles ahead
  without moving the machine. Clip cuts at level boundaries and preserve
  mastery requirements. Preserve the child's avatar and frame during glow-up
  reveals, starting only after server confirmation.
- Each laser row steps one column farther outward, entirely outside the widest
  possible cut of the currently equipped head. Animate beams down and outward
  along the diagonal path through those stepped block positions.
  Use visible down-facing laser accessories for all equipped accessory tiers.
  Extend deposits into the outer laser-reachable columns and fit their reach
  within the landscape viewport. Keep previous rectangular laser cuts readable.
- Passing a depth must not hide or collect unmined wall deposits. Keep their
  icons on intact tiles behind the machine until an actual cut reaches them.
- Inventory offers Return to basic for each upgraded slot. Restore only that
  starter part through the verified API; retain owned tiers, other equipment,
  balances and excavation history. A basic head mines three visible tiles.
- Deposits use a server-issued expedition seed and shared world coordinates.
  Diamond-bearing tiles have one-quarter the occurrence probability of nugget
  tiles (1% vs 4%). Award one item per mined deposit; empty digs are valid.
  Preserve previous excavation widths, existing balances and earned badges.
  Animate each mined item from its block position to Inventory.
- Persist laser cuts alongside main cuts and deduplicate deposit awards across
  both. Owning an unequipped laser must not fire it; returning a part to basic
  removes its active benefit without deleting owned tiers or earlier cuts.
- Use the same drill-head icon in the list and gameplay header. Provide an
  in-game achievement panel showing server-verified earned and locked badges,
  difficulty and unlock conditions; pause and resume the question timer.
- Generate multiple block texture variants and place material families by depth:
  dirt, harder dirt, rock, deeper rock, rock with lava, then the core. Keep the
  background minimal, blend layer boundaries, and preserve reward-linked ore
  deposits. Lava and material hardness remain visual only in this version.
- Preserve the 18-level expedition, depth/mastery gates, equipment and badges;
  stage mapping and Venn artwork are game-specific presentation choices.
- Keep browser API traffic same-origin. The Render API must validate persisted
  answers, rewards, inventory, ownership, and progress server-side.
- Town rewards include one bonus sand for every ten newly earned rocks, keeping
  all rock. The server retains each child's remainder across digs and replays;
  display confirmed `townReward` values without calculating or awarding locally.
- Run the frontend gates in `frontend/AGENTS.md` after code changes.

## Visual identity and asset production

- Achievement artwork follows the shared storybook, text-free collectible
  medallion prompt in `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`.
  Keep the common frame, linework, palette and detail level; names, difficulty
  and unlock conditions belong outside the icon. Definitions become earnable
  only through implemented server-verified grading and progress.

- Match the existing kid avatars and avatar frames, especially
  `frontend/public/avatars/kids/capybara-calm.webp` and the tank/space frames in
  `frontend/public/avatar-frames/`. Inspect these references before generating
  or replacing any drill artwork.
- Use flat, friendly 2D illustrations: chubby rounded silhouettes, thick warm
  brown outlines, soft pastel fills, and minimal shading. Keep details readable
  at game and workshop-preview sizes. Avoid realistic metal, glossy 3D renders,
  faceted highlights, neon effects, and excessive mechanical detail.
- Generate raster drill/upgrade assets using ImageGen with the avatar/frame
  images as explicit style references. Keep all five slots (head, cabin,
  accessory, engine, tank treads) consistent across starter and four upgrade tiers.
- Preserve transparent backgrounds, sprite proportions, and fixed attachment
  positions. Measure atlas crop rectangles rather than assuming generated grids
  are exact. Keep the cabin window empty for the active avatar and frame.
- Mount tank treads vertically on the right side of the machine. The source
  track art faces left, so rotate it 90 degrees counterclockwise to face down;
  do not place horizontal tracks under the cabin. Apply the same anchor and
  orientation to every tread upgrade.
- Document the final prompts and reference paths with the generated assets.
  Preview the assembled machine and upgrades in a real browser after replacement.
- Keep the setup screen free of the removed Telephone keypad, Cosmetic upgrades,
  and Earth's core tags. Do not reintroduce them as feature badges.
- Use a depth-following camera and separate underground background walls from
  solid foreground blocks. Drilling breaks/pushes away foreground material and
  leaves a visible shaft revealing the background; the surface must leave view
  as the drill descends. Keep the drill gently bouncy while moving and give cave
  falls a soft landing. Keep the math controls stationary.
- Render only terrain rows, deposits, labels, cave sections, and debris that
  intersect the viewport. Unmount offscreen content, expire debris, and prune
  passed cave metadata. Do not render the entire Earth or retain old DOM rows.
- Foreground blocks use simple pastel textures with sparse detail. Each original
  six-metre block is visually divided into 2×2 smaller three-metre tiles; keep
  the existing math and depth progression unchanged. Excavation
  tapers into a V at the drill tip and widens into the persistent shaft behind.
- Underground walls retain a little subtle texture with a soft blur. Group
  adjacent background rows by material to avoid per-tile blur layers.
- Decorate only visible solid/empty boundaries, including stepped sides and the
  V-shaped tip, using the material-matched transparent `tunnel-edges.png` atlas.
  Document generation prompts and measured crop rectangles with the asset.
- Use the generated four-frame side-view head atlas while drilling/firing.
  Rotate flutes/facets around the head shaft, not the entire sprite in the
  screen plane. Keep mounting anchors fixed, use CSS frame cycling, restore
  still art when idle/paused, and use still art for reduced-motion preferences.
- Keep a gentle engine vibration during active play, including idle question
  time. Compose it with descent/glow animations; stop while paused or viewing
  overlays and honor reduced motion. Clicking/tapping the idle machine emits
  1–5 rounded hearts in an arch above the cabin, with no server action or reward.

## Minigame viewport requirement

- Optimize setup, gameplay, optional challenges, upgrades, pause, results,
  failure, and replay for laptop and iPad landscape screens.
- Keep the play area and all controls needed in the current step visible and
  usable together, without vertical or horizontal scrolling. Prompts must not
  cover controls or hide their action buttons.
- Size layouts using available viewport width and height, browser chrome, and
  safe areas. Preserve artwork proportions, readable text, and usable touch
  targets.
- Verify complete flows in a real browser at 1366×768, 1024×768, and 1180×820.
  Check every button's bounds and confirm each state needs no scrolling.
- Browser test command, from `frontend/` so Tailwind scans the app correctly:
  `node --import ../server/node_modules/tsx/dist/loader.mjs tests/browser/infinidrill.test.ts`.
  Cover stacked chains, operand/result blanks, all multiplication bands and
  every Venn target, including correct/wrong answers, bonus, pause and replay.

## Brand, interface language, and haptics

- Keep transport in `useInfinidrillServerSession.ts`, visual timers in
  `useInfinidrillAnimations.ts`, and artwork/panels in their presentation
  modules. Use `useSessionRequests` to discard callbacks after family/session
  or profile changes and unmount. Never move grading or persistent rewards
  into a visual controller.

- Display the brand as **InfiniDrill**. Module paths, API paths, IDs and existing
  data contracts retain their spelling for compatibility.
- Interface labels follow the global device UI language. Math values and
  question generation never change as a side effect of switching UI locale.
- Gameplay uses two 64px header rows: Back to Playground, icon + Pause game,
  Badges and the shared language slot first; diamonds/nuggets and Inventory
  second. Show depth and the Town storage link on the digging view. Keep all
  current controls inside the remaining laptop/iPad viewport.
- Pause offers Resume and Start new session. Resume preserves the current
  question/depth. Start new session uses the existing revisioned server replay
  command and returns directly to level 1 at ground level after confirmation.
  Clearly explain the fresh drill inventory; earned badges and Town storage
  remain saved. Failed requests must recover through Sync game before retrying.
- Brief optional vibration is triggered only when the server confirms a
  correct main answer and downward drilling begins. Feature-detect it, catch
  unsupported calls, and skip it for reduced motion. iPad Safari does not
  support the web Vibration API; preserve visual feedback there.

## Parent and admin achievement reporting

- Whenever a minigame is added and its achievements are produced, include the
  minigame and its complete achievement group in the kid profile reports in
  **both Parent Space and Admin Space**. This is part of adding the minigame,
  not a later optional task. Keep names, badge artwork, unlock conditions,
  difficulty, earned status and progress consistent across both spaces.
- Use the shared server-owned child-report projection and the universal activity
  identity/design language. Test both reports when adding a group; registering
  it only in the admin achievement catalog is insufficient.
- Keep catalog-only definitions visibly labeled as not yet earnable. Show
  unsupported progress as unavailable, never invented completion counts or
  earned badges. Earned status must come from server-verified progress.
