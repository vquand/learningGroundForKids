# Cabbage Roll Kitchen — implementation guide and gameplay spec

Follow `../AGENTS.md`, `frontend/src/features/AGENTS.md`, and
`frontend/AGENTS.md`. This is the meal-specific source of truth agreed during
the cabbage-roll gameplay discussion on 2026-10-15.

## Working rules and status

- Number every brainstorming and clarification question. Keep numbers unique
  within a batch, preserve pending question numbers, and offer short lettered
  choices where useful.
- The current UI/UX follow-up is on `feature/uiux-improvements`, as requested.
  Do not commit, push, merge, publish, or provision cloud resources until the
  user says `confirmed`.
- The complete six-step recipe is implemented in `CabbageRollPage.tsx`, with
  pure transitions in `cabbageGame.ts`, gesture inputs in `CabbageInputs.tsx`,
  and generated sprite atlases described in `GAMEPLAY_ART.md`.
- The pending **Grilled garden vegetables** menu card is replaced by **Cabbage
  rolls with meat**, ID `cabbage-rolls`, at the Pot station. It is playable from the kitchen menu. Preserve other meals.
- Use beef, carrot, mushroom, and onion for the filling. The correct seasoning
  choices are salt, pepper, and soy sauce. Finish in tomato sauce.
- This is guided play. Chopping uses an automatic timing pointer and broad
  target stripes; mixing has no speed challenge. Final simmering uses the
  separately agreed 50/10/20/10/10 timing zones.

## Universal design language and layout

- Match the existing kitchen/Chef Capy storybook artwork, typography, palette,
  panel treatment, spacing, and control hierarchy. Reuse shared design tokens
  and `frontend/src/components/kidControls.css` rather than inventing another
  button system.
- Use `KidBackButton` and the shared `kid-nav` header: contextual Back to
  Kitchen action first, consistent 64px navigation row and 48px controls,
  reserved top-right interface-language slot. Use `kid-nav-action` for header
  actions. Keep pause, sound, instructions and results consistent with the
  existing cooking games.
- Keep an uncluttered central play canvas, a compact six-step progress display,
  and the current instruction/action together. Folding must act directly on
  the food in the canvas; controls must visibly correspond to the food.
- Use large readable text and touch targets. Supplement color with labels,
  outlines or pictograms. Support mouse, touch and keyboard equivalents,
  reduced motion and sound muting. Reduced motion must preserve timing cues.
- Localize authored English/Vietnamese UI at render time with `uiText` and
  `useUiLanguage`; follow `frontend/src/i18n/AGENTS.md`. Changing language must
  preserve the current recipe, folds, timers and earned progress.
- Full achievement collections use shared `BadgeCollection` and `BadgeCard`
  components with fixed card/artwork sizes and wrapping, never smaller badges
  as the group grows. In-game compact reward panels still fit the viewport.

## Viewport requirement

- Optimize setup, each ingredient/chopping/mixing/heat/folding/cooking state,
  pause, results, failure, retry and replay for laptop and iPad landscape.
- All controls needed now must remain visible and usable alongside the play
  area without vertical or horizontal scrolling. Prompts must not cover them.
- Size from available width AND height, including browser chrome and safe
  areas; preserve artwork proportions, readable text and usable touch targets.
- Verify complete flows in a real browser at **1366×768**, **1024×768**, and
  **1180×820**; also check compact kitchen cards at **1180×720**. Measure the
  bounds of every action and actual artwork, not only containing buttons.

## Agreed six-step gameplay

### 1. Peel the onion and chop meat and vegetables

- Latest user revision supersedes the two-zone/six-chop mechanic. Show a
  horizontal bar with **three broad green stripes**. Guide the child to tap the
  **wooden handle of the illustrated knife above the food**. Place the native
  button target over the handle with a visible touch cue; keep the blade inert.
  No separate Chop button at the bar. Show retry in the instruction panel.
  Hit each stripe once, in order, during one forward pass: exactly three
  consecutive successful chops finish the ingredient. Stripes are not buttons.
