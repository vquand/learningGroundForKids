# Parent Space guide

Follow `frontend/AGENTS.md`, the root guide, and `src/i18n/AGENTS.md`. Number
brainstorming and clarification questions uniquely within each batch.

- Use nested parent-gated routes and restorable URLs for lists/items/editors.
- Keep dashboard/child reporting separate from content and account management.
- Display server-owned reports only. Never grade or award from browser data.
- Use the shared `components/ActivityIcon` for activity/report cards, matching
  the kid's Playground list. Cooking, Burger and Food and Drink belong to its
  Kitchen activity; keep server report IDs and separate progress unchanged.
- Separate earned, locked server-backed, catalog-only, and unrecorded features.
- Scope caches and request callbacks to family/session. Locking clears protected
  reports, list/puzzle settings, and parent management data.
- Use `useParentRequests` for parent mutations so locking or capability expiry
  invalidates callbacks immediately, including before React unmounts the view.
- Preserve existing APIs and lesson/puzzle/friend/profile/account actions.
- Use authored English/Vietnamese UI copy; never translate user content or IDs.
- Use calm, warm, readable styling, touch targets, accessible labels, and the
  shared top-right language slot. Parent pages may scroll vertically; avoid
  horizontal page overflow at laptop, iPad landscape, and narrow mobile sizes.
- Verify direct links, refresh, back/forward, reports, editing and locking in a
  real browser. Run frontend gates and server gates for report/API changes.
