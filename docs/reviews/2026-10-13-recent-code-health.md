# Recent code health review — 2026-10-13

Branch: `review/recent-code-health-2026-10-13`, based on `aa3688d`.

Scope: 20 non-merge commits returned by `git log --since='5 days ago'`,
covering October 8–12. Reviewed the aggregate changes and focused on new game
state, persistence, achievements, authentication, and localization. This is
a refactoring assessment, not an exhaustive security or live-browser audit.
The initial assessment changed no application code or external resources. The
implementation and self-test results are recorded below.

## Recommended work, in order

### 1. Important: centralize session-safe game mutations

Evidence: `frontend/src/features/miniku/MinikuPage.tsx:69` awaits the action
and optional animation before unconditionally calling `cache.setQueryData`
and updating local completion state. Its query is session-scoped, but its
mutation is not. A response arriving after logout can recreate the removed
private cache entry under the old family/profile key. This is a client cache
lifecycle issue; it does not establish a server authorization bypass.

Town already captures a family session snapshot and checks both the session
and active profile before applying action responses
(`TownBuildingPage.tsx:88`). The puzzle editor also guards successful responses.
Several handlers still handle errors/finalization differently.

Extract a small request lifecycle helper or hook: capture family generation
and profile, serialize commands, apply responses only while the owner is
current, and guard errors and completion callbacks too. Keep each game's
revision rules and animations explicit. Start with Miniku; avoid building a
general game framework. Remount profile-local state on session/profile changes.

Verification: delayed action response after logout, same-family sign-in again,
profile switching, and unmount during animation must not restore old cache
entries or show old completion UI. These scenarios need focused regression
tests; the existing Miniku API test checks transport and private-key membership.

### 2. Important: separate Town reads from reconciliation and unconditional writes

Evidence: `server/src/town-building/repository.ts:35` uses the same transaction
for reads and mutations. Every `get` initializes/locks the row, backfills learned
items, loads all learned IDs, and saves the full state even if it is unchanged.
Both the town GET and the name-only GET call this method
(`server/src/town-building/routes.ts:50`). The town page polls every 30 seconds.
Verified source-game rewards also lock the town row.

This makes normal display reads perform avoidable writes and share an exclusive
lock with resource credits. The extra work is demonstrable from the queries;
production contention and latency have not been measured.

First skip unchanged saves and give name-only reads a narrow query. Then
separate initial reconciliation from steady-state reads, preserving first-Done
backfill, earned milestones, and revision behavior. The verified Done path
already inserts into `town_learned_items` in its own transaction
(`server/src/db/index.ts:2629`), so maintain that atomicity.

Verification: existing DB town tests plus legacy-progress initialization,
repeated unchanged reads, concurrent reward/read/action requests, and stale
revision rejection without partial debit. Keep lock ordering explicit.

### 3. Consider: give Miniku achievements one canonical definition

Evidence: `server/src/miniku/game.ts:39` repeats names, IDs, descriptions,
difficulties, and unlock thresholds also declared in
`server/src/achievement-catalog.ts:120`. The game uses predicates while the
admin catalog uses metrics/targets. They agree today but can drift independently.

Put Miniku definitions in a small feature-owned module. Derive catalog metadata
and server grading from those definitions, preserving IDs, atlas indices,
timestamps, and admin migration behavior. Keep grading on the server. Do not
merge the global catalog into the game engine just to remove duplication.

Verification: threshold boundaries, all three board sizes, catalog/grading
agreement, idempotent catalog sync, and preservation of previously earned badges.

### 4. Consider: split Infinidrill orchestration from presentation

Evidence: `frontend/src/features/infinidrill/InfinidrillPage.tsx` is 468 lines.
Its session component starts at line 141 and owns network sync, request locking,
game input, equipment reveals, reward flights, timers, keyboard handlers,
dialog focus management, and the main render. Animation locks and server state
are intertwined. The drill transition updates React state every 16 ms at line
322, rerendering the component; no performance regression is claimed without
profiling.

Extract a server-session hook, an animation controller with centralized timer
cleanup, and the existing workshop/drill presentation components into separate
files. Keep the pure reducer shared and authoritative grading server-side.
If profiling warrants it, localize animation state to the scene or drive visual
updates with animation frames instead of rerendering the entire page.

Verification: existing game/API/browser coverage, replay, sync after conflict,
leave during a request or animation, reduced motion, and all required viewport
sizes. Split behavior-preserving extraction from any animation optimization.

### 5. Consider: remove authentication's dependency on the app composition module

