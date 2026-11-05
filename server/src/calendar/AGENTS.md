# Calendar implementation guide

Follow `server/AGENTS.md`, the repository guide and
`docs/plans/2026-10-29-kid-calendar.md`.

- Number brainstorming and clarification questions uniquely per batch; use short
  lettered choices where useful and preserve pending question numbers.
- Calendar is a reminder, not a minigame: no achievements, scores or rewards.
- Require session ownership through requireOwnedProfile on every profile route.
  Match every resource query by the authorized profile_id. Never accept identity,
  family, ownership, today or catalog definitions from the browser.
- Capture one now per request; use Asia/Ho_Chi_Minh civil dates. Past days are
  read-only for plan edits; the explicit rename action may start on a displayed
  past day. Template changes freeze the old effective past list first.
- Serialize reads and writes with a per-profile advisory transaction lock.
  Require expected_revision for every mutation; serialize JSONB explicitly and
  validate strict area-specific items both on write and read. Log malformed
  stored lists without logging child text; drop the entire invalid list.
- Use bounded parseJson, parameterized SQL, structured errors and no-store.
  Slice 1 writes Study only. Other catalog key sets remain empty until reviewed.
- `GET .../calendar` also returns a top-level `templates` object keyed by
  weekday `'1'`..`'7'` (Monday = `'1'`), each area holding only the weekday
  template: `{ id, items, revision, source: 'template' | 'empty' }`. A missing
  template is `{ id: null, items: [], revision: 0, source: 'empty' }`. Use it to
  save "every <weekday>" edits or show what "Restore weekly plan" restores while
  `days[].lists` shows the effective (template or override) list.
- Medicine is display-only. Later child text is family-visible plain text,
  cleaned and bounded; no medicine-name field or medical guidance.
- `eye_nose_drops` adds a pointed-tip eye/nose bottle; preserve the existing
  `drops` key for saved reminders. Medicine methods are validated catalog keys
  in JSONB and require no schema migration.
- Frontend reference: fit all views, editors and dialogs without scrolling at
  1366×768, 1024×768 and 1180×820, with readable text and usable touch targets.
  Calendar is the fourth Playground card and Daily Quiz fifth.

## My meals library (`meals.ts`)

- `POST .../calendar/meals` takes `{food, custom_name?}` and returns 201 for a new
  row or 200 for the existing (food, cleaned name) row. `DELETE .../calendar/meals/:mealId`
  returns 204, or 404 `CALENDAR_MEAL_NOT_FOUND` for unknown or foreign ids.
- `custom_name` is trimmed, control characters removed, then 1..40 characters
  (same rule as a list meal `name`). Food must be in `MEAL_FOOD_KEYS`.
- Adds take the same per-profile advisory lock as list writes, so the 60-row cap
  (`CALENDAR_LIBRARY_FULL`, 422) cannot be exceeded by parallel requests.
- Library rows are references for the picker only; deleting one never edits a list.
- `GET .../calendar` returns `meal_library` ordered by `created_at, id`; invalid stored
  rows are dropped and logged by id only.

## Weather

- Weather is server-only: never add browser-to-provider calls. Read the saved
  city/country from the family-scoped profile returned by requireOwnedProfile;
  no saved location means no_location, never a guessed location.
- Round geocoded coordinates to 0.1 degrees before weather URLs and cache keys.
  Never send identity, city text or precise coordinates to the weather provider.
- Only the code-allowlisted HTTPS api.open-meteo.com/v1/forecast URL is allowed.
  No redirects; total 4-second default deadline, 1 MB body cap, strict validated
  hourly values and local timestamps within calendarDates(now)'s Vietnam window.
- Local periods are 06-11, 12-17, 18-23. Omit incomplete days. Provider errors
  return HTTP 200 unavailable without provider text; private responses no-store.
- Forecast cache: bounded 500-entry FIFO, rounded coordinates plus Monday key,
  60-minute success TTL, 5-minute negative TTL, in-flight coalescing, stale on
  error up to 6 hours from the last successful response (never extended by errors).
  Geocodes: bounded 500-entry FIFO, 7-day success / 5-minute failure TTL,
  coalesced misses; one geocode attempt per miss, identified User-Agent and
  serialized default Nominatim requests starting at most once per second.
