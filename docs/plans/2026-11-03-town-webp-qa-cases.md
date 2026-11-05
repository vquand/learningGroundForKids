> **Executor addendum (authoritative over the placeholders below).** The `window.__TOWN_DEV__` hooks named in this document do
> NOT exist (agy invented them). Real hooks: `window.__townArtTier` (current tier `'s'|'m'|'l'`, dev build only), the network log,
> and the DOM/canvas. App `http://localhost:5173` (Docker dev stack, already running, `VITE_DEV_MODE=true`). Account/profile: a throwaway
> local family seeded with a copy of Mun's Town (148 entities); profile name **QA Mun**; credentials in the scratchpad file
> `qa-account.txt` (email then password). Sign in at the login page, pick **QA Mun**, open Town. A/B flag: append `?townArt=png`.
> Zoom: the Town's own zoom control / wheel / pinch; discover it. Entity locating: no hook, so crop by visual regions the executor
> identifies from a full screenshot. Use Playwright (frontend/node_modules) with scripts written under the scratchpad dir, never in the repo.
> Executor never edits repo files; it only reports. Currently only `buildings-minimal-v2`, `pets-dogs`, `terrain-minimal-v2` are converted;
> everything else is expected to remain PNG until the bulk conversion lands, so TC-04's PNG whitelist is "all keys not in townArtManifest.json".

# Town Map WebP Tiered Art QA Browser Test Suite

**Target**: Real browser (Playwright/Chromium) operated by an automated executor.  
**Subject Under Test**: Town canvas WebP migration (`@s`, `@m`, `@l` tiers) vs. PNG baseline (`?townArt=png`).  
**Test Profile**: Kid profile `"Mun"`.  
**Artifact Directory**: `/tmp/townart-qa/` (Must exist before run: `mkdir -p /tmp/townart-qa`).  
**Resolution Rule**: Items marked `[RESOLVE: <description>]` must be discovered from DOM/global state during pre-flight.

---

## 1. Execution Setup & Global Constants

### 1.1 Resolution Placeholders
- **Base URL**: `[RESOLVE: App root URL, e.g., http://localhost:5173]`
- **Profile Selector**: `[RESOLVE: Selector for profile 'Mun', e.g., button[data-profile="Mun"]]`
- **Canvas Selector**: `[RESOLVE: Town canvas element, e.g., canvas#town-canvas, canvas.town-map-viewport]`
- **Zoom Controls**: `[RESOLVE: Zoom-in button, e.g., button[data-action="zoom-in"]]`, `[RESOLVE: Zoom-out button, e.g., button[data-action="zoom-out"]]`
- **Dev Hooks**:
  - `window.__TOWN_DEV__.getCamera()`: Returns `{ x: number, y: number, zoom: number }`
  - `window.__TOWN_DEV__.setCamera(camera)`: Sets position and zoom
  - `window.__TOWN_DEV__.getLoadedAssets()`: Returns `{ [assetKey: string]: { url: string, tier: 's'|'m'|'l'|'png' } }`
  - `window.__TOWN_DEV__.getEntityScreenBounds(entityClass)`: Returns `[{ id, class, x, y, width, height }]`
  - `window.__TOWN_DEV__.freezeAnimation(bool)`: Freezes internal canvas tick/frame step

### 1.2 Tier Calculation Formula
$$\text{tile\_px} = \min\left(\frac{W}{46}, \frac{H}{26.2}\right) \times \text{zoom} \times \min(\text{DPR}, 2)$$
- **Small (`@s`)**: $\text{tile\_px} \le 48$
- **Medium (`@m`)**: $48 < \text{tile\_px} \le 96$
- **Large (`@l`)**: $\text{tile\_px} > 96$

### 1.3 Diff Pass/Fail Thresholds (revised after the first run)
Lossy downscaled WebP always differs from the PNG along sprite outlines (a uniform soft halo), so raw per-pixel limits are meaningless.
Measure **structure**, not pixels:
- Blur both images (Gaussian sigma = 3 CSS px x DPR) before diffing. Halo and compression noise vanish; a clipped, missing, shifted or wrong-frame sprite does not.
- **Global blurred MAD** <= 1.5 / 255.
- **Per-cell blurred MAD** (46 x 26 grid): any cell > 6.0 = FAIL; list the cell, the visible sprite and a 4x crop.
- **Silhouette check**: threshold alpha-equivalent coverage (pixel differs from the surrounding ground colour by > 24) on both images; the XOR area must be <= 4% of the union area per 200 x 200 CSS px window.
- **Animation**: also run a WebP-vs-WebP control. PASS when IoU(WebP,PNG) >= 0.9 x IoU(WebP,WebP); the motion-pixel counts must match within 10%.
- **Coverage**: the run must locate and crop (4x, side by side) at least one instance of EVERY class: building views (house, large house, library, town hall, civ buildings, farmhouse, coop, animal haven, town storage), trees, crops incl. withered, farm animals, baby animals, pets (dogs, cats, birds, pig), civ people incl. baker idle/work, vehicles, wildlife, scenery strips and seasonal ring, terrain, shoreline, cloud shades, xmas sculptures, grass tufts, leaf piles, mushroom, flower bush. Classes that cannot be located after panning to all four corners and the centre at zoom 2 are reported as NOT COVERED, never as passed.
- Tier tables are derived from the live canvas size (see addendum); the large tier is expected only on high-DPR screens, so add one run at 1440x900 DPR2 zoom 2 to exercise `@l`.

