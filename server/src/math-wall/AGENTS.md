# Math Wall API Agent Guide

Follow the repository guide and the paired frontend minigame guide at
`frontend/src/features/math-quiz-wall/AGENTS.md`.

Question generation, identity, choices, projection, and saved-question
compatibility are shared rules owned by `server/src/questions/AGENTS.md`.

- Present brainstorming and clarification questions as concise numbered lists.
  Use short lettered multiple-choice options where they fit, so the user can
  answer by question number and option letter. Preserve pending question numbers.
- Keep questions, deadlines, grading, points, best scores, and badges owned by
  the server. Accept no client-supplied score or completion state.
- Authorize family ownership on every route. Rankings include only the current
  kid and accepted profile-to-profile friends in either direction; no mixed or
  family-scoped requests grant visibility.
- Keep JSON progress and `best_score` synchronized in a locked transaction.
  Reject stale revisions and prevent duplicate awards.
- A server-verified passed wall grants both wood and wool: 1 each on easy,
  3 each on medium, 5 each on hard. Credit through the shared Town reward
  service in the game transaction with a revision-based `waddle:` event ID.
  Failed walls and ungraded actions grant nothing; replays preserve event IDs.
- Capture newly unlocked achievement IDs in the session when grading. Never
  label earlier lifetime unlocks as session awards; reset the list on replay.
  Legacy sessions missing this list default to no known session awards.
- Math Scientist (`scientist`, catalog `waddle-wall-scientist`) requires 10
  verified lifetime hard-wall passes, difficulty hard. Preserve the existing
  Orange Explorer milestone at five and all existing badge IDs/artwork slots.
  The shared catalog/projection must include all seven achievements in both
  Parent and Admin reports; migrate definitions through the single admin button.
- The first failure is terminal after its splash animation. `next` finishes
  that session without advancing the wave; pause/resume must not bypass this,
  including recovery of older paused failure snapshots.
- Run server tests, type check, and build after changes. Database integration
  uses the guarded disposable test database, never production.

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

## Question configuration

Shared identity, choices, projection, bounded selection and saved-question
conversion are defined in `server/src/questions/AGENTS.md`. Waddle Wall owns
only its difficulty weighting, result-blank choice configuration, lane history
and hard-pool cap of 99; no database schema migration is needed for its JSON
question history.
