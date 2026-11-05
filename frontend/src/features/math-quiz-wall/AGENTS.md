# Math Quiz Wall Minigame Agent Guide

Follow `../AGENTS.md` and `frontend/AGENTS.md`.

Question generation, identity, choices, projection, bounded selection and
saved-question compatibility are shared rules owned by
`server/src/questions/AGENTS.md`. Waddle Wall owns difficulty weighting,
result-blank choices, lane history and the hard answer cap of 99.

## Achievement badge visual contract

- Follow `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`
  for all Waddle Wall badge art. Keep the shared illustrated medallion frame,
  linework, palette, and detail level; vary the central pictogram by achievement.
  Do not use monograms, lettering, emoji, or a separate frame style.

- Number every brainstorming and clarification question so the user can answer
  by number. Keep numbers unique within each batch and preserve them when
  restating pending questions, including tool prompts.
- Follow the accepted gameplay in `docs/plans/2026-10-06-waddle-wall.md`.
  Clarify new ambiguous gameplay changes with the user before implementing them.
- This planned game is the fifth activity on the kid's playground page, for
  ages 5–8. Easy walls are green, medium walls yellow, and hard walls orange.
- Before playing, kids select a capybara, dairy cow, or highland cow and an
  English or Vietnamese language option displayed as a flag without a label.
- Use a fully 2D illustrated arena with warm outlines matching the kid avatars
  and avatar frames: generated ground/pond, continuous wall strips, flowers,
  stars, heart, and splash. Do not restore WebGL or procedural 3D scenery.
- Use lively, chubby 2D animal sprites matching the Town animal atlas and kid
  avatars: simple rounded silhouettes, smooth cocoa outlines, muted honey/
  caramel/cream fills, minimal flat shading, no detailed fur or glossy highlights.
  Each animal has six real walking frames per direction plus rear and surprised
  poses. Use rear at rest, an actual stepping cycle during travel, and surprised
  during the splash. Do not jiggle/rotate a static side sprite to fake walking.
  Freeze animation during pause and honor reduced motion. Use the same artwork
  in setup and gameplay.
- Preserve sprite aspect ratios and align the feet when switching poses.
  Generated source alpha bounds live in `docs/artwork/waddle-wall/chubby-v3/manifest.json`.
  `frontend/scripts/prepare-waddle-art.mjs` normalizes and packs 256×192 cells
  with a shared foot anchor; `animalSprites.ts` owns the runtime coordinates.
  Keep noses/tails inside each cell. Do not restore 3D animal models.
- Passing shows a chubby heart, flowers, grass, and stars while the wall fades.
- Keep the moving wall continuous across all three lanes: one artwork surface
  with no highlighted container border, three answer positions, and a cutout at the correct
  position after arrival. Do not render three independently framed blocks.
- Use registered four-state wall sheets (full, left, middle, right) through
  `wallMaterial.ts` and `wallSprites.json`. Each passage has illustrated broken
  edges appropriate to its material; do not restore a rectangular CSS cutout.
  All frames share one coordinate system; never trim/recenter surviving chunks
  independently. Keep the animal in front of the wall and separate HTML answers
  above the animal. Difficulty colors belong on answer labels.
- Minecraft walls use crisp square grass/dirt texture tiles: grass on the top
  row, dirt below. Adapt row/column counts to the available area using
  `minecraftLayout.ts`; never stretch one large illustrated strip. Use the
  generated block sheet only as an alpha silhouette over those square tiles.
  Keep answer
  text in separate HTML overlays at the relative centres of the three lanes.
- Pause and finish display only newly unlocked badges from this game. Track
  them on the server, preserve through reloads, and reset on a fresh game.
  Hide the section if empty; the Badges page still shows the full collection.
- Offer three lanes selected by tap/click or physical keyboard keys 1/2/3.
  Anchor lane numbers at the routes' border with the pond, inside the canvas
  area. Use projected HTML controls with undistorted text. Keep the pool,
  lanes, and wall visible together across screen sizes.
- Show the question only above the canvas, never on the wall; the wall carries
  answer numbers. Stop the wall at the pond border. On success fade it out;
  on failure leave it stationary so it does not obscure the fall into water.
- One wall is one round/wave; there is no fixed wall limit while answers are
  correct, but the first failed wall ends the session. Mix difficulties, increasing
  the chance of harder questions as the child progresses and reducing that
  chance after successfully passing a harder question.
- Difficulty weighting and the hard answer cap follow the server configuration;
  shared level rules are documented in `server/src/questions/AGENTS.md`.
