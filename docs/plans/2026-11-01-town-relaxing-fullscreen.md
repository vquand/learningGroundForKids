# Relaxing fullscreen Town maps

## Accepted behavior

- Put the top-right controls in this order: Fullscreen, Badges, Language.
  Keep the existing Badges/Language positions and reserve the Fullscreen slot
  immediately to their left.
- Expand the current map using the browser Fullscreen API. If it is unavailable
  or denied, keep the same quiet presentation within the browser viewport.
- Hide navigation, material/weather bars, side panels, construction controls,
  status stickers, coverage, selection, countdown clocks, sleep/heart/speech
  overlays, notices and reward flights. Keep the actual world and ambient motion.
- Show an accessible exit control at the top right and retain available map
  travel arrows. Town/Lake navigation keeps both fullscreen and quiet mode active.
- Keep pan/zoom, but prevent building selection, construction and object actions.
  Existing server-authorized travel/checkpoint behavior remains unchanged.
- Exit through the button, Escape or browser fullscreen exit. Restore ordinary
  layout, focus and the previous edit/view setting; never persist fullscreen.
- Reuse one fullscreen owner and the shared scene/renderers on owned and visited
  maps. Preserve square tiles, artwork proportions and reduced motion behavior.

## Verification

Use the existing local browser harness and isolated headless agent-browser.
Check English/Vietnamese at 1366×768, 1024×768 and 1180×820, portrait compatibility,
native fullscreen, fallback/denial, Escape/browser exits, map travel in both
directions, no hidden construction actions and restoration of ordinary statuses.
Keep evidence under `/tmp`. Run frontend tests, both typechecks and both builds.

Fullscreen lifecycle follows [MDN's requestFullscreen contract](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)
and [fullscreenchange events](https://developer.mozilla.org/en-US/docs/Web/API/Element/fullscreenchange_event).

Validated: 813 frontend tests, application/hosting typechecks and both builds.
The native fullscreen matrix passed in English/Vietnamese at all required
landscape sizes, including continuous Town/Lake travel and UI/focus restoration.
Viewport fallback, denied requests, native/browser/Escape exits, portrait,
friend-map travel, reduced motion and event scenery passed. Canvas auditing
confirmed clocks, sleep/hearts and the crop-boost glyph stop while scene painting
continues, then resume on exit. Existing tablet-layout and shared-map flow suites
passed. Reviewed the common screen owner, workspace, scene, animal/building/civil
renderers and river/event adapters; no renderer or simulation was copied.

User confirmed local UAT on 2026-11-02 and requested a PR without merging.

## Follow-up corrections

- The normal status row is Weather, Materials, then Build. The three sections
  remain separate and share the same ordering on Town and Lake.
- Resident and shop signposts mask only animals inside their own shelter. Board
  masks carry the building's owner ID and an interior-only flag; nearby walkers
  and animals in other shelters stay visible. Ordinary building alpha and the
  shelter's structural frame retain their depth behavior.
- The signpost regression failed before the fix and now passes for havens,
  barns, coops and shops in every direction. Real canvas pixel checks pass on
  both maps at all three required landscape sizes and DPR 1/2, covering outdoor
  animals, own/other shelters, transparent gutters and ordinary building masks.
