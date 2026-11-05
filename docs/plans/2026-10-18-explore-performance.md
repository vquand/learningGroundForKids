# Explore performance review and improvement

Performance screenshots, logs, traces and raw measurements remain local under
`docs/performance/`, which is excluded from Git. They are not required by the
application or automated tests. The source, tests, migration and reproduction
commands remain in the repository.

Status: complete. All measurable acceptance checks pass, with the explicitly
documented wheel-presentation measurement exception. Work stays uncommitted on
`main` at the user's request.

## Scope and acceptance

Improve measured loading, panning and zooming bottlenecks without changing the
illustrated map, catalog/API contracts, filters, navigation, camera restoration,
server-owned progress or achievements. Follow the Map implementation guide.

Reference conditions: production-built Explore route harness, Chromium, scale 1,
4x CPU slowdown, 10 Mbps downstream, 100 ms network latency, fixed local API
fixtures. Run both the published checked-in catalog and a deterministic dense
fixture, at 1366×768, 1024×768 and 1180×820. Collect five repetitions, raw samples,
medians and p95; retain browser/machine/commit metadata and traces. Distinguish
cold contexts from cached item-detail returns. These are synthetic measurements,
not measurements on physical iPads or deployed Vercel/Render infrastructure.

| Metric | Target |
| --- | --- |
| Median cold usable map | ≤2500 ms |
| Median warm detail return | ≤500 ms |
| p95 gesture frame interval | ≤33.4 ms |
| p95 input to next paint | ≤100 ms |
| Longest interaction task | ≤200 ms |

Initially failing metrics must improve by at least 25% and meet their target.
Initially passing metrics must remain in budget with at most 10% regression.
Record resource counts and transferred bytes. Do not include idle or setup
frames in gesture statistics. Explain measurement limits instead of substituting
unrelated timings for input-to-paint or presenting main-thread timings as GPU FPS.

## Ordered work

1. Build a repeatable production benchmark and record the unchanged baseline.
   Verify readiness includes artwork, visible markers, and controls; assert that
   input moves/zooms the map. Trace the overview and dense views.
2. Address the measured rendering bottleneck in a small slice. Add a regression
   check that fails before the fix, rerun it after the fix, then compare the same
   benchmark workloads. Keep coastlines, biome detail and non-scaling linework.
3. Address measured loading/marker bottlenecks, if necessary. Validate cached
   navigation, filters and profile changes. After 20 pan/zoom/filter cycles,
   check marker IDs/counts, map listeners, DOM nodes and retained resources.
4. Verify full Explore flows and bounds of current controls at all three sizes,
   including touch/pinch, wheel/buttons, clusters, previews, detail/back, progress
   and child changes. Confirm no page scrolling or browser errors.
5. Run frontend tests, hosting typecheck, Vercel build, compatibility build and
   focused browser tests. Record a before/after report with reproduction commands
   and remaining limitations; review changes before handing over for UAT.

No commit, push, merge, publication, provisioning or production data operations.
No new achievements or provider/browser/database connections are in scope.

## Findings and implementation

The original production build is retained at
`/tmp/plg-explore-baseline/build`, from main at
`5a259465d815c0946f43fe713a0840fd5571cb09`. Initial traces showed close-up wheel
frame p95 around 183 ms and interaction tasks up to 513 ms. Controlled browser
ablations isolated the expensive work: hiding biome dashed borders removed the
deep-zoom stalls; hiding hatching or country/coastline strokes did not. Merely
reducing the outer SVG dimensions did not remove the stalls. SVG was expanding
tiny non-scaling dashes along complete world-sized biome outlines, including
offscreen portions.

The implementation clips only biome border segments to a buffered visible
envelope before SVG dash expansion. It retains full fills, land clipping,
country boundaries, coastline strokes and authored world coordinates. Border
fragments retain the original screen-space dash phase. Border-only group opacity
avoids darkening the overlapping round caps at a closed path's seam. Two
duplicate world trees that were permanently clipped away are removed; seam
copies needed inside individual land/country geometry remain.

