# Parent Space refinement

## Objective and scope

Replace the original Exploring-focused parent page with a calm, warm family
overview, explicit routes, and trustworthy reports across the available games.
Continue on `review/recent-code-health-2026-10-13`; preserve the prior refactors.
No release, cloud changes, or production migrations. The user confirmed UAT
and authorized branch commits/push on 2026-10-13.

User-selected direction: a family overview with links to each child's report,
and calm, warm, readable styling with restrained illustrations.

## Routes

- `/parent`: family dashboard and activity totals.
- `/parent/children`: child profiles; `/parent/children/:profileId`: child report.
- `/parent/achievements`: earned collections grouped by child and game.
- `/parent/lists`: content hubs; `/parent/lists/exploring`: system/custom lessons.
- `/parent/lists/exploring/new`, `/:itemId`, and `/:itemId/edit`: routed items.
- `/parent/lists/miniku`: puzzles; `/new` and `/:puzzleId/edit`: routed editor.
- `/parent/friends`: family links and requests.
- `/parent/settings`: parent password/passkeys and optional support.
- Preserve existing `/parent/lessons/*` and `/parent/miniku` entry URLs as aliases.

One parent-gated nested layout owns navigation, breadcrumbs, lock, and the
language-control clearance. Refresh, browser back/forward, and direct entry
must work. Filters and pagination use URL query parameters.

## Reports and security

Render returns a read-only, family-scoped summary from persisted progress,
assessment aggregates, and verified reward events. No schema changes are needed.
An authenticated session and current parent capability protect every report route.
Ownership comes exclusively from the server session.

- Exploring: completed items, derived badges, quiz attempts/passes.
- Flashcards: recorded study sessions/cards; do not claim graded mastery.
- UFO: lifetime words and difficulty counts plus server-derived achievements.
- Waddle Wall: lifetime walls, best score, difficulty/streak achievements.
- InfiniDrill: current expedition depth/answers/equipment; retained earned badges.
- Miniku: lifetime boards and size counts; retained earned badges.
- Town: current structures, roads, balances, and retained earned badges.
- Food and Drink: lifetime completions from deduplicated `drink:` reward events.
- Cooking and Burger: clearly say progress is not recorded yet. Catalog-only
  definitions never contribute to earned badge counts.

Show lifetime/current-expedition labels rather than inventing time-series metrics
that the stored data cannot support. Return scalar aggregates and allowlisted
achievement metadata only, never private questions, solutions, or tokens.
Empty, loading, failed, and unsupported data states must be distinct.

## Implementation order

1. Add reporting contracts, normalization tests, family-scoped repository/routes,
   and API authorization/integration tests.
2. Add the shared parent layout, dashboard, child reports, and achievements.
3. Extract lesson/friend/profile management from the old page into routed views;
   preserve existing actions and add routed item/puzzle editors.
4. Add authored English/Vietnamese copy and responsive styling.
5. Verify browser navigation, filters, reports, parent locking, and CRUD flows,
   then run both frontend/server baseline gates.

## Stack, files, and checks

Use existing React Router, React Query, React/Vite, Hono, PostgreSQL, and Zod.
Do not add dependencies. Frontend modules live in `frontend/src/features/parent/`;
server reports in `server/src/parent-reports/`. Keep presentation separate from
transport; use session-scoped caches and guarded mutation callbacks.

Tests: Node unit/contract tests and disposable localhost PostgreSQL integration;
real Chromium harnesses at 1366×768, 1024×768, 1180×820 and narrow mobile widths.
Parent pages may scroll vertically; navigation, tables, and action controls must
remain readable and never force horizontal page scrolling.

Commands: frontend `npm test`, `typecheck`, `typecheck:hosting`, Vercel and normal
builds; server `npm test`, `typecheck`, and `build`. Run commands with `--prefix`
for their package directories. Use existing local browser test conventions.

## Acceptance criteria

- Dashboard includes all supported games and separates unrecorded/catalog-only
  features. Fixture numbers match server aggregates and do not leak other families.
- Parent navigation has dedicated dashboard, children, lists, achievements,
  friends, and settings destinations; item detail/edit URLs are restorable.
- Creating children, managing lesson availability, custom lesson creation/edit/
  sharing, Miniku puzzles/hints, friendships, passkeys, and locking still work.
- New authored UI copy reacts to English/Vietnamese switching without changing
  learning content. Parent locking clears protected report/management caches.
- Existing branch work and user files are preserved; all relevant checks pass.

## Implementation and validation

Implemented the nested Parent Space shell, family dashboard, child reports,
achievement collections, and routed content/profile/friend/settings management.
Added authenticated read-only report and content-detail endpoints, with owned
family filtering and server-derived achievement totals. Private grading fields
are excluded from the new parent content read response. Parent locking/expiry
clears protected caches and invalidates pending mutation callbacks immediately.

GPT-5.6 Luna agents wrote focused transport/session tests, executed and reviewed
test results, and independently verified the implementation. Final gates passed:

- Frontend: 69 test files; application and hosting typechecks; Vercel and normal
  builds.
- Server: 258 tests, zero skipped, including disposable PostgreSQL integration;
  typecheck and build.
- Chromium: 24 scenarios (12 Parent Space, four access-error),
  including direct entry/refresh, back/forward, CRUD, sharing, locking/expiry,
  Vietnamese copy, and 1366×768, 1024×768, 1180×820, 390×844, 320×667 layouts.
- Focused final transport/request-lifecycle tests and `git diff --check` passed.

Independent review also corrected the supported-game empty-state label and the
Vietnamese lesson-editor back link. A further Luna browser regression passed:
an unrecorded child's game shows "No saved progress yet", while family totals
still include another child's recorded progress (25 browser scenarios verified
in total). Application/hosting typechecks and the Vercel build passed again.

Screenshots in `/tmp/plg-parent-space/` use fixture family data. Cooking/Burger
reporting remains unavailable because persisted progress is absent; Food and
Drink badge definitions remain catalog-only. No production data or cloud
resources were changed. The user confirmed UAT and authorized committing and
pushing the review branch for a pull request.

## Badge collection UAT follow-up

The child's My Badges page now uses shared collection cards for UFO, Waddle
Wall, InfiniDrill, Town, Exploring and Wisdom: 200×380px cards with 96×96px
artwork slots. Fixed columns wrap onto additional rows rather than squeezing
larger groups into smaller cards. Full conditions, earned state, counters and
dates remain visible; compact in-game reward panels are unchanged.

Five Chromium layout cases passed at the laptop, iPad and narrow mobile sizes,
each checking English and Vietnamese, equal card/art dimensions, wrapping,
absence of horizontal overflow and unclipped text. Screenshots were inspected.
The 69 frontend test files, application/hosting typechecks, both builds and
whitespace checks passed again. Fixture screenshots live in
`/tmp/plg-badge-collection/`.
