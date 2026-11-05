# Shoo Shoo UFO art

Generated with the built-in image generation tool on 2026-10-05 for this project,
using the user's animal references and the app's rounded pastel avatar style.
These are generated assets, not fetched third-party catalog images.

- `animals.png`: 4 columns × 4 rows. Rows: dairy cow, Highland cow, sheep,
  capybara. Columns: idle, eating, napping, happy floating.
- `animals-eating-fixed.png`: matching atlas with the two extra apple-holding
  paws removed from the capybara eating cell. Only that cell is used at runtime.
- `animals-surprised.png`: matching atlas with mildly surprised O-mouth capture
  expressions in column four. Used only for capture and UFO passenger poses.
- `backgrounds.png`: 3 horizontal scene panels. Farmhouse, forest, lake.
- `props.png`: UFO in the upper region; oval soil/grass patch below.
- `badges.png`: 5 columns × 3 rows. Ordering matches achievement `logo` indices
  in `server/src/ufo/game.ts`, from First Word! through Farm Friends. Regenerated
  using the shared prompt at `../achievements/UNIVERSAL_BADGE_ART_PROMPT.md`.

Atlas positions and animations are implemented in `UfoArt.tsx`, `UfoScene.tsx`,
and `ufo.css`. Animal/prop/badge atlases have alpha transparency. The backdrop
is opaque raster art. Originals remain in the image generator's output store;
these copies are the application-owned runtime assets.
