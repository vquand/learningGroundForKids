# Playground Daily Quiz specification

## Objective and agreed behavior

Move Daily Quiz from the Explorer internal screen to Playground slot four,
after Avatar, Badges and Town name. It is available immediately, without the
current five-completed-lessons gate. Preserve unrelated item quizzes.

Each UTC day has one frozen eight-question quiz per child. All questions have
multiple choices and exactly one correct answer and one selectable answer.
At most two questions come from any subject category. Math is one category;
animals, monuments and other existing Explorer subjects are separate categories;
English vocabulary and Vietnamese vocabulary are separate categories too.
Use only server-recorded learned Explorer content for catalog questions, including
food and drinks. Verified Food and Drink completions may also unlock matching
recipe questions. Add standalone logic/pattern and everyday reasoning categories
to fill eight questions for new children without testing unlearned catalog content.

Add authored math and vocabulary content to the bank. Math spans easy counting,
addition and subtraction; medium multiplication and division; and hard
fractions, decimals and multi-step arithmetic. Sample difficulty with approximate
25/50/25 easy/medium/hard weighting across days, rather than promising that
ratio inside a day containing at most two math questions.

Vocabulary always has three choices. Per-child game settings offer four toggles:
English description→Vietnamese word, Vietnamese description→English word,
English description→English word and Vietnamese description→Vietnamese word. All start enabled, at least one must remain
enabled, and changes affect the next quiz after today's snapshot is created.
Question learning languages remain independent from the global UI language.

## Completion, calendar and resources

Passing requires at least 70% (six correct out of eight). Unlimited retries use
the same day's questions. Only the first pass on a UTC date earns resources.
Failing, reopening, duplicate submissions and practice cannot award resources.

Award wood, stamina and metal equally: 10 each on streak day one, 12 on day two,
14 on day three and 16 on day four onward. Missing a UTC day resets the streak.
Monday always starts again at 10, even after a completed Sunday. Weekly streaks
cannot carry a bonus across Monday. Examples: Mon/Tue/Wed/Thu/Fri/Sat/Sun earns
10/12/14/16/16/16/16; Mon/Tue/missed Wed/Thu earns 10/12/none/10.

Display base plus bonus for each resource (10 + 0/2/4/6), with distinct
celebrations for the four payout tiers. Use server receipt IDs and TownRewardBar
for material artwork and inventory flights. Handle capped stamina according to
the existing inventory contract and clearly distinguish any actual credited
amount from the nominal reward. Cosmetic effects cannot write inventory.

## Achievement group: Daily Quiz

Each achievement has matching text-free storybook medallion artwork following
the universal badge prompt, and localized names, conditions and difficulty.

| Achievement | Server-verified unlock condition | Difficulty |
| --- | --- | --- |
| First Daily Quiz | Pass one daily quiz | Easy |
| Four in a Row | Pass four consecutive UTC days within one Monday–Sunday week | Medium |
| Perfect Week | Pass every UTC day Monday–Sunday in one week | Hard |
| Daily Ten | Pass quizzes on 10 distinct UTC days | Easy |
| Daily Thirty | Pass quizzes on 30 distinct UTC days | Medium |
| Daily Hundred | Pass quizzes on 100 distinct UTC days | Hard |
| All-Round Learner | Correctly answer a question in every supported subject category | Medium |
| Hard Math Twenty | Correctly answer 20 hard math questions | Hard |

Count a question at most once per child/day for question-based achievements,
including retries. Persist a stable explicit list/version of supported subject
categories for All-Round Learner; adding a future category must not revoke an
earned badge. Integrate all eight achievements with the reviewed server catalog,
the existing single admin migration button, and shared Parent/Admin child-report
projection. Preserve old earned badges and progress; do not infer unrecorded
historical hard-math/category progress.

## Project structure and code style

Active API: `server/src/app.ts`, `server/src/db/index.ts`, `server/src/quiz.ts`,
and typed database contracts/schema. Keep new daily-specific selection, reward
and progress policy in focused modules rather than expanding unrelated games.
Frontend: `frontend/src/pages/ActivityHubPage.tsx`, `MapPage.tsx`, shared Quiz
components, API types and localization. Daily Quiz guide:
`frontend/src/components/Quiz/AGENTS.md`.

Use the existing TypeScript style, explicit typed records and pure policy helpers:

```ts
const bonus = Math.min(Math.max(streakDays - 1, 0), 3) * 2;
const amount = 10 + bonus;
```

The server supplies streakDays; the browser only renders the returned result.

## Implementation sequence

1. Add content/category metadata, deterministic selection and difficulty policy;
   cover eight-question, category-cap, vocabulary-setting and snapshot behavior.
2. Persist settings, snapshots, unique credited days, receipts and question
   progress. Grade and atomically award resources/progress with concurrency and
   replay protection. Provide guarded local schema migration if required.
3. Build the Playground card, game settings, single-selection quiz and tiered
   reward screen; remove the Explorer daily entry point and lesson gate.
4. Register artwork and achievements and both child report projections.
5. Run API/frontend gates and isolated agent-browser complete-flow verification.

## Testing strategy and commands

Use existing frontend/backend test frameworks. Focus tests on UTC midnight,
Sunday/Monday rollover, missed days, retries after failure, repeated/concurrent
passes, cross-family access, snapshot stability and no duplicate progress/rewards.
Verify content has one correct answer, vocabulary has three distinct options,
eight questions fit the category cap and bank coverage supports every setting.
Verify all achievements and consistency of Parent/Admin reports.

