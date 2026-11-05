# Friend town visits

## Scope and acceptance

- Add a Visit friends button immediately right of Back to Playground in Town.
- Open a centered, keyboard-accessible dialog. Each row contains the child's
  avatar and name, saved town name, existing prosperity-stage artwork, and Visit.
- Sort by most recent server-recorded activity, then child name and ID. Activity
  timestamps stay out of the UI. Page long lists within the viewport.
- Only accepted friendships qualify. Honor both participants' profile/family
  scopes in both directions, including new children in family-scoped friendships.
- Visits show the friend's saved Town with pan/zoom and a return to own Town.
- During visits use a different navbar background, place the child's name to
  the left of the saved Town name, keep the picker button available, and add
  Back to my town inside that same dialog.
  No editing, harvest, help, greetings or simulation ticks. Only the explicit river gift, pickup and visit-audit endpoints may write during visits.
- Recheck viewer ownership and current friendship for list, visit and uploaded
  avatar reads. Return only display data, never balances, learned IDs, awards,
  birth/home-location information or authentication data. Unknown/revoked targets
  return the same 404. All visit responses are private and no-store.
- Preserve own-Town behavior and current achievement groups. River sharing extends
  Town and Fishing; it introduces no new achievement group or dependencies.

## Implementation

React/Vite frontend, Hono API and existing PostgreSQL tables. Add an isolated
`server/src/town-building/visits.ts` repository with shared SQL authorization;
register same-origin GET routes under the viewer's owned Town. Keep contracts
typed and use existing error envelopes, for example
`throw new AppError(404, 'FRIEND_TOWN_NOT_FOUND', 'This town is not available.');`.
Use the existing Town scene, ProfileAvatar and prosperity art in separate picker
and read-only visitor components. Scope queries to session, viewer and target.
Translate authored UI into Vietnamese; preserve saved names.

## Ordered work and verification

1. Test scoped friendship visibility, ordering, redacted projections, read-only
   behavior and revocation against a guarded disposable database; implement API.
2. Test same-origin API clients and cache cleanup; build picker and visitor view.
3. Verify dialog, pagination, visit/return, errors, loading and both languages
   using headless agent-browser at 1366×768, 1024×768 and 1180×820.

Required commands: `npm test --prefix frontend`,
`npm run typecheck:hosting --prefix frontend`, `npm run typecheck --prefix frontend`,
`npm run build --prefix frontend -- --mode vercel`, `npm run build --prefix frontend`,
`npm test --prefix server`, `npm run typecheck --prefix server`,
`npm run build --prefix server`. Database tests use a separate guarded local test
database; browser evidence stays under `/tmp` or ignored test output.

## Validation

## River basket extension

The user selected friendly surprises: a fixed basket on the river, three sender
decoration presets (flowers, balloons, waving gnome), and ten preset messages.
The recipient opens gifts on a later Town visit; each delivered basket and its visible contents last
five days from delivery, whether opened or not. Gifts are free and cosmetic, never inventory, construction, learning
progress or achievement claims. Limit one unopened gift and one delivery per
rolling 24 hours for each directed friendship pair; cap pending baskets at 50.

Add an isolated gift receipt table and strictly validated send/open endpoints.
Recheck both friendship scopes and owner permissions for every operation;
serialize recipient deliveries, deduplicate request UUIDs, and never refresh an
gift's delivery-based expiry on retries. Keep sender/recipient Town revisions,
materials and garden leases unchanged. Private owner inbox and visitor sending
capabilities are separate; other visitors cannot read unopened messages.

The river basket and the first three delivered baskets share one fixed world
anchor and follow Town camera/zoom. Hide interaction while editing or another
Town panel blocks it. A centered composer contains three decoration choices and
ten message choices; owner inbox/reveal dialogs fit all required landscapes.
Respect reduced motion. Use generated transparent artwork through the private
artwork catalog. No production migration or cloud upload on this branch.

Verification adds server preset, authorization, retry/concurrency/cooldown,
revocation and expiry tests against the guarded local database, plus actual
browser send/open/reload and EN/VI viewport flows. Keep source tests, assets,
migration/handoff and this authored design versioned; evidence remains local.

## Visit validation

- Frontend suite: 472 tests passed; both frontend typechecks passed.
- Server suite: 464 tests passed with the guarded local test database enabled.
  Includes friendship scope/direction matrices, pagination/activity ordering,
  viewer ownership, revocation, custom-avatar media authorization, external URL
  fallback and unchanged stored Town rows.
- Vercel, compatibility and server builds passed. Existing large-chunk warnings
  remain in the frontend build.
- Headless agent-browser verified own Town, centered six-row picker, pagination,
  visit, another friend's Town, return, empty/error/revoked states, navbar color,
  owner/name order and 48px dialog controls. English and Vietnamese flows fit
  1366×768, 1024×768 and 1180×820 without page scrolling. Visitor interactions
  originally made no POST requests; the river extension adds an explicit arrival audit. Screenshots remain local under `/tmp`.
