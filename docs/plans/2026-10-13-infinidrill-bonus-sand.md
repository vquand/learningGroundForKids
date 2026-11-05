# InfiniDrill rock-to-sand bonus

## Accepted behavior

The user requested one bonus sand for every ten rocks earned in InfiniDrill so
children below the surface dirt layers can still earn sand while drilling.

- Keep the entire rock reward; this is an additional reward, not a conversion.
- Count only newly earned, server-verified rock, after head/laser overlap is
  deduplicated. Preserve direct dirt-layer sand and occasional metal rewards.
- Carry the remainder (0–9 rocks) across digs, reloads and expeditions for each
  child independently. Spending Town materials cannot affect this counter.
- Apply to new earnings. Existing saves without the counter begin at zero;
  do not backfill historical rewards or reset current progress/balances.
- Persist the counter in private InfiniDrill progress JSON. No schema migration,
  new client claims or separate reward endpoint is needed.
- Commit game progress, carry and Town reward in the existing transaction. Stale
  revisions, duplicate attempts and failed transactions cannot award twice.
- Existing `townReward.sand` reports the combined direct/bonus grant. Explain the
  rule in the existing English/Vietnamese help without adding gameplay controls.

## Economy check

The extra sand faucet is exactly 10% of earned rock, rounded only after carrying
the remainder. From zero, 80 newly earned rocks yield the school's eight sand;
100 yield the library's ten sand. Rock remains available for construction.
Repeatedly spending/refunding, revisiting mined cells or stationary boundary
practice cannot generate this bonus: only new verified rock advances it.

## Verification

Luna agents own test writing, execution and independent review. Cover threshold
and multi-dig grants, mixed direct/bonus rewards, legacy state, replay/reload,
profile isolation, forged/stale/parallel submissions, excavation overlap and
transaction rollback. Run all server tests serially against disposable local
PostgreSQL with zero skipped integration cases, plus typecheck/build. Verify the
bonus/storage notice and full controls at required laptop/iPad landscape sizes;
run frontend gates. Preserve the real local UAT environment and unrelated files.

Changes remain on `review/recent-code-health-2026-10-13`. No production migrations
or cloud changes are part of this work. The user approved committing and pushing
the fixes to the existing review branch after UAT.

## Implementation and evidence

Implemented the private rock remainder and additive sand grant in the verified
InfiniDrill transaction. Existing saves default to zero carry, and all normal
actions/replays preserve it. The public response keeps its existing shape and
reports bonus sand through `townReward.sand`.

Independent Luna review found an older mining bug: a save without excavation
history could credit the reducer's synthesized historical footprint as new
ground. A zero-depth practice answer reproduced 720 sand/120 rock in that case.
The reward calculation now excludes that old footprint, including fractional
depth and overlapping new laser/head cuts. No historical balance backfill or
reset was performed.

- Eight focused pure cases passed; the disposable PostgreSQL regression passed
  carry, reload/replay, spending independence, parallel/stale requests, child
  isolation, legacy saves, boundary practice and atomic rollback.
- Full server suite: 267 passed, zero failed/skipped. Typecheck and build passed.
- Frontend: 69 test files, application/hosting typechecks and both builds passed.
- Chromium checked confirmed rock/sand/metal notice, English/Vietnamese help,
  touch-target bounds and absence of scrolling at 1366×768, 1024×768 and 1180×820.
  The new reward notice initially shrank a control at 1024px; the header now
  stacks the notice and prevents icon controls from shrinking. All checks pass.
  The final check includes the shared language selector and its reserved header
  slot, so the pause/achievement controls remain uncovered in the real layout.
- Luna agents wrote tests, captured failing cases, executed browser checks and
  independently reviewed code/results. Fixture screenshots were inspected.

The real local UAT stack remains on port 5173, using its existing development
database. Only the separate disposable test database was used for migrations
and test fixtures. The user approved the fixes for the existing pull request.
