# Waddle Wall

## Status

Implemented and user reviewed on `feature/kids-math-quiz-wall`. The user
authorized committing and pushing this feature on 2026-10-06. Cloud resource
changes, deployment, and production migration remain outside this approval.

## Accepted gameplay

The fifth card on `/playground` opens `/waddle-wall`. Kids ages 5–8 choose a
capybara, dairy cow, or Highland cow, then an English (British country ball) or
Vietnamese country ball. A language choice is required. Wall choices are brick,
Minecraft-inspired blocks, European stone, and Vietnamese garden fence.

Lively chubby 2D animal sprites play in a fully illustrated 2D garden arena.
The ground, pond, four continuous wall styles, flowers, stars, heart, and splash
are raster artwork matching the kid avatars and flower frame's warm outlines.
There is no WebGL renderer or 3D scenery. Every animal has
rear, left, right, and surprised pieces. Use rear at rest, switch to the side
facing the destination while moving, then return to rear on arrival. Bob and
jiggle the image for the waddle; use the surprised piece during a splash.
Measured crop rectangles preserve each piece and align the feet. Setup uses
the same sprites as gameplay. Tap a lane or its number, or press keys 1/2/3.
Number buttons are anchored at the routes' border with the pond inside the
canvas area; projected HTML text retains its normal proportions. Responsive
layouts keep the pool, wall, and all three lanes visible, including landscape.
The question appears only above the arena; the wall shows answer numbers.
The wall is one continuous artwork surface with three answer positions and
no highlighted container border. Crop atlas margins so it fills the wall;
the correct position opens after arrival, retaining a top beam. The animal
stays in front and answer labels sit above it on a separate synchronized layer.
The Minecraft style uses original pixel grass/dirt tiles instead of the
illustrated strip. Square tiles stack across the available width and height,
with grass on the first row and dirt below. Rows/columns increase on larger
screens; answer labels remain separate HTML overlays centred in each lane.
Classic 2D countryballs have thick black outlines, white eyes, and a British
top hat or Vietnamese nón lá, matching the user's supplied references.

Each approaching wall is one wave. The correct opening becomes visible when
the wall arrives. The wall advances to the pond border and stops there. Correct
choices fade it away while a chubby heart, flowers, grass, and stars celebrate.
Wrong choices leave the wall stationary while the animal turns its surprised
face into view and falls into the pond. After the splash, the session finishes
with "You stopped at wall X and scored Y points" (localized in Vietnamese),
and Play again is required to start a new session. Lane controls hide during
the outcome to keep the animation visible. Correct answers continue without
a fixed wall limit; the first failure or Finish ends the game. Pause and
returning to the playground preserve the current
session; returning to an existing session pauses it for review before resume.
Switching away from the browser tab automatically requests pause.

| Difficulty | Color on panels/border | Math | Time | Points |
|---|---|---|---|---|
| Easy | Green | Counting, addition within 10 | 10 s | 1 |
| Medium | Yellow | Addition/subtraction within 20 | 15 s | 2 |
| Hard | Orange | Addition/subtraction within 100, multiplication 2–9 | 20 s | 3 |

Wall materials retain natural colors. First wave is easy. Over 40 waves,
medium probability grows from 16% to 40%, hard from 4% to 30%. Immediately
after passing a medium/hard wall, medium chance halves and hard chance drops
to a quarter for the next wave, allowing a gentler follow-up.

Live gameplay shows the question, answer choices, wall, and pause control.
Session points, saved personal best, friends ranking, and badges appear only
while paused or finished. Rankings contain the active child and accepted
profile-to-profile friends in either direction. Pending, rejected, mixed
profile/family, family-wide friendships, and unrelated siblings grant no
ranking access. Hide the global ranking section when no connected kid friends
are returned; its child-facing caption is "You and your friends" / "Bạn và bạn bè".
For a solo kid, show "Your high score so far: N" using the saved best score
("Điểm cao nhất của bạn đến giờ: N" in Vietnamese). The friends table marks
the highest score with a gold medal; tied highest scores each receive a medal.