- Migrations 0028/0029 were applied only to local development/test databases.
  No production migration, cloud change, commit or push was performed.

## Sharing raft and return report

- A separate fixed raft unlocks permanently after 50 new verified fish catches
  after deployment. No historical backfill; turtles and garbage do not count.
- New fish catches and committed vegetable harvests stock at most ten uncollected
  items per Town. Only today/yesterday stock is eligible; discard expired stock
  on subsequent source/pickup writes. Full rafts drop overflow without blocking
  normal rewards. Existing direct activity rewards remain unchanged.
- Each picker may take 30 items per UTC day across all friends. Split each item's
  existing stamina value independently: ceil(30%) picker, ceil(70%) provider.
  A vegetable worth two gives one and two. Lock friendship, picker quota, Town
  rows in consistent order, and stock; persist unique reward receipts in the
  same transaction. Expiring stock must not erase quota or reporting history.
- Record visits, delivered gifts and pickups as server-owned owner-private
  events, including display snapshots. On returning to own Town, atomically
  advance a per-owner arrival watermark and save a report of new events. Retry
  the same arrival nonce safely; quiet arrivals do not reopen old popups.
- Show a centered return popup when new events exist, including visits without
  gifts, decoration icons, exact item kinds/counts and provider stamina. The raft
  reopens the most recent report. Separate paginated item details avoid truncation.
- The raft's River diary tab displays seven UTC days of server-derived earned
  stamina, items given away and visits, with two crayon-style charts and generated
  storybook icons. Transaction history remains separate from perishable stock.
- Use the shared TownRewardBar only for newly committed picker rewards; initial
  reads, retries and return reports never animate or credit rewards again.
- Migrations 0028/0029 and matching idempotent operator handoffs are versioned;
  never run handoffs against production from this branch. Art prompts/provenance
  accompany the two generated transparent atlases in friend-baskets/README.md.

River browser verification passed send/open/reload, all three decoration and ten
message choices, pickup reward flight, owner auto-report and manual review,
item details, charts, locked/quota states and English/Vietnamese layouts at
1366×768, 1024×768 and 1180×820. Screenshots remain under /tmp.

## Final verification

- Frontend full suite: 476 passed; server full suite with guarded local test
  database: 474 passed, zero skipped. Final focused river route/database and
  canonical migration-handoff checks: 8 passed.
- Both frontend typechecks, server typecheck/build, and Vercel/compatibility
  frontend builds passed. Existing frontend bundle-size warnings remain.
- Both isolated headless agent-browser flows passed: friend Town navigation
  and river gifting/sharing/report/diary, including EN/VI and all three required
  landscapes. Dialog controls fit and meet 48px height; screenshots stay local.

## Basket display revision

Delivered gifts immediately show their selected generated decoration inside an
individual open basket. A different eligible visitor sees a fresh empty basket
beside existing gifts. Show the first three deliveries clearly; any overflow
uses one fixed three-silhouette group, identical regardless of overflow count.
All unopened gifts remain available through the paginated basket list.
Every delivered basket expires five days after delivery; opening/retries never
renew the timer. The separate per-friend sending cooldown remains 24 hours.
Expired pending gifts stop blocking new deliveries; durable event receipts
prevent old request IDs from resurrecting discarded contents. No schema change.

Revision verification: guarded basket tests passed immediate contents, another
friend's empty-basket capability, opened/unopened five-day expiry, cooldown and
retry protection. Agent-browser checked identical silhouettes for four and many
baskets at all three required landscape sizes, alongside the complete river flow.

## Grouped raft inventory and batch pickup

Owner stock groups identical item kinds/species into one row with an ×quantity;
no stamina amounts appear in stock. Friend-town rows use spacing without dash
separator characters. Visiting children see grouped inventory tiles with corner
stock quantities. Each tap selects one physical item, up to five in total and
within the remaining daily quota. Tiles only add items; the side basket shows selected icons/quantities with
one-item minus controls.

One Pick up action submits the selected server item IDs and a request UUID.
The server validates unique IDs (one to five), current friendship, fresh stock,
unlock and the complete quota before any pickup. One transaction locks stock,
credits each item's independently rounded shares, records each item in the
owner's report and persists a durable batch receipt. Retries and reordered IDs
do not re-credit; changed batches under the same nonce fail. Unavailable items
roll back the whole selection. Receipts survive perishable stock cleanup.
The existing single-item payload remains supported; no schema change is needed.

Verification: 476 frontend and 478 server tests passed, with guarded database
coverage for five-item splitting, all-or-nothing failure, retries and durable
report totals. All typechecks/builds passed. Isolated agent-browser checks
verified grouped quantities, repeated taps, removal from tiles and basket,
the five-item cap, batch receipt animation, owner report and EN/VI landscape
layouts. Friend-town navigation/layout regression also passed.
