# Infinidrill Server Guide

Follow the repository guide and frontend/src/features/infinidrill/AGENTS.md.
Number all clarification and brainstorming questions uniquely in each batch.

- game.ts, types.ts, questions.ts, and upgrades.ts are the shared pure engine.
  The frontend re-exports them for rendering and isolated practice tests.
- Shared question kinds, levels, projection, identity, grading, blank rules and
  legacy conversion are defined in `server/src/questions/AGENTS.md`. InfiniDrill
  owns only its stage mapping and its Venn presentation.
- Lock the profile game row for actions and require a matching revision.
- Equipped cabin/engine/treads tiers each add 3m per dig. Equipped accessory
  tiers fire on a server-selected side and persist laser cuts. Count deposits
  from newly removed cells only; future digs cannot recollect laser deposits.
  Clip digging/laser depth to curriculum boundaries and keep mastery gates.
- Laser cuts step down and outward one column per row, beyond the maximum
  possible width of the equipped head (including random extra columns).
  Store and grade the individual steps, never their rectangular envelope.
- Keep earned achievement IDs/timestamps across replays. Persist current state
  for verification, without retaining submitted-answer history.
- Use the shared question selection and history contracts; never reset history
  mid-expedition or increase difficulty to evade exhaustion.
  An exhausted layer enters `question-exhausted` with a replay/exit prompt,
  preserving earned rewards without awarding a core-completion achievement.
  Replay starts fresh history; legacy JSON can recover only its current card.
  These optional JSON fields need no SQL migration.
- Every ten newly earned Town rocks also grant one bonus sand without spending
  rock. Persist the private 0–9 rock remainder across actions, reloads and replays;
  legacy saves start at zero. Grade/deduplicate excavation before counting rock,
  and commit remainder and Town credit atomically with game progress.
- Maintain badges, difficulty levels, unlock rules, and registration with the
  single admin catalog migration. Migration updates definitions only.
- Minigame controls must fit laptop/iPad landscape viewports at 1366×768,
  1024×768, and 1180×820 without scrolling in every game state.

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
