# Xmas 2026 snow sculptures, wool as an animal product, and the vegetable shop trade

Status: design agreed through numbered brainstorming (2026-11-03). Branch:
`feat/xmas-snow-sculptures`. Follow ADR-008 (timed events), the Halloween lantern pattern in
`server/src/town-building/AGENTS.md`, and the repository rules for achievements, art,
viewport sizes, resource feedback, and parent/admin reporting.

## 1. Event

- Timed event `xmas`, edition `2026-v1`, selected by the home-city calendar from **Dec 20 to
  Jan 6** (spans the new year; occurrence identity is the starting year, `2026`). Unknown
  clocks, previews and appearance overrides never start it.
- Sculptures are built through the common land construction on every map (Town and Lake),
  inside the revision/ownership transaction, using the event window as the lantern does.
- When the event ends, sculptures **melt**: removed by the shared map tick with a durable
  revision, no refund, no receipts. Cap: **100** installed per child (all maps combined).
- Event history keeps per-year counts and per-type counts after cleanup (like Halloween).

## 2. Sculptures (all 1x1, four hand-drawn facings, rotatable)

Every sculpture also costs **5 stamina** (stamina overflow is a known problem). Paid costs are
stored per building (`paidCost`) for move/transfer, like other buildings; moving is free as
for other 1x1 decorations unless the blueprint says otherwise.

| Sculpture | Materials / crops / animal products |
| --- | --- |
| Snowman | 2 wood, 1 carrot |
| Snow rabbit | 1 tomato, 1 wool |
| Snow owl | 2 wool |
| Snow penguin | 1 fish, 1 yarn |
| Snow fox | 1 pumpkin, 1 yarn |
| Snow lamb | 2 wool, 1 corn |
| Snow duckling | 1 wood, 1 peas |
| Snow bear | 3 rock, 1 yarn |
| Snow tree | 2 wood, 1 yarn |
| Snow angel | 1 wool, 1 yarn |

- Crops need not be in season: kids use stored crops or buy them at the vegetable shop.
- No milk or eggs in any cost. Costs are validated and debited server-side in one
  transaction; stored crops, wool, yarn and fish come from the shared Town storage.
- Behavior: tapping a sculpture shows a small sparkle; nearby animals pause and look at it;
  resident NPCs show a heart above their head briefly. Cosmetic only (no rewards, no
  revision bumps, no client-supplied state).
- No extra Xmas scenery in this release (sculptures and the existing winter snow only).

## 3. Wool becomes an animal product

- Wool is no longer a building material or part of the materials bar. It is a stored item
  with the shared item limit (10 base, `1000 + 2000*(storages-1)`), included in storage,
  the barn collection, and the harvest-all "animal products" category.
- Buildings that used wool in their cost (large house 4, infirmary 6, library 8) **keep their
  wool cost, paid from the animal-product storage**.
- One-time idempotent normalization of saved Town JSON: any legacy `materials.wool` balance
  moves into stored wool, **clamped to the current item limit; the excess is lost**
  (user-approved). Marked in state so it never repeats and never re-grants.
- Yarn remains its own non-spoiling item. Existing wool material code paths (barn
  collection, costs, achievements that count wool) must be updated and tested.

## 4. Vegetable shop trade

- The vegetable shop becomes an interactive trading counter (always on, not event-only).
- A child chooses a vegetable (any of the 8 crops, always available), and pays with animal
  products: wool, yarn, fish, eggs, milk (**not** building materials).
- Hidden values (never displayed as money): wool 3, yarn 5, fish 4, egg 1, milk 2.
  Vegetable price: 4 in season; **out of season +50% rounded up (6)**.
- The server picks the cheapest combination of the child's animal products and shows it
  before confirming. Any leftover value from rounding is lost (the picked combination is
  chosen to minimize it). The purchase is blocked with a friendly message when storage for
  that vegetable is full.
- Server-owned: price, season, selection and debits are computed on the server in one
  revision-checked transaction; the browser sends only the vegetable and quantity.
- Result uses the resource-collection feedback rules (material art, large `+N`, fly to
  storage via `TownRewardBar`).

## 5. Achievements (group `xmas-2026`, server-verified, universal badge art)

