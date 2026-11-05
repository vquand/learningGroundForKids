# Feature Agent Guide

Follow `frontend/AGENTS.md` and the repository guide.

## Minigame brainstorming

- Present brainstorming and clarification questions as concise numbered lists.
  Use multiple-choice options where they fit, with short lettered choices so
  the user can reply with a question number and option letter.

- For all existing and future minigames, number every brainstorming and
  clarification question so the user can answer by number.
- Keep numbers unique within each question batch and preserve them when
  restating pending questions. Use numbered questions in tool prompts too.
- Before brainstorming or implementing a minigame, ensure its implementation
  directory contains an `AGENTS.md` with this rule; create it if missing.
- Games currently live in `cooking/`, `cooking/burger/`, `food-and-drink/`,
  and `ufo/`. The planned math moving-wall game lives in `math-quiz-wall/`.
- Follow `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`
  when creating or regenerating badges for any minigame. Keep illustrated
  medallion frames, linework, palette, and detail level consistent across the
  system; vary the central pictogram by achievement. Do not use monograms,
  lettering, emoji, or unrelated game-specific frame styles. Keep badge name,
  difficulty, and unlock condition in adjacent text.

- Full badge collections use the shared `achievements/BadgeCollection` and
  `BadgeCard` presentation: one card size and one artwork slot across groups.
  Additional badges wrap to new rows instead of shrinking columns. Compact
  in-game reward/pause panels retain their viewport-specific presentation.
- In-game collection entry points use `achievements/MinigameBadgesButton` with
  the server catalog group IDs. It reads the active profile's authenticated
  achievement projection on opening, paginates within the viewport, and labels
  catalog-only definitions as not yet earnable. Timed games must pause via
  `onOpen`; keep the game's explicit resume action after dismissal. InfiniDrill
  retains its expedition panel and server pause/resume flow.
- Collection triggers use the generated `BadgesIconButton` artwork without
  visible text, keeping a localized accessible name. Place the 48px control
  immediately left of the global language selector with an 8px gap; reserve
  both controls in headers. Mount only one trigger per game, including pause
  and result states.

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