```bash
npm test --prefix server
npm run typecheck --prefix server
npm run build --prefix server
npm test --prefix frontend
npm run typecheck:hosting --prefix frontend
npm run build --prefix frontend -- --mode vercel
npm run build --prefix frontend
```

Use the agent-browser skill and an isolated headless Chrome session for setup,
settings, gameplay, failure, retry, completion and repeat-open states at
1366×768, 1024×768 and 1180×820. Check control bounds, scrolling, console/errors,
network behavior, reduced motion and receipt replay. Store evidence only in /tmp.
Start local UAT only through `scripts/start-uat.sh` when needed.

## Boundaries and success criteria

- Always derive identity, authorization, grading, dates, progress and rewards
  on the authenticated server. Persist rewards and completion atomically.
- Preserve same-origin API contracts and existing earned progress; keep changes
  on `feature/playground-daily-quiz`, as explicitly requested by the user.
- No cloud provisioning, production migration, commit, push, merge or deployment
  before the repository-required user confirmation.
- Complete flows fit all required viewports without scrolling, with accessible
  touch controls, localized UI and shared navigation/artwork.
- Implementation is complete only when required checks pass and the full group
  appears consistently in child, Parent and Admin achievement surfaces.

## Review status

User decisions 1–11 and the subsequent learned-content/category clarification
incorporated. Implement the sequence above under the authorized feature scope.

## UAT refinements

- Welcome copy: “Let’s start today with a little warm-up for your curious mind!”
- Keep Town storage in the header. Use the shared English/Vietnamese country
  balls for learning-language selection. No medallion/logo, resource totals or
  seven-day circles on setup; show eight-question progress during gameplay.
- Material amounts and 10 + bonus appear only after a newly rewarded completion.
  Growth-themed celebrations are separate from collectible achievement art.
- Generated sunrise wallpaper matches the existing chubby spring illustration:
  thick cocoa borders, pastel rounded clouds, a smiling sun and rolling hills.
- Exclude category-identification filler and equivalent answer options from new
  selection. Repair invalid uncompleted snapshots on opening while preserving
  already-counted daily question IDs and progress. Already-issued equivalent
  choices are graded fairly; a stale replaced quiz asks the child to reopen.
- Keep standalone-bank ID validation scoped to Daily Quiz; item quiz validation
  retains its existing contract. Daily input accepts one index per question.
- Existing local development/test history included another feature branch's
  schema. Preserve it; use the isolated local Daily Quiz test database for the
  complete backend suite. Migration 0030 has a unique monotonic timestamp.

## Reproducible browser checks

The versioned `frontend/tests/browser/daily-quiz.agent-browser.mjs` harness uses
only agent-browser snapshots/refs and checks every question, setup/settings,
failed results, retry, success and completed/reloaded states at all three
landscape sizes. It exports screenshots, control bounds, console/errors and
filtered HTTP evidence only under /tmp. Reload deliberately requires selecting
an owned child again; profile identity is never persisted by the harness.

For future local runs, register a dedicated `daily-quiz-…@example.test` family
named `Daily Quiz Test Family` and sign in through the isolated browser. With a
local guarded DATABASE_URL_UNPOOLED, run
`node --import tsx scripts/create-daily-quiz-uat-fixtures.ts` from server. It
creates new test children only and prints private fixture paths under /tmp;
it never overwrites existing children/progress. Nonzero bonus fixtures are
not created on Monday, when the real UTC rule always resets bonuses.

Run the harness from the repository root with
`DAILY_QUIZ_ANSWER_FILE=/tmp/daily-quiz-uat-fixtures/<profile-id>.json node frontend/tests/browser/daily-quiz.agent-browser.mjs`.
Use DAILY_QUIZ_BROWSER_SESSION and DAILY_QUIZ_BROWSER_OUTPUT to isolate runs.

## Validation

- Backend: all 470 tests passed with the isolated disposable local PostgreSQL
  database; the additional focused HTTP snapshot-repair/progress regression
  passed. Server typecheck and build passed.
- Frontend: all 471 tests passed; app and hosting typechecks, Vercel build and
  compatibility build passed. Existing large-bundle warnings remain unchanged.
- Headless agent-browser verified failure/retry/pass, all four payout tiers,
  completed-day reopening and no receipt replay. Complete question/control
  flows fit 1366×768, 1024×768 and 1180×820. Final sunrise/setup bounds also
  passed at those sizes and Vietnamese iPad portrait 820×1180, with no scrolling,
  offscreen controls, setup materials or setup achievement medallions.
- The local settings endpoint returned HTTP 200 after migration 0030. Local
  UAT launcher passed readiness on ports 5173/10000 with accounts preserved.
- No commit, push, deployment, cloud provisioning or production migration.

## Vocabulary clue-direction correction

Vocabulary modes now mean description language → answer-word language. Show the
English or Vietnamese definition followed by “What is this?” / “Đây là gì?”,
then three words of the same part of speech. English-word and Vietnamese-word
category caps follow the answer language. New word-clue IDs distinguish this
format from the old word→definition questions. Reopening an uncompleted daily
quiz replaces the old format and aliases already-counted IDs to prevent duplicate
achievement credit. Completed-day rewards, earned achievements and all saved
progress remain intact.

Vocabulary correction validation: all 471 backend and 471 frontend tests passed,
including the four clue/answer language modes and migration of already-counted
word IDs without duplicate progress. Typechecks and both frontend build modes
passed. The isolated agent-browser flow verified description→word choices,
failure/retry/pass and receipt replay at all three landscape sizes.
