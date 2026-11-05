# Codebase review and fixes — 2026-09-27

## Scope

Reviewed and fixed the active React frontend and Render API: routing,
registration, session ownership, completion tracking, profile creation,
geocoding, storage streams, and bundle boundaries. Removal candidates were
checked using TypeScript's resolved application graph and repository usage
searches. Independent reviewers checked the frontend, API, and final fixes.

This is a targeted code review with local regression evidence, not completed
migration UAT or an exhaustive security audit. Historical backends and the
transitional Worker remain required reference/compatibility infrastructure.

## Implemented fixes

- Removed the unreachable CategoryFilter component, unused admin profile
  mutation wrappers and duplicate ProfileUpdate type, unused era-label
  functions, completion-hook default exports, deprecated clearFamily alias,
  and unused server test import. Active replacements remain intact. The
  deleted tracked component is recoverable from Git history.
- Added application TypeScript checking, separate from hosting configuration.
- Corrected related movie/music links to the registered /items/:id route.
- Completion tracking waits for item data and the lazy category to render.
  Timers, scroll dwell, media interaction, and badge celebrations are owned by
  the item, profile, family, and session generation. Dynamically added
  checkpoints receive their own three-second dwell; tall content remains
  usable. A late response cannot update a different owner or an unmounted page.
- Quiz passes cancel pending pre-pass reads and refresh server-derived
  completion, quiz status, progress, profile totals, badges, and achievements.
  The quiz result screen remains open until explicitly closed.
- In-flight completion saves are deduplicated, including quiz-required
  responses. Read/save failures have visible, explicit retry controls; a
  failed status read cannot bypass the completion gates.
- Authentication quotas use the trusted HTTP adapter's socket address instead
  of the destination hostname. Forwarded addresses are accepted only through
  explicitly configured proxy IPs/CIDRs, walked right-to-left to the first
  untrusted hop. Forged prefixes cannot reset the quota.
- Profile creation locks the family row, counts, and inserts in one
  PostgreSQL transaction. Concurrent creation cannot exceed five profiles;
  the existing 409 PROFILE_LIMIT_REACHED response is preserved.
- Geocoding has one five-second deadline covering both provider attempts and
  body parsing, validates coordinate shape/ranges, and preserves null fallback.
- Storage bodies are cancelled for HEAD and known oversized-object responses.
  Cancellation failures preserve the original HTTP response.
- Restored /register and the sign-in registration link, governed by a public,
  non-cacheable availability endpoint and existing server enforcement.
  Password confirmation, API errors, duplicate-submit protection, mobile
  layout, and session refresh are covered.
- Consolidated quiz language selection into the production-used, tested
  policy: requested language, then English, then alphabetical fallback.
- Lazy-loaded map, profile-picker, item-detail, and registration routes.
  Journey replay and globe CSS load with their features. Route-load failures
  provide a reload recovery screen.

## Registration and deployment configuration

Self-registration remains disabled by default. When the API runtime sets
ALLOW_REGISTRATION=true, sign-in offers **Create a family account**. The
/register form requires a family name, email, and a 12-character minimum
password. This branch does not change live registration settings.

AUTH_TRUSTED_PROXY_CIDRS defaults to empty. Behind verified ingress, operators
must supply its exact IPs/CIDRs alongside TRUST_PROXY_HEADERS=true and the
existing Render hostname trust anchor. Empty proxy ranges safely ignore
forwarded addresses, so clients behind one ingress peer share that peer's
quota until verified runtime configuration is supplied. Do not guess broad
private-network or catch-all ranges. No platform configuration was changed.

## Verification

- Frontend unit/contract suite: **106 passed**, none skipped.
- API suite: **147 passed**, none skipped, including real socket-address
  checks and PostgreSQL integration on a disposable local test database.
- Database integration includes simultaneous creation from four profiles:
  exactly one success, one 409 conflict, and exactly five stored profiles.
- Browser completion suite: **18 passed**, covering delayed data/chunks,
  dynamic/tall checkpoints, media gates, quiz synchronization, pending
  pre-pass reads, read/save retries, duplicate saves, and late responses after
  item/profile/family/session transitions or unmount.
- Browser flow checks passed: route failure/reload, closed/enabled registration,
  confirmation and duplicate-account errors, mobile registration, new session,
  delayed item/category loading, media/scroll gates, quiz pass, and linked-item
  reset. API responses were mocked; real React, routing, queries, observers,
  audio controls, and Chromium were exercised. No unexpected page errors.
- Application, hosting, and server type checks passed.
- Vercel frontend, transitional Sites, and server builds passed.
- Initial JavaScript chunk: **295.99 kB / 93.07 kB gzip**, down from approximately
  **1,193.68 kB / 370.98 kB gzip** (about 75% smaller).
- Final targeted peer review found no outstanding actionable issues.
- git diff --check passed.

Browser regressions use an existing Playwright installation. The isolated
suite starts its own Vite server:

    npm run test:browser:completion --prefix frontend

Set PLG_PLAYWRIGHT_MODULE to an existing Playwright package path when it is not
resolvable locally. The flow suite uses a running Vercel-mode dev server at
127.0.0.1:5173 by default:

    npm run test:browser:review --prefix frontend

REVIEW_BASE_URL overrides that URL; PLAYWRIGHT_MODULE accepts the module
specifier or file URL of an existing installation. No dependencies were added.

## Remaining limitations

The lazy replay chunk is still approximately 584 kB and the lazy Cesium globe
chunk 4,057 kB; build size warnings remain visible. These are deferred feature
costs, not part of the initial JavaScript chunk. Removing or replacing the globe
is outside this targeted cleanup. The existing Node module registration
deprecation warning also remains.

Media HEAD still calls GetObject before cancelling; a metadata-only storage
method is a possible later optimization. No live cloud/provider UAT, production
migration, or release action was performed.

Verification completed on **codex/codebase-review-fixes**, created at the user's
explicit request. Publication is tracked in Git history; no merge, deployment,
or migration-completion action was performed.
