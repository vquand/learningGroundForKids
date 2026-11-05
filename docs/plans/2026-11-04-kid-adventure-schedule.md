# Kid adventure schedule (simplified parental control): plan

Status: draft v1. Branch `feat/kid-scheduled-access`. Mockup:
https://claude.ai/artifact/98v6F1k6AVbcjz48AyQ7Tk

## 1. Goal

A parent can whitelist weekly time slots when each child may use adventures.
Outside a slot the child sees only the Calendar card. Off by default: a child
without the feature enabled is never restricted.

## 2. Decisions (user answers, 2026-11-04)

| # | Decision |
|---|---|
| 1 | A child with the feature on and no slot on a day is locked all day. |
| 2 | Weekly recurring slots (e.g. Mon/Tue/Fri 16:00-18:00) repeat every week until the parent removes them. No date exceptions. |
| 3 | Slots are wall-clock times in the child's **current device time zone**; the **server** decides. Zone travels with kid requests; a child who flies keeps the same local "biological" hours. |
| 4 | Slot ends mid-game: 5-minute warning countdown (fixed), then lock. |
| 5 | On lock the server saves progress and keeps committed rewards. **Exception: Road Racing** forfeits the unfinished round (clear "round not saved" message). |
| 6 | Locked: only Calendar usable (view and edit); profile read-only; badges, town, quiz, explore and all minigames blocked. Message: "It is not yet time for adventure(s)" plus next slot start. Profile switch and sign-out remain. |
| 7 | Kid accounts only. Parent and admin spaces are never locked. |
| 8 | Parent edits a week grid by dragging, 30-minute steps, slots cannot cross midnight. |
| 9 | Overlap view: one coloured lane per selected kid, legend, overlaps highlighted. |
| 10 | Applying slots to several kids asks, per apply, **replace / add / ask**. |
| 11 | Total "max possible screen time" per kid (week + per-day), one legend line per kid, updating live. It is a ceiling, not usage. |
| 12 | Enforced server-side on every kid route. UI only reflects. |
| 13 | Server clock is the only clock. |
| 15-17 | Reported zone is accepted only if a valid IANA zone and changes are rate-limited (max 3 per day; extra changes keep the old zone). Last reported zone applies when the kid is idle. The parent sees a notice on zone change. |
| 19 | Parent Space gets a "Schedule" section with a kid picker. |

## 3. Data model (migration `0038_kid_schedule`)

- `profile_schedules(profile_id PK -> profiles ON DELETE CASCADE, enabled bool default false, revision int, current_timezone text, timezone_changed_at timestamptz, timezone_changes_today int, timezone_change_day date)`.
- `profile_schedule_slots(id uuid PK, profile_id -> profiles CASCADE, weekday smallint 1..7 (Mon=1), start_minute smallint, end_minute smallint)`; check 0 <= start < end <= 1440, both multiples of 30; unique (profile_id, weekday, start_minute); non-overlap enforced in the repository inside the per-profile advisory lock.
- `profile_schedule_events(id, profile_id, kind 'timezone_changed', from_tz, to_tz, at)` for the parent notice.
- Add paste-ready Neon file like earlier migrations; add rollback. No production runs.

## 4. Server (`server/src/schedule/`)

- `lock.ts`: pure `evaluateLock(schedule, slots, nowUtc, tz)` -> `{locked, reason, next_open_at, ends_at}`. DST-safe via Intl in the child zone.
- `repository.ts`: per-profile advisory lock, `expected_revision` on every mutation, parameterized SQL.
- Middleware in `app.ts` after auth: for `/api/v1/profiles/:profileId/...` read `X-Device-Timezone`, validate and record via the rate-limited rule, load the schedule (cached 15 s per profile, invalidated on write), and reject with 423 `ADVENTURE_LOCKED` + `{next_open_at}` unless the path is on the allowlist (calendar, profile read, schedule status, tour/session endpoints). `/api/v1/parent/*` and admin are untouched.
- Routes: `GET /api/v1/profiles/:id/schedule/status` (kid, never leaks other kids); parent-only `GET/PUT /api/v1/parent/schedule` (all kids' slots and totals), `PUT .../kids/:id` (enable/disable + apply with `mode=replace|add`), body validated strictly, never trusts browser-supplied lock state.
- Road Racing: when lock begins, an active race is forfeited via the existing forfeit path (no award, streak reset rules unchanged). Other games: existing saves stay; late writes are rejected by the middleware, so the 5-minute warning gives the client time to flush.

## 5. Frontend

- Shared `apiFetch` adds `X-Device-Timezone` from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- `useScheduleStatus` polls status every 30 s (and on 423) and drives a locked-mode context: Playground cards other than Calendar render disabled with the message; routes redirect to Playground. Warning countdown banner at 5 minutes.
- Parent Space: `features/parent/ParentSchedulePage.tsx` (kid picker with colour legend and totals, drag-paint week grid, overlap highlights, apply dialog replace/add/ask, enable toggles, zone-change notice). Fits 1366x768, 1024x768 and 1180x820 without scrolling.
- Bilingual copy in `uiText`; agy reviews wording before final tests.

## 6. Not in scope

Usage tracking, date exceptions, per-kid warning length, activity-level allowlists.

## 7. Verification

Server: lock evaluation (boundaries, DST, zone change, no slot), middleware allowlist, rate limit, replace/add, revision conflicts, ownership. Frontend: locked cards, countdown, parent grid, totals, overlaps. Real-browser checks at the three required sizes. Then codex:review, then the standard test, typecheck and build gates.