A later pinch-out trace exposed a second native rendering cost in complete
country/coastline strokes when the SVG surface was reframed. Hiding those
strokes removed the stall; hiding hatching or biome borders did not. Solid
outlines now use the same buffered clipping principle, retaining complete
authored fills and clipping stroke centerlines without creating viewport-edge
closures. Compound rings and holes stay separate, visible closed rings retain
their original strings, and fragments join across a closed ring's start to
preserve solid-line joins. A 32 px stroke margin keeps cut endpoints outside
the visible region. Country fill/stroke order is unchanged: computed styles
in both production artifacts confirm normal SVG fill-then-stroke order in the
custom map pane. The overlay-pane-scoped stroke-first CSS does not apply there.

At close zoom, the outer SVG stays within the viewport plus 256 px on each side,
intersected with the canonical world bounds. Small overview worlds up to 2,048 px
retain a stable full-world viewBox: repeatedly cropping/reframing those surfaces
introduced an overview button-paint regression. Keeping their authored viewBox
lets the browser reuse the small surface. Fully visible countries retain the
original combined fill/stroke path, and biome fragments use a shared opacity
group only when several fragments overlap. No blank off-world pixels are added.
The close-up viewBox
and geographic bounds change together before paint. During pinch/fly/CSS zoom,
the overlay transforms its existing surface instead of resizing the SVG every
frame. Overflow and an independent canonical-world clip retain fill coverage;
the outline envelope expands when motion reveals more geography. The surface
is reframed at movement end. Already-covered outline bounds retain their state
identity rather than rerendering the atlas on every movement event. During
animated scaling, dash phase uses the last
settled zoom and is corrected at the end; at-rest and pan phase are preserved.
This can move an individual dash by less than its 6 px repeat during a zoom.

Additional interaction work: popup auto-pan
waits for the selected-item flight and any world-bounds correction to settle,
and uses normal one-shot popup semantics rather than Leaflet's recursive
`keepInView`/pan-stop path. Marker hover scaling and its transition now affect
icon content, leaving Leaflet's geographic position transform untouched.

Loading checks also identified controls' entrance animations as a readiness
cost. Both Explore control entrances now take 80 ms, with the timeline's
additional 100 ms delay removed. Controls reach their usable position earlier;
the layout, artwork and API/query caching contracts remain the same.

## Measurement protocol

`bench:explore` builds the real Map and Item Detail pages in a small production
route harness, with deterministic HTTP API fixtures (2,982 published catalog
items and 4,000 dense items). Identity and progress are test fixtures only;
no real accounts, provider calls, database writes or production APIs are used.
The normal app entry and deployment are unchanged.

Protocol 2 measures five fresh-context repetitions for each dataset/viewport.
Cold readiness requires artwork, visible decoded markers, and rendered,
uncovered controls inside the viewport. Warm readiness follows the real detail
Back button and asserts that a fresh catalog query is reused. Results retain
resource transfer sizes, request counts, tasks, frame interval timestamps,
individual presentation-linked input samples, browser/machine/profile metadata
and a hash of the production build. First-run traces and CPU profiles are saved
for each group. Reused builds are recorded separately from the measurement
checkout's dirty status.

Each repetition runs mouse drag, wheel, buttons, touch pan, pinch in and pinch
out at overview and close-up levels. Pan inputs travel 480 px, crossing the
render buffer. Wheel/button windows end after actual zoom completion plus two
animation frames; idle gaps are excluded and frame history resets between
windows. Pinch-out starts at zoom 3 for the overview so the minimum zoom does
not prevent the gesture. Every input must actually move or zoom the map.

The first baseline run used fixed gaps between zoom inputs. Its data remains
available for diagnosis at `/tmp/plg-explore-baseline`, but final acceptance uses
the repeated unchanged build under protocol 2 at `/tmp/plg-explore-baseline-v2`.
The report rejects missing scenarios, fewer than five repetitions in either
version, incompatible environments, and over-budget or regressed measurements.

