# Child adventure journal

The user requested a wide Latest Adventures button below the child's Playground
welcome section, with original illustrated artwork instead of an emoji. Remove
the family-picker button. Each child sees their own activity and accepted friends'
activity across Explore, all Kitchen recipes, Town, UFO, Waddle Wall, Infinidrill,
and Miniku. Keep English/Vietnamese copy and phone/iPad usability.

Implementation order and acceptance:

1. Add a server-owned journal with stable event keys and cursor pagination.
   Authorize the viewer profile; both sides of an accepted request must include
   the specific viewer/actor profile (family scope includes its children).
   Unrelated siblings, pending/rejected connections and foreign profiles cannot
   appear. Existing Explore completions retain their actual timestamps and titles;
   other historical outcomes are not invented.
2. Record verified transitions inside existing game transactions. Include learned
   Explore items, Kitchen completion/burning, Town blueprint unlocks, construction,
   development milestones, solved UFO words, Waddle Wall passes, Infinidrill depth/
   core/upgrades and completed Miniku boards. Retries/stale revisions cannot produce
   duplicate events; a failed transaction cannot leave a phantom adventure.
3. Share the existing pure Cooking/Burger rules with the API and add revisioned
   sessions, preserving the same gameplay and explicit browser-only UAT paths.
   These adventure events do not change catalog-only achievement status or award
   badges/resources. Never accept claimed completion, scores or outcome fields.
4. Integrate the generated journal icon into a full-width Playground button and
   child-scoped accessible feed with loading, empty, retry and pagination states.
   Remove the old family-picker entry. Localize authored interface/event copy,
   preserve child names and learning content, clear/guard data on profile/family
   switches and logout.
5. Verify ownership and all friendship scope combinations, event idempotency,
   rollback and pagination in API/database tests. Run representative game paths,
   frontend/server gates and real-browser phone/iPad/laptop journal checks.

No production/cloud writes, commits, pushes or publishing are authorized. Use only
local disposable test databases; use scripts/start-uat.sh for local UAT readiness.

## Delivered behavior

- Latest Adventures is a full-width child Playground action below its welcome
  section. It uses the generated transparent journal illustration; the optimized
  256px lossless WebP is 54 KiB. Source and exact prompt are in `docs/artwork/`.
- The native modal stays centered on both axes, keeps its close action visible,
  traps keyboard focus, supports Escape and restores focus to its trigger. Its
  two streams paginate independently and support empty/loading/retry states.
- Back to profiles stays sticky while the Playground scrolls and reserves the
  common language-control slot. The family picker no longer has the old button.
- The server journal records every current Playground minigame. Explore history
  retains actual saved timestamps. Cooking, Burger, drinks and cabbage outcomes,
  Town construction/unlocks/development/harvests, UFO words, Waddle Wall passes,
  Infinidrill first dig/depth/core/upgrades and Miniku completions record from
  this rollout onward; previously unrecorded outcomes are not reconstructed.
- Blueprint thresholds serialize first-learning updates, including concurrent
  completions and removed/re-marked items. Source-game saves and journal entries
  commit/roll back together with stable idempotency keys. No client outcome or
  score endpoint exists. Catalog-only achievements remain catalog-only.
- The new read endpoint checks ownership and both sides of accepted friendship
  scopes, hides private/unpublished Explore lessons, and uses bounded validated
  cursors. It never includes unrelated siblings or pending/rejected friends.
- The existing pure Cooking/Burger rules now live in `server/src/kitchen`, with
  frontend re-exports. Production sessions serialize revisioned actions, coalesce
  consecutive pointer rotations and recover failures from authoritative state.
  Already-issued actions finish for the origin child on navigation, with all UI
  callbacks guarded against profile/family/session changes. `/uat` practice is local.

## Verification

- 327 server tests passed with no skips against a dedicated loopback-only local
  PostgreSQL database, including new ownership/privacy/pagination/rollback tests,
  all friendship scope combinations/directions, and saved game event integration.
- 414 frontend checks passed; app/hosting/server typechecks and server, Vercel and
  compatibility builds passed.
- 10 new Chromium cases cover centered dialogs at 1366×768, 1024×768, 1180×820,
  390×844 and 320×667, sticky navigation, localization, generated artwork, all
  event copy, older pages, retry/empty states and profile switching; production
  Burger replay/resume and Cooking save recovery/rotation batching also pass.
- 58 existing browser cases passed across the profile picker, Playground,
  Cooking and Burger, including complete recipe/viewport flows.
- Local-only migration 0024 was applied through the Compose database guard. The
  UAT launcher reused the healthy stack at localhost:5173 and retained all
  existing accounts and progress. No cloud migrations, commits or publishing.

The dedicated `plg_adventures_test` database was removed after verification; the
UAT database and its existing accounts/progress remain intact.

## Hourly grouped notifications — 2026-10-22

The journal now aggregates verified events on the server by person, activity and
viewer-local clock hour, from :00 through :59. Construction types, meal recipes
and outcomes, and Miniku sizes remain distinct. Different words/lessons combine
within their respective activity. Each card carries the total event count and
latest member timestamp. Single events retain their existing copy. Harvests sum
vegetables; wall scores and drill depth use maxima, not sums.

Permission filters run before aggregation; pagination runs after it. Stable group
IDs and microsecond cursors keep complete groups on one page. The browser sends
its IANA timezone and keys cached streams by it; omitted timezone defaults to UTC.
Fractional offsets, midnight boundaries and repeated daylight-saving hours are
covered. No SQL migration is required. Raw events remain unchanged because they
also support kitchen completion counts, rollback and receipt deduplication.
