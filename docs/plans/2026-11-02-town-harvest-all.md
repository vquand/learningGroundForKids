# Town "Harvest all" buttons and icon-based map overview

Status: approved design (numbered brainstorming answers, 2026-11-02). Branch:
`feat/town-harvest-all`. Applies to every Town map (original Town and Lake) through the
shared map architecture; follow `server/src/town-building/AGENTS.md`,
`frontend/src/features/town-building/AGENTS.md`, `maps/AGENTS.md` and the repository
`AGENTS.md` (viewport, resource-feedback and achievement rules).

## 1. Map overview as icons

- Replace the numeric/text rows in `TownMapSummary` with icon rows: `[icon][icon] × N`.
- One combined row per statistic that lists the icons of the kinds present, then the total
  (for example roads: `[Mud road][Stone road] × 92`). Buildings, plant plots, roads, bridges,
  and animal / fish counts are included. Use the existing blueprint/material artwork; no new
  text-in-icon art. Icon rows carry an accessible name and a tooltip only (no visible labels).
- Remove the divider lines between rows (the `border-bottom` rule on the `dl` items).
- Counts stay read-only, derived from the saved map state; Vietnamese and English accessible
  names are localized.

## 2. Harvest-all section (nothing selected)

When the child has nothing selected, the right panel shows up to three buttons below the
overview. Each button is hidden unless its category has something ready:

| Button | Covers | Existing rules reused |
| --- | --- | --- |
| Harvest all plants on this map | Town vegetable patches; Lake floating-garden / water plants | `harvest`, `harvest-plant` |
| Harvest all animal products on this map | Coop eggs, barn products (milk, wool, yarn), animal-haven products when present | `harvest-eggs`, `collect-barn` |
| Harvest all fish on this map | Fully grown nursery / raft fish only | `harvest-fish` |

- Fruit trees are decorative today and are not harvestable; they are out of scope. New product
  sources register into the category list so more can be added later.
- Button face: category icon + generic harvest icon + label. No ready count on the button.
- Controls stay visible without scrolling at 1366×768, 1024×768 and 1180×820.

### Ready signal

- The server computes `harvestReady: { plants, animals, fish }` (booleans) from saved state
  inside the map projection, the same signal that already drives the ready icon above a
  building. Do not add a second source of truth, do not persist it, and never accept it from the
  browser. The panel shows a button only when its flag is true; the client only reads it.
- The command re-derives everything from locked state on the server.

### Click behavior

1. The click sends one `harvest-all` command with only `{ category, mapId, revision }`.
2. While the request runs, play the existing "things leave their buildings and fly to storage"
   animation (cosmetic, reduced-motion safe, timers/layers cleaned up on unmount).
3. The server harvests every ready item of that category on the map in one revision-checked,
   per-profile transaction, using exactly the same payout, stamina, storage-cap and achievement
   rules as harvesting one item manually (manual-harvest counts and "first harvest" style
   achievements advance the same way). Each target is all-or-nothing on its own; see
   "Storage and refusals" below for which targets are skipped.
   - Storage and refusals (2026-11-02 decision, supersedes the earlier "clamp and keep going" rule
     for crops and fish): when one target cannot be harvested because storage is full, or its
     manual rule refuses just that target, the batch SKIPS that target. It stays ready in the
     world, untouched (no stock, stamina, counter, generation, replant or award change), and the
     rest of the category is still harvested. A skipped target is reported in `notCollected`.
   - Crop patches and nursery fish are skipped whole when storage cannot hold all of them, since
     the manual rule would discard the overflow. A barn keeps the manual partial collect: what
     fits is stored, and the rest stays in the barn and is reported with the amount left.
   - Coop eggs have no storage limit in the current rules, so they are never skipped for storage.
   - If every ready target is skipped, nothing changes (no revision bump, no ledger entry):
     `HARVEST_STORAGE_FULL` (409) when every skip was caused by storage, otherwise `HARVEST_EMPTY`
     (409). Readiness is unchanged, so a category stays ready while product is left in the world;
     the child can free storage and tap again.
4. Automatic replant/regrow of the same crop / fish / water plant, without asking anything:
   - Replanting uses the existing manual rules. Where the existing rule charges a cost, pay it
     and replant only what the child can afford; leave the rest empty and report it.
   - Withered plant slots are harvested (no reward) and replanted free, as manual harvest already
     does.
