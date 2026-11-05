# Hollow Animal Haven: see capybaras and rabbits sleeping inside (2026-10-27)

Branch `feature/animal-interactions`. First building of a series (coops and barns
follow once this is approved).

## Goal

When capybaras or rabbits shelter (night, rain) or rest at home, the child sees
them lying inside the Animal Haven's open front, under the roof, instead of
fading out (rabbits) or sleeping on the grass beside it (capybaras).

## Art (Codex imagegen, then reviewed)

Front view only: `animal-haven.png` is the one view whose open front shows the
interior. Side views show the entrance only as a sliver and the back view hides
it, so those keep today's behaviour.

1. `animal-haven-hollow-v1.png`: the SAME pixels and canvas as
   `animal-haven.png` (1402×1122, crop `[189,127,1023,882]`), except the visible
   interior of the open front (the cream back wall and the inner floor area
   framed by the posts, roof edge and porch lip) is made fully transparent.
   Roof, leaf emblem, posts, outline, porch lip and feet stay pixel-identical.
2. `animal-haven-interior-v1.png`: same canvas, ONLY the hollow region, opaque
   (alpha 255) in the original interior colours (cream wall, honey floor, the
   soft shade band), everything else transparent. It is both the default fill
   and the clip mask for animals inside.
Edits are deterministic pixel operations on the existing art (flood/region
selection + manual mask review), not a regeneration; imagegen only if a clean
mask cannot be cut. Verify: hollow + interior composited == original (pixel
diff ≈ 0 inside the crop), alpha edges clean, no halos.

## Rendering (frontend)

- Static layer (`buildingRender.drawTownBuilding`): a front-facing haven draws
  the interior image tinted by the ambient tone (darker in the evening/night,
  slightly grey in rain; reuse `sceneLighting` tones, no new palette), then the
  hollow building over it. Empty havens therefore look like today.
- Sheltered residents: capybaras/rabbits of a FRONT-facing haven whose mode is
  `resting` (night, rain) or that are asleep at home are drawn INSIDE: moved to
  fixed interior slots (2 capybaras side by side; 4 rabbits in a 2×2 huddle),
  sleeping pose, smaller depth-correct order, clipped to the interior mask, so
  the frame (posts, roof edge, porch lip) covers their edges. Drawn after the
  static layer in the animal pass; the clip makes them sit "behind" the frame.
- Walking home: they walk to the door as today, then step in (short fade/slide
  of ~0.4 s into the slot) instead of fading out. Waking reverses it.
- Rabbits stop being invisible in a front-facing haven; side/back-facing havens
  keep the current fade-inside behaviour, capybaras there keep resting at the door.
- Decorative only: positions are client-side, never saved or sent.

## Tests

- Unit: interior slot assignment (2 capybaras / 4 rabbits), front-only rule,
  mask-clip geometry, waking order.
- Browser: Night preview on a town with one capybara haven and one rabbit haven
  (front) and one turned left: screenshot shows animals inside the front havens,
  sleep "zzZ" still drawn, side haven unchanged; no console errors; existing
  suites green.

## Side and back windows (follow-up)

Left, right and back views have one landscape window (imagegen edit composited
onto the approved art; right = exact mirror). Residents behind a window are drawn
at full size (same scale as the front) with their feet below the sill, clipped to
the opening, so only the top shows: a capybara's ears and upper back, rabbits
sitting up so their ears peek over the sill. 1 capybara or 2 rabbits per window;
the rest stay unseen inside. The haven's own frame (posts, roof edge, porch lip)
is always cut out of the residents, so nothing overlaps a post.

## Barn shelter (requested 2026-10-27)
Side views redrawn to fill the 4×2 turned footprint (upper 2×2 barn middle
section, lower 2×2 roofed hay bay); rear bay built like the front bay. When
farmhouse residents shelter (night, rain): front shows the big door open with
the animals' heads curled asleep inside at their outdoor size; sides and rear
hide the hay pyramid and the animals sleep in the empty bay. One shared shelter
system serves the haven and the barn.
