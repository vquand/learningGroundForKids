# Cozy cheeseburger minigame

Approved direction: relaxed play for the existing children's audience, on
`feature/hamburger-minigame`. User authorized commit and push on 2026-10-04.

## Flow

1. Choose round, heart, flower, star, or rounded-square buns; animate dough shaping.
2. Choose toast level from three buttons; golden is ready, other choices get gentle hints.
3. Choose patty heat from three buttons; medium cooks it, then tap to flip.
4. Tap to melt cheese.
5. Preview ketchup, mayo, or burger sauce, then confirm with Next.
6. Preview exactly one of lettuce, tomato, or pickles; swapping replaces the
   previous topping immediately with a falling animation. Next confirms.
7. If tomato was confirmed, ask how many 1 cm slices a 3–6 cm thick tomato makes.
   Offer three answers, unlimited retries, and animate slicing after success.
   Each replay selects a different thickness from the preceding game.
8. Choose a flower, star, or heart decorative pick. Close the burger and serve.
9. Show the finished burger beside a 2D capybara in an apron, with a flower burst.
   Offer replay and return to kitchen.

## UI and implementation

- Bold outlines, soft cozy colors, generated chubby raster food and capybara.
- Landscape first: 1080×810 and 1180×820 CSS-pixel viewports (2× display scale),
  plus reduced heights for Safari browser controls. Use dynamic viewport units,
  safe-area padding, a large scene beside controls, and touch targets >=48 px.
- Keyboard-operable buttons, selected state, polite feedback, focus on step
  headings, and reduced-motion support. No timing penalties or score persistence.
- Food items jiggle on tap without changing choices. Tools, plate, capybara,
  and decorations remain still; only the visible toaster bun accepts taps.
- Independent pure game reducer and focused view/art components; reuse kitchen
  menu and authenticated/UAT route boundaries. No new backend or dependencies.

## Acceptance and validation

- All five shapes render in prep and final burger; changes are previewed before confirmation.
- Required preparation cannot be skipped. Tomato question appears only for tomato.
- Topping remains singular after repeated swaps. Wrong answers preserve the step.
- Replay clears choices and changes thickness; final selections survive into the showcase.
- Unit tests for game transitions; browser runs for full tomato/non-tomato paths,
  swaps, replay, reduced motion, and tablet viewport fit. Run all frontend gates.
- Physical iPad Safari testing remains user UAT; browser emulation cannot verify hardware.

## Implementation evidence (2026-10-04)

- Added kitchen menu entry and dedicated protected `/cooking/hamburger` route,
  plus development-only `/uat/cooking/hamburger`.
- Four game-logic tests pass. Eight Chromium browser tests pass: full touch
  flows at 1080×810, 1180×820, 1080×650, 1180×650, 1024×600, and 375×812,
  plus keyboard focus. Coverage includes all bun shapes, topping replacement,
  incorrect answers, exact rendered slice counts, replay, reduced motion,
  food-only jiggles, repeated taps, and static tools.
- Frontend app and hosting type checks pass. Vercel and compatibility builds pass.
- Full frontend suite after raster integration: 217/218 pass. Existing `profile-extras-api.test.ts:41`
  expects a September 20 completion inside the current last-seven-days window;
  the test fails on October 4. No profile API or fixture changes made here.
- Landscape test sizes derive from Apple's display specifications at 2× scale:
  [iPad 9th generation](https://support.apple.com/en-by/111898) and
  [iPad 10th generation](https://support.apple.com/kb/SP884?locale=en_US).
- Local review: `npm run dev:uat --prefix frontend -- --host 127.0.0.1 --port 3002 --strictPort`.
  Open `http://127.0.0.1:3002/uat/cooking/hamburger` on this computer.
- Physical iPad Safari UAT remains outstanding.
- Replaced all hamburger SVG artwork with 35 generated raster sprites across
  five transparent PNG sheets. Provenance and prompt set are in
  `frontend/public/minigames/cooking/burger/ASSETS.md`. The browser suite checks
  PNG decoding and the absence of SVG artwork inside the game.