5. The response carries a receipt with a stable ID/revision for `TownRewardBar`
   (`HarvestReceipt` in `server/src/town-building/harvestTypes.ts`):
   - `id`, `revision`, `mapId`, `category`, `duplicate`;
   - `products: [{ item, amount }]`: each actual product stored or counted, not a group;
   - `replanted` and `notReplanted: [{ item, amount }]` (items skipped for cost);
   - `notCollected: [{ item, amount }]`: product left in the world because storage was full or a
     manual rule refused that target. `amount` is what remained there (the whole ready amount for
     a skipped target, the rest of a partly stored barn). Empty when everything was collected;
   - `reward`, the server-credited stamina and materials for the cosmetic `TownRewardBar`.
   A retry of a committed batch returns the saved receipt with `duplicate: true`, including its
   `notCollected`.
6. Result dialog (small, after the harvest): rows `Icon - label - xNumber` per product
   (for example egg ×10, wool ×20, carrot ×4), plus a short note if anything was not replanted or
   collected (`notCollected`, so the child knows to free storage and tap again).
   Show the material artwork and large `+N`, then fly to storage via `TownRewardBar`.
   Animate only newly committed receipts; no replay on reload, duplicate responses, zero
   results, or failed requests.

## 3. Server contract

- Add a strict `harvest-all` command (category enum `plants | animals | fish`) to the shared
  Town/Lake action schema. No client-supplied entity IDs, quantities, products or rewards.
- Reuse the per-entity harvest functions rather than duplicating payout logic; one revision bump
  per committed batch; a stale revision rejects with no write; a batch with no kept target rejects
  with no write (`HARVEST_STORAGE_FULL` or `HARVEST_EMPTY`, both 409); retries deduplicate.
- Errors: `TOWN_STALE` (409) for a stale revision, `HARVEST_EMPTY` (409) when nothing is ready or
  nothing could be kept for a non-storage reason, `HARVEST_STORAGE_FULL` (409) when every
  skipped target was blocked by storage.
- Visits and read-only views never run it. Preview/appearance modes never enable it.
- No SQL migration expected (Town JSON state only); confirm during implementation.

## 4. Verification

- Server: per-category ready detection, empty category rejected/idempotent, per-target skip and
  stale-revision behavior, payout parity with manual harvest (stamina, storage caps, achievement
  counters), replant cost handling, withered slots, no reward on duplicate retry, ownership.
- Storage and refusals (Town and Lake): a partly full store keeps the targets that fit and reports
  `notCollected`; skipped targets are byte-for-byte unchanged; a batch with nothing kept rejects
  with no revision bump (`HARVEST_STORAGE_FULL` when storage is the only reason); the duplicate
  retry returns the same `notCollected`.
- Frontend: icon overview (EN/VI), hidden/visible buttons from `harvestReady`, result dialog
  rows, reward animation only on new receipts, reduced motion, no dividers.
- Real browser at 1366×768, 1024×768, 1180×820 for the idle panel, loading, result dialog and
  both maps. Standard gates: `npm test` / `typecheck` / `build` for server and frontend.

## 5. Final frontend contract

- `TownMapSummary` is a pure projection of the selected map's saved entities and rafts. It renders
  separate Roads and Bridges rows, plus Animal houses and Fish houses, in catalog artwork order;
  zero rows are omitted and an entirely empty map gets one localized status line. Row labels are
  both `aria-label` and `title`, with no decorative divider lines.
- `TownHarvestAll` is mounted by the shared `MapWorkspace` idle panel for both Town and Lake. It
  reads only `harvestReady`, sends the current-revision `harvest-all` command through the page's
  existing action transport, disables all three buttons during the request, and clears its cosmetic
  pending flight on completion or unmount. The result dialog renders only receipt products and
  explicitly reports `notReplanted` and `notCollected`.
- `TownRewardBar` receives the receipt ID and server reward only for a newly committed, non-duplicate
  receipt with a positive reward. Reloads, duplicate receipts, zero results, failures and visits do
  not animate. `HARVEST_STORAGE_FULL`, `HARVEST_EMPTY` and `TOWN_STALE` remain friendly and the
  existing page refetch handles stale synchronization.
