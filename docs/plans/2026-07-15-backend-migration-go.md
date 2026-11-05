# Implementation Plan: React Frontend + Go Backend Migration

> Historical plan: the superseded Go and Python backends were removed on
> 2026-10-31 after the user confirmed parity on Vercel/Render/Neon. Old runtime
> files and commands remain available in Git history.

## Status

- **Status:** Proposed implementation plan
- **Working branch:** `feature/backend-migration-go`
- **UAT gate:** Do not mark this plan complete, commit, push, or merge to `main` until the user says `confirmed`.
- **Detailed scope:** This plan carries forward the non-Supabase findings from the code review. Supabase-specific RLS and client-query fixes are intentionally replaced by the target backend's authorization and data-access design.

## Implementation progress

- [x] Created the standalone `backend-go` module with safe development defaults.
- [x] Added structured JSON errors, request IDs, security headers, liveness, readiness, and graceful shutdown.
- [x] Added configuration and HTTP tests; `go test -race ./...`, `go vet ./...`, and `go build ./...` pass for the new module.
- [x] Added a bounded `pgx` connection pool with startup ping and explicit production HTTPS-origin validation.
- [x] Added standalone core/learning/social SQL migrations and a transactional migration runner with ordered-file tests.
- [x] Added Argon2id password hashing and opaque session-token primitives with input/cost limits and race-tested unit coverage.
- [x] Connected the frontend through a Vite `/api/v1` proxy to the Go backend and added a visible backend connection/retry gate.
- [x] Made legacy Supabase startup configuration non-fatal while feature modules are being migrated, preventing blank-screen startup failures.
- [x] Added a localhost smoke test path; liveness passed and readiness correctly failed until database configuration exists.
- [ ] Run migrations against a disposable PostgreSQL instance and add repository queries with authorization predicates.
- [ ] Port the first authenticated vertical feature slice.

## Objective

Move the application to a conventional web architecture:

```text
React/Vite browser client
        │ HTTPS / same-origin API
        ▼
Go API and background workers
        │
        ├── PostgreSQL
        ├── S3-compatible object storage (MinIO locally)
        └── Optional Redis only when measured needs justify it
```

The browser must not connect directly to the database, object storage, or an administrative data service. The Go backend becomes the single enforcement point for authentication, authorization, validation, transactions, quiz grading, progress, media, and admin operations.

## Assumptions

1. The existing React/Vite frontend remains the product UI; this is a backend and data-access migration, not a frontend rewrite.
2. PostgreSQL remains the primary relational database, but it is operated independently from Supabase.
3. The migration must preserve existing user-visible features: profiles, map items, lessons, custom sharing, progress, badges, quizzes, flashcards, social features, admin tools, AI enrichment, Telegram workflows, and journey replay.
4. Local UAT uses the Vite frontend on port `3001` and the Go API on a separate local port, proxied through the frontend during development.
5. Existing data must be migrated without losing families, profiles, items, progress, attempts, badges, media metadata, or custom lessons.

## Backend recommendation: Go

Use Go for the replacement backend.

### Why Go is the better fit here

- Strong HTTP, PostgreSQL, concurrency, and operational tooling with a smaller migration surface than Rust.
- Easier for the existing Python/TypeScript team to read and maintain during a large feature-by-feature port.
- Good performance for API I/O, background jobs, media processing orchestration, and concurrent database access.
- Straightforward static binaries and small production containers.
- `pgx` plus `sqlc` provides explicit, parameterized SQL without hiding important query behavior.

### Rust remains viable, but is not the recommendation

Rust with Axum and SQLx would provide excellent safety and performance, but it increases the learning curve and porting cost for this application. Choose Rust only if the team already has strong Rust expertise or has a measured requirement for tighter memory control, specialized CPU workloads, or a single high-performance service where the extra complexity is justified.

## Target architecture

### Frontend

- Keep React 19, Vite, React Router, React Query, Zustand, Leaflet, and Cesium where they continue to provide value.
- Replace direct database client calls with a typed `api/v1` client using `fetch` and same-origin cookies.
- Remove the Supabase client and all browser-side database access.
- Keep API response types separate from form input types.
- Use one structured error format and one pagination format everywhere.