- Initial timing: 7.2 seconds per crossing. Choose from the reviewed target
  presets in `CHOP_PATTERNS`; every preset has three ordered, separated green
  zones with small variations in position and width. Start with a random preset,
  then change it for each ingredient and retry. Keep the pointer moving forward
  after each hit, including during
  the 350 ms knife animation; never reset or reverse it after a successful chop.
  Ignore duplicate presses during the knife animation. Mark each hit stripe ✓.
- Missing the next stripe (passing it or pressing outside it) stops the attempt.
  **Try three chops again** resets only that ingredient's cuts and pointer.
  Do not allow later stripes or repeat hits in a completed stripe to substitute
  for the next target. Pause/focus loss freezes all timing; bound stalled frames.
- Four distinct authored sprites per ingredient: whole → large pieces → smaller
  chunks → finely minced/diced. Switch to the next sprite at each successful
  chop. **No opacity crossfade between whole and minced assets.** Keep food on
  the board; animate the separate knife. The shared cutting board is viewed
  directly from above with no visible front edge, thickness, foreshortening or
  three-quarter perspective, and every ingredient stays centered on it. Carry
  the same fine-stage art into mixing.
- Apply to beef, carrot, mushroom, and onion. Explicit Next moves between
  ingredients after the third chop animation finishes.
- Onion starts unpeeled. **Peel the onion** removes its brown outer skin before
  chopping; show the peeled white onion after the peel animation.
- Mouse, touch and keyboard activate the same knife-handle button and are graded
  against the displayed pointer position. Reduced motion preserves timing cues.
- The knife artwork stays close to horizontal so its chopping motion reads
  naturally. Its handle target is at least 44×44 px, keyboard accessible, and
  described by the visible handle-tapping instruction. Keep it visible with the
  timing bar at every required viewport, including narrow phones.
- At the top of the chopping canvas, always show: **“Knives are dangerous. Only
  use one while an adult is watching.”** Localize it, expose it as a note, and
  keep it readable without obscuring the food or timing bar.

### 2. Select ingredients and mix

- Tap OR drag the minced beef and chopped vegetables into the bowl. Keyboard
  activation must work too. Once all four are in, enable Choose seasonings. Choose the correct
  seasonings from a small selection; do not measure spoonfuls in this step.
- Each ingredient falls from above into the bowl, then stays inside its opening
  behind the front rim. Never stick ingredient sprites to the outside wall.
- Salt and pepper use tilted shakers and falling particles; soy sauce uses a
  tilted bottle and liquid stream. Do not substitute stars for seasoning actions.
- Stir along a perspective **ellipse inside the bowl**, with mouse/touch capture
  and arrow-key access. Normalize gesture angles to the ellipse. The spoon mouth
  travels through the filling while its handle remains above it; the spoon must
  not rotate like a clock hand. Both directions count; stopping stops stirring.
- Two accumulated turns finish mixing; filling visibly blends inside the bowl.

### 3. Rest the filling

- Animate **translucent plastic wrap** descending and stretching across the same
  bowl opening. Give it a light blue-green edge, subtle sheen and a few crease
  lines so it reads clearly without hiding the filling. Layer it behind the bowl's
  clipped front wall so its edge conforms naturally to the opening. Then animate that wrapped bowl
  shrinking/moving into an empty fridge shelf, followed by the closed fridge.
  Only after this transfer switch to cabbage steaming. An accelerated timer runs
  while the child steams the cabbage. Preserve this ordering while overlapping
  the wait; avoid a long idle countdown or a separate busywork minigame.
- Show covered/resting/ready feedback. Resting must finish before portioning.
  Tune resting and steaming durations together to keep the flow comfortable.

### 4. Steam the cabbage

- Place a **whole cabbage head in a large stockpot**. Do not use loose leaves
  in a bamboo/rice steamer. Lower the matching pot lid, then choose heat.