- Tests inject fetch, clock and geocoder or disable weather through AppDependencies.
  Never access real weather/geocode providers in tests.

## System event dates (`system-events.ts`, `lunar.ts`)

- `systemEventsInWindow(start, end)` takes inclusive civil dates, allows at most 400
  inclusive days and years 1900 to 2199, and returns `{key, date}` sorted by date then key.
- Tet (lunar 1/1) and Mid-Autumn (lunar 8/15) come from the pure Ho Ngoc Duc converter in
  `lunar.ts`; `tests/calendar-system-events.test.ts` checks every Tet date in
  `frontend/src/lib/seasonalTheme.ts` for 2026 to 2046.
- The day-level leap rule can place a leap month differently from the Chinese calendar
  (for example 2023). Tet and Mid-Autumn do not depend on that placement.

## Kid events (`events.ts`, `recurrence.ts`)

- Routes: `POST .../calendar/events` (201), `PUT|DELETE .../calendar/events/:eventId`
  (200 / 204; DELETE takes `?expected_revision=N` only), `POST .../events/:eventId/stop-repeat`
  (200). Every id match is `id AND profile_id`; foreign or sibling ids are 404
  `CALENDAR_EVENT_NOT_FOUND`. Stale revisions are 409 with `details.current`.
- Create and update bodies are strict. Title: control characters removed, trimmed, 1..40
  code points. `start_date` runs from today through today+365 (Vietnam date, captured once).
  New one-time records may start as early as this week's Monday; new repeating
  events must start today or later. The 50-active cap (`CALENDAR_EVENTS_FULL`, 422) is checked under the per-profile lock on
  create and on any update that makes an event active again.
- Active means a one-off with `start_date >= today`, or a series whose `repeat_ended_on`
  is null or today or later. Keep custom event history indefinitely; do not prune
  old one-offs or ended series. Historical one-offs never enter notifications.
- `stop-repeat` on a series that starts today or earlier sets `repeat_ended_on` to today
  (kept if already earlier). A series starting after today becomes a one-off. Stopping a
  one-off, or a series already stopped, returns the event without bumping its revision.
- PUT keeps a stopped series stopped unless its new start is after the stop date, and sets
  `repeat_ended_on` to null when the repeat becomes `none`.
- PUT always keeps an unchanged `start_date`, even a past one (title, icon and repeat edits of
  started events). A changed `start_date` must be from today through today+365 and is
  rejected (422 `VALIDATION_ERROR`) for an event whose stored start is already past.
  When rescheduling, validate `from_date` against the old schedule and read its
  selected participants there, then make the edited title/icon/participants
  effective from the new `start_date`, including moves to an earlier day.
- `occurrencesInWindow` and `isEventActive` (`recurrence.ts`) are pure civil-date helpers
  for the notifications feed. Windows are inclusive and computed directly, never by
  iterating from start_date. `GET .../calendar` returns `events` from the 14-day window as
  `{event_id, date, title, icon_key, repeat, repeat_ended_on, start_date, revision}`.

## Family notifications (`notifications.ts`)

- `GET /api/v1/calendar/notifications` is family-level and session-only: the family comes
  from `c.get('family')`, never from query or body. Other methods are 405 with `Allow: GET`;
  responses are `no-store`; a missing repository is 503 `CALENDAR_UNAVAILABLE`.
- Window is today through today + 3 (Vietnam date, one captured `now`). Items are
  `{occurrence_id, kind, profile_id, profile_name, title_key, title, icon_key, date, days_until}`.
  System items are one per family (`system:<key>:<date>`); kid items are one per profile
  occurrence (`kid:<profile_id>:<event_id>:<date>`).
- Sort is date, then profile name (system items first), then occurrence id. The cap of 100
  applies after sorting. `buildCalendarNotifications` is pure and tested with fakes.
