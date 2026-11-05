# Journey Replay 3D Globe Implementation Plan

> **Scope guard:** Phase 1 applies to the `Watch My Journey` replay overlay only. The main exploration map remains Leaflet-based in this phase.

**Goal:** Replace the current replay-only Leaflet animation with a production-grade 3D globe so journey playback follows the real round world, preserves latitude/longitude geolocation, and removes visible teleportation near the antimeridian.

**Architecture:** Keep the existing journey API contract and replay state hook. Swap only the replay renderer from `JourneyMap.tsx` to a replay-only Cesium globe component. Reuse the existing ordered `origin` + `waypoints` data and the replay overlay controls. Preserve the current terrain-to-vehicle logic, but render the moving vehicle as a globe entity instead of a Leaflet DOM marker.

**Tech Stack:** React 19, TypeScript, Vite 6, CesiumJS, Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `docs/superpowers/plans/2026-04-06-journey-replay-3d-globe.md` | New plan document |
| `frontend/package.json` | Add CesiumJS integration dependencies |
| `frontend/package-lock.json` | Dependency lockfile update |
| `frontend/vite.config.ts` | Copy Cesium static assets into build output |
| `frontend/src/main.tsx` | Load Cesium widget styles and base URL bootstrap |
| `frontend/src/components/Journey/JourneyReplayOverlay.tsx` | Replay overlay continues to host controls, but mounts globe renderer |
| `frontend/src/components/Journey/JourneyGlobe.tsx` | New replay-only 3D globe renderer |
| `frontend/src/components/Journey/JourneyAnimator.ts` | Reused for phase 1, with minor adjustments if needed for globe path output |
| `frontend/src/components/Journey/VehicleBillboard.ts` | New helper to render a Cesium billboard image for the moving vehicle |

The main exploration map files under `frontend/src/components/Map/` do not change in phase 1.

---

## Task 1: Add the replay-only globe foundation

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Add Cesium runtime dependencies**

Add:

```json
"cesium": "...",
"vite-plugin-static-copy": "..."
```

Reason:
- `cesium` provides the 3D WGS84 globe runtime.
- `vite-plugin-static-copy` copies Cesium workers, widgets, and assets into the Vite build output.

- [ ] **Step 2: Configure Vite to copy Cesium static assets**

Update `frontend/vite.config.ts` so the production build includes Cesium assets under a stable public path, for example:

```ts
cesiumStaticCopy({
  targets: [
    { src: "node_modules/cesium/Build/Cesium/Workers", dest: "cesium" },
    { src: "node_modules/cesium/Build/Cesium/ThirdParty", dest: "cesium" },
    { src: "node_modules/cesium/Build/Cesium/Assets", dest: "cesium" },
    { src: "node_modules/cesium/Build/Cesium/Widgets", dest: "cesium" },
  ],
})
```

- [ ] **Step 3: Bootstrap Cesium in the frontend entry**

In `frontend/src/main.tsx`:
- import Cesium widget CSS
- set `window.CESIUM_BASE_URL = "/cesium"`

This keeps Cesium asset loading local to the frontend app build.

---

## Task 2: Replace replay rendering with a 3D globe

**Files:**
- Add: `frontend/src/components/Journey/JourneyGlobe.tsx`
- Modify: `frontend/src/components/Journey/JourneyReplayOverlay.tsx`
- Optional modify: `frontend/src/components/Journey/JourneyMap.tsx`

- [ ] **Step 1: Introduce a replay-only globe component**

Create `JourneyGlobe.tsx` to own:
- Cesium `Viewer` lifecycle
- replay path rendering
- waypoint markers
- animated vehicle entity
- camera behavior for replay

The component props should stay aligned with the existing `JourneyMap` props so the overlay integration stays small.

- [ ] **Step 2: Keep the overlay controls unchanged**

`JourneyReplayOverlay.tsx` should continue to own:
- period selection
- play/pause
- speed toggle
- completion state
- waypoint arrival label

Only the rendered map surface changes from `JourneyMap` to `JourneyGlobe`.