---

## 2. Test Cases

### TC-01: Profile Initialization & Baseline Lock
- **Objective**: Ensure profile "Mun" loads in identical camera states for both A (WebP) and B (PNG).
- **Preconditions**: Browser clean session, storage cleared.
- **Steps**:
  1. Navigate to `[RESOLVE: Base URL]`.
  2. Click profile `"Mun"`: `[RESOLVE: Profile Selector]`. Wait for canvas `[RESOLVE: Canvas Selector]` to be visible.
  3. Wait until network idle (no active `/minigames/town-building/*` requests for 1000ms).
  4. Query `window.__TOWN_DEV__.getCamera()` and record baseline coordinates $(X_0, Y_0, Z_0)$.
- **Pass Criteria**:
  - Town canvas mounts with width and height $> 0$.
  - Camera state $(X_0, Y_0, Z_0)$ is successfully read and stored.

---

### TC-02: Viewport & Zoom Tier Selection Matrix
- **Objective**: Verify correct tier request and Dev Hook state across viewports, DPRs, and zoom levels.
- **Matrix**:
  | Config | Viewport | DPR | Zoom | Expected $\text{tile\_px}$ | Expected Tier |
  | :--- | :--- | :--- | :--- | :--- | :--- |
  | **M1** | $1366 \times 768$ | 1.0 | 1.0 | $29.31$ | `@s` |
  | **M2** | $1366 \times 768$ | 1.0 | 2.0 | $58.62$ | `@m` |
  | **M3** | $1024 \times 768$ | 2.0 | 1.0 | $44.52$ | `@s` |
  | **M4** | $1024 \times 768$ | 2.0 | 2.0 | $89.04$ | `@m` |
  | **M5** | $1180 \times 820$ | 2.0 | 1.0 | $51.30$ | `@m` |
  | **M6** | $1180 \times 820$ | 2.0 | 2.0 | $102.60$ | `@l` |
  | **M7** | $1920 \times 1080$ | 1.0 | 1.0 | $41.22$ | `@s` |
  | **M8** | $1920 \times 1080$ | 1.0 | 2.0 | $82.44$ | `@m` |
- **Steps**:
  1. For each matrix entry (M1–M8), launch Playwright context with specified `viewport` and `deviceScaleFactor`.
  2. Intercept network requests matching `/minigames/town-building/*`.
  3. Load page, select profile `"Mun"`, apply zoom via `[RESOLVE: Zoom Controls]` or `window.__TOWN_DEV__.setCamera({ zoom })`.
  4. Wait 1500ms after last network request.
  5. Check requested asset URLs and execute `window.__TOWN_DEV__.getLoadedAssets()`.
- **Pass Criteria**:
  - All requested WebP art URLs contain the corresponding `@s`, `@m`, or `@l` tag per the table.
  - Zero 404 responses on `/minigames/town-building/*`.
  - Dev hook reports identical tier for all loaded WebP assets matching the calculation.

---

### TC-03: Tier Upgrade Invariance (No Downgrade)
- **Objective**: Guarantee that zooming out never triggers downgrading to a lower-resolution tier.
- **Steps**:
  1. Launch at $1180 \times 820$, DPR 2.0 at Zoom 2.0 (Target: `@l`).
  2. Wait for all `@l` assets to complete loading.
  3. Zoom out to Zoom 1.0 (where formula yields $51.30$, which normally requests `@m`).
  4. Monitor network for 2000ms.
  5. Inspect `window.__TOWN_DEV__.getLoadedAssets()`.
- **Pass Criteria**:
  - Zero network requests for `@m` or `@s` variants after zooming out.
  - Active tier in memory remains `@l` for all assets previously upgraded.

---

