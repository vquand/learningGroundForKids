# Burger Minigame Agent Guide

Follow `../AGENTS.md` and `frontend/AGENTS.md`.

## Achievement badge visual contract

- Follow `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`
  for burger badge art. Keep the shared illustrated medallion frame, linework,
  palette, and detail level; vary the central pictogram by achievement. Do not
  use monograms, lettering, emoji, or a separate frame style.

- Number every brainstorming and clarification question so the user can answer
  by number. Keep numbers unique within each batch and preserve them when
  restating pending questions, including tool prompts.
- Run the frontend checks specified in `frontend/AGENTS.md` after code changes.
- Maintain the named Burger Kitchen achievement group: every definition needs
  shared badge art, an explicit unlock condition and difficulty. Its admin-only
  authenticated migration installs server-owned definitions idempotently while
  preserving earned badges/progress. These are catalog-only until server-verified
  burger grading/progress exists; client completion cannot award a badge.

- Present brainstorming and clarification questions as concise numbered lists.
  Use multiple-choice options where they fit, with short lettered choices so
  the user can reply with a question number and option letter.

## Minigame viewport requirement

- On iPad portrait screens, keep the animation above the controls, with the
  controls beginning near the screen midpoint. In landscape, allocate 3/5 of
  the workspace width to animation and 2/5 to controls. Fit the entire 620×450
  scene proportionally inside the preview so the board and final chef remain
  visible. Verify portrait sizes including 768×1024, 820×1180 and 1024×1366.
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
award the catalog-only achievement definitions or change earned badges.
