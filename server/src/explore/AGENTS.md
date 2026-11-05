# Explore cache implementation

Follow [`../../AGENTS.md`](../../AGENTS.md) and the
[frontend Map guide](../../../frontend/src/components/Map/AGENTS.md).
Number every brainstorming/clarification question uniquely within each batch;
preserve pending numbers and offer concise lettered choices where useful.

- Common cached catalog data is shared only among authenticated, authorized
  users. Publication and family/child visibility are server-side boundaries on
  cache hits as well as misses; use the current database revision, not a TTL.
- Use managed Neon tables for durable snapshots and fenced, bounded rebuild
  leases. Free Render has no free cron/worker/one-off job service; execute the
  reusable bounded builder inside the existing API and recover after restart.
- Merge authorized membership before clustering. Never merge independent
  precomputed counts or include private/progress data in a common snapshot.
- Preserve the existing named Exploring achievement group and server-verified
  item/quiz grading. No new achievement group is introduced by caching. New
  definitions must include badge, clear condition and difficulty, an idempotent
  authenticated admin migration, and both Parent/Admin child-report projection.
  Catalog-only definitions stay visibly not yet earnable until server grading
  exists; preserve earned badges/progress.
- Badge artwork follows the universal illustrated, text-free storybook-medallion
  prompt in `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`.
  Keep the common frame/linework/palette/detail, vary the pictogram, and keep
  names, difficulty and unlock conditions outside the icon.
- All current Explore controls must remain usable without page scrolling at
  1366×768, 1024×768 and 1180×820, including filters, preview, detail/back and
  touch/zoom states. Verify complete flows in a real browser. Preserve artwork,
  clustering/navigation semantics and per-child fractional camera restoration.
- Test concurrent readers, stale-builder fencing, process restart, invalidation
  from SQL/ingestion, and cross-family/child revocation with disposable databases.
