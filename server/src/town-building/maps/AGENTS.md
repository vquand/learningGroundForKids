# Shared Town Server Map Guide

Follow the [common Town server guide](../AGENTS.md), `server/AGENTS.md`, the
repository guide and `frontend/src/features/town-building/maps/AGENTS.md`.
Map-specific behavior belongs in `maps/<map-id>/` with its own linked guide.
These boundaries apply to the implemented map registry and lake runtime.

- Number every clarification/brainstorming question, including tool prompts;
  use concise numbered lists with short lettered choices where useful.
- Keep map definitions, terrain/depth, blueprint eligibility and placement
  rules server-owned and browser-safe where shared for previews. Accept only
  allowlisted map IDs, never caller-supplied maps, costs or habitat definitions.
- Legacy entities default to original Town. Scope collision, pathfinding,
  road/fence components, business entries, animal contacts and garden simulation
  to the entity's map. Original Town's protected mask is not a global map mask.
- One child, one Town storage and transaction boundary across maps. Cross-map
  moves atomically validate both placements, ownership, revision and original
  paid move costs. Preserve identity, occupants, crops, readiness and awards.
- Share construction/reward/authentication services, live home-city environment
  and report projections. Do not create independent lake balances, duplicate
  source-game rewards or expose reward quantities as input.
- Active simulation uses bounded server-observed leases, shared multi-tab
  accounting and safe checkpoint/revision rules. No client elapsed time,
  position, weather, completion, capacity or boost claims. No offscreen catch-up.
- Each map supplies its own unique simulation/content policies. Generic Town
  services receive map context rather than branching on lake IDs throughout.
  Extract the smallest needed common helpers; preserve original-map contracts.
- Map achievements require a named group, explicit unlock conditions,
  obtainment difficulty and universal-style badge artwork. Use the one
  authenticated admin migration, preserve existing awards, and include the
  complete group in the common Parent/Admin child-report projection.
  Catalog-only definitions must remain visibly not earnable until rules exist.
- Keep the shared frontend viewport and reward-animation rules: no scrolling
  at 1366×768, 1024×768 and 1180×820; newly committed resource receipts drive
  the existing centered-art/+N-to-storage effect, never client payouts.
- Verify ownership, forged commands, stale revisions, replay/concurrency,
  legacy normalization, map isolation, once-only rewards and both reports with
  guarded disposable PostgreSQL tests plus required server/frontend gates.
  Evidence stays under `/tmp`; no production/cloud/release writes before
  the repository's required `confirmed` instruction.
