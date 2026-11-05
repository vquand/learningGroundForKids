# Playground interface and game polish

Requested by the user on 2026-10-14. Branch:
`feature/playground-ui-and-game-polish`. The local UAT setup was committed
separately as `da2b0a4`. No cloud deployment or production data change is part
of this work.

## Interface findings and shared treatment

- Return actions varied between plain links, icon-only arrows, pills, and full
  buttons, with different case, fonts, colors, height and placement. Use one
  KidBackButton, always first in the header. Keep destination-aware kitchen/
  profile labels, and use Back to Playground for playground returns.
- Header actions had different heights and sometimes lacked backgrounds.
  Use 48px secondary controls centered in a shared 64px header. Reserve the
  global language slot. Keep recognizable game artwork and independent game
  content-language settings.
- Primary actions used inconsistent color and shape. Share a cream/brown
  secondary treatment and readable sage-green primary treatment. Questions,
  answers, instructions and return labels receive larger type without shrinking
  the required touch targets or hiding controls below the viewport.
- Verify setup, gameplay and relevant modal/results flows at 1366×768,
  1024×768 and 1180×820, including bounds, hit testing and page overflow.

## Connected roads

Selected roads retain single-tile removal and add connected-road removal.
Include branches and loops connected by an edge; stop at gaps, diagonal-only
contact and different road types. Send only a target entity ID through the
existing owned, authenticated town action route. The server computes the set
from saved state, validates revision and removes all tiles atomically, without
refunds or changes to buildings/earned badges. No schema migration is needed.

## Grilling

Add one matching transparent six-view warming atlas using the raw and golden
references. Crossfade by fractional turns through two visual thresholds while
preserving golden readiness and burn grading. Enlarge the brush and show a
4.2-second Z stroke. Keep Done seasoning disabled during brushing, and support
reduced motion and interrupted animations. Record generation provenance and
the exact prompt in the grill asset guide.

## Suggested age badges

Use small age badges beside activity titles: Miniku 4+, Waddle Wall 5+ (the
existing game design starts with counting and is aimed at ages 5–8), Explore,
Town, Kitchen and InfiniDrill 6+, and Shoo Shoo UFO 7+. These are starting-age
suggestions based on reading/counting demands, with grown-up help encouraged
for younger players. They do not restrict access or claim developmental
validation. Non-game avatar and badge-management cards receive no age badge.

## Verification completed

- Frontend unit suite, app and hosting TypeScript checks, Vercel build and Sites
  compatibility build pass. Builds retain the existing large-chunk warning.
- The guarded local API/database suite passes 278 tests, with none skipped.
  Connected-road tests cover branches/loops, diagonal and other-type boundaries,
  ownership, forged payloads, stale retries, concurrency and unchanged materials
  and earned achievements.
- Real Chromium flows cover Town, Miniku, Waddle Wall, InfiniDrill, UFO, Burger
  and grilling at the required laptop/iPad landscape viewports. Bounds, controls,
  hit testing and scrolling checks pass, including kitchen selection, setup,
  play, relevant pause/results, failure and replay states. These are viewport
  simulations, not physical iPad/Safari testing. Temporary visual evidence is
  saved under `/tmp/plg-town-browser`, `/tmp/plg-infinidrill-browser`,
  `/tmp/plg-burger-*`, `/tmp/plg-ufo-*` and `/tmp/polish-*`.
- Grilling tests observe the intermediate sprite before golden readiness,
  prevent continuation during the 4.2-second brush stroke, recover canceled
  animations and finish promptly under reduced motion.
- Startup/import guards pass their tests. The final `scripts/start-uat.sh` run
  reused the healthy 5173/10000 stack and retained restored user records. The
  user confirmed login works again after adopting the original local database.
- Catalog triage and its local update are documented separately in
  `2026-10-14-catalog-publication-review.md`. Both feature sets remain on this
  branch for review. The user tested and confirmed UAT on 2026-10-14 and
  authorized committing and pushing the feature branch.

## Follow-up refinements

- The frontend Docker target now includes the shared server source tree, also
  mounted read-only for live development. Startup probes compile the shared-module
  entry points, so an HTML-only response cannot hide a Vite import failure.
  The actual 5173 container passes a read-only browser smoke flow through
  Playground, Town, InfiniDrill, Cooking and Drinks.
- Both sign-in and the family landing page use eight new seasonal/event pastel
  illustrations and a matching transparent baby rice explorer mascot. Original
  Đông Hồ artwork is preserved byte-for-byte in
  `docs/art-backups/dong-ho-2026-10-14/`, with a SHA256 manifest. Exact generation
  prompts are in the seasonal asset guide; the seasonal calendar is unchanged.
- The child's background portrait moves down and left so its rotated chin
  reaches the corner. Browser screenshots include the requested lavender bunny
  at laptop, iPad landscape and phone sizes.
- Parent report icons and child Playground icons now share ActivityIcon;
  cooking, drinks and burgers share their child-facing Kitchen identity.
  Comparison tests cover every parent game that has a Playground counterpart.
  The parent menu's left accent and stat cards' top accent are removed; current
  navigation remains highlighted by background and text color.
- Playground's child header and Parent Space's children/dashboard lists display
  the server-issued `public_id` friend code with a shared copy control. Clipboard
  success/failure is announced and localized; unavailable legacy codes are
  omitted rather than replaced with internal IDs. Parent copy buttons are
  siblings of report links, so copying cannot navigate into the report.
  Browser checks cover exact copied values, independent children, keyboard use,
  Vietnamese copy, denied clipboard access and missing legacy codes.
