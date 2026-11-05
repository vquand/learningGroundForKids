# Shared Town Storage stacking and removal

Town and Lake share one inventory. Count actual Town Storage buildings across
both maps: zero gives 10 per item, N >= 1 gives 1000 + 2000*(N-1). Building
materials remain 2000 without storage and 5000 with any storage; stamina is
unlimited. Ordinary credits clamp gains and preserve existing excess stock.
Lake land views carry a temporary full-root storage count for shared rules;
mergeLand removes that view field before persistence.

The sole exception to preserving excess stock is explicit storage demolition.
Moving, rotating and transferring a building never trigger demolition rules.
No SQL migration is required: inventory, buildings and the latest removal
receipt use existing Town JSON state.

## Command and response contract

- Town: POST /api/v1/profiles/:profileId/town/action with
  `{revision, command:{type:"remove", entityId}}`.
- Lake: POST /api/v1/profiles/:profileId/town/maps/lake/action with
  `{revision, command:{type:"land-action", mapId:"lake", command:{type:"remove", entityId}}}`.
- Removal optionally accepts `confirmLoss:boolean` and
  `lossConfirmation:string` (maximum 20000 characters). Other command schemas
  reject these fields; the domain rejects confirmation on non-storage removal.
  Browser-supplied loss arrays or quantities are rejected by the strict schema.
- Under the existing profile transaction/lock, compute the exact overflow after
  removing one storage. If there are losses and confirmation is absent or differs,
  return HTTP 409 with `error.code = STORAGE_LOSS_CONFIRM` and `error.details`
  containing `{oldItemLimit,newItemLimit,oldMaterialLimit,newMaterialLimit,
  lastStorage,losses,confirmation}`. No state is saved on rejection.
- Each loss is `{kind,id,amount}`, where kind is crop, milk, yarn, fish or
  material and id is the actual product/material ID. Entries sort by kind/ID.
  `confirmation` is the serialized server-computed limits and exact loss list;
  it is a comparison token, not a client-authoritative list or a secret.
- Confirm resends the remove command with `confirmLoss:true` and the returned
  `lossConfirmation`. The server recomputes everything under lock. Changed loss
  or limits returns STORAGE_LOSS_CONFIRM again; changed revision follows the
  existing TOWN_STALE contract. The client must obtain current state to retry a
  stale revision. Never trust a browser quantity or confirmation token as stock.
- Successful removal and overflow discard commit together with one revision
  increase. The returned Town state includes `storageRemovalReceipt` with the
  same fields, including an empty losses array on no-loss removal. This latest
  receipt is saved in Town JSON; UI feedback only reacts to a successful remove
  response, never initial reads or heartbeats. It awards no resources.
- Milk and fish discard oldest timestamped batches first. Other products and
  materials lose exactly the amount above their new individual limits.

## Interface and validation

Storage demolition first calls the server without a generic removal question.
No-loss success gives an after-notice with old/new item limits and no goods
being affected. Loss prompts use the shared TownMapDialog, existing product art,
localized labels and ×amount rows, Cancel/Remove buttons, and an extra only-store
warning. Cancel sends nothing. A successful confirmed removal displays the
actual committed loss list. The dialog uses a compact three-column grid and
48px controls; browser viewport verification remains required at 1366×768,
1024×768 and 1180×820. No motion is introduced.

Unit tests cover N=0..4, construction stacking, exact losses, pure rejection,
changed/forged confirmation, oldest-first batches, both maps, no-loss receipts,
move/rotation preservation, strict schemas and harvest-all at stacked capacity.
A DB-gated test covers rollback, stale revisions and concurrent confirmation.
Database and browser UAT are delegated to the user for this task.

## Sandbox validation (2026-11-02)

- Focused `cd server && node --import tsx --test tests/town-*.test.ts`:
  43 files passed; new storage file contains seven passing tests.
- Server typecheck/build and frontend typecheck: passed.
- Full server suite: 165/166 files passed; node-adapter test cannot listen on
  127.0.0.1 in this sandbox (EPERM). DB-gated cases had no configured test URL.
- Full frontend suite: 178/179 files passed; explore-performance-report fails
  because spawnSync /usr/bin/node is denied (EPERM).
- New DB test and real-browser viewport/English/Vietnamese flows still require
  the user's local validation. No production data or SQL migrations were run.
