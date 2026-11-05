# Shared question engine refactor

Branch: `review/minigame-question-types`. Decided with the user on 2026-10-28.

## Goal

Every minigame question comes from one shared module. Shared: question kinds and
answer modes, data format, de-duplication identity, wrong-answer choices, and
the difficulty ladder. Game-specific: which kinds, answer modes, blank
positions and ladder levels a game uses, and when.

Games in scope: InfiniDrill, Waddle Wall (`math-wall` / `math-quiz-wall`),
Road Racing (`road-racing` / `animal-racing`), Fishing.
Kinds in scope: equation (sum or missing number), Venn, counting, compare,
animal picture.

Decisions:

- **One unified ladder.** InfiniDrill's 18 documented levels are the backbone
  and InfiniDrill's behaviour stays identical. The other games move to the
  nearest shared levels, so their questions change slightly.
- **Wrong-answer choices are shared.** Waddle Wall and Road Racing choices
  change to the shared rule.
- **Identity ignores the blank position and the order of + or × operands.**
  Road Racing currently counts the same fact with a different blank as new;
  that stops.
- **One minus sign:** `−` (U+2212) everywhere. Road Racing's `-` goes away.

## Status

- Phase 1 shipped the pure shared ladder, equation/card helpers, identity,
  bounded selection, choices, projections, prompt text and legacy fixtures.
- Phase 2 shipped InfiniDrill integration and the shared equation/Venn renderers.
- Phase 3 shipped Waddle Wall integration, counting questions and legacy repair.
- Phase 4 shipped Road Racing integration, comparison/picture/Venn questions,
  opaque saved IDs and the shared choice projection.
- Phase 5 shipped Fishing integration, bait-level configuration, shared math
  rendering, continuous practice and legacy saved-question repair.
- Phase 6 implemented the temporary Root-only Admin migration tool in
  `server/src/question-shapes-migration/index.ts`, with a 20-second eager
  conversion budget, runtime backup table, conditional restore, idempotent
  retries, Root authorization, explicit JSON confirmations, allowed-Origin checks
  when the header is present, a renewable lease and counts-only reporting. The CLI is
  now only a thin local-development wrapper over that module.
- Removed (2026-10-28): the temporary Root-only saved-question migration button,
  routes and script after production and local conversions completed.

### Review deviations from the original plan

- Implemented bait mappings are baby `addsub-2d1d` `+` result-only, beginner
  `add-2d` `+`, leafy `addsub-20` `−`, chewy `sub-2d`, bouncy `mul-2to5`,
  crunchy `mul-1d`, and master `div-1d`; Fishing's baby operands are 10–98 and
  0–9 without carrying.
- Shared prompts and accessible answer-cell naming were restored while the
  games moved to `QuestionView`; current layouts remain result-only for baby
  and `blank: 'any'` for the other Fishing baits.
- Difficulty tables retain their game-specific weighting and filters. Crunchy
  uses the shared `mul-1d` pool, so products reach 81; hard Waddle Wall keeps
  its answer range capped at 99.
- The migration is intentionally state-only: it does not bump gameplay
  revisions or timestamps, and it backs up only rows that would change. A
  convertible InfiniDrill question preserves `questionCounter`; an
  unconvertible question is replaced through the normal repair path, which
  issues one unique question ID and increments that counter once. Repaired
  rows therefore can change more than their question fields.
- Apply compares the canonical locked state with the scan snapshot and skips a
  row changed during the run, then exits non-zero so the operator reruns with
  a new exclusive backup. Restore is conditional on the recorded post-write
  state unless `--force` is explicitly supplied; malformed object states are
  reported without exposing their contents.

## Shared module: `server/src/questions/`

The frontend already imports server code relatively (InfiniDrill re-exports
its engine), so the shared module lives on the server and the frontend imports
it the same way. All of it is pure: no I/O, no `Math.random` except as a default.

