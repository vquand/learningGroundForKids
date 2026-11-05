# Infinidrill generated art

`terrain-atlas-v2.png` is the active 887×1774 pastel terrain atlas arranged in
3 columns × 6 rows. It uses simpler broad shapes and sparse detail, matching
the softer avatar/frame art. `terrain-atlas.png` is superseded.
Generated rows have unequal heights. Use `terrainSourceRect` in `assets.ts` to
isolate each material and crop it to cover its block without stretching.
Rows are dirt, packed dirt, rock, deep rock, lava rock, and core rock;
columns are the three texture variants.

The generation prompt is recorded in `terrain-art-v2-prompt.md`. Each previous
six-metre block is visually split into 2×2 three-metre tiles. The tunnel tapers
into a stepped V around the drill tip. Underground walls keep a little detail
with a 2px blur; adjacent rows share a background band to reduce blur layers.

`drill-parts-atlas-v2.png` is the active 1254×1254 RGBA atlas, regenerated to
match the flat kid avatars and avatar frames: warm brown outlines, rounded
silhouettes, pastel fills, and simple shading. It contains 25 sprites arranged
in 5 columns × 5 rows. The original `drill-parts-atlas.png` is superseded.
The generated spacing is uneven: use the measured pixel source rectangles in
`frontend/src/features/infinidrill/assets.ts`, not equal grid slices, to avoid
clipping heads or including neighboring sprites. Columns are starter, tiers 1–4;
rows are head, cabin, accessory, engine, and paired tank treads. The cabin
window is intentionally empty so the active profile avatar and frame can be
rendered behind it. Render each clipped asset with its proportions preserved,
centered inside the fixed mounting area for that slot. Heads point right in the
source and should be rotated downward for drilling.

Track assemblies face left in the source. Their mounted slot is on the right
side of the machine, rotated 90 degrees counterclockwise so the front faces down.
This mounting position and orientation are shared by every tread tier and all
assembled-machine views (setup, gameplay, workshop preview, and results).

The style references and generation prompt are recorded in
`drill-art-v2-prompt.md`. The replacement was generated using the built-in
ImageGen tool, with genuine transparency around the parts and through all five
cabin windows.

`underground-wall.png` is the quieter background wall visible through excavated
shafts and natural caves. It is tinted per Earth layer and anchored to world
coordinates. Its built-in ImageGen prompt is in `underground-wall-prompt.md`.
Foreground tiles are removed as the drill descends and their fragments are
briefly animated away. The camera follows depth; only intersecting rows, labels,
and deposits are rendered. Debris expires and passed cave metadata is pruned.
