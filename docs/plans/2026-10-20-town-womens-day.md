# Town · Vietnamese Women’s Day

Approved scope: seasonal cosmetic visitors on October 19, 20 and 21 every year,
using the server-supplied saved home-city calendar. Seven cute bouquet-carrying
pastel slimes wander along clear cardinal paths. They emit occasional
petal bursts and separate chubby hearts. Tapping or keyboard-activating a visitor
shows one of sixteen original English/Vietnamese wishes for mothers,
grandmothers, aunts, sisters, teachers and girls. Wishes cycle rather than
repeating one per color, update immediately when language changes, close on
request, and dismiss after eight seconds.

Three of the seven visitors pause at reachable clear sites and plant small flower
clusters. Stable sites beside homes/roads use the Halloween lanterns' minimum
three-tile spacing, capped at sixteen, without importing Halloween event logic.
Up to five balloon bunches/floral garlands hang on placed trees; ambient trees
are the fallback in treeless towns. Their art and placement do not block building
or roads and disappear outside the three-day date window. This decorative
browser world does not change construction or materials. Authenticated visits
and greetings separately record verified achievement progress. The shared server
event host stores a namespaced occurrence/edition record and per-child intro
dates, removing the live record at the end while preserving achievement history;
no SQL migration is needed. A fresh visit starts a new
cosmetic planting session. Reduced motion shows static visitors, hearts and
flowers without movement or particles.

Event lifecycle follows ADR-008, just like Halloween: the explicit server
registry includes `events/womensDay2026.ts`, stable ID `womens-day`, and pinned
edition `2026-v1`. Its immutable policy and home-calendar rules live in
`womensDay2026Model.ts`. The module has no material/harvest capability. Authenticated interactions use
only its two reviewed 2026 achievement counters. The existing garden worker dispatches it under the normal Town
transaction/lease; occurrence lifecycle, intro dismissals and new verified receipts change its revision.

`TownTimedEventLayers.tsx` explicitly registers the matching visual adapter. A
missing server record, mismatched year, expired date or unsupported edition
renders nothing; the calendar alone cannot invent an active event. A later
yearly edition must add its own behavior, policy, art and visual adapter.

Presentation: `womensDayWorld.ts`, `WomensDayCelebration.tsx`, edition atlas
and its README. Shared React/SVG/canvas hearts also replace duplicate Fishing
Friends/Town animal heart shapes. The existing Town animation remains separate;
only its established social heart call delegates to the shared drawing helper.

AGY headless generated both languages. A second generation pass refined awkward
phrasing and localized English kinship terms; reviewed original messages live
as English UI keys plus Vietnamese catalog entries. Raw generation output/logs
remain local under `/tmp`. Built-in ImageGen created the RGBA sprite atlas;
provenance, exact prompt and measured crops accompany production artwork.

Release requires the normal user confirmation. Operator-applied production SQL,
cloud uploads and deployment remain separate from the commit/push handoff.
Follow the private artwork upload/verification procedure when releasing.

Operator SQL: `docs/migrations/neon-womens-day-2026-achievements.sql` installs or
updates the four reviewed achievement definitions, equivalent to the admin
migration button. It needs no schema or Drizzle ledger change and preserves all
child progress. A disposable PostgreSQL test applies it twice, repairs a stale
definition and compares the installed definitions with the server catalog.

Validation: all 460 frontend tests pass, including calendar boundaries, stable
sparse placement, safe routes, blocked-town handling and unreachable planting
sites. App/hosting type checks and both Vercel/compatibility builds pass (existing
chunk-size warnings). The existing Fishing Friends ready-companion greeting
browser regression passes with the shared heart. Dedicated agent-browser checks
cover EN/VI at 1366×768, 1024×768 and 1180×820, open-bubble language switching,
zoom, keyboard activation, editing exclusion, reduced motion and recurring date
boundaries, with no page overflow or browser errors. Evidence remains local.

Event integration validation: the server gate passes (396 tests passed, 22
DB integration tests skipped without a test database). The focused Women’s Day
and Halloween database tests also pass in a disposable local database, including
concurrent greetings, permanent awards, sibling isolation and daily dismissal.
New coverage checks registration, pinned edition/reload,
annual recurrence, cleanup alongside Halloween/unrelated events, unchanged
materials/badges and fail-closed visual adapters. Server build/type checks pass.
UAT was started with `scripts/start-uat.sh`; existing accounts/progress remain.

## Permanent 20/10/2026 keepsakes and daily celebration cards

The named group is **20/10/2026** (`womens-day-2026`). Names remain short;
each description identifies 20/10/2026. All four generated badge pictograms are
text-free universal storybook medallions. Celebration Guest (easy) requires a
Town visit; Flower Hello (easy), Bouquet Buddies (medium), and A Town of Friends
(medium) require greeting 3, 5, and all 7 distinct server-known visitors.

`POST /profiles/:profileId/town/events/womens-day/action` accepts only individual
visit, greet(visitorId), and dismiss-intro commands. Origin/session/ownership
checks and a strict schema reject client counts, years, awards, unknown visitor
IDs and other profile claims. The existing Town row lock plus atomic event host
record one visit and one receipt per distinct visitor in the 2026 occurrence.
Retries, reloads and parallel API processes cannot duplicate progress or change
earned timestamps. A later year cannot earn these 2026 badges. Cleanup preserves
yearly history and earned badges. The authenticated admin migration button uses
only server definitions; repeated runs preserve child data. The complete group
appears in Town/universal collections and shared Parent/Admin report projection.

Seven production slime sprites now have two eyes only (no nose/mouth), distinct
colors/head accessories, and a visible maximum dimension of .78 tile, matching
chickens. Their invisible tap targets remain at least 44px. Movement and planting
are decorative. New art and source windows are in `womensDayArt.ts` and the asset
README; old atlas cells supply only flower/balloon/garland props.

AGY headless supplied the bilingual celebration-card copy: October 19 arrival
and preparations, October 20 celebration, October 21 farewell. Cards are centered
in the viewport. Dismissals live under the individual child's event record as
bounded home-calendar dates, not a family flag or a device date. A sibling gets
their own daily card. The icon-only View card control beside Back reopens the
current day's dismissed card; the event adapter hides it on October 22. The Town
brand is centered independently of unequal navigation controls. Raw AGY output,
browser screenshots and database-test logs remain local.

The focused browser regression passes all six viewport/language cases. It checks
all three daily cards, dismissal/reload/replay, centered layout, seven distinct
greetings, the October 22 visibility boundary, kid/Parent/Admin badge collections
and repeated admin catalog migration without changing earned progress.