### Go backend

Recommended layout:

```text
backend-go/
  cmd/server/                 # process entrypoint
  cmd/worker/                 # media/AI/background jobs
  internal/http/              # routes, middleware, request/response types
  internal/auth/              # password hashing, sessions, roles, CSRF
  internal/domain/            # business rules and authorization decisions
  internal/repository/        # sqlc-generated queries and transactions
  internal/storage/           # S3-compatible object storage
  internal/jobs/              # bounded asynchronous work
  migrations/                 # versioned PostgreSQL migrations
  tests/                      # unit, integration, contract, security tests
```

Recommended dependencies:

- `net/http` with `chi` or an equivalent small router.
- `pgx` and `sqlc` for PostgreSQL access.
- `goose` or `atlas` for migrations; choose one and document it.
- `argon2id` for passwords.
- OpenTelemetry-compatible tracing and structured JSON logging.
- S3-compatible storage API for avatars and media; MinIO is the local UAT service.

### Data and authorization model

- Use PostgreSQL constraints, foreign keys, unique indexes, check constraints, and transactions as the integrity boundary.
- Centralize authorization in Go services and repository queries. Every query involving a family, profile, lesson, audience, progress row, attempt, media object, or admin action must receive the authenticated principal.
- Never load all tenants and filter in application memory when the database can filter and aggregate safely.
- Use explicit ownership checks for family/profile resources and explicit recipient checks for shared lessons.
- Keep admin operations separate from family operations and require a role plus audit record.

## Security baseline

Security is a design requirement for the migration, not a later hardening pass.

- Use Argon2id password hashes; never SHA-256 passwords.
- Use opaque, cryptographically random server-side sessions stored in PostgreSQL or Redis. Store only a hash of the session token, expire sessions, support logout/revocation, and use `HttpOnly`, `Secure`, and `SameSite` cookies.
- Add CSRF protection for cookie-authenticated state-changing requests.
- Rate-limit login, password reset, avatar upload, admin, AI, and expensive search/media endpoints.
- Configure a strict CORS allowlist, CSP, HSTS in production, `X-Content-Type-Options`, frame protection, and a safe referrer policy.
- Validate all JSON, query, path, file, and third-party inputs at the boundary. Parse UUIDs before queries and return predictable 4xx responses.
- Never return stack traces, raw database errors, tokens, password hashes, or internal paths to clients.
- Validate uploaded files by content/magic bytes, size, dimensions, and decoded image format; re-encode accepted images and generate controlled storage keys.
- Treat AI output as untrusted. Validate structured output, allowlist tool actions, cap tokens/loops, and require explicit authorization for destructive actions.
- Treat every server-side URL fetch as SSRF-sensitive: allowlist schemes/hosts, reject private/reserved addresses, cap response size, disable unsafe redirects, and set timeouts.
- Use separate least-privilege database roles for migrations, API reads/writes, and background jobs.
- Add audit events for authentication, admin writes, sharing, deletion, quiz completion, and role changes.
- Maintain encrypted backups and regularly verify restoration.

## Performance baseline

- Use one process-level PostgreSQL connection pool with bounded sizes and timeouts.
- Add indexes based on query plans for family/profile ownership, item category/year, lesson audiences, progress, attempts, and timestamps.
- Paginate all list endpoints server-side with stable ordering; prefer cursor pagination for large activity/attempt lists.
- Return compact map/catalog payloads and load full item detail on demand.
- Replace repeated aggregate loops with SQL aggregation or materialized read models where profiling supports it.
- Move CPU-heavy image tracing and AI work to bounded worker jobs; cap downloaded bytes and decoded pixels.
- Cache stable public catalog data with explicit invalidation/versioning and use ETags where useful.
- Lazy-load Cesium, world-atlas terrain data, and journey replay code; avoid putting large map/replay dependencies in the initial route bundle.
- Keep animation state in refs or an external store and publish UI progress at a controlled rate rather than causing React updates on every animation frame.
- Configure React Query stale times and retry behavior intentionally; do not refetch expensive catalogs on every focus event.
- Measure with database `EXPLAIN`, Go benchmarks, browser performance traces, and realistic seeded data before and after optimization.

