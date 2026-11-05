# Render API and Neon backend guide

Follow the repository [`AGENTS.md`](../AGENTS.md) and the applicable nested
implementation guide. This is the active Node.js/TypeScript/Hono backend on
Render, using Neon PostgreSQL through Drizzle and `node-postgres`. The Sites
Worker is a historical reference, not the active runtime.

Architecture and security source of truth:
[`docs/plans/2026-09-19-vercel-render-neon.md`](../docs/plans/2026-09-19-vercel-render-neon.md).

## Backend boundaries

- Keep browser requests same-origin through Vercel. Render still validates
  origin/forwarded host and authenticates every protected request.
- Derive identity, family, roles, profile ownership, visibility, grading and
  progress on the server. Never trust browser-provided ownership or completion.
- Preserve existing API shapes and structured error envelopes. Validate request
  inputs, parameterize SQL, and treat provider/generated content as untrusted.
- Keep credentials in runtime configuration. Use pooled `DATABASE_URL` for
  application traffic and direct `DATABASE_URL_UNPOOLED` for migrations.
- Keep private API responses `Cache-Control: no-store`; Vercel/CDN responses
  must not become public/shared HTTP caches for authenticated content.
- Run migrations and seeds only against guarded local/disposable databases
  during development. Do not touch production data or provision/deploy cloud
  resources without the repository's required user confirmation.

## Explore catalog and cluster cache: approved architecture

The user approved this architecture on 2026-10-18. It describes the required
design, not a claim that the cache is already implemented. Implementation and
testable criteria are tracked in
[`docs/plans/2026-10-18-explore-cache.md`](../docs/plans/2026-10-18-explore-cache.md).

### Storage and reuse

- Durable cache storage is **tables we manage in the existing Neon PostgreSQL
  database**. Do not assume PostgreSQL provides an application query-result
  cache or add another database solely for caching.
- Persist versioned catalog/cluster snapshots and bounded rebuild-job state.
  Cluster data includes count, geographic position, bounds and expansion/child
  information for the supported zoom levels or tiles.
- Publish a complete new snapshot atomically; readers must never observe a
  partially built version. Bound retained versions, rows, payloads and retries.
- Use a small bounded API memory cache over durable snapshots. Memory and
  Render's local filesystem are disposable; sleeping/restarting must not require
  rebuilding an unchanged catalog from source.
- Coalesce concurrent misses and rebuild requests. Ten readers of the same
  unchanged common catalog should share one source load/build per revision,
  including across processes through database locking/job ownership.

### Shared means authenticated

- A **common/shared catalog is shared among authorized logged-in users**.
  It does not mean public/anonymous endpoints, public database access or CDN
  publication. Authenticate and authorize every request, including cache hits.
- Enforce published status, family-disabled lessons, ownership, family shares
  and child-targeted audience grants on the server. Cached common data must not
  bypass these visibility rules or a revoked session/profile grant.
- Reuse the common snapshot when the caller can see that catalog. For custom,
  hidden or shared content, compose the authorized common/family view on the
  server and cache the appropriately scoped result.
- Merge authorized item membership before producing final clusters. Do not
  concatenate independently clustered common/family lists or simply add nearby
  counts: membership, centroids and expansion behavior can change.
- Keep child progress, earned badges and completion state outside shared
  catalog/cluster snapshots. Progress remains server-verified and child-scoped.

### Versions, filters and invalidation

- Cache identity must cover catalog version, current visibility scope/version,
  zoom band/tile or geographic bounds, category selection and timeline filter.
  Never key a personalized result only by zoom or category.
- Invalidate/revise affected snapshots when catalog content, translations,
  quiz metadata, publication, disabled lessons or audience grants change.
  Account for ingestion jobs/seeds and external database writes, not only one
  HTTP mutation handler. Permission revocation must not wait for a long TTL.
- Precompute reusable common views and cache other combinations on demand;
  avoid generating every family × child × year × filter × zoom combination.
- The frontend should render prepared overview clusters directly and request
  bounded later views, rather than instantiate every item marker first.
  Preserve filters, cluster expansion, mouse/touch navigation and camera restore.
- Browser reuse remains authorized, versioned and scoped. Do not persist
  identity/progress in browser storage or replay one session/child's private
  results for another. Validate current authorization/version before displaying
  a persisted catalog view after reload.

