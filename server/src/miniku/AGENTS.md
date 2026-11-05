# Miniku server guide

Follow the repository guide and `frontend/src/features/miniku/AGENTS.md`.
Number every brainstorming and clarification question uniquely within its batch.

- Generate and grade boards on the server. Never trust client identity, scores,
  completion, solutions, or badge claims. Check profile ownership and revision.
- Keep the named Miniku achievement group with badges, explicit unlock conditions,
  and difficulty levels. `achievements.ts` owns the reviewed definitions and
  thresholds used by server grading and the admin catalog.
- Preserve earned IDs and timestamps across replays and catalog updates. The
  authenticated admin-only migration installs reviewed definitions idempotently;
  never accept browser-supplied definitions. Catalog definitions are earnable
  only when server-verified grading and progress implement their conditions.
- Badge artwork follows
  `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`: shared
  illustrated, text-free storybook medallions, common frame, palette, linework,
  and detail. Names, difficulty, and conditions remain outside the icon.
- Preserve gameplay and all current controls without scrolling at laptop and
  iPad landscape sizes 1366×768, 1024×768, and 1180×820 in every game state.
- Keep saved puzzles, private solutions, family ownership, hint preferences,
  and database transaction/revision contracts intact during refactoring.

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