### TC-04: Asset Coverage & Dual-Load Prevention
- **Objective**: Ensure exhaustive coverage of Mun's assets without duplicate loading or mixed modes.
- **Steps**:
  1. In default mode, pan through all four corners of Mun's town at Zoom 2.0 to trigger viewport culling loads.
  2. Collect all network URLs matching `/minigames/town-building/*`.
  3. Analyze asset keys (URL stripped of `@s|@m|@l` suffix and extension).
- **Pass Criteria**:
  - Zero 404 responses.
  - No asset key loads both `.png` and `.webp`.
  - No asset key loads multiple WebP tiers simultaneously unless an explicit upgrade event occurred.
  - Every asset key is either a WebP tier or explicitly whitelisted as an unmigrated PNG asset.

---

### TC-05: Static Visual Parity A/B Diff (Frozen State)
- **Objective**: Prove WebP canvas render is indistinguishable from PNG baseline under identical geometry.
- **Steps**:
  1. **Run A (Default / WebP)**:
     - Viewport $1366 \times 768$, DPR 1.0. Emulate `prefers-reduced-motion: reduce`.
     - Call `window.__TOWN_DEV__.freezeAnimation(true)`.
     - Align camera to $(X_0, Y_0, 1.0)$. Wait 500ms.
     - Capture canvas screenshot to `/tmp/townart-qa/tc05-canvas-webp.png`.
  2. **Run B (Baseline PNG)**:
     - Navigate to same URL with `?townArt=png`.
     - Apply identical motion reduction and camera $(X_0, Y_0, 1.0)$.
     - Capture canvas screenshot to `/tmp/townart-qa/tc05-canvas-png.png`.
  3. Execute diff using Pixelmatch/Sharp with output `/tmp/townart-qa/tc05-diff.png`.
  4. Compute global MAD, per-tile-cell MAD, and bounding-box edge-band deltas.
- **Pass Criteria**:
  - Global MAD $\le 3.5$.
  - Mismatch pixels $\le 0.3\%$.
  - Every $46 \times 26$ grid tile has $\text{MAD} \le 12.0$.
  - Edge-band difference test passes with no bleeding from neighboring atlas frames.

---

### TC-06: Animation Parity & Motion Bounding Regions
- **Objective**: Confirm that WebP conversion maintains the correct animation frames, cadence, and active regions.
- **Target Classes**: Animals (walking/sleeping), Pets (walk), Civ people, Water/boats, Seasonal ghosts/lanterns, Snow.
- **Steps**:
  1. Set viewport $1366 \times 768$, DPR 1.0. **Disable** reduced motion (`prefers-reduced-motion: no-preference`).
  2. **Run A (WebP)**: Record 5 canvas frames at $t = 0, 400, 800, 1200, 1600\text{ ms}$. Save to `/tmp/townart-qa/anim-webp-frame-[1..5].png`.
  3. **Run B (`?townArt=png`)**: Under identical game time/seed, record 5 canvas frames at same intervals. Save to `/tmp/townart-qa/anim-png-frame-[1..5].png`.
  4. For both runs, compute delta mask: $M_A = \bigcup_{i=1}^4 |F_{A, i+1} - F_{A, i}| > 15$, $M_B = \bigcup_{i=1}^4 |F_{B, i+1} - F_{B, i}| > 15$.
  5. Check overlap ratio: $\text{IoU}(M_A, M_B) = \frac{|M_A \cap M_B|}{|M_A \cup M_B|}$.
- **Pass Criteria**:
  - $\text{IoU}(M_A, M_B) \ge 0.90$.
  - Bounding boxes for each target animated entity (queried via `window.__TOWN_DEV__.getEntityScreenBounds(entityClass)`) exhibit non-zero motion in both runs.
  - Zero wrong or stuck frames in WebP versus PNG.

---

### TC-07: Zoomed 4x Inspection: Infrastructure & Landscaping
- **Entities**: `building`, `road`, `bridge`
- **Steps**:
  1. For each entity class, fetch screen coordinates using `window.__TOWN_DEV__.getEntityScreenBounds(class)`.
  2. Center camera on the entity and render at Zoom 2.0.
  3. Crop entity bounding box (with 8px padding) from Run A (WebP) and Run B (PNG).
  4. Upscale both crops 4x using nearest-neighbor.
  5. Generate side-by-side composite and save to:
     - `/tmp/townart-qa/crop-building-4x.png`
     - `/tmp/townart-qa/crop-road-4x.png`
     - `/tmp/townart-qa/crop-bridge-4x.png`
- **Pass Criteria**:
  - Edge boundaries show no clipping (no missing outline pixels along outer edge).
  - No bleeding of pixels from adjacent atlas textures.
  - Visual sharpness matches original PNG without blur or downsampling pixelation.

---

