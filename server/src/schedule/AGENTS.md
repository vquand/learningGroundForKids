# Kid adventure schedule guide

Follow `server/AGENTS.md`, the repository guide and
`docs/plans/2026-11-04-kid-adventure-schedule.md`.

- Number brainstorming and clarification questions uniquely per batch.
- This is a parental control, not a minigame: no achievements, scores or rewards.
- The feature is off by default. Only profiles with `enabled = true` are ever
  locked. Weekly recurring slots (Mon=1, 30-minute steps, no midnight crossing);
  a day without slots is locked all day.
- The server clock decides. The device zone arrives only in `X-Device-Timezone`,
  must be a valid IANA zone, the first report is free and later changes are
  limited to 3 per UTC day. The last accepted zone applies while idle. Never
  accept lock state, slots or "now" from the browser.
- `enforceScheduleLock` in `app.ts` guards every `/api/v1/profiles/:id/...`
  request after authentication; `isLockExempt` is the only allowlist (profile
  read, `/progress` read, calendar, schedule status). Parent and admin routes
  are never locked. Locked requests return 423 `ADVENTURE_LOCKED`.
- Mutations take `expected_revision`, a per-profile (or per-family for apply)
  advisory lock, and verify the profile belongs to the session family. Apply
  merges overlapping slots; `replace` and `add` are chosen per request.
- Road Racing needs no special code: blocked requests expire the race lease and
  the next load forfeits it (no award, streak reset). Other games keep saved
  progress; late writes are rejected.
- Frontend: Parent Space page `features/parent/ParentSchedulePage.tsx`; kid side
  `AdventureLockGuard` plus `useScheduleStatus`. Fit 1366×768, 1024×768 and
  1180×820 without scrolling. Copy goes through `uiText` and `vi.json`.
