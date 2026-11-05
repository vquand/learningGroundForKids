# Admin family and learner inspection

## Scope and acceptance criteria

Restore access to item/family lists independently of dashboard statistics;
provide stable family and learner URLs; expose read-only journeys and complete,
paginated stored learning history. Preserve existing family-facing API ownership
checks and existing admin reports. No production migration or new dependencies
are required.

- `/admin` and every protected admin page expose persistent **Administration**
  navigation: Dashboard, Items, Families, Assessments.
- `/admin/families/:familyId` opens family details, with a profile selector and
  **View journey and activity** link for each selected learner.
- `/admin/families/:familyId/profiles/:profileId` can be refreshed/bookmarked.
  It shows totals, a geographic learning journey and chronological stops, plus
  activity filters, pagination, retry, loading, and empty states.
- Dashboard item/statistics errors never hide admin navigation. Root password
  controls remain available as before.
- Requests are cancelled or isolated when session, family, profile, period, or
  activity filter changes; a late result cannot replace the current selection.

## Admin provisioning

Every verified administrator sees **Create family** on `/admin/families`. The form requires a
name, email, initial password (12–256 characters), and matching confirmation.
`POST /api/v1/admin/families` accepts exactly `{ name, email, password }` and
returns `201 { id, display_name, email }`. Passwords are Argon2id hashed and
never returned. The server generates the ID and fixes the role to `family`;
client-provided IDs/roles are rejected. Anonymous callers receive 401; ordinary
families receive 403. Duplicate or reserved email
returns 409, including concurrent duplicates. Existing origin/host checks and
the authentication request limiter apply. Public registration may stay disabled.
Provisioning does not issue a session or replace the administrator's login. No invitation or
email delivery is implied: share the initial credentials privately.

After creation, the family report reloads and opens the new Detail page. Detail
also works for accounts with no learner profiles, and displays email, role,
active status, and creation date when returned by the server. The family-facing
profile picker remains responsible for adding learner profiles after login.
No database migration is required for this feature.

Provisioning verification: 114 frontend tests, 165 server tests including
disposable PostgreSQL integration (zero skips), and 58 Chromium checks passed
(8 provisioning/detail/layout checks plus 50 existing admin/root/login checks).
Frontend and server typechecks and builds passed. Creation uses a native modal
dialog to keep controls usable above the fixed root-password control on mobile.
No production accounts were created during verification.

## Read APIs

All routes require a current backend session with the `admin` role, return
`Cache-Control: no-store`, and use the existing error envelope. Only `GET` is
supported. Both family and profile IDs are checked together on the backend.
They do not impersonate a family or bypass family-route ownership.

Base: `/api/v1/admin/families/:familyId/profiles/:profileId`.

- Base route: identity/display fields, `family_id`, `family_name`, `total_done`,
  `badge_count`, `quiz_attempt_count`, `flashcard_session_count`. No passwords,
  session tokens, raw quiz answers, or flashcard responses are returned.
- `/activities?page=1&page_size=20&type=all`: `{ activities, page, page_size,
  total, total_pages }`. Allowed types: `all`, `completion`, `quiz`, `flashcard`.
  Maximum page size 100. Events have a type-prefixed ID, timestamp, nullable item
  title/category, quiz score/total, or flashcard theme and derived study counts.
  Sort order is timestamp descending, then ID descending for stable ties.
- `/journey?period=last7days&page=1&page_size=100`: `{ origin, waypoints,
  exploredCount, total, page, page_size, total_pages }`. Periods: `today`,
  `yesterday`, `last3days`, `last7days`, `all`. Maximum page size 500. Waypoints
  are ordered by completion time ascending, then progress ID ascending.
  `origin` is the first catalog location on the current page, not a geocoded
  home or physical GPS location. Pagination renders only the current page's
  segment. `exploredCount` is the current page count; `total` is the period count.

Unknown, repeated, malformed, or oversized query parameters return 422.
Page numbers range from 1 to 1,000,000. Missing/mismatched profile pairs return
404. Out-of-range pages return an empty page retaining the total. Lists are
live views: new or removed records can shift offset pages between requests.

## What history means

Completions derive from existing `profile_progress`; quiz attempts and flashcard
sessions derive from their existing server-recorded tables. Existing historical
records are included, including daily quizzes and study sessions without a focus
item. English titles are preferred with another stored language as fallback;
unpublished content remains inspectable by admins.

This is **not an immutable audit log**. Removing completion progress removes its
record; deleting an item cascades some historical records under existing schema
rules. No old logins, page views, or deleted records can be reconstructed. Future
completion/quiz/flashcard records continue to appear through their existing
server-controlled writes; no new sensitive event categories are collected.

Periods use UTC calendar boundaries (three/seven days include today), exclude
future records, and display timestamps in the viewer's local timezone. Lines
on the bundled vector map connect learned catalog locations, not physical travel.

## Verification

Local verification on 2026-09-27 passed: 113 frontend unit tests, 164 server
tests (including disposable PostgreSQL integration, no skips), and 66 Chromium
checks (36 admin restoration, 12 root-password, 18 completion regressions).
Frontend application/hosting and server typechecks passed; both Vercel-mode
and compatibility frontend builds and the server build passed. Responsive
screenshots were inspected and date-line coastline rendering was corrected.
This is local verification, not deployed-environment UAT.

API tests cover role/anonymous protection, methods, scoped IDs, no-store,
validation, and report contracts. Disposable PostgreSQL integration covers
more than eight completions, quiz and flashcard records, stable paging and ties,
title fallback, empty/mismatched scope, period boundaries, and counts.
Browser tests exercise the real application routes with controlled fixtures,
dashboard failure/loading, root control persistence, profile switching, filters,
errors/empty states, keyboard-accessible controls, and responsive navigation.

Run the repository frontend/server gates and:

```bash
PLG_PLAYWRIGHT_MODULE=/path/to/playwright npm run test:browser:admin --prefix frontend
```

Database integration must use a disposable local `TEST_DATABASE_URL`, never
production Neon. No deployment, seed, migration, or production writes are part
of this restoration.
