# Miniku Minigame Agent Guide

- Remount profile-local state on family/session/profile changes. Use
  `useSessionRequests` for actions, including animation arrival, so stale
  responses cannot restore cleared private caches or trigger completion UI.
  Cancel number-flight animations and remove their sprites on unmount.

Follow the repository guide and `frontend/AGENTS.md`. Render owns authenticated
grading, profile ownership, progress, achievements and friend notifications.

## Brainstorming and clarification

- Number every question uniquely within a batch, including tool questions.
  Use concise lettered choices and preserve numbers when restating questions.

## Game and security

- Miniku is mini sudoku with selectable 3×3, 4×4 and 5×5 boards. The current
  child-friendly rule is Latin-square style: each digit appears once in each
  row and column. There are no sub-boxes, so the same rule works for 5×5.
- Generate a complete board, then remove clues only while preserving a unique
  solution and an approved child-friendly logical solving path. Do not hide
  arbitrary cells or require guessing. Keep generators deterministic in tests.
- For 3×3, leave only 3–4 clues and ensure at least one empty cell starts with
  multiple candidates, while the entire puzzle remains solvable without guessing.
- Leave at most 7 starting clues for 4×4 and 10 for 5×5. Retry removal
  orders when needed; never return an overfilled board to meet those caps.
- Fixed clues cannot be changed. Child-entered values may be changed or erased.
  Show potential row/column conflicts on number choices but allow choosing
  them; highlight all conflicted editable values clearly.
- Use same-origin API calls. Never trust browser identity, ownership, completion,
  timing, puzzle solutions, rewards or achievement claims. Do not expose stored
  puzzle answers. Grade and persist completion server-side without duplicate
  awards or friend notifications on retry/reload/concurrent requests.

## Achievements

- Maintain a named Miniku achievement group. Every definition includes a badge,
  clear server-verified unlock condition and obtainment difficulty.
- Register the group with the single authenticated admin-only catalog migration.
  Install/update reviewed server-owned definitions idempotently, preserving
  earned badges and progress. Never accept browser-defined achievements or award
  from client state.
- Definitions are catalog-only until authoritative progress/grading makes them
  earnable. Follow `public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`:
  text-free collectible medallions in the common storybook frame, palette,
  linework and detail level. Keep names/conditions/difficulty outside icons.
- Verify newly earned achievements notify eligible friends through the existing
  authenticated notification pathway, including all other minigame groups.
  Respect existing friend/privacy rules and deduplicate notifications.

## Visuals and viewport

- Match existing flat pastel avatars and frames: simple chubby silhouettes,
  thick warm outlines and minimal shading. Reuse app controls and profile gates.
- The Miniku scene uses the generated thinking-animal background and text-free
  four-cell badge atlas in `frontend/public/minigames/miniku/`; keep both
  original, non-branded, pastel storybook assets cohesive with the universal
  badge prompt.
- Keep size selection, the board, 1–N number buttons, erase, pause/help, completion
  and replay actions usable without page scrolling on laptop/iPad landscape.
- Use available viewport width/height and safe areas; keep square cells, legible
  digits and usable touch targets. Verify full flows at 1366×768, 1024×768 and
  1180×820 in a real browser, including conflicts and completion.
- Run frontend gates, server tests/typecheck/build and guarded disposable-local
  database tests. Never run production migrations, provision cloud resources,
  commit/push/merge or publish until the user authorizes the feature handoff.

## Puzzle management and parent hints

- Admins manage shared custom puzzles; parents manage only their own family’s
  custom puzzles. Parent lists must exclude shared and generated puzzles. Generated puzzles are not catalogued.
- Validate edited clues on the server for valid digits, unique solution, logical
  solving and size-specific clue limits. Enforce exact clue-layout uniqueness
  with a database unique key, including disabled puzzles.
- Disabled puzzles cannot be selected for new games. Fall back to generation
  when no enabled shared or family puzzle exists for the chosen size. Editing or disabling never
  changes a board already in progress.
- Store the possible-value hint preference per family, default true. Only a
  verified parent can change it. When off, every number choice is neutral gray;
  actual conflicts in entered grid values remain visible.

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