- Animate steam and show the softened whole cabbage when ready. Lift it out to
  continue. Before portioning, explain that the filling rested while the cabbage
  steamed, then animate the same covered filling bowl coming back out of the
  fridge. Only after the 1600 ms retrieval motion finishes may folding begin.
  Keep this guided and distinct from final scoring.
- Front pot walls occlude contents; the cabbage must not protrude through a
  closed lid. Fit the lid to the pot opening's width and perspective.

### 5. Portion, fold and roll three rolls

- Make **three rolls**. Fully guide the first, then use lighter hints.
- Choose a small, medium or large spoonful against a pictured target portion.
  Overfilling can tear the leaf; undersizing changes the portion/appearance.
- Place the leaf on a cutting board with arrow guides inscribed on the board.
  Reuse the same orthographic top-down board as chopping and keep every open
  leaf, folding state and rolling-progress sprite centered on its work area.
  Use **one direct draggable leaf**, with no four floating arrow buttons.
  Drag the bottom up, then both sides inward, then roll upward from the **bottom**.
- The final upward drag scrubs through eight authored roll-progress sprites,
  from tucked parcel to fully rolled; releasing too soon cancels that preview.
  Pointer cancellation must also reset it. Keyboard uses the focused leaf:
  Up = bottom/final roll, Left/Right = sides; Enter advances the next valid fold.
- Left-first and right-first are equally valid. Both sides must be tucked
  before the final upward roll. Reject premature closure with a gentle hint.
- Overfilling OR dragging a fold far beyond its guide can tear the leaf.
  Small slips remain forgiving. A tear restarts only the current roll, with
  fresh leaf/filling; preserve already completed rolls and all earlier steps.
- Finished rolls accumulate visibly on a nearby tray. Require all three before
  the final cooking step.

### 6. Simmer in tomato sauce and stop the pointer

- Animate tongs lowering each roll into the pot opening, behind its front wall.
  Ladle tomato sauce over them, lower the matched lid onto its opening,
  choose heat and start cooking from a stationary preview.
- Animate the simmering pot, bubbling tomato sauce, steam and subtle lid/pot
  movement. Use the supplied Genshin cooking image as interaction inspiration;
  preserve this app's universal art and controls.
- Below the pot show a pointer moving slowly across a clearly labeled bar and
  one large **Stop cooking** action. The colored zones remain unlabeled beneath
  the bar; instructions explain that green is the target. Stopping locks the outcome.
- The final agreed zones are **50% undercooked, 10% okay-ish, 20% perfect,
  10% okay-ish, 10% burnt**. Acceptable is exactly 40% in total; its middle
  half is perfect. Do not widen this to the earlier rejected 90% proposal.

| Pointer position | Outcome |
| --- | --- |
| 0% ≤ p < 50% | Undercooked |
| 50% ≤ p < 60% | Okay-ish |
| 60% ≤ p < 80% | Perfect |
| 80% ≤ p < 90% | Okay-ish |
| 90% ≤ p ≤ 100% | Burnt |

- **12 seconds per one-way crossing is the proposed initial playtest value**,
  not an independently approved difficulty setting. At that speed acceptable
  spans 4.8 seconds and perfect spans 2.4 seconds. Tune speed through playtests,
  preserving the agreed zone proportions and allowing time to understand cues.
- Initial implementation default: reverse gently at each end if no stop is
  pressed; do not auto-submit a meal. Pause on lost focus/hidden page and resume
  without elapsed background time advancing the pointer.
- Handle actual input promptly, avoid frame-count-dependent speed, keep effects
  lightweight on old devices, and test simulated stalls/delayed input. Any
  small boundary allowance must be explicit and bounded; do not silently
  expand scoring zones or make the challenge automatically perfect.
- After stopping, animate the lid lifting, tongs transferring three rolls from
  the pot onto a separate dish, then a large ladle scooping sauce from the pot
  and pouring it over the plated rolls. Only then show the result controls.
- Show the matching final-meal artwork/result for all four outcomes. Both
  okay-ish zones share one asset. The child can **serve the result** or retry
  **only final simmering**, retaining the three prepared rolls.
