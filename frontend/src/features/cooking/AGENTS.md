# Cooking Minigame Agent Guide

Follow `../AGENTS.md` and `frontend/AGENTS.md`.

## Achievement badge visual contract

- Follow `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`
  for cooking badge art. Keep the shared illustrated medallion frame, linework,
  palette, and detail level; vary the central pictogram by achievement. Do not
  use monograms, lettering, emoji, or a separate frame style.

- Number every brainstorming and clarification question so the user can answer
  by number. Keep numbers unique within each batch and preserve them when
  restating pending questions, including tool prompts.
- This directory contains the cooking games and shared kitchen menu. Apply
  this rule to every existing and future meal minigame; create a dedicated
  `AGENTS.md` when adding a minigame in a new implementation directory.
- Run the frontend checks specified in `frontend/AGENTS.md` after code changes.
- Compact kitchen cards use explicitly shrinkable grid tracks in each artwork
  header. Keep images/sprites inside the header with their proportions intact;
  intrinsic image height must never cover the recipe title, description or
  action. Verify actual artwork bounds, not only the card button bounds, at
  laptop/iPad landscape sizes, including 1180×720 with browser chrome.
- Use the shared KidBackButton and kid-nav controls. Keep context-aware kitchen
  returns in the header's first slot, with the common arrow, 48px height and type.
- Grilling uses matching six-pose raw, warming and golden RGBA rotation sheets.
  Crossfade raw to warming over 18–62% of the required turns, then warming to
  golden over 72–100%. Keep golden readiness and burn grading in the reducer.
  Glazing uses a larger brush with a 4.2-second Z stroke; disable Done seasoning
  until the stroke finishes, respect reduced motion, and recover lost animation
  events without trapping the child on the step.
- Maintain the named Cooking achievement group and each definition's badge,
  explicit unlock condition and difficulty. The authenticated admin-only group
  migration installs server-owned definitions idempotently and preserves earned
  badges/progress. These definitions remain catalog-only until server-verified
  cooking grading/progress exist; browser completion cannot earn badges.

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

## Adventure journal

Production play uses revisioned profile-owned `/kitchen` sessions and the shared
pure rules in `server/src/kitchen`. Record terminal outcomes in the server's
transaction, never from a browser completion claim. Explicit `/uat` practice
routes remain local and add no journal events. Adventure verification does not
award the remaining catalog-only achievement definitions. Cabbage Roll Kitchen
now awards its four badges from verified served batches; follow its nested guide.

Kitchen menu completion medals are decorative counters, separate from earned
achievement badges. Read profile-owned `/kitchen-completions` data; count only
server-verified successful batches, once per recipe session. Include both OK-ish
and Perfect cabbage rolls, excluding burnt/undercooked attempts. Practice routes
never display or increment saved counts. Keep the medal in each card's top-right
corner without changing its grid tracks or covering recipe copy.
