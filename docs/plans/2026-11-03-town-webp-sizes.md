# Town art: multi-size WebP variants

Branch `feat/town-webp-asset-sizes`. Goal: faster Town canvas rendering and smaller downloads by serving each
Town asset as WebP in three pre-scaled sizes (small, medium, large), loading only what the screen needs.

## Decisions (user, 2026-11-03)
1. Three tiers per asset, chosen at runtime from device pixels per tile: small = furthest zoom, medium = zoomed in on small
   devices, large = zoomed in on large screens.
2. Lossy WebP, mild (quality ~86, alphaQuality ~92). Each tier is sized to what it displays: a sprite shown at 60px has a 60px small variant.
   Never upscale: variant scale = min(1, tierPxPerTile / assetPxPerTile).
3. PNG originals move to `art/town-building/` (not served).
4. The Lake gets its own baked scenery ring.
5. Scope: script, rewire, conversion, guard test, load-by-need (current-season ring only; Xmas/Halloween only inside their windows).

## Geometry
`tile = min(W/46, H/26.2) * zoom` (zoom 1..2, `forestWorld.ts`). Device px per tile = tile * min(devicePixelRatio, 2).
Typical: laptop zoom1 ~27, iPad DPR2 zoom1 ~44, laptop zoom2 ~54, iPad DPR2 zoom2 ~90, 1080p zoom2 ~82, DPR2 ~164.
Tier boundaries (device px per tile): small <= 48, medium <= 96, large > 96. Tier target px per tile: 48 / 96 / 160.
The tier is picked at load from the viewport, upgraded (never downgraded) when zoom/resize crosses a boundary; the old tier stays drawn until the new one has decoded.

## File naming and manifest
`name-v1.png` -> `name-v1@s.webp`, `@m.webp`, `@l.webp` under the same directory. A changed image gets a new `-vN`.
`frontend/src/features/town-building/townArtManifest.json` (generated) maps each key to
`{baseWidth, baseHeight, pxPerTile, tiers:{s,m,l}}` (variant widths; a tier equal to a larger one is omitted and aliased).
Atlas rects stay in base-pixel coordinates. A scale-aware draw shim multiplies source rects by `image.naturalWidth/baseWidth`.

## Phases
1. Converter script + manifest + tier module + tests.
2. Loader rewire (`townImageUrl`, `useTownArtwork`, draw shim) + audit of all `drawImage` call sites.
3. Convert assets by class; move originals; regenerate artwork catalog; check alpha fringes over grass and snow.
4. Guard test (no old-PNG references, no oversized PNG).
5. Load-by-need (season ring, event art) and Lake ring.