| File | Contents |
|---|---|
| `types.ts` | Data format (below). |
| `random.ts` | One `RandomSource = () => number` in [0,1), plus `int`, `choose`, `pick`. Adapters for the games' current RNG signatures where needed. |
| `ladder.ts` | `DIFFICULTY_LADDER`: ordered, stable string IDs, EN/VI labels, rank, kind. One generator and one finite enumeration per level. |
| `equation.ts` | Evaluate (left to right, intermediate results), format, `withBlank(card, position)` (lifted from InfiniDrill `missingNumberVariant`, including its ×0 and 0÷ uniqueness guards). |
| `venn.ts` | One generator: regions, target, pictograms. |
| `counting.ts`, `compare.ts`, `picture.ts` | Card makers. The animal catalog (names EN/VI, image paths) moves from `road-racing/questions.ts` to `picture.ts`. |
| `choices.ts` | `numericChoices(answer, { count, min, max, random })`: nearest-neighbour distractors, distinct, includes the answer, never negative. Compare uses fixed `< = >`. Picture uses catalog names. |
| `identity.ts` | `questionKey(card)`: canonical identity. Equations: operator list plus operands, with operands sorted when every operator is `+` or every operator is `×`. Blank, level, choices and artwork are excluded. Venn: region counts plus target. Counting: count. Compare: both numbers. Picture: subject. |
| `select.ts` | `selectQuestion(levels, random, seen, options)`: tries random generation a bounded number of times, then walks the finite enumeration. It returns `null` when exhausted and never loops forever. |
| `projection.ts` | `publicQuestion(question)`: the only way a question leaves the server. Strips the answer, the correct index, hidden operands, intermediate results and keys. |
| `text.ts` | Prompt text EN/VI per kind and target, taking an explicit language (games have a content language separate from the UI language). |
| `legacy.ts` | Converters from each game's old saved question and old seen-key formats to the new ones. |
| `AGENTS.md` | Shared rules (below). |

### Data format (`types.ts`)

A discriminated union on `kind`; no optional per-kind fields and no `!` in renderers.

```ts
type Operator = '+' | '−' | '×' | '÷';
type Blank = number /* operand index */ | 'result';

type Card =
  | { kind: 'equation'; level: LevelId; operands: number[]; operators: Operator[]; blank: Blank }
  | { kind: 'venn'; level: LevelId; regions: { leftOnly: number; shared: number; rightOnly: number };
      target: VennTarget; friend: VennFriend; items: VennItem[] }
  | { kind: 'counting'; level: LevelId; count: number; picture: 'star' }
  | { kind: 'compare'; level: LevelId; left: number; right: number }
  | { kind: 'picture'; level: LevelId; subject: AnimalId };

type Response =
  | { mode: 'typed' }
  | { mode: 'choice'; choices: string[]; correct: number };

interface Question { id: string; card: Card; response: Response; answer: string | number; key: string }
```

`PublicQuestion` is the projection: an equation shows `values: (number | null)[]`,
`operators` and `result: number | null`, with `null` at the blank. The Venn
projection shows sorted pictograms and the target, not the counts. Choices are
kept and `correct` is removed. The exact TypeScript can differ, but these
semantics must hold.

### Unified difficulty ladder (`ladder.ts`)

IDs are stable strings; `rank` gives the global order. Levels marked IDn copy
InfiniDrill level n's current rules exactly.

| Rank | ID | Rule |
|---|---|---|
| 1 | `count-10` | Count 1–10 stars |
| 2 | `add-1d` | ID1: a+b ≤ 9 |
| 3 | `sub-1d` | ID2: one-digit a−b ≥ 0 |
| 4 | `add-chain-1d` | ID3 |
| 5 | `sub-chain-1d` | ID4 |
| 6 | `mixed-chain-1d` | ID5 |
| 7 | `venn-small` | ≤3 pictures per region, 6 targets (InfiniDrill levels 1–2) |
| 8 | `addsub-20` | **New:** a+b ≤ 20 or a−b with a ≤ 20 |
| 9 | `addsub-2d1d` | ID6: no carry or borrow |
| 10 | `addsub-2d1d-regroup` | ID7 |
| 11 | `venn-large` | ≤6 per region, 6 targets (InfiniDrill levels 3–11) |
| 12 | `add-2d` | ID8 |
| 13 | `sub-2d` | ID9 |
| 14 | `compare-100` | Compare two numbers 1–99 |
| 15 | `chain-2d-3` | ID10 |
| 16 | `chain-2d-4` | ID11 |
| 17 | `mul-2to5` | **New:** 2–5 × 2–5 |
| 18 | `mul-1d` | ID12 |
| 19 | `mul-teens-small` | ID13: 10–19 × 1–5 |
| 20 | `mul-teens-large` | ID14's multiplication half: 10–19 × 6–10 |
| 21 | `div-1d` | ID14's division half: exact division, divisor 1–9, dividend ≤ 99 |
| 22 | `addsub-3d1d` | ID15 |
| 23 | `addsub-3d2d` | ID16 |
| 24 | `chain-3d-3` | ID17 |
| 25 | `chain-3d-4` | ID18 |
| — | `picture-animals` | Name the animal (no rank; knowledge, not math) |