Main-thread rAF intervals are scheduling evidence, not GPU FPS. Double-rAF input
timings are retained as a diagnostic proxy and never substituted for actual
presentation latency. Chromium's presentation-linked EventLatency is used where
available, filtered to the input kind being measured (dragged mouse, released
zoom-button click, wheel, or moved/released touch). Hover events do not stand in
for a wheel or button response. The report requires presentation samples in
each repetition and shows their run coverage. Debounced JavaScript wheel zoom
may have no presentation-linked
input frame; the report marks it unavailable and only the explicit
`--allow-missing-presentation` option can waive that wheel-only measurement.
Physical iPad performance and deployed API latency require separate UAT.

## Reproduction

From the repository root, using an installed Playwright Chromium executable:

```bash
export PLG_CHROMIUM_EXECUTABLE=$PLAYWRIGHT_BROWSERS_PATH/chromium-1243/chrome-linux64/chrome
npm run bench:explore --prefix frontend -- --out /tmp/plg-explore-candidate-final --trace --profile
node frontend/tests/browser/explore-performance-report.mjs /tmp/plg-explore-candidate-final/results.json /tmp/plg-explore-baseline-v2/results.json --check --allow-missing-presentation
node --test --test-concurrency=1 frontend/tests/browser/explore-rendering.test.mjs frontend/tests/browser/map-performance.test.ts frontend/tests/browser/explore-navigation.test.ts frontend/tests/browser/map-cluster-scaling.test.ts
```

The candidate command builds from current source. To repeat measurements against
the retained unchanged production artifact:

```bash
npm run bench:explore --prefix frontend -- --out /tmp/plg-explore-baseline-repeat --build-dir /tmp/plg-explore-baseline/build --trace --profile
```

To reconstruct the reference source without changing this working tree, create
a detached worktree at the recorded SHA, copy the benchmark tooling only, and
reuse the installed dependencies:

```bash
git worktree add --detach /tmp/plg-explore-reference 5a259465d815c0946f43fe713a0840fd5571cb09
mkdir -p /tmp/plg-explore-reference/frontend/tests/browser
cp frontend/tests/browser/explore-performance* /tmp/plg-explore-reference/frontend/tests/browser/
ln -s "$PWD/frontend/node_modules" /tmp/plg-explore-reference/frontend/node_modules
node /tmp/plg-explore-reference/frontend/tests/browser/explore-performance.mjs --out /tmp/plg-explore-baseline-rebuilt --trace --profile
```

Use a fresh output directory per comparison. Run timed jobs alone; do not run
builds, other browser suites or heavy workloads alongside them. `--runs`,
`--widths`, `--fixtures`, `--levels` and `--inputs` allow diagnostic subsets, but
the acceptance report requires the complete matrix. The browser regression
stores screenshots and the 20-cycle resource snapshots under
`/tmp/plg-explore-regression`.

## Measured results

Five runs per row, before → after, under the same production-build reference
profile. Loading numbers are medians; gesture frame numbers are pooled p95
over active input/animation windows. Tasks are the longest observed interaction
long task across the row's repetitions and gestures; 0 means no ≥50 ms Long
Tasks API entry. All values are milliseconds.

| Dataset / viewport | Cold ready | Warm return | Close-up wheel frame p95 | Close-up button frame p95 | Longest task |
| --- | ---: | ---: | ---: | ---: | ---: |
| Catalog / 1366×768 | 1517 → 1324 | 488 → 273 | 150 → 16.7 | 166.6 → 16.7 | 414 → 0 |
| Dense / 1366×768 | 1476 → 1292 | 515 → 308 | 199.9 → 33.4 | 200 → 16.8 | 412 → 79 |
| Catalog / 1024×768 | 1507 → 1304 | 478 → 274 | 183.4 → 16.8 | 116.6 → 16.8 | 493 → 52 |
| Dense / 1024×768 | 1467 → 1286 | 486 → 306 | 199.9 → 33.4 | 183.3 → 16.7 | 333 → 71 |
| Catalog / 1180×820 | 1511 → 1316 | 482 → 278 | 133.3 → 16.8 | 116.7 → 16.8 | 496 → 0 |
| Dense / 1180×820 | 1474 → 1298 | 500 → 306 | 166.7 → 33.4 | 216.6 → 16.8 | 438 → 78 |

