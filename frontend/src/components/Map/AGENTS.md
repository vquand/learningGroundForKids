# Explore map implementation guide

Follow `frontend/AGENTS.md` and the repository guide. Number every brainstorming
and clarification question uniquely within each batch; preserve pending numbers
and offer short lettered choices where useful.

- Selected category filters expand to icon + localized label. Do not require
  hover or tooltips to identify the selected filter on iPad. Preserve multi-select.
- Keep the timeline in the top navigation row, between the back control and
  the reserved language slot. It must shrink within that space; narrow-screen
  era/year overflow stays inside the timeline, never under either control.
- Returning from an item restores that child's map center and fractional zoom.
  Keep camera state in memory, scoped to family/login generation and child;
  never write identity/progress to browser storage. Save on pan/zoom and before
  opening an item, including touch taps and preview actions.
- Item details keep Back and the item title sticky while reading. The small
  completion medal before the title comes only from server-confirmed completion
  for the selected child; it is separate from achievement badge awards.
- Keep all current controls usable without page scrolling at 1366×768,
  1024×768 and 1180×820. Fit width and height, safe areas and browser chrome.
  Phone controls may rearrange with at least 44px touch targets; do not shrink
  the entire page or change existing iPad proportions.
- Exploring achievements use server-verified item/quiz progress and the existing
  named Exploring collection in child reports. Never award badges from filters
  or browser-reported completion. Achievement definitions need a badge, explicit
  unlock condition and difficulty. Any new catalog group requires its reviewed,
  idempotent admin-only migration and both Parent/Admin child-report projections.
  Catalog-only definitions must be labeled not yet earnable until server grading
  and progress exist; preserve already earned badges and progress.
- Follow `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`:
  illustrated text-free storybook medallions, shared frame, linework, palette and
  detail level; vary the central pictogram. Keep text outside the icon.