### Render free-tier job execution

- Stay within the existing **free Render web service** unless the user approves
  a cost change. Free web services do not support Render one-off jobs; cron,
  background-worker and workflow compute must not be assumed free.
- Use bounded rebuild execution in the existing API, with durable database
  job state/locking, idempotent retries and recovery after interruption. Schedule
  work on catalog changes or demand; do not depend on a continuously running
  timer, an always-on worker or a keepalive workaround.
- Free services sleep on idle and may restart. Persist work and snapshots in
  Neon, resume interrupted work safely, and report platform spin-up latency
  separately from warm API/cache latency.
- Keep the rebuild function reusable from a local command or a future Render
  job if paid job execution is later authorized. Do not create a paid service
  or change `render.yaml` to add one as part of the free-tier implementation.
- Recheck official limits before changing the execution model. References
  verified on 2026-10-18: [free service limits](https://render.com/docs/free),
  [cron billing](https://render.com/docs/cronjobs#compute-plans-and-billing),
  [workflow billing](https://render.com/docs/workflows-limits).

## Quiz content

- Exclude country/region association templates and category-identification
  placeholders from authoring, imports and serving. Use the shared policy in
  `src/quiz-content-policy.mjs`; metadata alone must not generate quizzes.
- Lessons with no meaningful questions have no quiz requirement. Retiring
  questions must preserve historical attempts, learned items, badges and rewards.
- Preserve original `seed_index` slots when filtering catalog question arrays;
  question and derived flashcard IDs must not shift onto a different question.
- Migration 0031 retires stored placeholders and their derived flashcards.
  Its operator handoff is `docs/migrations/neon-0031-retire-placeholder-quizzes.sql`.
  Apply only to guarded local/disposable data here, never production.

## Verification gates

The approved Exploring content batch uses the independent, content-only handoff
[`docs/migrations/neon-2026-10-23-exploring-content.sql`](../docs/migrations/neon-2026-10-23-exploring-content.sql).
It requires the existing catalog/schema through 0025, verifies all 30 targets
are system items, and preserves media and player history. It does not consume a
Drizzle schema migration number. Regenerate with `node --import tsx
scripts/build-reviewed-exploring-sql.mjs` from `server/`. Explicit authored
flashcards replace generated prompts; retire old rows rather than deleting
history. Never run this handoff against production from a feature branch.

Run focused tests first, then the required backend gates:

For operator-applied Explore migration 0025, use
[`docs/migrations/neon-0025-explore-snapshots.sql`](../docs/migrations/neon-0025-explore-snapshots.sql).
It wraps the canonical migration in a transaction, requires the exact 0024
ledger entry, and records 0025's canonical hash/timestamp so subsequent Drizzle
runs skip it. Do not run it concurrently with another migrator. The migration
drift regression and disposable PostgreSQL handoff validation cover this path.

For operator-applied Fishing Friends migration 0026, use
[`docs/migrations/neon-0026-fishing-friends.sql`](../docs/migrations/neon-0026-fishing-friends.sql).
It requires the matching 0025 ledger entry, creates only the fishing tables and
records 0026's canonical hash/timestamp atomically. Repeated runs preserve data.
Do not run it concurrently with another migrator or apply it to production here.

For operator-applied Road Racing migration 0027, use
[`docs/migrations/neon-0027-road-racing.sql`](../docs/migrations/neon-0027-road-racing.sql).
It requires the matching 0026 ledger entry, creates only Road Racing progress,
and records 0027's canonical hash/timestamp atomically. Repeated runs preserve
data. Do not run it concurrently with another migrator or apply it to production here.

```bash
npm test --prefix server
npm run typecheck --prefix server
npm run build --prefix server
```

Use disposable/local PostgreSQL for integration tests, including migration,
concurrent rebuild, restart recovery and invalidation tests. Cache-backed routes
need anonymous/cross-family/child/revocation tests even when a snapshot is hot.
Retain before/after latency and source-query/build counts for ten concurrent
readers; do not claim a speedup solely from a cache-hit flag.

For frontend changes, also run the frontend guide's gates and real-browser
Explore flows at 1366×768, 1024×768 and 1180×820. Preserve the prior Explore
performance improvements, controls within the viewport, server-owned progress
and achievement reporting. No commit, push, merge or deployment until the
repository's required user confirmation.
