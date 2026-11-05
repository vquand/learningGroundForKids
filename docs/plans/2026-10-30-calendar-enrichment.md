# Calendar item enrichment

Approved direction, 2026-10-30. Implement on
`feature/calendar-items-and-favorites`; no commit, push, merge or cloud writes
until the user says `confirmed`.

## Behavior

1. Keep the existing 42 meal icons and add 36 icons in three additional sheets.
   Include fish preparations, common Vietnamese vegetables, and raw/plated/
   pot-cooked/grilled/rotisserie meat and poultry. Offer generic greens and
   separate rau cải, cải thìa and cải thảo choices.
2. Favorite creation is icon selection, editable default name, then explicit
   "Mark as favorite". Choosing a tile alone saves nothing. Preserve typed names
   on icon changes and localize unedited defaults. Provide food category filters
   and accent-insensitive English/Vietnamese search.
3. Add custom study subjects using existing subject/PE/club icons. Store each
   child's favorites on the server. Favorite name/icon edits and removals never
   rewrite already scheduled entries. Do not add a copy action.
4. Custom entries use a subtle lilac border, without a label.
5. Calendar Study, Meals and Events allow direct name edits. A rename applies
   from the selected occurrence, including a past day in the displayed week,
   only to that entry's repeating series. Tuesday Math never renames Wednesday
   Math or another independently scheduled Math entry. Preserve earlier names.
   A common item becomes a named personal version with its existing icon; the
   shared catalog is unchanged. A date-only entry changes once.
6. Keep kid-created events as history. Permit past one-time records in the
   displayed current week with no reminders. New repeating events start today
   or later. Universal system events stay computed and read-only.

## Storage and concurrency

Migration 0034 adds `calendar_study_library` and event name versions. JSON list
items support optional custom study names and series identifiers. The explicit
rename route checks the effective-list and template revisions under the profile
advisory lock, preserves earlier occurrences, and updates only the selected
weekday/area/entry. Event versions preserve the recurrence anchor and are
projected consistently into calendar reads and notifications. All routes remain
same-origin, authenticated and profile-owned. Plain text names remain bounded.

## Artwork prompt set

Built-in image generation, `illustration-story`, using
`frontend/public/calendar/UNIVERSAL_CALENDAR_ICON_PROMPT.md`: thick navy outlines,
flat storybook pictograms, no text or frames, 4 columns by 3 rows per raw sheet,
flat magenta extraction matte. Existing artwork is preserved as part 1.

- Part 2: plated fish fillet, grilled fish, canned fish, fish soup, tomato,
  potato, cabbage, carrot, radish, water spinach, Malabar spinach, mustard greens.
- Part 3: bok choy, napa cabbage, raw beef, plated beef, beef stew, grilled beef,
  raw pork, plated pork, braised pork, grilled pork, rotisserie pork, raw poultry.
- Part 4: plated poultry, poultry soup, rotisserie poultry, cooked shrimp,
  steamed fish, fried fish, raw fish fillet, steamed carrot, stir-fried water
  spinach, Malabar spinach soup, boiled cabbage, grilled pork ribs.

Production assets live in `frontend/public/calendar/icons/meals/`; labels live
in the bilingual catalog and icon manifest. Raw sheets and QA are ignored.

## Verification

- Unit and route suites for catalog parity, bounded names, past record rules,
  matching notification names, accent-insensitive search, and explicit favorites.
- Dedicated local PostgreSQL tests for weekday/area/profile isolation, revisions,
  historical names, one-time overrides, library edits, and retained event history.
- Browser flows at 1366×768, 1024×768 and 1180×820; inspect control bounds,
  scrolling, keyboard/focus, screenshots, console, errors, and network responses.
- Frontend and server baseline test, typecheck and build gates. Keep all generated
  verification output under `/tmp` or ignored output directories.

## Validation so far

Frontend: 788 passing tests. Server: 718 passing, 63 database tests skipped
without a configured test URL. A separate guarded local PostgreSQL run passes
all 23 calendar database checks, with no skipped tests. Frontend/server type
checks and Vercel, compatibility and server builds pass. Existing bundle-size
warnings remain. Cesium runtime directories are present. Browser verification
uses a separate local test family; generated evidence remains local.

Browser: verified explicit subject/meal favorite creation, saved Study/Meals
renames, past-event creation and correction, disabled past repeat options, and
absence of historical one-offs from the reminder response. Dialog control bounds
and internal/page scrolling pass at 1366×768, 1024×768 and 1180×820. Reviewed
screenshots; no browser JavaScript errors. Calendar saves return 200/201.