- The SQL reads only rows that can occur in the window, joined to profiles of the session
  family, and keeps at most 50 rows per profile (window function). Do not widen this query
  without revisiting that bound.
- Browser alerts are frontend-only and never need a server push. Do not add a notification
  write or read-state route without a plan change.

## Custom items and names (2026-10-30)

- Follow `docs/plans/2026-10-30-calendar-enrichment.md`. Study items accept a
  reviewed subject icon plus an optional 40-character name. Study favorites live
  in `calendar_study_library` (60 per child); meal favorites keep their existing
  table; every calendar item name shares the 40-character limit. Favorite edits compare the original icon
  and name under the profile lock. Removing/editing a favorite never rewrites plans.
- `POST .../calendar/rename-item` validates the selected date, area, position,
  effective-list revision and weekday-template revision. Rename only that entry
  in that weekday/area series. Never replace all entries sharing a catalog key.
  `series_id` links preserved occurrences of the same entry; keep it through
  reordering and ordinary plan saves. Earlier occurrences retain their names.
  A date-only entry with no series link changes only that entry.
- Event name/icon edits send `from_date`, a displayed occurrence verified by the
  server. Store effective name versions in `calendar_events.name_history` and
  project the name for each occurrence in both calendar and notification reads.
  Keep the original recurrence anchor, including month-end/yearly behavior.
- Migration 0034 is local-only until the repository release gate is satisfied.

## Extra study and teaching language (2026-11-01)

- `study_extra` uses the same validated eight-item study contract, revision locks,
  template/date scope, past-date protection and rename lineage as Morning and
  Afternoon. Migration 0035 extends the list-area check without changing rows.
- Study items optionally accept `teaching_language` as `en` or `vi`; omission
  preserves legacy plans. Validate this field on both reads and writes. Preserve
  it through renames and frozen past lists. It is never identity or completion.
- Migration 0035 has been tested only on a disposable local database. Apply it
  with the API release before enabling Extra saves on a deployed frontend.

## Multi-weekday medicine writes (2026-11-01)

- The existing owned-profile list PUT accepts optional `medicine_repeats` only
  for meal/medicine areas. Each entry has a validated medicine item with UUID
  `series_id` and unique weekdays 1..7. Require exactly one captured template
  revision per selected weekday; reject missing, extra or duplicate revisions.
- Keep the normal draft, past-plan freezing, selected weekday templates and
  affected future date overrides in one per-profile transaction. Any stale
  revision, full day or invalid input rolls back the entire save.
- Append to the same area without replacing other days' meals or existing
  reminders. Freeze old past lists first; add to future date overrides without
  losing their own content. Templates carry recurrence beyond the current window.
- A medicine `series_id` is a profile-scoped reminder lineage/dedupe key, never
  identity or authorization. Skip identical existing lineage; reject conflicting
  content with the same lineage. Preserve this optional field on reads and
  ordinary saves, including legacy medicines with no lineage. No new SQL schema
  or production data migration is required for this JSONB-compatible extension.

## Event participants and family choices (2026-11-01)

- Participants are display-only; no invitations, cross-child writes or rewards.
  Optional `participants` accepts up to 24 unique reviewed roles/profile refs.
  Reject browser names, foreign/unknown/self profile IDs, pending friendships and
  friendships whose scopes do not cover both children. Resolve names server-side.
- Version participants alongside names in `name_history`; omitted participant
  fields retain previous selections. Notification name projections remain names
  only. On friendship revocation/deletion, project A friend without the old ID.
- Owned-profile GET `/calendar/participants?q=` returns six available relatives,
  A friend and up to 100 siblings/accepted friend profiles, with `has_more` for
  narrower live searches. Responses are no-store and family/profile scoped.
- Parent-only GET/PUT `/api/v1/parent/calendar-settings` manages `disabled_roles`
  and a captured `expected_revision`. The authenticated family owns the setting;
  children cannot alter it. Serialize setting writes and role validation under
  one family lock. Existing event roles may be retained after being hidden.
- Migration 0036 adds only `calendar_family_settings`; old events remain compatible.
  Apply locally through the UAT launcher. No production migration is authorized.
