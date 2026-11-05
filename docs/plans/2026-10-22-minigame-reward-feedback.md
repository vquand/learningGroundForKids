# Minigame reward feedback and fishing break

Status: implementation on `feature/minigame-reward-animations`; not authorized
for commit/push/publication until the user's confirmation.

## Audit

The active server's `creditTown` call sites define resource-awarding games:

| Game | Before | Change |
| --- | --- | --- |
| Shoo Shoo UFO | Shared resource flight | Measure play area and storage target |
| Food & Drink | Shared stamina flight | Measure play area and storage target |
| Cabbage Rolls | Shared stamina flight | Measure play area and storage target |
| InfiniDrill | Deposit/equipment flights | Retain its measured inventory flights |
| Waddle Wall | Server receipt ignored by frontend | Render receipt with shared flight |
| Fishing Friends | Stamina credited without flight | Emit receipt on verified catch |
| Road Racing | Reward totals only | Emit receipt on verified finish |
| Burger, Miniku | No Town resource awards | No fabricated rewards or flights |

Town Building consumes/stores these resources; gardening harvest feedback and
seasonal Town events are separate existing in-town systems, not minigame payouts.
Catalog/exploration learning activities do not call `creditTown`.

## Behavior

Material art with large +N counts appears in the play area, then flies to the
visible storage control. Multiple receipts can finish independently. Initial
loads and reloads never replay a saved reward. Empty rewards and ordinary
heartbeats never create flights. The shared component snapshots each receipt,
ignores the same event again, cleans up timers on unmount, and announces a
localized stored-resource message. Reduced motion shows a still receipt by storage.
No gameplay, payout, schema, or server authorization changes.

Fishing drops the scene's combined lifetime-points sticker while preserving the
current pond/river progress bar. Bait cards use large ×N counts. Explicit breaks
replace the fishing pose with a generated curled-up sleeping friend and zzZ;
Highland Cow's eyes stay covered. Floats/reaction emotes hide until continuing.
All three friends retain the same identities and warm illustration style.

## Verification

Run frontend tests, hosting typecheck, Vercel and compatibility builds. Use
isolated headless agent-browser at 1366×768, 1024×768 and 1180×820 to check setup,
play, catches/results, pause, inventory target and complete flight paths. Assert
that zero rewards, same-event rerenders, restored outcomes, and reads do not
create another animation; test reduced motion and cleanup. Evidence stays in /tmp.

Validated locally on 2026-10-22: 466 frontend tests, the hosting typecheck, and
Vercel/compatibility builds passed. Existing Fishing (19) and Waddle Wall (15)
browser regressions passed. The isolated agent-browser regression verified all
three landscape sizes, scene-to-storage paths and exact amounts in Waddle Wall,
Fishing and Road Racing, duplicate receipts, restored races, zero/last-place/
garbage outcomes, reduced motion and portal cleanup. All three sleeping friends
were visually inspected, including measured atlas gutters; controls fit without
scrolling. Waddle Wall setup spacing was compacted to meet the same requirement.
Its browser fixture no longer assumes the Playground has a fixed total of nine
activities; it still verifies that the Waddle Wall card is unique and opens.

New browser source: `frontend/tests/minigame-rewards.browser.mjs`, backed by the
local-only `minigame-rewards-preview.ts` and existing `fishing-preview.ts`.
Generated artwork and its full built-in-tool prompt are versioned under
`frontend/public/minigames/fishing/`; the private catalog was regenerated locally.
No server/schema/reward changes or cloud writes were needed.

## Follow-up UAT refinements

- Sleeping friends retain the fishing pose's 27% bank anchor. Hide the scene
  bucket while the friend sleeps, restoring its normal bank position on resume.
  Do not lift the friend or place the paused bucket on the water.
- Road Racing storage sits on the right beside Badges and language, preserving
  the centred title. A completed race replaces the track with a 2–1–3 podium:
  first on the tallest centre step, second left, third right. The remaining three
  friends cheer below. Animal names/numbers stay on the steps so feet touch them.
- The ceremony uses server finish order/distances and the server-awarded player
  place (including exact finish ties). All six friends appear once. A new unit
  regression checks every possible player place without mutating race state.