Full eight-entry Study editor: all actions fit without internal or page scrolling
at the three required landscape sizes. The final launcher reuses the healthy
local stack and preserves existing local accounts/progress.

Final screenshot review caught the eighth meal row clipped by a hidden list
overflow. Meal/event overlays now portal outside the animated week (whose CSS
transform had shortened their fixed positioning area). Medicine controls move
to the palette, and 46px fixed meal rows preserve 44px controls without flex
shrink. Retest with ancestor clipping checks, not viewport bounds alone.

Clipping retest after the fix: all eight meal entries, rename/remove controls and
footer actions are visible at 1366×768, 1024×768 and 1180×820. The overlay starts
at the correct 63px header boundary; clipping-ancestor checks report no clipped
controls. Reviewed the corrected screenshots. Frontend suite remains 788/788.

Event overlay clipping retest also passes all three target sizes, including the
locked-date historical editor. Final screenshots reviewed; no JavaScript page
errors. The isolated verification browser is closed; UAT remains available at
http://localhost:5173. No commits, pushes, merges or production writes performed.

## UAT correction: editing study drafts

Removed the Study save-before-rename guard. Existing and newly added subjects
remain editable after additions/removal/reordering. New names stay in the draft;
existing series renames keep unsaved additions, preserve server positions and
refresh revisions before the final plan save. Browser reproduced saved Math +
new Vietnamese and renamed both successfully. Frontend: 789 tests pass; type
checks and both builds pass.

## Additional meal choices and notice

Added Sausage (Xúc xích), Fast food (Đồ ăn nhanh), and Vegetable soup
(Canh rau củ), bringing the meal catalog to 81 icons. Part 5 uses the shared
calendar prompt for a sausage plate and generic vegetable soup. The fast-food
icon is replaced by a standalone red takeaway bag with large cream FF letters,
with no visible food or restaurant branding, per the user's explicit text exception.
Built-in image generation; production files are sausage.webp, fast_food.webp
and vegetable_soup.webp under frontend/public/calendar/icons/meals/.

The amber, non-blocking notice says: Fast food can be high in salt, sugar and
unhealthy fats. Enjoy it occasionally. It follows the selected fast-food icon
even when renamed, and clears when it is removed or another icon is chosen.
No nutrition totals or actual consumption are inferred. Wording is grounded in
NIDDK guidance: https://www.niddk.nih.gov/health-information/weight-management/healthy-eating-physical-activity-for-life/helping-your-child-tips-for-parents

Checks: 791 frontend tests pass; server suite passes (718, with 63 DB tests
skipped without a configured test URL). Frontend/server type checks and both
frontend builds plus server build pass.

Browser validation: generic FF bag inspected in the picker; highlighted notice
shows on Fast food selection, clears on Sausage selection, and remains visible
in a full eight-entry meal. Both dialogs fit 1366×768, 1024×768 and 1180×820
with no clipped controls. No page JavaScript errors; icon asset QA passes.

## UAT correction: subject row controls

Study order rows now use 48px tracks and rows, leaving space for 44px controls
plus padding/borders. Previously 44px tracks forced the controls outside the
row border and into the next row. Browser checked every button against its own
row on a full eight-entry list at 1024×768, 1366×768 and 1180×820: no overflow,
all targets at least 44px. Screenshot reviewed, no JS errors. Frontend tests
791/791, type checks and both builds pass.

## UAT correction: larger iPad meal icons

Touch devices and viewports up to 1180px now use at most two meal icons per
row, sized from the available cell width/height up to 64px. Overflow reserves
one tile for +N; the dedicated Medicine row stays compact. The same measured
size drives both rendering and capacity calculations. Browser verified 49px
icons at 1024×768, 59px at 1180×820, two columns in portrait too, no clipped
tiles, accurate +5 for eight-item cells, and access to all eight via the cell.
Laptop non-touch rendering stays compact. Frontend: 793 passing tests; type
checks and both builds pass.

## Neon SQL Editor handoff

Use `docs/migrations/neon-0034-calendar-custom-items.sql` for operator-applied
migration 0034. It requires the exact 0033 ledger entry and applies the canonical
SQL plus its Drizzle hash/timestamp in one transaction. A repeated matching run
does nothing. Do not run concurrently with another migrator.

Disposable local PostgreSQL validation passed: fresh apply, repeat no-op,
existing event preservation with an empty name history, custom subject insert,
hash mismatch rejection and missing prerequisite rejection. The seven migration
metadata tests pass. No production database was accessed.