- A stopped attempt is not a served meal. Retry must not count an abandoned
  outcome, duplicate completions, or grant a badge from browser-reported grade.

## Gameplay asset requirements

- Use cute, chubby cartoon food with thick warm-brown outlines and simple
  pastel shading. No realistic marbling, gloss, wood grain, or fine food texture.
  Match existing illustrated app/minigame references.
- Generate a consistent polished asset set, with camera angle, scale, lighting,
  kitchen style and ingredient identity stable across frames. Keep active
  folding edges readable. Separate food, utensils, filling and shadow layers
  where needed for dimensional animation.
- Chopping: whole/intermediate/chopped beef and vegetables, separate top-down
  board and knife. The board must remain empty so both gameplay phases can
  composite their active food at its exact center.
- Mixing/resting: bowl, separate ingredient patches, blended filling, spoon,
  wheel/rim and handle, translucent plastic wrap and fridge/rest-ready states.
- Steaming: matched stockpot/lid, whole firm/soft cabbage heads, lightweight steam overlays.
- Folding: open filled leaf, bottom folded, bottom+left, bottom+right, both
  sides tucked, roll-closing transition, completed roll and torn leaf. Both
  side orders need authored states. Preserve earlier rolls across tear/retry.
- Final cooking: pot/lid, sauce ladle, simmering layers and tray/serving plate.
- Exactly four final-meal assets with identical plate/camera/three-roll layout:
  **undercooked**, **okay-ish**, **perfect**, and **burnt**. Make differences
  legible without relying on labels. Undercooked is pale/firm with thin sauce;
  okay-ish is modestly coated; perfect is tender with rich glossy tomato sauce;
  burnt has dark edges, split cabbage and visibly scorched sauce.
- Gameplay assets are checked in as twelve transparent runtime images under
  `frontend/public/minigames/cooking/cabbage-rolls/`. Achievement medallions
  remain separate collectibles; the four result plates use `cartoon-meals-v2.png`.

## Achievements — Cabbage Roll Kitchen

Group ID: `cabbage-rolls`. Stable IDs and atlas order:

| ID | Name | Unlock condition | Difficulty | Badge pictogram |
| --- | --- | --- | --- | --- |
| `cabbage-rolls-completed` | Roll Chef | Complete all six steps and serve three rolls once, with any final result. | Easy: one full recipe; no quality requirement. | Three rolls in tomato sauce with a wooden spoon. |
| `cabbage-rolls-undercooked` | A Little Too Soon | Serve one completed recipe with an undercooked final result. | Easy: one recipe, 50% timing zone. | Pale roll and a small early-clock pictogram. |
| `cabbage-rolls-burnt` | Toasty Lesson | Serve one completed recipe with a burnt final result. | Medium: one recipe, final 10% timing zone. | Charred roll, scorched sauce and a small smoke curl. |
| `cabbage-rolls-perfect` | Perfectly Simmered | Serve one completed recipe with a perfect final simmering result. | Medium: one recipe, central 20% timing zone. | Richly sauced rolls, one cut open, with gold star accents. |

- Completion and the served outcome can unlock together. Perfect refers to
  final simmering, not a newly invented requirement for flawless earlier steps.
- A live, server-verified served run credits **8 stamina** to Town Building once.
  Persist a unique run identity and credit the Town reward in the same database
  transaction as the served state. Retries, duplicate requests, stale revisions,
  browser-supplied completion/reward fields, and unserved result screens award
  nothing. The public `/uat/` flow remains non-persistent practice.
- Gameplay verification is intentionally lightweight, as accepted in review:
  chopping targets and mixing gestures remain client-graded for this child-facing
  game. The server still owns recipe sequence, rest/steam timing, profile
  ownership, run identity, and once-only stamina credit. This gameplay choice
  does not establish request-flood or DDoS protection.
- These four definitions are server-verified and earnable on a valid Serve.
  Migration installs definitions; the server recipe transition awards badges.
