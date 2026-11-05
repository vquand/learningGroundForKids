# Explore the world optimization

Branch `review/explore-world-optimization` (from `main` after PR #92). Two independent
read-only reviews (Sonnet 5.5 and Codex Sol 6.1) produced the findings; the user approved the
scope on 2026-10-28.

## Decisions
- Done filter: with "not done" selected, cluster bubbles count and position only matching
  items (server-side, per request; no progress in any shared snapshot).
- Merge `CLAUDE.md` into `AGENTS.md` and delete `CLAUDE.md` (the user states Claude Code now
  loads `AGENTS.md`). Prune obsolete architecture and older-model guidance.
- Supabase removal originally retained the old schemas and archived backends as history.
  On 2026-10-31 the user authorized removing them after confirming platform parity.
  Catalog seed JSON was relocated to `frontend/data/catalog-seeds/`; old runtime,
  schema and setup files are available in Git history. Architecture decisions remain.
- Category fallback art stays raster (painted PNGs) and moves to WebP; SVG is not suitable.

## Phases (parallel worktrees A/B/J first, then M on the review branch)
- A `opt/docs-supabase`: AGENTS.md merge, CLAUDE.md removal, Supabase removal.
- B `opt/assets-loading`: category art to WebP, lazy `vi.json`, item language toggle keeps data.
- J `opt/item-detail-journey`: item-detail waterfall, quiz error states, audio playback,
  flashcards catalog dependency, journey diagnostics gated, journey latest-request-wins and
  sliding vehicle, missing translations.
- M (review branch): keep previous markers + progressive pages, dev-only map code removed from
  production, access-check round trips, bounds-first server projection, IndexedDB off the
  critical path, atlas redraw (profile first), map duplication/structure/tests, done filter
  (bottom left, default "not done", Journey unaffected).

Per phase: Codex implements, Sonnet reviews, Haiku runs tests, then commit.