### TC-08: Zoomed 4x Inspection: Nature & Agriculture
- **Entities**: `tree`, `crop`, `scenery ring`
- **Steps**:
  1. Repeat TC-07 locate, center, crop, and 4x upscale procedure for `tree`, `crop`, and `scenery ring`.
  2. Save side-by-side outputs to:
     - `/tmp/townart-qa/crop-tree-4x.png`
     - `/tmp/townart-qa/crop-crop-4x.png`
     - `/tmp/townart-qa/crop-scenery-ring-4x.png`
- **Pass Criteria**:
  - Semi-transparent foliage/edge alpha blending matches PNG baseline.
  - No atlas border bleed or cut-off branches/rings.

---

### TC-09: Zoomed 4x Inspection: Living Entities
- **Entities**: `farm animal`, `pet`, `civ person`
- **Steps**:
  1. Freeze animation via `window.__TOWN_DEV__.freezeAnimation(true)`.
  2. Repeat TC-07 locate, center, crop, and 4x upscale procedure for `farm animal`, `pet`, and `civ person`.
  3. Save side-by-side outputs to:
     - `/tmp/townart-qa/crop-farm-animal-4x.png`
     - `/tmp/townart-qa/crop-pet-4x.png`
     - `/tmp/townart-qa/crop-civ-person-4x.png`
- **Pass Criteria**:
  - Exact frame correspondence between WebP and PNG.
  - Sprite origin and feet alignment on ground tile match within 0.5px.

---

### TC-10: Zoomed 4x Inspection: Icons & Seasonal Items
- **Entities**: `material icon`, `badge/UI icon`, `Xmas sculpture`
- **Steps**:
  1. Repeat TC-07 locate, center, crop, and 4x upscale procedure for `material icon`, `badge/UI icon`, and `Xmas sculpture`.
  2. Save side-by-side outputs to:
     - `/tmp/townart-qa/crop-material-icon-4x.png`
     - `/tmp/townart-qa/crop-badge-ui-4x.png`
     - `/tmp/townart-qa/crop-xmas-sculpture-4x.png`
- **Pass Criteria**:
  - High-contrast icon outlines and festive decorations show no compression ringing or clipping.
  - Zero sub-rectangle alignment shift in canvas draw shim.

---

## 3. QA Execution & Defect Report Template

> **Executor Rule**: Never modify application code. Record test outcomes, attach evidence paths, and list failing asset keys.

### 3.1 Test Execution Summary Table

| TC ID | Test Description | Result (PASS / FAIL) | Evidence Path | Failing Asset Keys |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Profile & Baseline Lock | | | None |
| **TC-02** | Viewport & Tier Matrix | | `/tmp/townart-qa/matrix-log.json` | |
| **TC-03** | Tier Upgrade Invariance | | `/tmp/townart-qa/upgrade-log.json` | |
| **TC-04** | Asset Coverage & Dual Load | | `/tmp/townart-qa/network-coverage.json` | |
| **TC-05** | Static Parity A/B Diff | | `/tmp/townart-qa/tc05-diff.png` | |
| **TC-06** | Animation & Motion Parity | | `/tmp/townart-qa/anim-diff.png` | |
| **TC-07** | 4x Crop: Infrastructure | | `/tmp/townart-qa/crop-building-4x.png`, etc. | |
| **TC-08** | 4x Crop: Nature & Crops | | `/tmp/townart-qa/crop-tree-4x.png`, etc. | |
| **TC-09** | 4x Crop: Living Entities | | `/tmp/townart-qa/crop-farm-animal-4x.png`, etc. | |
| **TC-10** | 4x Crop: Icons & Seasonal | | `/tmp/townart-qa/crop-xmas-sculpture-4x.png`, etc. | |

---

### 3.2 Defect Logging Format (Append for each failure)

```markdown
### DEFECT-<ID>: [Asset Key or Test ID]
- **TC ID**: TC-XX
- **Asset Key**: e.g., `building.town_hall_lvl3`, `animal.cow_walk`
- **Requested URL**: e.g., `/minigames/town-building/buildings/town_hall_lvl3@m.webp`
- **Failure Category**: [Clipping | Atlas Bleed | Pixelation/Blur | Wrong Frame | 404 | Dual Load | Tier Downgrade]
- **Measured Metrics**:
  - Global MAD: <value> (Threshold: <= 3.5)
  - Cell MAD: <value> (Threshold: <= 12.0)
  - Edge-band Delta: <value> (Threshold: <= 10.0)
- **Evidence File**: `/tmp/townart-qa/<filename>.png`
- **Description**: Concise visual description of the anomaly observed.
```
agy-headless: done rc=0
