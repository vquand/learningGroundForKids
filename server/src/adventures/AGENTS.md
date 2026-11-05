# Adventure journal API guide

Follow `server/AGENTS.md` and the repository rules. Number clarification questions.

- The journal is a read-only projection of verified activity. Keep raw event keys,
  timestamps and receipts unchanged: kitchen completion counts and deduplication
  depend on them. Never infer rewards or achievements from grouped cards.
- Authorize the viewer and both ends of accepted friendship scopes before reading
  actors. Apply lesson publication/audience permissions before counting groups so
  private lessons cannot leak through titles, totals or timestamps.
- Group by actor, game, activity and local clock hour (:00 through :59). Preserve
  relevant identities: construction type, meal recipe/outcome, and Miniku size.
  Combine distinct Explore lessons, UFO words, blueprint unlocks, town milestones
  and drill upgrades by activity. Sum harvested vegetables; use best wall score
  and deepest drill depth rather than summing cumulative measurements.
- The validated optional `tz` query uses the viewer's IANA timezone; old clients
  default to UTC. Handle fractional offsets, midnight and repeated DST hours.
  Return a stable group ID, event count and the latest member's exact timestamp.
- Aggregate before cursor filtering/limits. Pagination must never split a group,
  truncate its total or reveal unauthorized events. Retain microsecond cursor
  precision. Scope queries to visible actors before scanning/grouping events.
- No schema migration or lossy storage compaction is needed. Test raw receipt and
  kitchen count preservation, privacy, pagination, timezone boundaries and copy.
  Evidence belongs in `/tmp` or ignored output. No release until confirmed.