- Show the complete group in the child-facing **My Badges** list and in the
  selected child's achievement collection in Parent Space and Admin Space.
  Locked catalog entries remain visibly distinct from earned badges.
- Maintain an authenticated admin-only migration button for this named group
  through the existing admin catalog flow. It installs/updates reviewed,
  server-owned definitions automatically. Repeated runs must be idempotent and
  preserve earned badges/player progress. Never accept browser definitions.
- Awarding uses authenticated, server-verified recipe actions,
  timing/outcomes and served-run identity; never trust client identity, scores,
  completion flags or outcome labels. Prevent duplicate/replayed awards.
- Follow `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`.
  Use illustrated text-free collectible medallions matching the UFO reference:
  shared cream frame, warm-brown linework, pastel palette, paper texture and
  detail level. Vary the central pictogram; keep names, difficulty and unlock
  conditions outside icons. No lettering, monograms or separate frame style.
- Badge atlas: `/minigames/cooking/cabbage-rolls/achievement-badges.png`, 2×2,
  row-major order completed, undercooked, burnt, perfect. Inspect transparency
  and actual cell bounds before wiring. Save the generation prompt beside it.

## Implementation and verification

- Colocate meal components/state/presentation here; use explicit TypeScript
  phases/actions following `../cookingGame.ts` conventions. Keep pure state
  transitions separate from animation and input. Use immutable updates and
  stable IDs; match local quote/formatting style.
- Frontend tests live in `frontend/tests/`, browser flows in
  `frontend/tests/browser/`. Use `node:test`/assert for meaningful state tests
  and existing Playwright setup for real browser flows.
- Cover timing targets/misses, automatic pointer motion, onion peeling, wrong seasoning, both valid fold orders, premature
  closure, overfill/overdrag tear recovery, three-roll completion, all timing
  boundaries (including exactly 50/60/80/90/100%), pause/stalls, serve/retry,
  four matching assets, keyboard/touch and locale-preserved state.
- Verify security, idempotency and progress preservation for admin migration.
  Add authoritative action/replay tests before claiming badges are earnable.
- Run from repository root after code changes:
  `npm test --prefix frontend`, `npm run typecheck:hosting --prefix frontend`,
  `npm run build --prefix frontend -- --mode vercel`, and
  `npm run build --prefix frontend`.
- For server/catalog changes also run `npm test --prefix server`,
  `npm run typecheck --prefix server`, and `npm run build --prefix server`.
- For local development/UAT requests run exactly `scripts/start-uat.sh` from
  the root. Do not start legacy runtimes or change/reset accounts or volumes.
- Keep browser API traffic same-origin and preserve existing meal/API contracts.
  No direct browser-to-provider/database calls or new dependencies are needed.
  Apply the checked-in cabbage-session migration through the normal deployment
  migration process; never run it against production from a feature branch.

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

## Implemented tuning and verification notes

- Chopping requires three consecutive hits in three ordered green stripes per
  ingredient. The pointer moves during the 350 ms animation lock. Explicit
  Next prevents a completed ingredient from accidentally starting the next one.
- Mixing requires two accumulated turns; both directions count. Pointer capture
  handles mouse/touch on an elliptical path; arrow keys add an eighth turn.
- Rest lasts eight active seconds. Steaming takes ten/eight/six seconds for
  low/medium/high heat. Both must finish before leaves can be lifted.
- Direct fold gestures travel at least 14% of the leaf's size; final upward
  rolling requires 35% and previews all frames over 40% travel. Beyond 90%, or
  sideways drift beyond 55%, tears the current leaf. Short drags cancel preview.
- The final pointer takes 12 active seconds across, reverses at the ends and
  never auto-serves. Heat is a recipe choice; it does not change scoring bands.
- Each rendered clock update is capped at 100 ms to avoid an unseen large jump
  after a stalled frame. Stop grades the last rendered pointer, without expanding
  any zone. Blur/hidden-page pause requires explicit resume. Timers freeze while
  paused; changing interface language preserves all recipe state.