- **Snowy Friends** (easy): build your first snow sculpture.
- **Snow Parade** (medium): build all 10 different sculpture types in one event.
- **Winter Wonderland** (hard): have 20 or more sculptures at once, at least once in one event.
- Per-type: **Snowman Army** (20 snowmen, hard), **Rabbit Warren** (15 snow rabbits,
  medium-hard), **Owl Parliament** (12 snow owls, medium), **Penguin Colony** (10 snow
  penguins, medium). Counts are per-event-year installed receipts, deduplicated.
- Included in kid, Parent and Admin reports via the shared projection and the existing
  admin catalog migration (idempotent; preserves earned badges).

## 6. Art (generated with agy, storybook style)

- One sprite sheet per sculpture, four facings (still), transparent background, same
  linework/palette/detail as the existing Town art. Badge art follows
  `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`.
- Recorded prompts live next to the art, like the Halloween art directory.

## 7. Test kit "Preview Xmas"

- Added to the Test appearance controls. Cosmetic snowy look plus sculpture blueprints
  buildable in preview. Per the Town guide this is admin-only, `NODE_ENV=test` and
  `TOWN_ENVIRONMENT_PREVIEW_ENABLED=true`; building in preview writes real sculptures
  (clearly labeled). Preview alone never grants the event window to non-admins.

## 8. Delivery plan (phases on this branch)

1. Wool as an animal product + storage/cost normalization + migration of saved wool.
   Implemented locally (2026-11-02); awaiting caller DB/browser verification and confirmation.
   Marker: root `woolMigrated:true`; first settle transfers legacy wool, clamps to
   all-map itemLimit and deletes materials.wool. Later settles delete stray legacy
   wool without granting it again. No SQL migration.
2. Vegetable shop trade — server implemented locally (2026-11-03); the frontend
   trade UI now lives inside the vegetable-shop civic interior. The approved rack
   artwork is an overlay with eight measured crop slots and crop-growth art;
   landscape uses an interior/rack two-column layout and portrait stacks them.
   Quote, payment, receipt, reward-flight, season, storage, stale and reduced-motion
   behavior remain server-authoritative and are exercised by the Town harness flow.
   Contract and sandbox validation below; no SQL migration.
3. Xmas event host, sculpture blueprints/building/melt, reactions, achievements, reports.
4. Art via agy, Preview Xmas, localized strings (EN/VI), viewport checks.

Each phase keeps the stack runnable and passes the standard gates. No SQL migration
expected (Town JSON state); confirm per phase.


## Phase 2 server contract (2026-11-03)

Always available on Town and Lake, independent of shop opening hours and events.
All eight `garden.ts` crops are available. Both maps use one shared implementation.
Owner authentication/authorization applies to every request; visits and appearance
previews provide no separate trade capability. The frontend uses the contract only
inside the owner's vegetable-shop interior; no report or visit projection changes.

### Quote

GET `/api/v1/profiles/:profileId/town/shop/quote` or
`/api/v1/profiles/:profileId/town/maps/lake/shop/quote` with query
`entityId=<vegetable-shop entity ID>&crop=carrot&quantity=1`.
Strict parameters; quantity 1–10. Owner-only and no-store. Pure SELECT/projection:
no Town initialization, save, revision bump, resource award or migration write.

Import browser-safe types from `server/src/town-building/shopTypes.ts`:

```ts
type ShopItem = 'wool' | 'yarn' | 'milk' | 'P1' | 'P3' | 'P4' | 'P5' | 'R4';
interface ShopProduct { item: ShopItem; amount: number }
interface ShopQuoteInput { entityId: string; crop: CropId; quantity: number }
interface ShopQuote extends ShopQuoteInput {
  revision: number;
  inSeason: boolean;
  units: number; // hidden total price: NEVER render as money
  payment: ShopProduct[];
  affordable: boolean;
  storageRoom: boolean;
  confirmation: string; // SHA-256 opaque comparison token (64 lowercase hex)
}
interface ShopTradeCommand extends ShopQuoteInput {
  type: 'shop-trade';
  confirmation: string;
}
interface ShopReceipt {
  id: string;
  revision: number;
  mapId: 'town' | 'lake';
  crop: CropId;
  amount: number;
  spent: ShopProduct[];
  reward: { crop: CropId; amount: number };
  duplicate: boolean;
}
```

Quote token binds profile, map, entity, crop, quantity, revision and computed quote
outputs. It authorizes no products itself. Unaffordable quotes have `payment:[]`.
The client uses the quote's revision when confirming and displays actual payment
products, never hidden units. All quantities/values are recomputed by the server.

### Confirm and retry