## Findings carried into the migration backlog

These are the review findings that are not specific to Supabase and must be addressed in the replacement implementation:

| Area | Finding | Target treatment |
|---|---|---|
| Avatar/media | Normal users cannot use the current custom-avatar flow; remove can orphan files. | Family-owned upload/delete API, object storage lifecycle cleanup, content validation, and ownership checks. |
| Transactions | Parent/admin lesson writes can insert partial records. | Validate first and commit item, translations, audiences, and related rows in one transaction. |
| Integrity | Quiz grading, attempts, progress, and badge awards are client-trusted. | Server-side grading and atomic completion command; never send answer keys to the browser. |
| Authentication | Default admin password and in-memory non-expiring tokens are unsafe. | Argon2id, expiring sessions, rate limits, role checks, revocation, and no default credentials. |
| API shape | List endpoints fetch unbounded data and paginate only in the UI. | Typed, versioned, server-paginated endpoints with counts/cursors and stable ordering. |
| Animation | Journey replay publishes React state on every animation frame. | Ref/external-store state with throttled progress events and measured rendering. |
| Media processing | Synchronous image tracing runs inside async request handlers; downloads are not sufficiently bounded. | Worker jobs, byte/pixel limits, timeouts, and retry/dead-letter behavior. |
| Logging | Telegram debug handler logs every update and some handlers expose raw exceptions. | Remove debug logging, redact PII, use structured logs, and return generic user errors. |
| In-memory state | Draft storage has no TTL or maximum size. | Add expiry, bounded capacity, cleanup, and persistence only if the workflow requires it. |
| Generated media | SVG generation needs output escaping and controlled markup. | XML-escape all dynamic text and validate generated assets before serving. |
| Quiz state | Active/inactive question handling is inconsistent between catalog and quiz behavior. | Define one server-side `hasQuiz` contract based on active published questions. |
| Randomization | `sort(() => Math.random() - 0.5)` is a biased shuffle. | Use one tested Fisher–Yates helper in the backend or API response builder. |
| Error handling | Several client operations ignore response errors and can fail silently. | Structured errors, explicit handling, telemetry, and retry policy. |
| Data contracts | Activity/avatar response fields are inconsistent between producer and consumer. | Define versioned response schemas and contract tests. |
| Validation | IDs and mutable collection defaults are not consistently modeled at boundaries. | Parse UUIDs, use default factories, and validate request/response schemas. |
| External services | Direct geocoding requests need rate policy, caching, headers, and failure handling. | Backend geocoder adapter with positive/negative caching, timeout, and provider policy. |
| Health | A shallow health endpoint can report success while dependencies are unavailable. | Separate liveness and readiness checks with dependency status. |
| Frontend structure | Very large pages/components make behavior difficult to test and change. | Extract feature hooks, data containers, forms, and presentational components incrementally. |
| Tooling | Frontend has no lint/test scripts and Vite contains unused copy code. | Add lint/typecheck/unit/e2e gates; remove dead imports/dependencies and simplify Cesium copying. |
| Documentation | README and agent instructions describe obsolete startup, auth, paths, and feature behavior. | Update current docs and add ADRs for durable architectural decisions. |

## Implementation phases

### Phase 0: Baseline and contracts

#### Task 0.1: Freeze the current behavior contract

**Acceptance criteria:**

- [ ] Inventory all current user/admin routes, request fields, response fields, status codes, and feature flows.
- [ ] Record data counts, media references, and representative UAT accounts from the current deployment.
- [ ] Define the compatibility target and explicitly list intentional behavior changes.

**Verification:** API inventory review, fixture export, and a baseline UAT checklist.

**Dependencies:** None. **Scope:** Medium.

#### Task 0.2: Define the versioned API contract

**Acceptance criteria:**

