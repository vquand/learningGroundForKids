# Universal minigame badge art prompt

Use this prompt for every minigame's achievement badge atlas. Keep the supplied
UFO badge atlas (`../ufo/badges.png`) as the primary visual style reference. When
regenerating an existing game's atlas, also provide its current atlas as a
content reference only; preserve the meaning and order of each badge while
bringing every badge into this shared system style.

## Prompt template

Use case: production game UI badge atlas for the Playing Ground children's
minigame system.

Style reference: match the hand-illustrated Shoo Shoo UFO achievement badges.
Every badge uses the same round cream medallion silhouette, fine warm-brown ink
outlines, delicate engraved/etched interior details, gentle paper-like texture,
and small pastel accents in honey gold, mint, coral, lilac, and sky blue. The
art should feel like one set of collectible storybook keepsakes: warm, charming,
carefully detailed, and legible at 64–96 px. Preserve the same outline weight,
medallion scale, decorative density, and visual finish across every cell.

Create exactly the requested number of different badge illustrations, arranged
in the exact requested rows and columns. Center one complete circular badge in
each cell, with generous transparent gutters and no overlap. Keep every badge's
outer edge and ribbon fully inside its cell. Use a transparent background.
Each badge should have a distinct central pictogram that clearly represents
its supplied achievement description. Keep all text, letters, numerals, labels,
and UI outside the image; the app supplies badge titles and difficulty labels.
Use no monograms, typography, logos, watermarks, separate backdrops, or mockup
cards. Do not use grayscale as a locked state; the app applies grayscale in UI.

Avoid 3D, clay/plastic rendering, glossy gradients, heavy shadows, neon, busy
backgrounds, inconsistent medal frames, abrupt changes in line style, and tiny
details that disappear at UI size. Do not copy unrelated subject matter from
the style reference. Output only the transparent atlas.

## Per-atlas details

For each generation, append the minigame name, exact grid dimensions, and a
numbered list of achievement names with a short description of the central
pictogram for each. Maintain reading order from left to right, then top to
bottom. Measure actual cell bounds and verify transparency before wiring the
atlas into the achievement catalog.

## Current atlases

- `../road-racing/badges.png`: 18 badges, 4 × 5; First Finish through Snail Survivor.
  Measured atlas bounds and generation prompts are in `../road-racing/ART.md`.
- `../ufo/badges.png`: 15 badges, 5 × 3; First Word! through Farm Friends.
- `../infinidrill/achievement-badges.png`: 10 badges, 5 × 2; First Dig through
  Core Champion.
- `../math-quiz-wall/badges.png`: 6 badges, 3 × 2; First Waddle through Orange
  Explorer.
- `../math-quiz-wall/math-scientist.png`: seventh Waddle Wall badge, separate
  1×1 transparent medallion; capybara scientist, flask and wall bricks.
- `../town-building/garden-badges.png`: 2 badges, 2 × 1; First Harvest and Garden Basket.
- `catalog-only.png`: 9 badges, 3 × 3; Cooking, Burger Kitchen, and Food and
  Drink, in that order by row.
- `../cooking/cabbage-rolls/achievement-badges.png`: 4 badges, 2 × 2;
  Roll Chef, A Little Too Soon, Toasty Lesson, Perfectly Simmered. Catalog-only
  until server-verified cabbage-roll gameplay and grading are implemented.

These atlases are transparent PNGs. The admin catalog stores the atlas path,
sprite index, and grid dimensions; the frontend applies grayscale only for
locked badges.

The content briefs are kept in catalog order: Infinidrill uses a friendly drill,
number miner, gem prospector, first layer, deep layer, mantle explorer, cave,
bonus puzzle, workshop parts, and smiling core. Waddle Wall uses a capybara
crossing a wall, a wall sequence, poolside trophy, heart parade, sunny math
board, and explorer. The catalog-only atlas rows use chef/spoon, recipe cards,
plated meal; burger, burger order, complete burger; teapot/cup, cocoa cup, and
fruit blender/drink. Shoo Shoo UFO retains the original 15 illustrated concepts
and their established game order.
