# Town iPad interface

## Accepted behavior

- Use three separate neighboring sections in this order: home-city time/season/
  weather, material bar, then Build. Build and weather sit outside the material bar.
- Reserve the same right panel in landscape while browsing, selecting,
  deselecting and editing. Keep the canvas bounds and renderer stable.
- When nothing is selected, show the current map’s building/plant-plot counts
  and road/bridge lengths in tiles. Count every relevant catalog kind, include
  empty and planted floating gardens, and exclude scenery, fences and previews.
  Keep the explanatory counting logic out of the labels.
- Put idle instructions at the bottom of the right panel. Display building
  information in a separate section beneath its shared summary card; remove the
  inspector button and popup.
- Place the map buttons at the bottom-left of the visible canvas over the ambient
  forest, including letterboxed views. Keep construction nudges on the right and
  selected-building actions clear of all map buttons. Arrange the nudges as a
  directional pad (up, left/right, down), with a translucent circle behind the
  48px buttons and space for the river exit. Empty pad space passes pointer input
  through to the map.
- Replace the weather text with the existing chubby calendar illustrations.
  Tapping opens an accessible dialog with the condition, saved city, Celsius
  temperature, freshness and MET Norway/CC BY 4.0 credit. Missing temperature is
  unavailable; previews do not invent a temperature.
- Town and Lake share this implementation. Portrait building summaries and extra
  details use adjacent columns where tablet width allows them to fit.

## Landscape space budget follow-up

- Keep the navbar, status bar and their gap within 18% of viewport height at
  heights of 600px or more, capped at 128px. Preserve 48px navigation targets.
- Remove the map's inner inset, reduce the map/panel bottom inset to 6px (or
  the device safe area), and use a narrower responsive sidebar. Keep square
  map tiles and the map's proportions.
- Scale blueprint tiles with viewport height, retaining 44px touch targets.
  Reserve at least 1.3 rows above details and derive page capacity from the
  actual rendered tile size.
- Show one idle hint. Remove the empty detail-card introduction and duplicate
  fish-unlock progress text; keep building descriptions, costs and requirements.
- Hide the arrow pad and coordinates until a blueprint is chosen or a building
  is being moved. Remove Items Learned from the shared material bar.

## Weather data

The existing cached forecast supplies the optional `temperatureC` field. Validate
the provider's unit and bounded temperature and select the current hourly point.
No additional provider request, credentials, migration or progression change is
needed. Older responses without the field remain compatible.

[MET's Locationforecast data model](https://docs.api.met.no/doc/locationforecast/datamodel.html)
defines `instant.details.air_temperature` in Celsius. “Hourly forecast” describes
forecast intervals; global model updates are not promised every hour.

## Verification

Keep screenshots and logs under `/tmp`. Cover English/Vietnamese at 1366×768,
1024×768 and 1180×820, plus portrait compatibility. The focused regression is
`frontend/tests/browser/town-ipad-layout.agent-browser.mjs`; the shared map-shell
and building-panel suites cover navigation, construction, harvesting and portrait
details. Run all frontend/backend baseline gates and review the common host,
workspace, scene and weather paths for duplicated map-specific behavior.

Validated locally: 812 frontend tests; 753 backend tests passed with 68
database-dependent tests skipped; frontend application/hosting and backend
typechecks; Vercel, compatibility and backend builds. The agent-browser matrix
passed in both languages at all three landscape sizes, including exact panel/
canvas stability, map-specific summary totals, popup accessibility and current
control bounds. The shared map-shell flow passed construction, harvesting,
navigation, choosers, weather and reduced motion. Both maps reuse the same host,
workspace, summary, scene/toolbar placement and forecast UI; no duplicate map
implementations were added.

Changes remain on the feature branch for UAT; no commit, push, merge or deployment
until the repository's required confirmation.

Landscape follow-up validation: all 812 frontend tests, application/hosting
typechecks and both builds passed. The agent-browser layout matrix passed in
English/Vietnamese at all three required landscape sizes, with additional
1024×600, 1920×1080 and 820×1180 checks. Missing-material links and locked-house
guidance remain usable beside the blueprint grid. The shared Town/Lake suite
passed construction, moving, harvesting, map navigation, dialogs and reduced
motion. Reviewed the shared host, workspace and palette; no entity renderer,
simulation, server rule or map-specific layout was duplicated.

User confirmed local UAT for this follow-up on 2026-11-01.