- [ ] All replacement routes use `/api/v1` and typed request/response schemas.
- [ ] Errors use `{ error: { code, message, details? } }` without internal details.
- [ ] List responses use one pagination contract with stable ordering.
- [ ] OpenAPI and generated TypeScript types are committed with the API implementation.

**Verification:** Contract tests reject shape/status regressions.

**Dependencies:** Task 0.1. **Scope:** Medium.

### Checkpoint A: Contract gate

- [ ] User-visible behavior and intentional changes are documented.
- [ ] API contracts are approved before feature ports begin.

### Phase 1: Go and infrastructure foundation

#### Task 1.1: Scaffold the Go API and worker

**Acceptance criteria:**

- [ ] `backend-go` builds as a reproducible binary with pinned dependencies.
- [ ] Configuration fails closed when required secrets or database settings are missing.
- [ ] Liveness/readiness endpoints, graceful shutdown, request IDs, structured logs, and panic recovery exist.

**Verification:** Go unit tests, `go vet`, static analysis, container build, and readiness failure tests.

**Dependencies:** Task 0.2. **Scope:** Medium.

#### Task 1.2: Add local PostgreSQL and MinIO services

**Acceptance criteria:**

- [ ] Local development starts without Supabase.
- [ ] Database and object storage data use ignored local volumes.
- [ ] Secrets come from an example environment file and are never committed.

**Verification:** Clean-machine bootstrap and health checks.

**Dependencies:** Task 1.1. **Scope:** Medium.

#### Task 1.3: Add quality gates

**Acceptance criteria:**

- [ ] Go formatting, vet, tests, static analysis, frontend typecheck, lint, and build have named commands.
- [ ] CI runs the same gates using lockfiles and no production secrets.
- [ ] Dependency audit and secret scanning are included.

**Verification:** CI passes on the branch with a clean checkout.

**Dependencies:** Task 1.1. **Scope:** Medium.

### Phase 2: Database and security foundations

#### Task 2.1: Create the standalone PostgreSQL schema

**Acceptance criteria:**

- [ ] All current domain tables and relationships are represented with constraints and indexes.
- [ ] Migration files are ordered, reversible where practical, and safe to run repeatedly in development.
- [ ] Ownership and sharing invariants are enforceable by constraints and transaction-level services.

**Verification:** Migration tests from empty database, schema inspection, and constraint violation tests.

**Dependencies:** Tasks 0.1, 1.2. **Scope:** Large; split by domain.

#### Task 2.2: Implement authentication and authorization

**Acceptance criteria:**

- [ ] Registration/login/logout/session renewal use Argon2id and secure cookies.
- [ ] Family, profile, recipient, and admin authorization checks are centralized and tested.
- [ ] CSRF, rate limiting, account lockout/backoff, audit events, and generic auth errors exist.

**Verification:** Authentication integration tests, authorization matrix tests, CSRF tests, and rate-limit tests.

**Dependencies:** Task 2.1. **Scope:** Large; split auth/session/authorization.

### Checkpoint B: Security gate

- [ ] No endpoint can access another family’s data in authorization tests.
- [ ] No client-supplied score, completion, role, owner, or audience can bypass server validation.
- [ ] Threat model and security checklist are reviewed before data is exposed.

### Phase 3: Vertical feature migration

Port one complete feature slice at a time so every increment remains UAT-able.

#### Task 3.1: Authentication and profile selection

**Acceptance criteria:**

- [ ] Login, registration, session restoration, profile selection, and logout work through `/api/v1`.
- [ ] Profile ownership and profile limits are enforced by the Go API.
- [ ] The frontend no longer imports a database client.

**Verification:** Browser UAT and API integration tests for valid, invalid, expired, and cross-family sessions.

**Dependencies:** Task 2.2. **Scope:** Large; split frontend/backend.

#### Task 3.2: Public catalog, item detail, map, and media

**Acceptance criteria:**

- [ ] Catalog/map endpoints are compact, paginated or cacheable, and filterable.
- [ ] Item detail includes translations/media consistently and validates IDs.
- [ ] Media is served from controlled storage with safe cache headers.

**Verification:** API contract tests, query-plan review, browser map/detail UAT, and large-fixture performance test.