- Live authenticated gameplay persists a server-owned recipe session and credits
  Town Building stamina only after a verified served run. The public `/uat/`
  route remains local, non-persistent practice and grants no badges. All four
  achievements now unlock through the server-verified Serve transition, and
  both reports use its saved lifetime counters and permanent award timestamps.
- A failed save freezes recipe inputs and animations. Sync recipe must restore
  every gameplay field from the server snapshot before re-enabling play, rather
  than merely refreshing its revision. Missing actions become available again;
  already committed actions (including serving) must not be replayed. Ignore
  queued responses after a resync, profile/session change, or unmount. Cover
  dropped requests and lost responses with the browser sync-recovery regression.
- Unit coverage: `frontend/tests/cabbage-rolls.test.ts`. Browser coverage:
  `frontend/tests/browser/cabbage-rolls.test.ts`; use its Vite/Playwright harness
  for isolated tests, not production data. It covers all phases, all four results,
  folds in both orders, touch/mouse/keyboard, pause, locale, reduced motion,
  retry/serve/replay, asset loading and action/artwork bounds at required sizes.

## Asset crop regression protection

- Never assume a generated atlas has even rows/cells. Inspect every sprite and
  record measured pixel bounds in `cabbageAtlas.ts`. Preserve source proportions.
- `CabbageArt.tsx` clips each source rectangle explicitly inside its SVG viewport,
  including when a scene uses a different aspect ratio. No neighboring sprite
  may show through letterboxing around a food, knife, bowl, or board.
- Verify all four ingredients both whole and chopped, knife/board alignment,
  setup thumbnails, ingredient cards and bowl visually in real-browser screenshots.
  Bounds-only tests do not prove artwork is clean or stylistically correct.

## Animation sequencing

`CabbageScenes.tsx` owns layered vessel scenes. `cabbageGame.ts` owns timed
motions, so pause/hidden-page handling freezes both animation and gameplay.
During a motion, duplicate/next actions are blocked until it completes. Durations:
ingredient fall 850 ms; seasoning 1100 ms; plastic wrap/pot lids 900 ms; fridge transfer
1600 ms in each direction; whole cabbage placement 1000 ms; tongs placement/sauce 1200 ms; final
plating 7600 ms. Keep all transient art and required actions inside the viewport.
Render contents between the full vessel and its clipped front wall; reuse the
same pot and bowl throughout their respective sequences. Never fake containment
by pasting sprites over the outside surface.

Latest animation revision verified with complete browser playthroughs at
1366×768, 1024×768, and 1180×820, including reduced motion, all four outcomes,
transient artwork bounds, no scrolling, direct leaf drag, and keyboard folding.

## Verified achievement progress

- The named Cabbage Roll Kitchen group is earnable. Roll Chef requires one
  served three-roll batch of any outcome; A Little Too Soon, Toasty Lesson, and
  Perfectly Simmered require a served undercooked, burnt, and perfect batch.
  Preserve the existing Easy/Easy/Medium/Medium difficulties and badge atlas.
- Track lifetime counters and first-award timestamps in the optional server-owned
  `cabbage_roll_sessions.state.achievements` object. Preserve it on Start and
  Replay. Existing sessions without this field start with no tracked history;
  do not fabricate earlier completions or backfill from client state.
- Award only on a verified result-to-served transition with three prepared and
  arranged rolls. Stop, retry, abandoned recipes, practice, reloading and duplicate
  serves do not award. Use the row lock/revision transaction for counters,
  timestamps and the existing unique stamina receipt together.
- The kid collection and Parent/Admin reports share the server report projection
  of these counters, all four definitions and permanent timestamps. Report all
  conditions, artwork, difficulty, earned status and current/target consistently.
  Render the authoritative served outcome after the save succeeds.
- No SQL migration is required: new fields live in existing JSON state. Badge
  catalog installation remains idempotent and cannot alter earned progress.
- Cover all four outcomes, retry, restart, reload, concurrent serves, migration
  preservation, family isolation and forged award claims. Test evidence stays
  local under `/tmp` or an ignored directory.