Cold medians improve by 12–13%; warm medians improve by 37–44%. The initially
failing dense/1366 warm return improves by 40%, exceeding the required 25%.
Every gesture group meets the 33.4 ms frame budget and 200 ms task budget,
including the relative improvement/regression checks. Among presentation-linked
non-wheel scenarios, the largest group p95 falls from 427 ms to 82 ms; every
such scenario meets the 100 ms budget and its relative comparison.

The comparison command with `--check --allow-missing-presentation` exits 0.
Without that explicit exception it exits 1 with exactly 12 unavailable wheel
presentation metrics: overview and close-up in each of the six groups. There
are no other unmet checks. Wheel frame intervals and tasks are measured and
pass; wheel input-to-presentation latency is not claimed. The raw archives and
summaries retain per-run distributions and presentation coverage, rather than
only these rounded aggregate values.

Transfer caveat: these resource snapshots contain entries **completed at map
readiness**, not eventual total page transfer. Catalog snapshots record
1,142,256 → 357,546 bytes, and dense snapshots 1,132,647 → 347,937 bytes;
completed entries are 16 → 15. The unchanged global country-ball sprite is
still in flight when the faster candidate becomes ready. The trace confirms
that request still completes successfully. Its 786,906-byte resource entry
explains the apparent reduction; there is no network-saving claim. The
candidate's completed script/style entries add about 2.2 KB instead.

Retained raw evidence, summaries, resource snapshots and screenshots (local-only `docs/performance/2026-10-18-explore/README.md`)
include all 60 runs. Large traces and profiles remain at the local paths above.
Reference build SHA-256:
`7815c3da4283782e0e39e15362a859d2491b035415f218adc0b44668bbce6b1b`.
Candidate build SHA-256:
`f5865a207e960e418e4df1acbfaa96039a52b98e1f4df55612147e1efd62cbcc`.

## Regression validation

- 432 frontend tests pass, including dashed/solid border clipping and phase, viewport projection,
  and rejection cases for the benchmark acceptance report.
- 20 real-browser tests pass across the rendering, navigation, cluster and
  marker-performance suites. They exercise the three required viewport sizes,
  long pan and animated zoom coverage, wheel anchoring, category/timeline
  filters, real cluster clicks, mouse preview/touch detail/back, confirmed
  progress styling, fractional child camera restoration and cached warm return.
- The 20-cycle dense test retains the exact 4,000 unique item IDs, stable map
  layer/listener counts, and bounded DOM/listener counts after garbage collection.
  Before/after snapshots both contain 472 DOM nodes, 497 JavaScript listeners,
  five map layers and 35 map handlers; no growth was observed in this run.
- App and hosting typechecks and both Vercel/compatibility builds pass.

The existing artwork-build test uses hard links, so this machine needs its
temporary test directory on the same filesystem as the checkout. The passing
unit command was `TMPDIR=<checkout>/frontend/.tmp-explore-tests npm test --prefix
frontend`, run outside the sandbox because it also needs Node child processes.
Those temporary directories' remaining compiler caches were moved to
`/tmp/plg-explore-unit-tmp*`; no test or production data was changed to bypass a
check. Build chunk-size warnings remain in the existing optional Journey/UAT
bundles; both build commands exit successfully.

Implementation references: [Leaflet SVGOverlay and map projection APIs](https://leafletjs.com/reference.html#svgoverlay),
[SVG viewBox](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox).
Benchmark references: [Playwright CDP sessions](https://playwright.dev/docs/api/class-cdpsession),
[Chromium input/rendering latency](https://www.chromium.org/developers/how-tos/trace-event-profiling-tool/anatomy-of-jank/),
[Long Tasks API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming).
Keep scheduling proxies separate from Chromium presentation-linked EventLatency
samples, especially for wheel zoom scheduled after a debounce timer.