**Dependencies:** Tasks 2.1, 2.2. **Scope:** Large; split read API, frontend adapter, media.

#### Task 3.3: Profiles, avatars, progress, badges, and social features

**Acceptance criteria:**

- [ ] Avatar upload/delete verifies profile ownership, validates/re-encodes images, and cleans up replaced files.
- [ ] Progress, badges, recent activity, friend requests, and parent profile views use consistent typed contracts.
- [ ] Mutations are idempotent where the UI can retry them.

**Verification:** Upload abuse tests, ownership matrix, retry/idempotency tests, and browser UAT.

**Dependencies:** Tasks 2.2, 3.1, 3.2. **Scope:** Large; split media/profile/social.

#### Task 3.4: Server-authoritative quizzes, daily quiz, and flashcards

**Acceptance criteria:**

- [ ] Answer keys remain server-side.
- [ ] The server validates question membership, attempt ownership, score calculation, pass thresholds, and completion transitions atomically.
- [ ] Daily quiz selection uses a tested unbiased shuffle and deterministic snapshots where required.
- [ ] Flashcard access is derived from item/family authorization.

**Verification:** Tampered-request tests, replay tests, concurrency tests, and browser UAT.

**Dependencies:** Tasks 2.1, 2.2, 3.2, 3.3. **Scope:** Large; split quiz/progress/flashcards.

#### Task 3.5: Parent lessons and sharing

**Acceptance criteria:**

- [ ] Create/update/delete lesson operations are transactional.
- [ ] Owner, family recipient, and profile recipient visibility is correct and does not reveal unrelated audiences.
- [ ] Catalog listing is server-paginated and bounded.

**Verification:** Authorization matrix, transaction rollback tests, privacy tests, and parent UAT.

**Dependencies:** Tasks 2.1, 2.2, 3.3. **Scope:** Large; split lesson CRUD/sharing/listing.

#### Task 3.6: Admin, AI enrichment, Telegram, and media jobs

**Acceptance criteria:**

- [ ] Admin routes use role checks, audit logs, validation, and bounded queries.
- [ ] AI tools validate model output, cap tool loops, enforce authorization, and do not leak raw exceptions.
- [ ] Telegram handlers do not log full updates or send internal errors to users.
- [ ] Image/media work runs in bounded workers with retry and failure visibility.

**Verification:** Admin authorization tests, job retry tests, SSRF/upload tests, and operator UAT.

**Dependencies:** Tasks 2.2, 3.2, 3.5. **Scope:** Large; split admin/AI/bot/jobs.

### Checkpoint C: Feature parity gate

- [ ] All baseline UAT flows work against the Go API.
- [ ] API, database, security, and frontend tests pass.
- [ ] Query plans and browser traces show no unbounded production paths.

### Phase 4: Frontend simplification and performance

#### Task 4.1: Replace frontend data access

**Acceptance criteria:**

- [ ] All frontend API modules call the Go API client.
- [ ] Supabase-specific stores, types, environment variables, and dependencies are removed after parity.
- [ ] Loading, empty, retry, and structured-error states are consistent.

**Verification:** Repository search finds no runtime database-client imports; frontend build and contract tests pass.

**Dependencies:** Tasks 3.1–3.6. **Scope:** Large; migrate one API module at a time.

#### Task 4.2: Simplify large UI modules

**Acceptance criteria:**

- [ ] Parent/profile/admin pages are decomposed into feature hooks, containers, and presentational components.
- [ ] Duplicate API/error/loading logic is centralized.
- [ ] Existing behavior is covered by component tests before extraction.

**Verification:** Component tests, typecheck, lint, and browser UAT.

**Dependencies:** Task 4.1. **Scope:** Large; incremental only.

#### Task 4.3: Optimize replay, catalog, and route loading

**Acceptance criteria:**

- [ ] Journey animation no longer causes per-frame React state updates.
- [ ] Cesium/world-atlas/replay code is lazy-loaded and measured.
- [ ] Catalog requests are bounded, cached, and not unnecessarily prefetched on profile selection.

**Verification:** Browser performance trace, bundle report, and before/after render/request measurements.