- Validation: 467 frontend tests, hosting typecheck and both builds passed.
  The agent-browser matrix passed at all three required landscape sizes,
  including podium/crowd membership, step heights and positions, right-side
  storage, bank placement, reward paths, last-place/garbage outcomes, duplicate
  and reload protection, cleanup and reduced motion. Direct podium checks
  confirmed all six friends stay still with reduced motion enabled.

## Bait and multiplication refinements

- Baby Bait now generates result-only addition without carrying, still using
  operands 1–29. Corn Bait and Worm Bait replace the Beginner/Chewy display names
  in both languages, retaining existing IDs, inventory, odds and rewards.
- Road Racing alternates its existing addition/subtraction forms with direct
  single-digit multiplication, factors 1–9 and product <50. The single-digit
  restriction applies only to multiplication, as explicitly clarified.
- Fishing multiplication has single-digit factors and product <60. Bouncy keeps
  2–5 tables; Crunchy samples 2–9 with at least one 6–9 factor. Division is unchanged.
- New generated-question tests cover every eligible Baby pair, visible factors,
  strict product boundaries, three unique race choices, and 400 nonrepeating
  race questions in each language. Issued legacy questions keep their grading.
- Validation: 445 backend tests passed against disposable local PostgreSQL
  (none skipped), 467 frontend tests, server/frontend typechecks and all builds
  passed. Fishing's 20 browser tests passed, including names, starter equations,
  higher-tier missing operands and bounded multiplication. Isolated agent-browser
  verified Road Racing multiplication in both languages at all required landscape
  sizes and the correct-answer flow. No database migration is required.

## Question variety, Village River art and Math Scientist

- Verified Waddle Wall's existing canonical session history; its regression now
  checks canonical identities across 500 walls, including reversed sums/products.
  Added a private two-lane tail: the correct answer cannot occupy the same lane
  for three consecutive walls. Choice swapping and server grading stay aligned
  through pause, saved JSON, legacy recovery and a new game.
- InfiniDrill persists private canonical task identities across the complete
  expedition, main/bonus questions, layers, pause and reload. Reversed sums and
  products, missing-number variants and cosmetic Venn friend changes cannot
  bypass history. Public responses strip keys because they can reveal operands.
  Bounded random sampling falls back to finite level-valid enumeration; exhausted
  layers offer localized replay/exit without a false core completion. Replay
  starts a new history; old saves can recover only their current question.
- Generated and integrated Village River's `river-v2.png`, five R1–R5 fish in
  `river-fish.png`, and Bouncy/Crunchy/Scholar bait icons in `river-baits.png`.
  Original pond/shared fish, visiting turtle and garbage art remain available.
  The background preserves open grass under the existing companion/bucket
  anchors. Built-in tool prompts, dimensions and crop grids are recorded in
  `VILLAGE_RIVER_ART_PROMPTS.md`; there were no cloud writes or uploads.
- Added Math Scientist for 10 verified lifetime hard-wall passes, difficulty
  hard, with a separate generated universal-style medallion. Preserve Orange
  Explorer at five hard walls and every existing badge ID. Session unlocks,
  collections, catalog migration and the shared Parent/Admin projection include
  the seventh badge. Both reporting routes and repeat catalog migration are
  covered; migration preserves saved counters and earned status.
- Validation: 453 backend tests against disposable local PostgreSQL, 467
  frontend tests, both typechecks and server/Vercel/compatibility builds passed.
  Waddle Wall's existing 15 browser tests and the new Scientist artwork test
  passed. InfiniDrill's full-expedition browser test verified unique main/bonus
  cards; all 25 browser cases passed after correcting two fixture assumptions.
  Fishing's 20 browser cases passed after updating the landscape test to the new
  versioned asset URL. Isolated agent-browser checked Village River's scene,
  three river baits, all five fish cells, journal and gameplay bounds at
  1366×768, 1024×768 and 1180×820, with no scroll or console/page errors.
- No SQL schema migration is needed. Install the new catalog definition using
  the existing single admin achievement migration button after release.
