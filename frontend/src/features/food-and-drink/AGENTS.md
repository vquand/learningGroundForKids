# Food and Drink Minigame Agent Guide

Follow `../AGENTS.md` and `frontend/AGENTS.md`.

## Achievement badge visual contract

- Follow `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`
  for food-and-drink badge art. Keep the shared illustrated medallion frame,
  linework, palette, and detail level; vary the central pictogram by achievement.
  Do not use monograms, lettering, emoji, or a separate frame style.

- Number every brainstorming and clarification question so the user can answer
  by number. Keep numbers unique within each batch and preserve them when
  restating pending questions, including tool prompts.
- Apply this rule to all existing and future recipe minigames in this directory.
- Run the frontend checks specified in `frontend/AGENTS.md` after code changes.
- Maintain the named Food and Drink achievement group: every definition needs
  shared badge art, an explicit unlock condition and difficulty. Its admin-only
  authenticated migration installs server-owned definitions idempotently while
  preserving earned badges/progress. The general recipe catalog remains catalog-only
  until server-verified grading/progress exists; verified town drink rewards retain
  their separate server-owned contract. Client completion cannot award a badge.

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

## Town rewards and verified recipes

- Production ingredient actions use the authenticated profile-owned Render
  `/drinks` session/actions. Share reviewed recipes and the pure reducer with
  `server/src/town-building/`; never report browser completion as stamina.
- The server credits 5 stamina plus completed optional steps (maximum 8) only
  once per completed issued recipe session, in the same transaction. Retries
  and page reloads cannot duplicate credits. Show collection after confirmation.
- Browser-only UAT uses explicit `/uat/food-and-drink` routes and grants no
  persisted resources. Keep UAT harnesses on those routes.
- Food and Drink catalog achievements remain catalog-only until their own
  authoritative achievement progress/unlock rules are implemented. Retain the
  named group, badge/unlock/difficulty definitions, admin-only idempotent catalog
  migration, and universal badge style independently of the stamina feature.

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
