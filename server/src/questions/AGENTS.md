# Shared Question Engine Guide

Follow the repository and server guides. Number all clarification and
brainstorming questions uniquely in each batch, preserving pending numbers.

- Questions are generated and graded on the server. Only `publicQuestion`
  output leaves it.
- The main APIs are `selectQuestion`, `enumerateLevelCards`, `withBlank`,
  `questionKey`, `gradeQuestion` and `publicQuestion`. `selectQuestion` accepts
  a level or level list plus `operators`, `blank` (`'result'`, an operand index,
  `'any'`, or an explicit blank list), and an optional card `filter`.
- A question's identity ignores the blank, + or × operand order, level,
  choices and artwork.
- A missing operand always has exactly one nonnegative integer solution.
- Selection is bounded: try random generation a fixed number of times, then
  walk the enumeration, then return `null`. Never retry forever, and never
  reset history mid-session.
- New kinds, levels or answer modes are added here; games only choose among
  them.
- Grading has one server rule: choice responses grade the submitted index
  against `response.correct`; typed responses grade the submitted value against
  the private `answer`. Picture answers are animal IDs while choices are
  localized display names. Numeric and picture choices are shuffled; compare
  choices intentionally retain the fixed `<`, `=`, `>` order.
- Saved data compatibility: when the format changes, add a legacy converter
  and fixtures.
- Keep this module pure. Do not add I/O, database access, game state, or
  frontend dependencies.
- Public projections retain picture `subject` so the client can draw the
  animal, and counting `count` so it can draw the stars. These are display
  data, not answer/correct fields. Venn pictograms may retain region labels for
  rendering, but explicit region counts stay private.
- Public equation projections retain only masked `values`, operators and the
  visible result. Choice projections retain localized choices but remove the
  correct index. Question IDs are opaque handles; legacy conversion uses stable
  game-scoped IDs that never depend on answers, operands or canonical keys.
- Repository lazy repairs compare states with `canonicalJson` from
  `town-building/repository.ts`, not plain `JSON.stringify`, because PostgreSQL
  `jsonb` can reorder object keys. Each repository's exported hash-seeded
  `stableRepairRandom` keeps repairs deterministic.

## Adding a question kind, level or answer mode

The user supplies four inputs. Implement them as code; do not ask for anything
that is answered here or can be read from the repository.

1. **Question format**: what the child sees, with English and Vietnamese
   examples, plus any artwork or layout.
2. **Answer format**: typed number, choice from options, or another mode, and
   how wrong choices are made.
3. **Difficulty levels**: an ordered list with the rule for each level.
4. **Which games use it**: per game, which levels and when.

### Ask before coding when any of these is unclear

Number every question and give short lettered options so the user can reply
`1a, 2b`. Ask only about gaps; state sensible defaults you will use otherwise.

1. Format: is this a new kind (new card shape and display) or a new level of
   an existing kind? Which existing display, if any, should it reuse? Is new
   artwork needed and who supplies it?
2. Format: which wording is shown in English and Vietnamese for each variant
   (blank position, target, direction)?
3. Answer: typed or choice? For choices, how many, and what makes a good wrong
   answer (nearby numbers, common mistakes, same category)? Is the correct
   position random? Is the answer always a nonnegative whole number?
4. Answer: does the browser need any of the answer-revealing data to draw the
   question (like picture `subject` or counting `count`)? Anything else must
   stay private.
5. Levels: for each level, the exact ranges or rules, whether operations or
   operands are restricted, and how many distinct questions exist (the pool
   must be finite and enumerable for the no-repeat fallback).
6. Levels: where do the levels sit relative to the existing ladder (rank)?
   Which existing level is the nearest equivalent?
7. Games: for each game, which levels, how often (fixed rotation, percentage,
   from which stage or wave), and any game rule such as no back-to-back
   repeats, a preferred sub-pool or a unlock condition.
8. Games: does a game that already uses a similar level change behavior, and is
   that intended?
9. Saved games: does any stored data already contain this question shape? A
   brand-new kind needs no legacy converter; changing an existing shape does.

### Implementation checklist

- `types.ts`: add the card shape to the `Card` union (discriminated on `kind`,
  no optional per-kind fields) and any response shape.
- A card module (like `equation.ts`, `venn.ts`): card maker, validity rules and
  the finite enumeration.
- `ladder.ts`: one `DifficultyLevel` per level with a stable string id, rank,
  English and Vietnamese labels, generator and enumeration. Reuse the
  generator `options` (`operators`, `blank`, `filter`).
- `identity.ts`: the canonical key (ignore artwork, level, choices and anything
  that does not change the underlying task) and the private answer.
- `choices.ts` / `choiceResponse`: wrong-answer rule when the mode is choice.
- `projection.ts`: the public card. Remove the answer, correct index and key.
  Keep only display data and document any intentional exposure here.
- `text.ts`: prompts in both languages (add keys to the frontend `vi.json` for
  any interface text).
- `legacy.ts` only when an existing stored shape changes.
- Frontend `components/questions/`: a display component, a branch in
  `QuestionView` (the `never` check fails to compile until it is covered), and
  styling through the shared CSS custom properties; games theme it with a
  variant class. Follow the viewport rules in `frontend/src/features/AGENTS.md`.
- Games choose among levels in their own config and never copy generator code:
  InfiniDrill `infinidrill/questions-config.ts`, Waddle Wall
  `math-wall/questions.ts`, Road Racing `road-racing/questions.ts`, Fishing
  `fishing/config.ts`. Preserve each game's progression, history and rewards.
- Update the affected games' `AGENTS.md` files only for game rules, and this
  file for shared rules.

### Verify before calling it done

- Tests for the new level pool (exact enumeration against the written rules),
  generator membership, constant-RNG safety, duplicate identity, projection
  privacy (no answer, correct index or key in the serialized public question),
  grading, choices, and selection exhaustion returning `null`.
- Per game that uses it: seeded statistical tests of how often it appears,
  and a round trip of a saved game containing it.
- `cd server && npm run typecheck && npm run build` and the full server suite
  against the test database; `cd frontend && npm run typecheck &&
  npm run typecheck:hosting && npm test && npm run build`; the browser tests of
  each affected game.
- A browser pass playing the new question in each game at the required
  viewport sizes, in both languages.
