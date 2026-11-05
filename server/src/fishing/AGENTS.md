# Fishing Friends server guide

Follow `server/AGENTS.md` and the complete minigame guide at
`frontend/src/features/fishing/AGENTS.md`. The approved rules and content are
in `docs/plans/fishing-minigame.md`.

## Shared questions

Question generation, identity, grading, projection, bounded selection and
saved-data conversion follow [`../questions/AGENTS.md`](../questions/AGENTS.md).
Fishing owns only the bait-to-level/operator map in `fishing/config.ts`:
baby uses `addsub-2d1d` `+` with `blank: 'result'`; the other baits use their
reviewed shared level with `blank: 'any'`. Persist private shared `Question`
data and expose only `publicQuestion`, the opaque question id, bait id and
attempt count.

- Number every brainstorming or clarification question; use concise numbered
  questions with short lettered multiple-choice answers where appropriate.
- Render owns math generation/grading, randomness, bait, clocks, progression,
  inventory and rewards. Keep answers and pending outcomes out of projections.
- Profile ownership, strict revisioned commands and transactional row locks are
  required. Commit the cast provenance, fish quantities, journal, achievements
  and Town stamina together; retries must never duplicate rewards.
- Keep the seven Fishing Friends achievements in the named group, with badges,
  explicit unlock conditions and difficulty. Use the universal text-free badge
  style specified in `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`.
- Keep the authenticated admin-only catalog migration idempotent and preserve
  earned badges. Definitions become earnable only through verified progress;
  catalog-only definitions must be labeled accordingly until then.
- Include the complete group in the shared Parent/Admin child-report projection,
  using owned profiles and allowlisted public metrics; no private state leaks.
- Preserve shared Badges/language/Back controls and viewport usability at
  1366×768, 1024×768 and 1180×820 in any related interface changes. All current
  controls must remain visible without scrolling.
- Run reducer/route tests and the disposable PostgreSQL fishing/report tests
  after gameplay changes. Never run test migrations against production.

- Persist running intent separately from a waiting cast. Math never pauses it;
  correct answers wake an armed empty session, and ticks repeat casts after a
  two-second reveal. Use selected stock, then easiest compatible stock.
- Enforce heartbeat leases in waiting, result and bait-starved states. Do not
  complete and replace a cast in one transaction: every completion must reach
  the provenance/Town credit path before the next cast starts.
- Friend changes pause and preserve paid bait, remaining time and committed
  outcome. Legacy states normalize paused; do not regrade historical catches.
- Use the shared question engine contract for blank solutions, private answers,
  projection and legacy conversion. Preserve grading for older pending Fishing
  questions without layout metadata.

## Starter math and bait display names

- Baby Bait uses result-only `addsub-2d1d` addition: left 10–98, right 0–9,
  with no carrying. Other baits use their shared configured level and
  `blank: 'any'` where solvable.
- Preserve grading for already-issued questions and all saved bait balances.
- Show Corn Bait (Mồi bắp) for persisted ID `beginner`, and Worm Bait (Mồi giun)
  for `chewy`. Keep IDs, odds, rewards, unlocks and asset slots unchanged.
- Fishing multiplication uses shared single-digit levels: Bouncy retains 2–5;
  Crunchy uses `mul-1d`, so products can reach 81. Preserve division.

## Continuous and varied bait practice

- Submit grades the current response on the server. With continuePractice enabled,
  a correct answer grants one bait and returns a new question of the same bait
  type atomically. Keep the keypad open and clear/refocus input. Incorrect answers
  retain the same question and retry feedback but clear the typed input; Close
  explicitly dismisses it.
- Persist the last six issued math facts privately, across reloads and dismissed
  questions. Reversed addition/multiplication operands and alternate missing-number
  positions count as the same fact. Exclude all six when issuing another question.
  Keep existing skill ranges/borrowing rules, private answers and replay protection.
- Sleeping companions hide the last catch/garbage bubble, reward and discovery
  labels. Keep committed catches, inventory, rewards and outcomes unchanged.