The linked Cute Little Animals pack was investigated on
[Fab](https://www.fab.com/listings/e2f6dfdc-95e3-4f1f-9191-79f05c46a218).
It is listed for purchase and is not rigged. No licensed source files were
available in this task, so the game retains its three original procedural
animals, now drawn as 2D sprites. The pack is not imported or
credited as an asset used in the game.

## Persistence and API

See [ADR-004](../decisions/ADR-004-waddle-wall.md). The API owns questions,
timing, grading, scores, badge counters, and best scores. A browser never sends
a score, correct answer, friendship scope, or owner identity.

Routes under `/api/v1/profiles/:profileId/math-wall`:

- `GET /`: private progress and session snapshot; solution lane is withheld
  until the wave resolves.
- `POST /start`: `{ revision, settings: { animal, language, wall } }`.
- `POST /action`: `{ revision, action }`, where action is `lane` (0–2),
  `settle`, `next`, `pause`, `resume`, or `finish`.
- `GET /leaderboard`: ranked `{ name, score, self }` entries from server-filtered
  accepted kid friendships; no family or public identifiers returned.

Existing cookie authentication, family ownership, origin checks, private
`no-store` headers, and strict JSON validation protect every route. Writes use
a PostgreSQL row lock and monotonically increasing revision to reject stale
tabs and duplicate grading. Timing uses server timestamps; paused sessions
preserve remaining wall or celebration time.

Migration `0013_math_quiz_wall` adds `math_wall_progress`, cascading with the
profile and checking nonnegative best scores. Normalized `best_score` is used
for ranking; remaining session/badge data uses a JSON snapshot, following UFO.
Migration generation is offline. Local integration tests migrate only the
explicitly guarded disposable `plg_test` database.

## Achievement group

All six badges follow the system-wide illustrated medallion style in
`frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`, with
distinct central pictograms for Waddle Wall milestones.
Each has distinct center art and bilingual names/descriptions:

- First Waddle: pass 1 wall.
- Wall Wanderer: pass 10 walls.
- Poolside Pro: pass 50 walls.
- Heart Parade: pass 5 walls consecutively.
- Sunny Thinker: pass 10 medium walls.
- Orange Explorer: pass 5 hard walls.

The dedicated group appears on the kid's existing Badges page. Pause and game
results show only badges newly unlocked during that session and hide the badge
section when none were earned. The server records award IDs at grading time,
preserves them through reload/pause/finish, and clears them on a new game.
Older snapshots without tracking show no known session awards rather than
guessing from lifetime counters. Lifetime badge counters persist. Provenance and prompts
are in [ASSETS.md](../../frontend/public/minigames/math-quiz-wall/ASSETS.md).

## Verification and UAT

Automated checks: frontend tests, app/hosting type checks, Vercel and legacy
compatibility builds, server tests/type check/build, disposable PostgreSQL
integration, and `frontend/tests/browser/math-wall.test.ts`.

Browser fixtures use the real server game rules with intercepted test API
transport. PostgreSQL integration separately covers durable scores and real
friendship filtering. Browser screenshots are stored in
`/tmp/plg-math-wall-browser/` during verification.

Verified on 2026-10-06: frontend tests and app/hosting type checks passed;
both frontend build modes passed; server type check/build and all 187 local
tests passed, including disposable PostgreSQL integration; all four Chromium
game tests passed. Screenshots were visually reviewed for EN/VI setup,
Highland/block and dairy/garden styles, responsive arenas, visible success
heart, surprised splash, and pause/badge views. The running local API reports
ready and `/waddle-wall` loads behind the existing login gate without console
errors. Local `plg_dev` migration was applied through its guarded command;
frontend and API are running on ports 5173 and 10000 for user UAT. The local
API's configured origin allowlist permits frontend port 5173; using port 3001
causes login to fail with `ORIGIN_NOT_ALLOWED` even for a correct password.

The subsequent UI revision was verified with the frontend suite (including
turn-before-waddle, pause/reversal, pond-boundary stop, and success-fade tests),
app/hosting type checks, both build modes, and all four Chromium flows.
Reviewed screenshots confirm the outlined countryballs, vivid colors, rear
and sideways animal poses, pond-border labels, flowers/grass/star celebration
after the wall disappears, and an unobstructed surprised dairy-cow splash
with the wall remaining at the border.

Counting waves now display a prominent "How many stars?" / "Có bao nhiêu
ngôi sao?" heading above the stars, verified in both languages on phone and
landscape screens. The latest first-failure ending rules passed all 189 local
server tests, frontend checks and builds, and all seven Chromium flows.

The final 2D animal revision passed frontend tests, app/hosting type checks,
both build modes, and all seven Chromium flows. Screenshots and accessible
pose assertions verify rear views at rest, separate left/right pieces during
movement, surprised splash sprites, and matching setup thumbnails. The old
animal geometry was removed; atlas pixels were inspected and each cutout's
bounds and foot anchor recorded without altering the generated artwork.

1. Open a kid's playground; confirm Waddle Wall is the fifth card.
2. Confirm Start requires a flag. Try all three buddies and four wall styles.
3. Play in EN and VI; check text, question readability, and flag-only options.
4. Tap lanes and press 1/2/3, including several quick changes. Confirm cute
   waddling and that the selected lane matches the numbered answer.
5. Pass a wall: check the opening and heart animation. Miss a wall: check the
   surprised face, backward fall, splash, and finished prompt with the stopped
   wall number and earned points. No new question appears until Play again.
6. Confirm 10/15/20-second allowances and green/yellow/orange panels. Continue
   through varied difficulty; inspect the gentler follow-up after a harder pass.
7. Pause/resume, finish, replay, and reload. Confirm best score/badges persist
   while a new session starts at zero. Scores remain hidden during live play.
8. Verify rankings with two explicitly befriended kids; pending requests,
   family friendships, and unrelated kids must remain absent.
9. Check phone portrait/landscape and desktop: pool, wall, lanes, and controls
   remain visible. Tab through pause/results and confirm focus stays in dialog.
10. Review the dedicated badge group on the existing Badges page.

Deployment and production migration remain gated by the user's `confirmed`.
