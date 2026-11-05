# Exploration map performance

## Scope

The user reports slow loading and lag on iPad 9/10 and authorized improvements
for local UAT. Continue on `review/recent-code-health-2026-10-13`; preserve prior
refactors, Parent Space and badge work. No deployments or data changes. The user
confirmed UAT and authorized branch commits/push on 2026-10-13.

This pass removes the full-world SVG coastline noise/displacement filter and
avoids recreating marker icons/positions when a preview or input mode changes.
Keep geography, biome colors, atlas wrapping, child touch targets, clustering,
category/year filters, saved progress and item navigation. Cache render inputs
only with dependencies that update correctly when data/progress changes.

## Validation

- Use a standalone actual WorldMap browser harness with a bounded large fixture
  catalog. Measure Leaflet marker icon/position updates during preview open/close
  before and after implementation; do not invent actual-iPad timings.
- Verify progress changes still update the affected marker, category/year filters
  still apply, and mouse/touch/cluster navigation still work.
- Check laptop and iPad landscape viewports and no new horizontal overflow.
- Run frontend tests, application/hosting typechecks, both builds and diff check.
- Keep the real local frontend/API/database on port 5173 available for UAT.

The first profiling attempt under CPU throttling did not produce usable timing
data. A physical iPad/Safari check remains necessary to assess perceived loading,
pan/pinch smoothness and any remaining rendering cost. A raster tile renderer is
a possible follow-up if this smaller change is insufficient.

## Implementation and evidence

Removed the decorative coastline SVG filter while retaining land geometry,
colors, biome layers and wrap copies. Memoized marker icons/positions and stable
map render inputs; the map artwork no longer rerenders just to open a preview.
Changed the map profile/avatar button to return to `/playground` with the child
still selected. Removed the Kitchen shortcut from the map; Kitchen remains in
the Playground activity list.

A pre-change Chromium run with 501 fixture items recorded 1,002 item-marker icon
replacements when opening and closing one mouse preview. The same interaction
after the change caused zero icon replacements and zero marker repositioning
at 1366×768, 1024×768 and 1180×820. Additional browser checks passed for saved
progress borders, category/year filtering, touch detail navigation and absence
of SVG turbulence/filter nodes. These counts measure unnecessary work, not
actual iPad frame rate or loading time.

Frontend tests (69 files), application/hosting typechecks, Vercel and compatibility
builds passed. Luna performed test writing, baseline/final execution and read-only
verification. Automated checks do not establish physical iPad frame rates. The
user confirmed UAT and authorized committing/pushing the review branch.

The existing browser cluster regression also passed after updating its entry
flow to select a child, enter Explore from the Playground, and wait for the
lazy map to mount. It verifies successive cluster splitting, the absent Kitchen
map button, profile return to `/playground`, retained child selection and Kitchen
access from the Playground. Six browser cases passed in total. Local frontend
port 5173 and API/database readiness remained HTTP 200 after testing.
