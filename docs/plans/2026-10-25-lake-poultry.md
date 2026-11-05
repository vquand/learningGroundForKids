# Lake poultry and egg sharing

Status: integrated locally on `feature/town-lake-resume` in the main checkout
`<repo>/`; manual user UAT is pending.
The original `.worktrees/town-lake` remains intact as a backup. The transfer
preserves the newer Daily Quiz, friend Town visits, river sharing and catalog
content already present in the main checkout.

Reviewed with the user: chicken coops produce four eggs per real day, or eight
within four tiles of a Land/Shore insect raiser. Accumulate gradually, including
while away, cap each coop at 24, and permit harvest from one egg. Harvest awards
two stamina per egg and adds eggs to shared takeaway stock available through a
built Friendly raft. Takeaway is for authenticated real child/friend profiles,
consumes one egg and awards the visitor one stamina. The user chose repeat
takeaway: a friend may take more eggs, one stocked egg per click. Retries reuse
the same request identity and cannot consume another egg or award again.

Chicken coops show their four-tile coverage when selected with chickens. Eligible
land crops receive 60 seconds of progress once per crop cycle, with no stacking.
Lake duck flocks prefer fish/garden rafts, remain for 30 active seconds and grant
30 seconds of progress once per resident/plant growth cycle. Movement/formation
is browser-owned; server-verified arrivals/completions validate a real active
visit before changing growth. Ducks swim as a close synchronized group, reuse
existing chubby duck art, honor terrain, night, weather and reduced motion.

Use shared Town construction, layouts, icon actions, centered dialogs, reward
receipts, material storage and map-scoped state. Keep read projections private:
visiting a friend's lake never exposes their material balances or learned items,
and never grants build/move/harvest permissions. Verify both scoped sides of an
accepted friendship on every list/read/takeaway request. Cross-profile claims
lock Town rows in stable order and atomically debit stock/credit the recipient.
No client time, position, quantity or completion claims award progress.

Validation includes exact egg timing/cap/rate changes, no retroactive new-coop
eggs, source move/species changes, once-only harvest and takeaway concurrency,
pending/revoked/wrong-child friendship denial, crop-cycle flags, duck visit
duration/replay/move invalidation, and all landscape sizes in both languages.

## Local validation and UAT handoff

- Frontend: 488 tests pass; application/hosting type checks and both Vercel and
  compatibility builds pass. Existing large-chunk notices remain.
- Backend: 521 tests pass with the guarded local `plg_test` database, including
  lake achievements in both Parent and Admin reports. An additional database
  regression passes for offline egg projection without read writes, competing
  harvests, generation replay, cross-map moves and future-only insect bonuses.
- Headless agent-browser poultry and shared Town/lake flows pass at 1366×768,
  1024×768 and 1180×820, including English/Vietnamese. Existing friend Town
  visits and river gifts/sharing browser regressions also pass after integration.
- Both map arrows are centered in their ambient river strips, outside the
  active building grid. Their bounds and actual click targets pass at all
  three landscape sizes; map round trips and shared screen identity pass.
- `scripts/start-uat.sh` refreshed the local frontend/API bind mounts to this
  checkout and verified readiness and the same-origin login route at
  `http://localhost:5173`. Existing local accounts and progress were preserved.
  Browser scenarios use isolated fixtures; authenticated manual user UAT
  remains the final acceptance step. No commit, push or cloud publication.

Raw screenshots and logs remain under `/tmp`; the transfer snapshot is at
`/tmp/town-lake-resume-backup`.

## Friend-space navigation follow-up

Use one Visit friends button across Town and Lake. Selecting a friend always
opens their Town; only that Town's unlocked ambient river arrow opens their
lake. The lake return arrow goes back to the same friend's Town. A friend can
be selected from either map without using a separate lake picker.

The friend list has aligned, non-interactive Town and Lake headers (three
little houses and a small lake). Rows show Town prosperity plus the saved lake
stage (egg, small fish or chubby fish), or a locked lake. The shared authorized
list/read projection returns only `lakeStage`, null when locked, alongside the
existing public scenery fields; it never exposes private lake progress.

Validation: 488 frontend and 522 backend tests pass, including the local test
database; application/hosting type checks, server build and both frontend build
modes pass. Agent-browser covers single-entry navigation from an owned lake,
Town-first selection, locked/unlocked stage indicators, header alignment,
friend Town/lake round trips and takeaway in both languages at all three
required landscape sizes. Manual user UAT remains pending.