- [ ] **Step 3: Preserve replay-only scope**

Do not touch:
- `frontend/src/components/Map/WorldMap.tsx`
- `frontend/src/components/Map/ItemMarker.tsx`
- the general browsing experience on the map page

Phase 1 is successful only if the replay overlay upgrades to a globe while the rest of the map stack remains stable.

---

## Task 3: Reuse the current journey model and animation flow

**Files:**
- Reuse: `frontend/src/hooks/useJourneyReplay.ts`
- Reuse/modify lightly: `frontend/src/components/Journey/JourneyAnimator.ts`
- Reuse: `frontend/src/types/journey.ts`

- [ ] **Step 1: Keep the backend contract unchanged**

The existing route model already provides:
- origin latitude/longitude
- ordered waypoint latitude/longitude
- waypoint metadata for labels and arrival toasts

No API change is required for phase 1.

- [ ] **Step 2: Keep great-circle motion logic**

The current animator already computes great-circle segments between waypoints. Reuse that logic for the globe renderer so:
- vehicle travel follows the round world
- path interpolation remains geospatially correct
- segment transitions continue to drive waypoint arrival events

- [ ] **Step 3: Let Cesium solve globe wrapping**

Stop depending on 2D world-wrap behavior and DOM markers for replay. The 3D globe should render a single continuous trip around the Earth surface without edge teleports.

---

## Task 4: Upgrade vehicle rendering for production

**Files:**
- Add: `frontend/src/components/Journey/VehicleBillboard.ts`
- Reuse: `frontend/src/components/Journey/vehicleSprites.ts`

- [ ] **Step 1: Replace Leaflet `DivIcon` rendering**

Create a Cesium-friendly billboard image for the moving vehicle, ideally by composing:
- terrain-specific vehicle shape
- profile emoji badge
- profile color accent

- [ ] **Step 2: Keep terrain-aware vehicle swaps**

Continue to map terrain to vehicle:
- `land -> car`
- `ocean -> boat`
- `undersea -> submarine`

Vehicle changes should happen on segment change, just like today.

- [ ] **Step 3: Keep visuals production-safe**

The phase 1 replay should avoid:
- debug overlays
- obvious DOM marker jitter
- abrupt icon snaps caused by 2D map relayout

---

## Task 5: Camera and path behavior

**Files:**
- Add/modify: `frontend/src/components/Journey/JourneyGlobe.tsx`

- [ ] **Step 1: Start with a readable camera**

Initial camera behavior should prioritize clarity over cinematic complexity:
- zoom out enough to understand the route globally
- keep the vehicle visible during motion
- avoid aggressive camera jumps at each waypoint

- [ ] **Step 2: Render completed journey progress**

Preserve the sense of progression by rendering:
- a completed path trail
- optional future route path with lower emphasis
- waypoint arrival markers

- [ ] **Step 3: Maintain existing replay state callbacks**

The globe component must still call:
- `onStateChange`
- `onWaypointArrive`
- `onComplete`

This avoids changes to the replay overlay state machine.

---

## Task 6: Verification

**Files:**
- Verify replay overlay manually
- Verify frontend production build

- [ ] **Step 1: Build the frontend**

```bash
cd frontend && npm run build
```

Expected:
- Vite build passes
- Cesium static assets are emitted into the build

- [ ] **Step 2: Manual replay checks**

Verify in the `Watch My Journey` overlay:
- replay opens successfully
- play/pause works
- speed toggle works
- waypoint arrival toast still appears
- long routes crossing the Pacific or antimeridian do not teleport at map edges

- [ ] **Step 3: Regression guard**

Confirm unchanged behavior for:
- main exploration map
- marker clusters
- item detail navigation
- timeline filter

---

## Implementation Notes

- Phase 1 deliberately keeps the existing replay state hook and route payload to reduce migration risk.
- If Cesium camera tracking feels too aggressive, prefer a fixed overview camera in phase 1 and defer cinematic follow mode.
- If billboard composition becomes a blocker, ship a simpler billboard first and iterate visual polish in phase 2.