Evidence: `server/src/app.ts` imports `registerPasskeyRoutes`, while
`server/src/passkeys.ts:13` imports the runtime `AuthRateLimiter` class back from
`app.ts`. This is a runtime circular dependency. The newly changed auth flow
also relies on app-owned dependency types. `app.ts` is 1,278 lines, and the
passkey persistence block was added to the 2,661-line `db/index.ts`.

Move the rate limiter to a standalone module and export app context/dependency
types from a contracts module. Extract the passkey repository behind its
existing interface, following the separate Google repository pattern. Preserve
all existing credential/session transaction checks; file size alone is not a
reason to rewrite the whole app or database layer.

Verification: existing auth, passkey, adapter, and database parent-access tests;
unchanged origin, rate-limit, counter/replay, password-rotation, and parent
elevation behavior. This can follow the first four items.

## Validation and limits

- Frontend tests: 67 passed.
- Server tests outside the sandbox: 247 passed, 6 skipped, 0 failed.
- Frontend hosting typecheck and server typecheck: passed.
- Frontend Vercel build, compatibility build, and server build: passed.
- The sandbox server test run failed in the localhost-binding Node adapter test;
  the unrestricted rerun passed.
- Database integration tests require `TEST_DATABASE_URL` and were skipped.
  No database migrations or seed commands were run.
- Frontend builds warn about large chunks, including the Cesium globe chunk.
  This predates the review's focused game/auth changes and is not, by itself,
  evidence for a new refactor in this five-day window.
- No live browser flows or production performance measurements were performed.

Recommended first slice: fix Miniku's mutation lifecycle with regression
coverage, then remove Town's unnecessary read-time writes. These have concrete
correctness or operational benefits; the remaining extractions reduce future
change risk.

## Implementation and self-test — 2026-10-13

All five items are implemented on the same review branch, without committing,
pushing, deploying, or changing production data.

1. `requestLifecycle.ts` and `useSessionRequests.ts` serialize requests and
   discard stale success, error, and finalization callbacks. Miniku, Town,
   and Infinidrill use them. Session/profile keys remount local game state.
   Miniku cancels number-flight sprites on unmount.
2. Town steady-state reads use an unlocked MVCC snapshot; reconciliation is
   rechecked transactionally only when needed. Unchanged state is not saved.
   Name reads select only the saved name. Source rewards and spending retain
   their existing atomic transactions and lock order.
3. `server/src/miniku/achievements.ts` supplies both catalog metadata and
   grading thresholds. IDs, badge positions, unlock rules, and awards remain
   compatible. The missing server Miniku implementation guide was added.
4. Infinidrill transport, animations, and presentation are separate modules.
   The route page shrank from 468 to 167 lines. Animation timing and server
   authority are preserved; no unmeasured animation performance claims are made.
5. Rate limiting and app contracts no longer depend on the app composition
   module. Passkey persistence is extracted into `server/src/db/passkeys.ts`,
   retaining credential-counter, session-binding, and elevation transactions.

Browser self-tests also exposed existing viewport gaps. Miniku's square grid
now accounts for its surrounding controls, and Town's blueprint tiles reserve
space for costs, locked-building links, and removal confirmation while retaining
44px minimum heights. Existing browser checks were updated for the current
InfiniDrill brand and Town preview buttons; closed details contents are excluded
from visible-control bounds checks.

Validation after implementation:

- Frontend tests: 68 test files passed, including request lifecycle regressions.
- Server tests: 254 passed, zero failures or skips, against a disposable local
  PostgreSQL 17 container. All DB integration tests ran sequentially.
- Frontend app/hosting and server typechecks passed.
- Frontend Vercel/compatibility and server builds passed. The existing large
  globe chunk warning remains.
- Browser scenarios: all 20 Infinidrill, 11 Town, and 8 Miniku scenarios passed
  across the full runs and focused reruns. The two Infinidrill reruns corrected
  an obsolete brand selector, not game logic.
- Required 1366×768, 1024×768, and 1180×820 flows pass bounds and no-scroll
  assertions; Town also passes 1366×678. Miniku covers all three board sizes,
  completion/replay, badges, logout, re-login, profile switch, leave, and a
  profile switch during number flight under React StrictMode.
- Town DB regressions verify unchanged reads preserve the row version, name
  reads cause no write, and reads succeed while a spending transaction holds
  the town row lock. Existing concurrent reward/spending checks also pass.
- `git diff --check` passed. Existing untracked user files were preserved.

Local self-tests are complete. The user confirmed UAT and authorized branch
commits/push on 2026-10-13; no merge or deployment was requested.
