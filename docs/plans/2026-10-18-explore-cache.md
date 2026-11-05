# Explore catalog and zoom-cluster cache

Performance screenshots, logs, traces and raw measurements remain local under
`docs/performance/`, which is excluded from Git. They are not required by the
application or automated tests. The source, tests, migration and reproduction
commands remain in the repository.

Status: implementation and local verification complete. Durable catalog/hierarchy
integration, authenticated map-view endpoints and prepared frontend renderer are
implemented. Required test/build/typecheck gates, 38 browser regressions and
independent code/security/evidence review pass. Full browser timing and matched
follow-up evidence are retained. User UAT was confirmed on 2026-10-19; release
handoff uses `feature/explore-map-performance-cache`. Production migration and
deployment remain separate operator steps.

## Agreed design

Use durable, versioned cache/snapshot and rebuild-state tables **we manage in
existing Neon PostgreSQL**, plus bounded hot API memory and authorized browser
reuse. Common means shared among authorized logged-in users, not public access.
Combine authorized common/family item membership server-side before clustering;
keep progress separate. Render prepared overview clusters rather than first
creating every item marker. Preserve existing API contracts through additive
map endpoints and a tested compatibility path.

The [backend guide](../../server/AGENTS.md) records the governing requirements.
Official [free Render limits](https://render.com/docs/free) exclude one-off jobs;
[cron](https://render.com/docs/cronjobs#compute-plans-and-billing) and
[workflow](https://render.com/docs/workflows-limits) compute incur charges.
Therefore the free-tier implementation uses a bounded rebuild function in the
existing API, with durable database job ownership/recovery. No paid services,
cloud provisioning, production migrations, commits or deployments are authorized.

## Ordered slices and verification

1. Record a repeatable baseline and define snapshot/job/API contracts. Reuse
   the previous Explore results as the rendering reference; measure real source
   query/build counts separately with a disposable PostgreSQL fixture.
2. Implement versioned durable snapshots/revisions/jobs with atomic activation,
   bounded retention, concurrency ownership and interrupted-build recovery.
   Prove ten concurrent readers share one common load/build per revision and
   a new API process reuses unchanged durable data without reclustering it.
3. Add authenticated bounded map-view APIs over the prepared data. Preserve
   existing item endpoints. Test publication, hidden lessons, family/custom
   shares, child-targeted grants and immediate revocation on warm cache hits.
   Invalidation must cover SQL writes, ingestion and quiz/title changes too.
4. Render prepared clusters/items directly and cache authorized view responses.
   Preserve filters/timeline, expansion, dateline/poles, progress styling,
   preview/touch detail/back and fractional per-child camera restoration.
5. Compare five production-browser repetitions per fixture/viewport, using the
   checked-in catalog and deterministic dense fixture. Record cold/warm medians,
   p95, completed and eventual resource bytes/counts, overview marker creations,
   cache source/build/hit counts and bounded memory. Retain reference budgets
   of ≤2500 ms cold, ≤500 ms warm and ≤33.4 ms gesture frame p95; separate
   Render spin-up and measurement limitations from local synthetic timings.
6. Run all required server/frontend tests, disposable DB integration tests,
   typechecks, Vercel and compatibility builds and a code/security review.
   Real-browser full flows at 1366×768, 1024×768 and 1180×820 must have no
   scrolling/covered controls/errors. Retain meaningful preview no-churn and
   20-cycle resource checks. Record evidence locally and retain exact reproduction commands.

Each slice must remain runnable. Check tests/contracts before progressing;
do not treat approved architecture as already verified implementation.

## Current evidence and limits

- Previous rendering benchmark: [Explore performance review](2026-10-18-explore-performance.md).
- Catalog baseline and first comparison:
  raw measurements and reproduction (local-only `docs/performance/2026-10-18-explore-cache/README.md`).
- Detailed ten-request DB query metrics: DB_METRICS.md (local-only `docs/performance/2026-10-18-explore-cache/DB_METRICS.md`),
  five repetitions with the current 2,982-item catalog. Batch medians are
  148.78→50.53 ms cold, 134.62→1.76 ms hot, 142.86→22.61 ms after restart.
  Source reads fall from ten to one/zero/zero; total small/control query counts
  increase. These are local DB-layer measurements, not deployed API latency.
- Durable browser views must be revalidated against current server access/version
  after reload. Never persist identity/progress or expose a prior session/child's
  private result while authorization is pending.
- Authentication/visibility checks remain on each request, even with a shared
  snapshot. Database query reduction applies to common catalog materialization,
  not an assertion that all ten authenticated requests perform zero SQL.

## Implemented catalog slice

- `explore_revisions` holds database-owned catalog/visibility revisions. Source
  triggers bump revisions in the mutation transaction, including raw SQL,
  ingestion, translation, active-quiz metadata, audience and disabled-lesson edits.
  Private item edits do not bump the common-catalog revision.
- `explore_snapshots` holds complete immutable JSON materializations keyed by
  algorithm, revision, scope and category. `explore_rebuild_jobs` records a
  committed owner/attempt lease before source work starts. No transaction or
  advisory lock is held while computing a snapshot.
- Claims/publication/pruning use short serialized transactions. The store
  admits at most two builds globally, gives them 30-second leases, permits
  three attempts per key and fences every completion/failure by owner+attempt.
  Publication checks the current revision vector under a brief shared lock;
  stale or reclaimed owners cannot activate their data. Failed exhausted keys
  require an operator retry or a new relevant source revision.
- API memory uses a 32-entry/32 MiB logical JSON budget, with an 8 MiB per-value
  limit and 32 in-flight keys. Source builders have a five-second cooperative
  abort deadline; their local admission and durable ownership remain occupied
  until underlying work settles. The timer is cleared before publication, which
  has its own bounded database transaction. Durable retention keeps at most 16 common and 64 scoped
  snapshots, within a combined 64 MiB logical JSON budget, plus bounded failed
  job history. These are logical payload budgets, not measured process heap or
  PostgreSQL physical-disk sizes.
- The existing item-list endpoint now reuses common published-system summaries.
  Indexed scope checks find family/child exceptions. Scoped materializations
  query exact published authorized IDs, merge common records with missing
  authorized records, then retain the original bounded ordering/category/limit
  semantics. Access/revision is checked again after asynchronous work; a changed
  vector retries instead of returning stale data. Cache hits do not skip session
  authentication or profile ownership checks.
- Summary loading retains the original output mapper. Its active-quiz EXISTS
  uses an explicitly qualified outer item ID, avoiding ambiguous/uncorrelated
  identifiers inside Drizzle select expressions.
- Cache/source SQL uses transaction-local statement limits (2 seconds for
  reads, 3 seconds for admission/publication) and connection-lifetime limits
  (3/4 seconds after acquisition). Pool acquisition is bounded at 10 seconds;
  aborted queued reads skip SQL when acquired. The 30-second lease covers
  successful source work (≤5 seconds) plus publication acquisition (≤10 seconds),
  transaction (≤4 seconds), and margin. Timeouts do not modify pooled session
  defaults used by other features.
- Preferred titles are selected in PostgreSQL: English first, otherwise the
  first language, with one bounded result per item. IDs, titles, icon slugs and
  country codes have explicit payload limits; oversized metadata fails closed.
- Busy cross-process readers use jittered 100–250 ms backoff with a hard wait
  deadline. Busy claims run no pruning scans. Publication protects the new
  snapshot during both row/byte retention and verifies it remains durable.

Five repetitions per fixture/phase, ten concurrent repository readers per run:

| Dataset / phase | Median reader ms, before → after | p95 reader ms, before → after | Source materializations per run |
| --- | ---: | ---: | ---: |
| Catalog / empty snapshot cache | 121.35 → 63.79 | 153.06 → 79.79 | 10 → 1 |
| Catalog / hot API memory | 112.72 → 1.07 | 125.83 → 2.05 | 10 → 0 |
| Catalog / fresh API instance | 126.75 → 21.39 | 142.15 → 26.53 | 10 → 0 |
| Dense / empty snapshot cache | 165.04 → 56.04 | 186.03 → 70.76 | 10 → 1 |
| Dense / hot API memory | 153.86 → 1.00 | 174.71 → 1.27 | 10 → 0 |
| Dense / fresh API instance | 163.82 → 18.24 | 186.96 → 19.83 | 10 → 0 |

These are local repository-call timings, excluding HTTP, authentication, network
throttling, browser rendering and Render spin-up. They prove common source-work
reuse, not deployed end-to-end latency. Cold source item rows fall from 29,820
to 2,982 (catalog) and 40,000 to 4,000 (dense); hot/restarted instances materialize
zero source item rows. Small revision/visibility SQL queries still run.

Initial verification: 350 server tests passed with real disposable
PostgreSQL integration, plus server typecheck/build. Dedicated cache coverage
includes ten-reader coalescing across two API-cache instances, durable restart,
expired/stale-owner fencing, admission/retry limits, transactional raw-SQL
invalidation, private/draft publication, family/child sharing, immediate warm
visibility changes and session revocation. The standard test script now places
`--test-concurrency=1` before file paths: database suites share/reset their
disposable schema and must run serially, matching `test:local`.

Resource-hardening verification: 357 server tests pass with real disposable
PostgreSQL and no skips; server typecheck/build pass. New regressions prove
underlying SQL cancellation, queued-read aborts, bounded preferred metadata,
deadline-edge polling, just-published retention, and connection-contention
ownership. Independent code/security review found no remaining material issue
in the catalog/resource fixes. The hierarchy increment is reviewed separately.

Resource-hardening comparison (`catalog-bounded.json`, five isolated repetitions
per phase/fixture) retains one common source load on build and zero on hot or
restart. Median/p95 repository-reader milliseconds are 52.58/57.30 build,
1.49/2.03 hot, 22.40/27.98 restart for catalog; 61.85/67.26 build, 1.65/2.03 hot,
17.02/22.31 restart for dense. It records source hashes and Node version. Its
query counter now observes the pg client, including transaction-bound queries;
total query invocation counts are not directly comparable with the first
Pool-only counter. No deployed/browser timing claim is made.

Primary concurrency references:
[PostgreSQL row/advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html),
[transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html),
[trigger functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html).

Query lifetime references:
[node-postgres transactions](https://node-postgres.com/features/transactions),
[PostgreSQL transaction-local statement limits](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-STATEMENT-TIMEOUT).

## Prepared hierarchy and map-view contract

Build a deterministic hierarchy from the complete authorized, merged item
membership, after applying normalized category/year filters. Match the map's
Web Mercator projection and 60-pixel clustering radius at integer zoom bands
2–18; fractional zoom requests use the lower band. Preserve every member once
per band, weighted centroids, geographic bounds, and expansion to the next split.
Wrap neighbor distances and cluster bounds across the dateline; clamp projection
at Mercator's latitude limit while retaining geographic source bounds.

Persist one hierarchy per catalog/visibility scope and normalized filter set,
not a materialization for every arbitrary pan rectangle. Store leaf summaries
once, cluster child references once, and per-band integer node references.
Nodes refer only to earlier nodes so the stored structure is acyclic. There are
at most 5,000 leaves, fewer clusters than leaves, and 17 bounded level arrays.
Prepared common and scoped hierarchies use the same fenced snapshot machinery.
Acquire the catalog before claiming a hierarchy build, avoiding nested admission.

Add authenticated `GET /api/v1/items/map/views` before the existing item-id
route. Inputs include server-checked `profile_id`, sorted category selection,
optional integer year, zoom and finite viewport bounds. Responses contain the
current opaque view version, total membership, only the bounded visible
cluster/item features, and authorized timeline metadata. Keep existing item
routes unchanged and private responses `no-store`. Cache the hierarchy, then
select bounded views from it; zoom/bounds/cursor are part of browser view keys.

Cluster features include snapshot-local integer node ID, count, centroid,
bounds and expansion zoom. Expansion/leaf requests must rederive the current
authorized hierarchy from the same normalized filters and compare its opaque
version before resolving a node ID. Never load an arbitrary client-supplied
snapshot or treat a node ID as authorization. Use bounded, explicit leaf/view
pagination for unusually dense/coincident groups; never silently truncate
membership. Progress remains a separate child-scoped projection.

`GET /api/v1/items/map/clusters/:node/leaves` resolves bounded pages only after
current authorized membership and hierarchy-version checks. Map responses have
a separate view validator covering hierarchy version, zoom, bounds, offset and
limit. A matching hierarchy alone cannot validate a different viewport/page.
Year filters are restricted to currently authorized timeline choices; arbitrary
integers cannot generate unbounded durable variants. The catalog cap is checked
with an extra source row and fails explicitly above 5,000; no silent truncation.

The hierarchy, HTTP adapter, durable integration and frontend consumption now
exist. The full server suite passes 374 tests with disposable PostgreSQL and no
skips, plus typecheck/build. Real HTTP tests compare complete map leaves with
catalog visibility through publication, family/child grants and revocation.

The frontend requests padded viewport views on completed camera changes and
renders prepared features directly. Coincident clusters have 12-leaf pages with
Previous/Next/Close controls. IndexedDB retains only revalidated common views,
bounded to 16 entries/2 MiB UTF-8 JSON; private views and child progress remain
outside persistent storage. Every reuse waits for current server authorization.
Child selection and fractional camera state are memory-only and scoped to the
current family/session/child. Fresh page loads require selecting a child again.

The first production-built fixture browser checks pass preview/detail/back,
touch/pinch/wheel, filters/timeline, geometry/dateline/poles, fractional camera
isolation, controls without scrolling at all three target viewports, and 20
dense filter/pan/zoom cycles with stable resources. These use HTTP-boundary
fixtures; real authentication/database security is tested separately. Routine
checks use isolated headless agent-browser. Full five-run performance evidence,
The expanded suites and final independent review are recorded below.

Follow-up checkpoint (2026-10-19): ten browser regressions passed, including
preview marker stability and delayed private-response isolation/IndexedDB
exclusion. Review then found adjacent-world preview coordinates, spider cleanup,
and fresh deep-link/profile lifecycle issues. Fixes and focused browser cases
are now written, but the expanded suite and complete gates must run again.
Session clearing/family replacement now clears the selected child synchronously;
same-family session refresh preserves it. A child returned by a successful
creation is installed in the server-owned query projection before selection,
preventing a stale list from clearing it during reconciliation. Profile picking
no longer prefetches the unused full catalog. The shared item-list route also
uses the normalized profile ID for both authorization and catalog projection.

The runtime restarted during an earlier temporary performance run, which is
discarded. A fresh isolated catalog-renderer reference is built by
`frontend/tests/browser/build-explore-cache-baseline.mjs`: it copies the current
source and restores only WorldMap/MapPage to main's uncached renderer, retaining
the earlier SVG improvements. Its source hashes and exact build are recorded
in `reference-build.log`. New before/after evidence is saved under this plan's
performance folder. Measurements remain incomplete until all thirty samples
per build, expanded browser checks and the compatibility report are complete.

Final gate checkpoint: 440 frontend tests, 376 server tests (disposable real
PostgreSQL, zero skips), and 38 browser regressions pass. Frontend application
and hosting typechecks, server typecheck/build, and Vercel/compatibility builds
pass. Independent follow-up review reports no remaining concrete blocker.
The browser regressions include all new follow-up cases, completion tracking,
and viewport flows. Their retained logs and review scope are in
`VERIFICATION.md` (local-only `docs/performance/2026-10-18-explore-cache/VERIFICATION.md`).
The reference and candidate each have 30 complete timing samples. Cold/warm
loading and frame budgets pass; the three small relative presentation-latency
flags were not reproduced in matched five-repeat controls on the final candidate.
All six control cells pass the unchanged 10% rule. Original flags and samples
remain retained, and this is not a statistical equivalence claim.
The full server gate now includes two actual Node processes sharing ten readers
and one common source load, plus a third fresh process serving ten readers with
zero source loads. Browser regressions also cover long-title previews at both
canonical dateline edges with normal camera bounds at all three viewport sizes.

Final browser evidence (local-only `docs/performance/2026-10-18-explore-cache/BROWSER_PERFORMANCE.md`)
and acceptance audit (local-only `docs/performance/2026-10-18-explore-cache/VERIFICATION.md`)
record exact build checkpoints, all latency/byte/request/marker metrics,
reproduction and measurement limits. The full candidate predates the last popup
edge adjustment; matched controls and the final 38-browser-test suite include
it. No cloud changes, production migrations or release actions were performed.

User UAT confirmation authorizes the feature-branch commit/push handoff. The
final 376-test server gate adds canonical SQL/ledger identity coverage for the
[Neon paste script](../migrations/neon-0025-explore-snapshots.sql), separately
validated on a newly created disposable local database. Production SQL execution
and deployment have not been performed. The navigation follow-up and its
phone/landscape verification are retained in the performance evidence folder.

The PR was subsequently integrated with main `9d4bdd2`. Its Vietnamese catalog
preserves all 2,070 unique entries from both branches. Integration gates pass:
451 frontend tests, 398 server tests with disposable PostgreSQL, four locale
browser checks, required typechecks and both frontend build modes. Generated
evidence stays local and ignored across features; the Neon migration is unchanged.

Pure hierarchy checkpoint: `server/src/explore/clusters.ts` and its regression
tests implement the geometry, bounded node graph and leaf pagination. Work
yields to the event loop every 256 units, including large candidate buckets,
and checks cancellation after yielding. A scheduled-abort regression proves
cancellation after work begins; an already-aborted signal alone is insufficient.
Both exact dateline longitudes use -180 in features and spiderfy leaves. Five
repetitions with the real fixtures verify exact member identity at every zoom:
2,982 catalog items produce 50 overview features, 4,086 total stored nodes and
1,184,551 serialized bytes; 4,000 dense items produce one overview feature,
6,455 stored nodes and 1,858,475 serialized bytes. Median source-only build
times are 76.57 ms and 93.87 ms respectively, including cooperative scheduling.
A coarse 1-ms heartbeat during builds reports maximum gaps of 8.91/10.45 ms
respectively (including first-run startup); it is not a browser-frame measure.
These numbers exclude SQL, HTTP, browser and validation/serialization work. Retained evidence and reproduction:
`hierarchy.json` (local-only `docs/performance/2026-10-18-explore-cache/hierarchy.json`) and
`npm run bench:explore-clusters --prefix server`.

The hierarchy increment's seven focused tests and the complete 364-test server
suite pass with local disposable PostgreSQL, no skips; server typecheck/build
pass. Independent review is clean after cooperative cancellation, nested-page,
radius/seam and structural-order regressions. Routine API/browser loading
self-tests will use the user's installed `agent-browser`, isolated named
headless Chrome sessions; required automated regression suites still run.
No new browser or deployed latency claim applies to this pure-builder slice.
