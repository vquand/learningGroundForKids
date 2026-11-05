# Garden API availability and iPad kitchen artwork fixes

## Defects

A valid dense town can spend seconds inside synchronous `tickGarden`, blocking
the API event loop throughout navigation and 100–300 fixed simulation steps.
The review reproduced 3.3–3.9-second stalls. The regression fixture builds 40
Collie houses, 30 sheep farmhouses and one garden through normal validators.
Before this fix, its heartbeat completed before an unrelated scheduled callback.

The compact kitchen layout reduced artwork header height without shrinking its
grid track's intrinsic minimum. Steak and soup images escaped the header and
covered recipe copy on iPad landscape. The artwork containment test failed at
1180×720 before the CSS change.

## Implementation

- A lazy single Node worker executes the existing pure `tickGarden` unchanged,
  including navigation reconstruction. This uses the official
  [Node worker thread API](https://nodejs.org/api/worker_threads.html), appropriate
  for CPU-intensive work; it does not move storage, identity or rewards into the
  browser or add an external service/dependency.
- Eight jobs maximum, including the running job; ten-second total queue/run
  deadline; 128 MB old-generation worker heap. A busy/failed/timed-out job returns
  a controlled 503, never partial progress or a synchronous fallback. Workers
  are reused, idle workers are unreferenced, and failed workers can restart.
- Overlapping tabs/retries for one profile share its in-flight heartbeat.
  Same-profile edits, harvest and pause checkpoints remain serialized. Work
  captures server time before enqueueing. Live calendar, fixed steps, resume,
  ≤15-second intervals and no offline catch-up retain their original rules.
- Worker simulation holds no database lock/connection. Re-read durable state
  before publishing its result; reject a changed revision so another process or
  verified source-game reward cannot be overwritten by stale output.
- Source development loads the TS worker with the existing tsx loader, without
  inheriting database/bootstrap/watch preloads. Builds load the emitted JS worker.
- The compact kitchen artwork grid now has explicit minmax(0, 1fr) tracks,
  shrinkable images and containment. Emoji line height fits the same header.
  Illustration proportions and card actions stay unchanged.

## Verification

- The independently authored availability regression failed against the original
  synchronous repository and passes with the worker. It verifies an unrelated
  family's authenticated Hono session route completes while a dense heartbeat
  is still pending, and full active time/plant growth still completes.
- Worker results exactly match direct simulation for contacts/boosts/bites,
  resume, duplicates, stale gaps, unknown clocks and season changes. Tests cover
  bounded admission, queue/run deadlines, simulation errors, worker exits,
  shutdown, recovery, coalescing and obsolete revision rejection.
- Guarded local PostgreSQL suite: 301 passed, zero skipped. A held simulation
  permits FOR UPDATE NOWAIT; racing harvests plus a pause checkpoint award
  exactly eight stamina once and never persist animal positions.
- Full frontend unit suite passed. Thirty browser flows passed: five kitchen
  artwork sizes (1024×768, 1180×720, 1180×820, 1300×750, 1366×768), complete pig
  roasting/sauce/serving/failure/replay, Town construction/roads, gardens and
  continuous/reduced-motion animal rendering. No required scrolling or console
  errors. Inspected `/tmp/kitchen-artwork-1180-720.png`.
- In-memory worker smoke passed inside the existing Node v22.23.3 API container.
  Compiled worker tests run without tsx, as production does.
- Local 100-resident fixture measurement: synchronous work 121.54 ms and an
  unrelated 10 ms timer delayed to 121.59 ms; worker work 117.41 ms and unrelated
  timer 10.33 ms. These are local measurements, not hardware-specific CI limits.

No SQL migration, new achievement definition, production data operation or cloud
resource change is needed. Changes remain on `fix/town-garden-worker` for UAT.

## Portrait Town follow-up

The user requested the map on top with a horizontal palette below in portrait
orientation. The portrait media rule stacks the map and palette, lays all five
categories across the tablet width with uniform 44–54 px blueprint buttons,
and uses compact construction details and a keepsake grid below. Artwork keeps
its existing aspect ratio. The landscape layout remains beside the map.

The portrait regression covers four iPad sizes in English and Vietnamese,
manual garden harvest/crop selection, every blueprint's shortage/lock guidance,
keepsakes, appearance controls and rotation back to landscape. It checks actual
control bounds/hit targets, no document scrolling and horizontal category order.

## Local gardening endpoint reload

The running local API served an older route table while the bind-mounted
frontend called `/town/garden/tick` and `/town/garden/checkpoint`, resulting in
404 responses. The API was rebuilt independently, retaining the existing local
database and frontend. Its Docker development command now uses explicit tsx
watching of all TypeScript source files. A temporary route-file edit and its
restoration both produced watcher restart messages.

Development readiness includes `x-plg-dev-gardening: ready` when both repository
methods are present. The existing health JSON and test/production responses
remain unchanged. Startup requires this capability through the frontend proxy
and directly; an outdated running API is rebuilt without restarting the
database. Two isolated startup regressions cover stale refresh and healthy
reuse. The real startup command reused the healthy stack on port 5173.

Final frontend suite: 77 files passed. Town browser suite: 35 flows passed,
including eight portrait scenarios. Frontend/server type checks and builds
passed. Existing authenticated route tests exercise both garden endpoints;
no user credentials were accessed for diagnostics.