POST the map's existing `/action` endpoint with
`{revision,command:{type:'shop-trade',entityId,crop,quantity,confirmation}}`.
This is a **top-level action on both maps**; the Lake does not wrap it in
`land-action`. Strict Zod rejects payment/price/value/product/map/preview fields.
Response: the existing map Town payload plus `shopReceipt: ShopReceipt`.
The receipt's crop ID resolves existing vegetable artwork; the later frontend
adapter must drive TownRewardBar with its `reward.amount`, scene and receipt ID,
only for newly committed responses (`duplicate:false`). Do not replay initial
reads, retries or failed trades.

Under the shared profile serialization/row lock, re-read storage, remove spoilage
on a copy, recompute the quote and validate confirmation. Credit the entire crop
quantity via `storeCrop`, debit exactly the chosen stored products, save once at
revision +1. Dedicated shop transaction uses common lock/save helpers and avoids
unrelated milestone/normalization writes on refusals. Garden lease progress is
preserved for a successful action. No harvest counters, raft stock, stamina,
achievement awards or Parent/Admin report projections are changed.

HTTP 409 errors use the existing `{error:{code,message,...}}` envelope:

- `TOWN_STALE`: revision differs (after checking retained retry receipts).
- `SHOP_NOT_FOUND`: entity is absent, another map's entity, or not vegetable-shop.
- `SHOP_QUOTE_CHANGED`: same revision but the recomputed confirmation differs
  (e.g. season, spoilage, payment or available room changed).
- `SHOP_NOT_AFFORDABLE`: matching quote cannot be paid.
- `SHOP_STORAGE_FULL`: matching quote cannot store **all** vegetables.

All refusals roll back with no write. Invalid command/query fields return 422;
existing authentication/ownership checks retain 401/404 behavior. Last 32 committed
receipts are saved in private Town JSON `shopReceipts`; exact retries return the
original stable `shop:<mapId>:<crop>:<revision>` ID and `duplicate:true` without
another debit, crop credit, revision or save. Beyond the retained window retries
are stale. Ledger is stripped from owner responses and never included in visits.

### Payable stock and selection

Wool (`storage.wool`, value 3), yarn (`storage.yarn`, 5), milk batches (2),
and Lake reserve fish by species (4). Fish in homes/nurseries, uncollected barn
products, building materials and stamina cannot pay. **Eggs excluded**: poultry
harvest credits stamina and friend takeaway-raft entries; no storable/spendable
egg stock exists. Egg value 1 remains reserved in the server value table only.

Prices reuse `cropMayGrow` with live `environment.peek` home-city calendar,
including its reviewed event crop eligibility. Known eligible season costs 4;
otherwise 6, including unknown clocks. Appearance preview state is never passed
as a live season. Quantity 1–10 caps total at 60. DP considers totals through
price+4, caps considered stock per item, minimizes overpayment first, then item
count, then lexicographically oldest perishable units (milk/fish globally) before
non-spoiling stock. Equal timestamps break by stable item ID. Shared storage
consumption debits oldest batches. Leftover paid value is lost, no change/credit.
Storage limits count Town Storage buildings across all maps. No SQL migration.

### Verification

Tests added: `server/tests/town-shop.test.ts` covers pure prices/selection,
exhaustive small product combinations, quantity 10, spoilage/oldest debits,
read-only quotes, strict schemas, owner/map isolation, success/refusals/retries,
private bounded receipts and repository no-write boundaries.
`server/tests/db/town-shop.test.ts` adds guarded PostgreSQL cross-repository
concurrent duplicates, row-version read-only/retry checks and refusal rollback;
not executed in the sandbox, included in server typecheck/build.

Sandbox validation (2026-11-03): server typecheck and build passed (including DB
test source). Focused Town suite passed 45/45 files; existing Parent/Admin report
regression file also passed. The new shop file has 13 passing test cases.
Frontend hosting typecheck passed. Full frontend suite passed 181/182 files,
including `runtime-server-import-graph.test.ts`; the existing
`explore-performance-report.test.ts` fails because `spawnSync /usr/bin/node`
is denied with `EPERM` in this sandbox (confirmed by direct execution).
No database tests, full DB-backed suites or browser scripts run here; caller
verification remains required. No SQL/cloud resources, commits, pushes, stashes,
resets or excluded files changed by phase 2. Shared-path self-review traced Town
and Lake adapters through the common quote/payment/trade/storage implementation
and private receipt redaction; no duplicate map-specific economy introduced.