**Dependencies:** Tasks 3.2, 4.1. **Scope:** Medium.

### Phase 5: Data migration and cutover

#### Task 5.1: Build an idempotent data/media migration tool

**Acceptance criteria:**

- [ ] Source data is exported with counts/checksums and transformed into the standalone schema.
- [ ] Media objects are copied with verified checksums and rewritten controlled URLs.
- [ ] Re-running the migration is safe and produces the same result.

**Verification:** Dry run, duplicate run, row-count comparison, foreign-key validation, media checksum comparison, and restore test.

**Dependencies:** Tasks 2.1, 3.2, 3.3. **Scope:** Large; split data/media/verification.

#### Task 5.2: Run a local shadow/cutover rehearsal

**Acceptance criteria:**

- [ ] The migrated stack supports the complete baseline UAT checklist.
- [ ] A rollback procedure restores the previous deployment and does not lose new data.
- [ ] Cutover timing, downtime, validation queries, and backup locations are documented.

**Verification:** Full rehearsal with an isolated copy and timed rollback.

**Dependencies:** Task 5.1 and Checkpoint C. **Scope:** Large.

#### Task 5.3: Remove the legacy runtime

**Acceptance criteria:**

- [ ] Supabase-specific runtime dependencies and direct browser data access are removed.
- [ ] Legacy Python/Supabase deployment paths are archived or deleted only after cutover verification.
- [ ] Environment examples, Docker files, README, and agent instructions describe only the supported stack.

**Verification:** Clean checkout build, repository search, container smoke test, and backup/restore verification.

**Dependencies:** Task 5.2. **Scope:** Medium.

## Local UAT and completion protocol

The implementation branch must stay usable throughout the migration. Run the frontend with:

```bash
./scripts/start-local.sh
```

This starts or restarts the frontend on port `3001` and avoids duplicate listeners. The replacement Go API will expose its own configured local port and be proxied/configured for the frontend during the relevant phase.

Before UAT, the implementation session must provide:

- [ ] Exact start commands and required environment variables.
- [ ] Test account/fixture instructions without sharing secrets.
- [ ] Known limitations and the UAT checklist.
- [ ] Test, build, lint, typecheck, security, and performance results.

When the user says **`confirmed`**:

1. Mark completed tasks and the plan status as `DONE`.
2. Run the final verification suite and inspect the complete diff.
3. Commit changes in atomic commits with descriptive messages.
4. Push `feature/backend-migration-go`.
5. Merge the branch into `main` only after the final checks pass.

Until `confirmed`, do not commit, push, merge, or delete the branch.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Migration changes authentication behavior | High | Preserve explicit contract tests, use secure session compatibility only where safe, and perform account/session UAT before cutover. |
| Data migration loses relationships or media | High | Idempotent tooling, checksums, row counts, foreign-key checks, backup, and rehearsal. |
| Replacing database-side access rules creates authorization gaps | High | Central authorization service, query-level ownership predicates, denial-by-default tests, and threat-model review. |
| Go rewrite expands scope too quickly | High | Vertical feature slices, parity checkpoints, and no unrelated UI redesign during migration. |
| Performance improves in one path but regresses elsewhere | Medium | Baseline realistic fixtures and require measurements for catalog, replay, media, and admin paths. |
| Background jobs lose visibility | Medium | Structured job state, bounded retries, dead-letter/error records, and operator health metrics. |
| UAT starts with inconsistent local dependencies | Medium | One documented bootstrap path, local PostgreSQL/MinIO, health/readiness checks, and the port-3001 script. |

## Open decisions to resolve during implementation

- Choose the PostgreSQL hosting provider and backup/restore policy.
- Choose PostgreSQL migration tooling (`goose` or `atlas`) after the first schema spike.
- Decide whether Redis is needed after measuring session/rate-limit/job requirements; do not add it by default.
- Decide whether email delivery/password reset is in the first migration slice or a follow-up.
- Decide whether AI/Telegram jobs remain in the same repository and deploy as a separate Go worker.
- Approve the final API contract before frontend module migration begins.