A level may be used with an operator filter (for example `addsub-2d1d` with `+`
only). The filter is game configuration, not a separate level.

## Game-specific configuration (each game's `questions.ts` becomes config plus a thin wrapper)

| Game | Kinds and levels | Blank | Response |
|---|---|---|---|
| InfiniDrill | Stage n → its IDn level(s); stage 14 = 50/50 `mul-teens-large`/`div-1d`. Venn 20% at stages ≤ 11 (`venn-small` at 1–2, `venn-large` at 3–11); missing number 35% | result or any operand | typed |
| Waddle Wall | easy: 20% `count-10`, else `add-1d`; medium: `addsub-20`; hard: `add-2d`, `sub-2d`, `mul-1d`. Keep 10% 0/1-operand rule, lane anti-streak, history | result | choice (3) |
| Road Racing | Rotate compare/arithmetic/picture/Venn. Arithmetic alternates missing-number `addsub-2d1d` + `addsub-2d1d-regroup` with result-only `mul-2to5` + `mul-1d`; `compare-100`; `picture-animals`; `venn-small` | arithmetic: any; mul: result | choice (3) |
| Fishing | baby → `addsub-2d1d` (+); beginner → `add-2d`; leafy → `addsub-20` (−); chewy → `sub-2d`; bouncy → `mul-2to5`; crunchy → `mul-1d`; master → `div-1d`. Keep the last-6-facts rule | baby: result; others: any of 3 | typed |

Game-owned behaviour stays in the game: progression, timing, lanes, rewards,
anti-streak, and how many cards a session holds.

## Frontend: `frontend/src/components/questions/`

`QuestionView` dispatches on `card.kind` to `EquationColumn`, `VennDiagram`,
`CountingStars`, `CompareSigns` and `AnimalPicture`. Props are the public
question, the current typed input (optional), the content language, and a
`variant`/className for game theming. One shared CSS file uses custom
properties; game CSS overrides only the variables. Answer input (number pad,
lanes, buttons) stays in each game. Remove the duplicated renderers and their CSS.

## Saved data compatibility

Each game's progress JSON holds old question shapes and seen keys. Each game's
normalizer converts them on load through `questions/legacy.ts`:
current question → new `Question`, and seen keys → new `questionKey` format, so
no-repeat history survives. Unknown or unconvertible saved questions are
replaced by a newly issued question at the same game position; nothing crashes.
Tests cover each game's legacy fixtures.

## Phases

Each phase is coded by Codex (`gpt-5.6-luna`, effort high) and reviewed by a
Sonnet 5.5 sub-agent (effort medium); fixes go back to Codex. Test suites run
through a Haiku sub-agent. A phase must pass server and frontend tests,
typecheck and build before the next phase starts.

1. **Foundation.** Build `server/src/questions/` plus tests. No game changes. Parity
   tests: each ID-mapped level's enumeration equals InfiniDrill's current
   `arithmeticPool` for that level, and generators only produce members of the
   enumeration. Property tests: key ignores blank and commutative order;
   `withBlank` has one nonnegative integer solution; choices are distinct, include
   the answer and are nonnegative; projection never contains the answer, the
   correct index, hidden operands or key.
2. **InfiniDrill plus shared renderers.** Move InfiniDrill to the shared engine
   and add `EquationColumn` and `VennDiagram`. Behaviour must stay identical.
3. **Waddle Wall.** Move it to shared, add `CountingStars`, convert legacy sessions.
4. **Road Racing.** Move it to shared, add `CompareSigns` and `AnimalPicture`,
   drop the `-` sign, keep the 400-card no-repeat race, convert legacy races.
5. **Fishing.** Move it to shared, convert legacy questions and `recentFacts`.
6. **Docs.** Update each game's `AGENTS.md` (rules that are now shared point to
   `questions/AGENTS.md`), plus `CLAUDE.md` and this plan's status.

## Shared rules for `questions/AGENTS.md`

- Questions are generated and graded on the server. Only `publicQuestion` output
  leaves it.
- A question's identity ignores the blank, + or × operand order, level, choices
  and artwork.
- A missing operand always has exactly one nonnegative integer solution.
- Selection is bounded: try random generation a fixed number of times, then walk
  the enumeration, then return `null`. Never retry forever, and never reset history mid-session.
- New kinds, levels or answer modes are added here; games only choose among them.
- Saved data compatibility: when the format changes, a legacy converter and fixtures are required.