- Math Scientist is the seventh badge, earned by clearing 10 hard walls in the
  lifetime server counter. Keep its separate `math-scientist.png` medallion
  alongside the original six-badge atlas, and show it consistently in session
  unlocks, collections, the admin catalog and Parent/Admin child reports.
- Keep gameplay focused on the question. Show the current best score only
  while paused or finished. The global leaderboard includes only the active
  kid and their accepted kid friends; exclude other kids and family-level
  friendships. Enforce this visibility on the server.
- Hide the global leaderboard when there are no connected kid friends.
  Use child-facing copy: "You and your friends" / "Bạn và bạn bè".
- For a kid without connected friends, show "Your high score so far: N"
  (localized into Vietnamese) using the saved personal best. When the friends
  table is visible, award a gold medal to every entry tied for highest score.
- Use the Shoo Shoo UFO dairy cow as a visual reference. English uses the
  British flag, Vietnamese the Vietnamese flag. Use classic outlined 2D
  countryballs with simple white eyes: British top hat and Vietnamese nón lá,
  matching the supplied references rather than glossy 3D faces.
- Add a dedicated achievement group with distinct badge designs sharing
  enough visual features to identify them as one group.
- Sessions end at the first failed wall or when the child chooses Finish.
  Show the splash before the finished prompt, including the wall number and
  earned points. Require Play again before another game. Each passed wall earns
  difficulty points: easy 1,
  medium 2, hard 3. Persist personal bests and earned badges across sessions.
- Allow 10 seconds for easy questions, 15 for medium, and 20 for hard.
- Design achievements around walls passed, streaks, and harder questions.
- Offer a pre-game wall-style choice: hard brick, Minecraft-style blocks,
  European stone, and Vietnamese garden fence. Keep natural material colors;
  answer panels and the wall border show green/yellow/orange difficulty.
- Run the frontend checks specified in `frontend/AGENTS.md` after code changes.

- Present brainstorming and clarification questions as concise numbered lists.
  Use multiple-choice options where they fit, with short lettered choices so
  the user can reply with a question number and option letter.

## Minigame viewport requirement

- Optimize every existing and future minigame for laptop screens and iPad
  landscape screens. All buttons and controls needed in the current step must
  be visible and usable within the viewport, with no vertical or horizontal
  scrolling required.
- Apply this to setup, gameplay, heat/ingredient selection, pause, results,
  failure, and replay prompts. Keep the play area and its current controls
  visible together; prompts must not cover controls or require scrolling to
  find their action buttons.
- Size and arrange the layout using the available viewport width and height,
  including browser chrome and safe areas. Preserve artwork proportions,
  readable text, and usable touch targets when fitting the screen.
- Verify complete flows in a real browser at representative laptop and iPad
  landscape sizes, including 1366×768, 1024×768, and 1180×820. Check every
  button's bounds and confirm that no scrolling is needed in each state.
- Include this requirement in the implementation-directory `AGENTS.md` of
  every future minigame.

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

## Chubby walking sprites

- Use the original `*-sprites.png` atlases as the body-proportion and character
  references. Keep their large heads, round bellies, broad rears and stubby legs
  in every motion frame; do not slim or stretch the character for animation.
  Highland cow's thick front fringe must fully hide both eyes in every walking,
  idle and surprised pose. Never show eyes, pupils or eye highlights through it.
  Runtime uses versioned `*-motion-v3.webp` sheets. Generate via built-in
  ImageGen, then pack with `node frontend/scripts/prepare-waddle-art.mjs v3`.
- The countdown bar is green above 50%, yellow from 50% to above 25%, and red
  for the final 25%. Its shrinking length remains an independent time cue.
- Keep the browser on the server-returned choices and lane state; shared
  question identity and selection rules are documented in
  `server/src/questions/AGENTS.md`.

## Wall-state artwork

- `docs/artwork/waddle-wall/wall-openings-v1/` retains generated sources, exact
  built-in ImageGen prompts and the crop manifest. Repack using
  `node frontend/scripts/prepare-waddle-walls.mjs` (installed ImageMagick).
- Each material has one 900×1200 WebP containing four 900×300 frames. Full
  walls preload the same sheet later used for the correct lane opening.
- Only server-graded `pass`/`splash` with a valid correct lane selects an opening.
  Player lane choice and approaching walls must always use the full frame.
- Test actual alpha at all lane centers, varied opening contours, registration,
  square Minecraft tiles, answer/animal clearance and the required viewports.

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
