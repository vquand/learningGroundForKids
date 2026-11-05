# Waddle Wall: original proportions and question variety

Branch: `feature/waddle-chubby-sprites`.

Restore the original animals' large heads, round bellies, broad rears and short
legs while retaining six walking frames per direction, pause freeze and reduced
motion. Built-in ImageGen used the original Waddle atlases as the character
references. Versioned sources, exact prompts, packing manifest and runtime asset
paths are in `docs/artwork/waddle-wall/chubby-v3/`.

The shrinking countdown uses green above 50%, yellow down to 25%, and red for
the final quarter. Length remains the non-color cue. Existing server timing and
pause rules still determine when the wall arrives.

Question selection is server-owned. A canonical history stored in existing
session JSON excludes repeats across difficulty levels, answer arrangements and
reversed sums/products. History survives persistence and pause; replay resets
it. Legacy sessions can recover only their current question, since previous
questions were not stored. No SQL migration is required.

Easy question selection targets 20% counting and 80% addition while both groups
have unused questions. Addition/subtraction target 10% with a 0/1 operand while
both operand groups remain available. Finite unused pools prevent random retry
loops. Exhausted groups fall back to other unused questions/difficulties; a
fully exhausted curriculum finishes rather than repeating.

Walls now use four registered sprite states per material: full, left opening,
middle opening and right opening. The built-in ImageGen sources and prompts are
in `docs/artwork/waddle-wall/wall-openings-v1/`. Brick, stone and bamboo use the
generated illustrated edges directly. Minecraft keeps square texture tiles and
uses its generated stepped silhouette as an alpha mask. The same preloaded
sheet serves all states; openings remain hidden until the server grades a pass
or splash. Answer labels stay clear of the animal and tile density adapts to
the visible wall height.

Validation:

- All 19 Waddle browser scenarios passed: real alpha/irregular contours for
  every material and lane, registration at the required viewports,
  six-frame playback for all animals,
  pause, reduced motion, timer colors, scoring, terminal splash and replay,
  responsive laptop/iPad/phone layouts and language behavior.
- Frontend tests (90 files), app/hosting typechecks, Vercel and compatibility
  builds passed.
- Server tests: 320 passed, 13 database integration cases skipped because no
  disposable test database was configured. Server typecheck and build passed.
- New server checks cover a 500-question saved/paused session without repeats,
  commutative identity, legacy recovery, replay reset, curriculum exhaustion
  and seeded sampling of the counting and 0/1 operand frequencies.
