# Kid Calendar: plan

Status: draft v2, revised after the Codex review (section 13 lists what changed). Branch `feature/kid-calendar`. Mockups:
https://claude.ai/artifact/ESdTKCyVj9EWkWmbF2Poze (emoji stand in for icons).

## 1. Goal and non-goals

A reminder, not a minigame. Each child profile gets a **Calendar** activity card
showing **this week and next week** (Monday to Sunday) in three views, one at a
time: **Study**, **Meals**, **Events**. No achievements, rewards, scores or
done-ticking. The minigame achievement rules do not apply. Upcoming events also
appear in the family **Notifications**.

Non-goals: clock-time alerts, medicine names or dosing advice, ticking items off,
editing from Parent Space, weeks beyond next week, month grids.

## 2. Decisions taken from the user's answers (2026-10-29)

| # | Decision |
|---|---|
| 1 | Week is Monday to Sunday. |
| 2 | A toggle "This week" / "Next week", one week at a time. |
| 3 | Tabs Study / Meals / Events; always opens on Study. |
| 4 | No ticking off. |
| 5 | Study = **Morning list** and **Afternoon list**, each an ordered list. |
| 6 | Study and meals are a **weekly template** with a **per-date override**. |
| 7 | One subject per list entry; a club is its own entry. |
| 8 | 16:00 slot is named **Afternoon snack** (VI: Bữa xế). |
| 9 | Meals chosen from a premade library; custom name optional. |
| 10 | Meals also use the weekly template plus per-date override. |
| 11 | Medicine sits inside a meal slot **or** on its own row; each entry has a method icon, colour, quantity and optional dose note (e.g. 2 x tablet red, 100 ml diluted orange). |
| 12 | The **kid** sets medicine. No medicine name is stored. |
| 13 | System events: Tết, Mid-Autumn, Halloween, Christmas, Vietnam National Day (2/9), Women's Day 20/10, Women's Day 8/3, Teachers' Day 20/11, Children's Day 1/6. |
| 14 | Kid events may repeat; they repeat until the kid taps **Stop repeating**. |
| 15 | Notifications include system and kid events, labelled with the kid's name, 3 days before and on the day. |
| 16 | Extend the existing Notifications panel into one list; also a browser notification when permission is granted. |
| 17 | Parent Space shows the calendar **read-only**. |
| 18 | Icons are transparent WebP, 256 px, one shared prompt and style. |
| 19 | About **200** icons in total, including activities (gardening, hiking, skiing, tourist, ...). |

### Assumptions (confirm or change)

- A1 Study entries use the catalog only (no free text). Meals and events allow a
  custom name (meals optional, events required).
- A2 Caps, enforced transactionally: 8 entries per study list, 8 per meal slot
  (foods and medicine together), 6 on the Medicine row, 60 "My meals" rows, 50
  **active** kid events per profile. Custom meal name 40 characters, event title
  40, dose note 16, quantity an integer 1 to 20. The caps are provisional until
  the maximum-content layout proof (section 6) passes.
- A3 Past days of this week stay visible, dimmed and read-only; today and later
  are editable. **Template edits never rewrite history:** when a template list
  is saved, the server first writes frozen date overrides for the past days of
  the current week that have none, so those days keep what they showed.
  Editing an overridden cell edits only that date; the editor shows "Only this
  day (changed)" and a **Restore weekly plan** action that deletes the override.
- A4 "Today" and week boundaries use `Asia/Ho_Chi_Minh`, matching
  `seasonalTheme.ts`. The server captures one "now" per request. The client
  refreshes its window at Vietnam midnight and on window focus.
- A5 Repeat choices: none, weekly, monthly, yearly, anchored to the start date.
  A month without the anchor day (31st) or a non-leap Feb 29 is **skipped**, not
  moved. **Stop repeating** sets `repeat_ended_on` to today (inclusive): earlier
  occurrences stay, later ones disappear. If the event starts in the future,
  stopping turns it into a one-off on its start date. Editing or deleting a
  series applies to the whole series. Occurrences are computed directly for the
  requested window, never by iterating from the start date.
- A6 Medicine is display-only: no clock times, no push at dose time. The app has
  no medicine-name field, but the 16-character dose note is free text, so
  "no medicine name stored" is a product rule, not something the server can
  guarantee.
- A7 Age badge on the hub card: 5+, guidance only, never an access gate.
- A8 Conflict handling is mandatory (section 5): every update, delete and
  stop-repeat carries the row's revision; creating a list uses revision 0.
- A9 Kid-typed text is family-visible plain text. No word filter in v1 (a filter
  gives no authorization or privacy); revisit if the user wants one.

## 3. Hub placement

`frontend/src/pages/ActivityHubPage.tsx`: insert `calendar` at index 3, after
the town card and before `daily-quiz`. Every later card shifts back by one.
Slots 1 to 3 (avatar, badges, town name) stay fixed. Add `calendar: 5` to
`activityAgeGuidance`. Extend the existing playground ordering test so Calendar
is 4th and Daily Quiz 5th.

## 4. Data model (Neon, Drizzle migration `0033_kid_calendar.sql` + rollback)

All rows belong to a profile (`profile_id` FK to `profiles`, `ON DELETE CASCADE`).
Family ownership is always derived from the session through `requireOwnedProfile`.

- `calendar_plan_lists`: one row per editable list.
  `id`, `profile_id`, `scope` (`template` | `date`), `weekday` (1 to 7, template
  only), `local_date` (date, override only), `area` (`study_morning`,
  `study_afternoon`, `meal_breakfast`, `meal_lunch`, `meal_snack`,
  `meal_dinner`, `medicine`), `items` jsonb, `revision` int, `updated_at`.
  CHECK constraints: `scope='template'` requires `weekday` not null and
  `local_date` null; `scope='date'` requires the reverse. Uniqueness uses two
  **partial unique indexes** (a unique key containing a NULL column allows
  duplicates in PostgreSQL): `(profile_id, weekday, area) WHERE scope='template'`
  and `(profile_id, local_date, area) WHERE scope='date'`. Add a
  `(profile_id, local_date)` index for window reads.
  `items` is validated on write (zod) and again when read.
  - study: `[{ "subject": "<catalog key>" }]`
  - meal: `[{ "food": "<catalog key>" }, { "food": "custom", "icon": "<key>", "name": "..." },
    { "medicine": { "method": "<key>", "color": "<token>", "qty": 2, "dose": "100 ml" } }]`
  - medicine row: medicine entries only.
  A `date` row **replaces** the template list for that date and area (an empty
  list means "nothing that day"). Deleting the override restores the template.
  Date overrides older than 14 days are pruned on write.
- `calendar_meal_library`: the kid's "My meals". `id`, `profile_id`, `food_key`
  (catalog key), `custom_name` (nullable), `created_at`; unique
  index on `(profile_id, food_key, coalesce(custom_name, ''))`; cap 60 rows.
  Removing a library meal does **not** remove it from existing lists (lists
  reference catalog keys, not library rows).
- `calendar_events`: kid events only. `id`, `profile_id`, `title`, `icon_key`,
  `start_date`, `repeat` (`none|weekly|monthly|yearly`), `repeat_ended_on`
  (nullable), `revision`, `created_at`, `updated_at`; index
  `(profile_id, start_date)`. Only active events count toward the cap of 50
  (active = no end date, or an end date or one-off date in the future); ended
  series and one-offs older than 60 days are pruned on write.
- **System events are code, not rows.** A server module `server/src/calendar/
  system-events.ts` holds the definitions and date rules: fixed month/day
  (31/10, 24-25/12, 2/9, 20/10, 8/3, 20/11, 1/6) and lookup tables for the
  lunar dates (Tết, Mid-Autumn) for 2026 to 2046. The existing Tết table in
  `seasonalTheme.ts` is the cross-check: a test asserts they agree.
- Cap checks and revision checks run inside one transaction that first takes a
  per-profile advisory lock (the pattern used by `progress.mark`), so concurrent
  first inserts cannot exceed a cap.
- Medicine, meals and study entries reference **catalog keys** only. The server
  catalog (`server/src/calendar/catalog.ts`) is authoritative; a frontend
  catalog carries labels, VI names and art paths. A parity test (same pattern as
  `avatar-frame-parity.test.ts`) fails if the key sets differ.

## 5. API (Hono, all `Cache-Control: no-store`, session-authenticated)

Every profile route calls `requireOwnedProfile`; no family, role or ownership
value is read from the body or query. `requireOwnedProfile` only proves the
**profile in the URL**, so every child-resource operation (event update, delete,
stop-repeat; library delete; list write) also filters `WHERE id = :id AND
profile_id = :authorizedProfileId`, and a sibling's or another family's row id
returns 404. The parent route verifies the profile belongs to the session family
as well as the parent capability.

**Authentication coverage:** `requestNeedsAuthentication` in `server/src/app.ts`
is an allowlist. `/api/v1/profiles/...` and `/api/v1/parent/...` are already in
it; add `/api/v1/calendar` for the family notifications route. Test anonymous,
expired-session and cross-family requests through `createApp` for every route.

**Conflicts:** list writes require `expected_revision` (0 means "no row yet");
event update, delete and stop-repeat require the event's revision; override
delete requires the override's revision. Reads return each list's `id`,
`revision` and whether it is `template` or `override`. A 409 keeps the client's
draft on screen.

| Route | Purpose |
|---|---|
| `GET /api/v1/profiles/:id/calendar` | Resolved window: today (Vietnam date), the two weeks, effective study/meal/medicine lists per date (template + override), meal library, kid events expanded for the window, system events for the window, and a `templates` block (weekday 1 to 7, every area) so the client always has each template's id and revision even when a date override hides it. One bounded read. |
| `PUT /api/v1/profiles/:id/calendar/lists` | Replace one list `{ scope, weekday \| date, area, items, expected_revision }`. Past dates rejected. Saving a template first freezes past days of the current week (A3). |
| `DELETE /api/v1/profiles/:id/calendar/lists` | Remove a date override. |
| `POST/DELETE /api/v1/profiles/:id/calendar/meals` | Add / remove a "My meals" entry. |
| `POST/PUT/DELETE /api/v1/profiles/:id/calendar/events[/:eventId]` | Kid events. |
| `POST /api/v1/profiles/:id/calendar/events/:eventId/stop-repeat` | End a repeating series. |
| `GET /api/v1/calendar/notifications` | Family-level: system and kid events from today through today+3 for every profile in the session family, with the kid's name. Bounded (max 100). |
| `GET /api/v1/parent/calendar/:profileId` | Same projection as the first route, read-only; requires the parent capability. |

Validation is an executable contract: strict, area-specific zod schemas (no
hybrid item objects, no keys from the wrong area, integer quantity 1 to 20,
valid civil dates, names re-checked after trimming and control-character
removal), parsed with the bounded streaming `parseJson` in `server/src/input.ts`
on every body-bearing method (the global Content-Length check is not enough).
JSONB arrays are serialized explicitly for parameterized writes, as existing
repositories do. Stored JSON that fails validation on read is dropped for that
list and logged, never crashed on. List writes accept dates from today through
the end of next week only. Never accept a client-supplied "today". Errors use
the existing structured envelope.

## 6. Frontend

New code lives in `frontend/src/components/Calendar/` and `frontend/src/pages/
CalendarPage.tsx` (route `/calendar`, `FamilyGate` + `ProfileGate`).

- Layout (see mockups): header with back button, week toggle, view tabs; a
  7-column grid with a left row-label column. Cells show up to 3 chips and a
  "+N" chip; tapping a cell opens an **editor sheet** for that list (palette,
  ordered list with up/down buttons, "Every Thursday" vs "Only 29 Oct" choice).
  This keeps every state inside the viewport without scrolling.
- Study: Morning and Afternoon rows. Meals: four slot rows plus a Medicine row.
  Events: a two-week agenda of days that have events (system events in orange,
  kid events in yellow).
- **Meal setup**: "My meals" dialog (palette plus optional custom name) and the
  medicine reminder dialog (method, colour, quantity, dose note, where it goes).
- Event editor: name, day, repeat, icon picker with groups.
- Strings: all UI text through `uiText` / `useUiLanguage`; Vietnamese in
  `vi.json`; catalog item names carry `en` and `vi` labels in the frontend
  catalog. Kid-typed names are shown as typed (React text nodes, never HTML).
- Notifications: see section 8.
- Parent Space: a read-only calendar view per child, reachable from the child
  report. Edit controls are absent, not just disabled.
- Navigation: use `KidBackButton` and the shared top-right slot (language ball)
  required by `frontend/AGENTS.md`; follow its shared target sizes.
- Viewport: no vertical or horizontal scroll at 1366x768, 1024x768 and
  1180x820 in every view, editor sheet and dialog. The layout is **proven early**
  (Foundation slice) with maximum content in both languages: 8 study entries per
  list, 8 foods plus medicine in a slot, the 60-meal library, the 86-icon
  activity group and a dense two-week agenda. Design answers: palettes, the
  library and the icon picker are **paged** (fixed page size, group tabs);
  agendas show at most N days with a "more" control; the editor is a right-hand
  drawer on landscape with a **sticky** Save / Cancel bar; dialogs anchor to the
  top and use `visualViewport` so the iPad keyboard never hides the actions;
  focus returns to the tapped cell; an unsaved draft survives a language switch.

## 7. Icons (about 200)

Transparent WebP, 256 x 256, text-free storybook style matching the vehicle
sprites and badges: navy outline `#17324D`, the shared palette, one centred
subject, same line weight and detail. One shared prompt file
`frontend/public/calendar/UNIVERSAL_CALENDAR_ICON_PROMPT.md`. Files live under
`frontend/public/calendar/icons/<group>/<key>.webp` with a manifest (key, group,
EN and VI label). Working files and contact sheets stay local under the ignored
`output/` folder (the new git hook blocks committing them).

| Group | Count | Examples |
|---|---|---|
| Study subjects | 24 | Math, Vietnamese, English, Science, History & Geography, Nature & Society, Art, Music, Computer, Technology, Ethics, Handwriting & Dictation, Reading, Life Skills, Experiential Activities, Homeroom, Flag Salutation, STEM, Coding, Second Language, Craft, Library, Self-study, Extra Tutoring |
| PE | 12 | Swimming, Football, Basketball, Badminton, Table Tennis, Volleyball, Gymnastics, Athletics, Martial Arts, Dance, Cycling, Skating |
| Clubs | 19 | Flower Decoration, Chess, Football, Drawing, Piano, Guitar, Singing, Coding, Science, Debate, Reading, English, Robotics, Cooking, Calligraphy, Drama, Photography, Scouts, Origami |
| Meals and drinks | 42 | rice, phở, bánh mì, eggs, grilled chicken, fish, pork, beef, tofu, vegetables, salad, soup, fruit, yogurt, milk box with straw, canned milk, soy milk, juice, water, porridge, sticky rice, dumplings, sandwich, cake, cookies, ... |
| Medicine methods | 8 | tablet, capsule, syrup spoon, drops, cream tube, powder in water, inhaler, patch |
| System events | 9 | Tết, Mid-Autumn, Halloween, Christmas, National Day, 20/10, 8/3, Teachers' Day, Children's Day (tailor-made, hard-coded) |
| Generic events and activities | 86 | gardening, hiking, skiing, tourist trip, camping, beach, fishing, birthday, show, baking, visit grandparents, doctor, haircut, ... |

QA per batch: automated checks (size, alpha channel, bounding box margin, file
size) plus a contact-sheet review by the main model for consistency and
recognisability at 32 px; failures are regenerated.

## 8. Notifications detail

`GET /api/v1/calendar/notifications` (family level, session only) returns, for
`days_until` 0 to 3, `{ occurrence_id, kind: "system"|"kid", profile_id | null,
profile_name | null, title, icon, date, days_until }`. System events are one
item per family ("for everyone"); kid events are one item per profile.
`occurrence_id` is globally unique: `system:<event_key>:<date>` or
`kid:<profile_id>:<event_id>:<date>`.

Panel behaviour (extends `FriendNotificationList`):
- Two groups in one panel: **Coming up** (calendar items, soonest first, then kid
  name, then id) above the existing friend requests (existing sort). Each group
  has its own preview length, so calendar items can never hide friend requests.
- The badge is a **total count** of listed items, as today (the panel has no
  read state); calendar items drop off when the day passes.
- Browser alerts: only when notification permission is already granted and the
  app is open (no push service). One alert at 3 days before and one on the day,
  per `occurrence_id` and `days_until`, per device. The dedupe set is stored in
  `localStorage` keyed by family id, holds identifiers only and keeps at most
  200 entries.
- Lifecycle: Calendar queries use `familyQueryKey`/`familyScopedQuery`, are added
  to the explicit private-cache prefix list in `lib/familyQueries.ts`, ignore
  responses that arrive after a family or session change, and close open
  browser notification handles and clear dedupe state on logout and account
  switch (mirroring `FriendRequestNotifications.tsx`). Polling reuses the
  existing 15 s notification cadence; the calendar endpoint is cheap and bounded.
- Server bound: the query is limited by profile count and a 100-item cap, with
  database work bounded before truncation.

## 9. Security and privacy

- Authorization: session + `requireOwnedProfile` on every kid route; parent
  route requires the parent capability; no admin write routes.
- No trust in client identity, dates, ownership or keys; unknown catalog keys
  are rejected; list sizes, string lengths and event counts bounded; SQL
  parameterized; jsonb validated on write and read.
- Kid-typed text (custom meal name, event title, dose note) is visible only to
  that family, rendered as plain text, length-limited, control characters
  removed. No word filter in v1 (A9).
- Medicine rows are reminders only; Parent Space labels them "reminders set by
  your child, not medical advice".
- Child-resource operations always match row id and authorized profile id;
  parent reads verify family ownership; notifications are family-scoped only.
- Private responses are `no-store`; no new browser-to-provider calls; no cloud
  resources created from this branch; migrations run only on guarded local DBs.

## 10. Tests

- Server (disposable Postgres, run by Haiku; the report must show
  `TEST_DATABASE_URL` was set and the DB tests actually ran, not skipped):
  - `createApp` authentication for every route (anonymous, expired, cross-family).
  - Ownership: an owned profile combined with a sibling's or foreign family's
    event, library or list id returns 404 for update, delete and stop-repeat.
  - Parent route: capability required, family ownership verified, read-only.
  - Validation: area-specific schemas, wrong-area keys, hybrid objects,
    fractional quantity, invalid dates, blank-after-cleaning names, malformed
    stored JSON, oversized bodies.
  - Concurrency: concurrent first inserts and cap enforcement; stale-revision
    update, delete and stop-repeat return 409; create-vs-create race.
  - Template vs override: override replaces template; restore; saving a template
    freezes past days of the current week; override pruning.
  - Recurrence: weekly; monthly skipping the 31st; yearly Feb 29 (leap and
    non-leap); stop-repeat before the first occurrence; window computation
    without iterating from the start date; cross-year weeks.
  - Time: week window and "today" around Vietnam midnight (UTC 16:59 and 17:00).
  - System events: fixed dates, Tết and Mid-Autumn tables, agreement with the
    Tết table in `seasonalTheme.ts`.
  - Notifications: window 0 to 3, 100 cap, id uniqueness, family isolation.
  - Migration up/down, and `rollback_all.sql` ordering.
- Frontend:
  - Hub order: Calendar 4th, Daily Quiz 5th; update the hard-coded age-badge
    count in `playground-polish.test.ts`.
  - **Symmetric** catalog parity: equal key sets in both directions, unique
    keys, valid group membership, and that every referenced WebP exists.
  - Merged notifications: two groups, ordering, truncation per group, total
    count, browser-alert dedupe, and cleanup on family switch with pending
    requests and open alerts.
  - `vi.json` coverage for every new string; locale switch with an unsaved draft.
  - Editor sheet behaviour; Parent view has no edit controls.
- Browser (follow the existing harness pattern in `frontend/tests/browser`;
  complete flows at 1366x768, 1024x768 and 1180x820): set a study template,
  override one date, restore, meal setup, medicine in a slot and on its own row,
  add and stop a repeating event, week and view switching, notifications, parent
  read-only view, maximum-content states in English and Vietnamese, iPad
  keyboard open, Vietnam-midnight rollover. Check every button's bounds and that
  nothing scrolls.
- Hooks: the artifact guard runs on every commit; icon working files stay in the
  ignored `output/` folder.

## 11. Delivery slices (each runnable, each with validation, Vietnamese copy and viewport checks)

0. **Guide updates**: record the new decisions where the repo guides disagree
   (section 13, "Repo rules to change").
1. **Foundation**: migration deliverables (schema.ts, `0033_kid_calendar.sql`,
   journal and snapshot, per-migration rollback, `rollback_all.sql`, the
   hard-coded latest-migration check in `migration.test.ts`), repository
   contract and factory, route registration and authentication coverage, catalog
   (server and frontend) with symmetric parity test, **read and list-write API
   with revisions**, Study view with template and override editing, the
   maximum-content layout proof, hub card and route, study icons.
2. **Meals**: meal library, meal editor, medicine entries (slot and own row),
   meal and medicine icons.
3. **Events**: system events, kid events with repeat and stop-repeat, event
   icons (system 9 first, then generic).
4. **Notifications**: family notifications route, merged panel, browser alerts,
   cache and session lifecycle.
5. **Parent view**: read-only projection and page.
6. **Finish**: remaining icons to about 200, Vietnamese review, `AGENTS.md` for
   `frontend/src/components/Calendar/` and `server/src/calendar/` (numbered
   questions and the viewport rule).

Work split: Codex (Luna high; Sol medium for the migration, authorization,
revision and recurrence logic) writes code, tests and icons; Haiku runs the DB
and browser suites and reports that DB tests ran; the main model plans, reviews
each slice and checks icon consistency.

## 12. Open questions for the user

1. Past days: is "dimmed and frozen" (A3) what you want, or should past days be
   hidden?
2. Study custom names (A1): keep catalog-only for v1?
3. Repo rules to change (section 13): approve the two guide edits?

## 13. Changes from the Codex review (2026-10-29)

Verified against the code: the notifications route was outside the
authentication allowlist (`requestNeedsAuthentication`, `app.ts:174`); the list
unique key contained NULL columns; the Daily Quiz guide says "Daily Quiz is
fourth". Applied: authentication coverage; row-id plus profile-id matching and
parent family checks; partial unique indexes and CHECKs; mandatory revisions;
strict schemas and bounded `parseJson`; template-vs-history rule (A3); recurrence
rules (A5); caps, pruning and transactional enforcement; notification identity,
alert days, count and lifecycle; complete migration deliverables with write API
in Foundation; stronger parity, hub and DB-ran tests; the maximum-content layout
proof moved into Foundation.

### Repo rules to change (need approval)

- `server/src/daily-quiz/AGENTS.md` line 30: "Daily Quiz is fourth" becomes
  "Calendar is fourth, Daily Quiz is fifth" (your instruction).
- Root `AGENTS.md`: "Work on feature/backend-migration-sites until UAT is
  complete" is stale (PR 93 and this branch use feature branches); replace it
  with "work on a feature branch off main".

## 14. Slice 1 refinements and weather (user request, 2026-10-29)

### UI refinements
- Cells show as many chips as fit the cell height; "+N" appears only for chips
  that do not fit.
- The editor list supports drag-and-drop reorder with Pointer Events (mouse and
  touch); the arrow buttons stay as the keyboard and accessibility path.
- The page header gets a consistent inset and top padding.
- Saturday and Sunday columns use a warm peach tint (today and past-day styling
  still win).
- The Morning row card shows a sunrise icon aligned to its top; the Afternoon
  row card shows a sunset icon aligned to its bottom, both with padding.

### Weather (server-side only)
- **Source and privacy:** Open-Meteo forecast API (no key), called only by the
  server (no browser-to-provider calls). Location is the profile's saved city
  and country, geocoded with the existing `geocodeHome` (Nominatim) and then
  **rounded to 0.1 degrees (about 11 km)** before any weather request, so no
  identity or precise position leaves the server. No location saved: weather is
  hidden and a short hint explains how to add a home city (never a guessed
  place).
- **Endpoint:** `GET /api/v1/profiles/:profileId/calendar/weather` returns
  `{ status: 'ok' | 'unavailable' | 'no_location', location_label, updated_at,
  days: [{ date, morning, afternoon, evening }] }` for the same 14-day window,
  each period `{ icon, temp_c }` with `icon` one of the 12 weather icon keys.
  Provider failures return `status: 'unavailable'` with HTTP 200, never a 5xx.
  The route is session-authenticated and uses `requireOwnedProfile`.
- **Mapping:** morning 06-11, afternoon 12-17, evening 18-23 local hours.
  WMO codes map to `sunny`, `partly_cloudy`, `cloudy`, `fog`, `drizzle`, `rain`,
  `heavy_rain`, `thunderstorm`, `hot` (clear and 35 C or more), `windy`
  (strong wind, no precipitation), and for the evening `clear_night` and
  `cloudy_night`. The most severe condition in a period wins
  (thunderstorm > heavy_rain > rain > drizzle > fog > cloudy > partly_cloudy >
  sunny). Past days of the current week use the provider's `past_days`.
- **Untrusted provider data:** fixed host allowlist (`api.open-meteo.com`), no
  redirects, 4 s total timeout, 1 MB response cap, strict zod validation of the
  response (array lengths, finite numbers, plausible ranges), only rounded
  numeric coordinates in the URL.
- **Cache:** in-memory, bounded (500 entries) keyed by rounded coordinates,
  60 min TTL, 5 min negative TTL, in-flight request coalescing, stale-if-error
  up to 6 h; geocoding results cached 7 days (Nominatim usage policy: identified
  User-Agent, at most 1 request per second).
- **UI:** a small weather icon with the temperature at the top right of each
  Morning and Afternoon cell, and a thin **Evening** row (about 40 px) under the
  grid with one weather icon per day. A separate `useCalendarWeather` hook
  (30 min stale time); failures are silent. Icon assets: 12 weather icons plus
  sunrise and sunset under `frontend/public/calendar/icons/{weather,time}/`.
- **Tests:** WMO mapping table, period aggregation and severity order, cache
  TTL, coalescing and stale-if-error with a fake fetch and clock, validation
  rejections, route authentication and ownership, rounding, no real network in
  tests.

## 15. Remaining slices: frozen contract (2026-10-29)

Catalog keys are in `server/src/calendar/catalog.ts` (authoritative): `MEAL_FOOD_KEYS`
(42), `MEDICINE_METHOD_KEYS` (8), `MEDICINE_COLOR_KEYS` (8), `SYSTEM_EVENT_KEYS` (9),
`GENERIC_EVENT_ICON_GROUPS` (86 in 6 groups) and `EVENT_ICON_KEYS` (study + meal +
generic, all unique). Art paths: `/calendar/icons/meals/<key>.webp`,
`/calendar/icons/medicine/<method>.webp`, `/calendar/icons/events/system/<key>.webp`,
`/calendar/icons/events/<group>/<key>.webp`; study icons keep `/calendar/icons/study/`.
Manifest groups `meal`, `medicine`, `system_event`, `event` (subgroup = group name).

### Meals and medicine (server)
- List PUT/DELETE already accept meal areas and `medicine` with the item shapes in
  section 4 (custom meal item: `{food:'custom', icon:<MEAL_FOOD_KEY>, name}`; medicine item:
  `{medicine:{method, color, qty 1..20, dose?<=16}}`, allowed in meal areas and on the
  `medicine` row, cap 6 on the medicine row, 8 per meal slot).
- `GET .../calendar` returns `meal_library: [{id, food_key, custom_name: string|null}]`.
- `POST /api/v1/profiles/:id/calendar/meals` body `{food: MealFoodKey, custom_name?: string(1..40)}`
  -> 201 `{id, food_key, custom_name}`; the same (food, custom_name) again returns 200 with
  the existing row; more than 60 rows -> 422 `CALENDAR_LIBRARY_FULL`.
- `DELETE /api/v1/profiles/:id/calendar/meals/:mealId` -> 204; unknown or foreign id -> 404.
  Removing a library row never edits lists.

### Events (server)
- `calendar_events` rows (see section 4). Kid event JSON: `{id, title, icon_key, start_date,
  repeat: 'none'|'weekly'|'monthly'|'yearly', repeat_ended_on: string|null, revision}`.
- `POST .../calendar/events` body `{title(1..40), icon_key: EventIconKey, start_date, repeat}`
  (start_date from today through 365 days ahead; 50 active events max, else 422
  `CALENDAR_EVENTS_FULL`) -> 201 event. `PUT .../calendar/events/:eventId` body
  `{title, icon_key, start_date, repeat, expected_revision}` -> 200 event, 409
  `CALENDAR_REVISION_CONFLICT` with `details.current`. `DELETE .../events/:eventId?expected_revision=N`
  -> 204. `POST .../events/:eventId/stop-repeat` body `{expected_revision}` -> 200 event
  (sets `repeat_ended_on` to today inclusive; if `start_date` is in the future it becomes a
  one-off, `repeat:'none'`). Every query filters `id AND profile_id`.
- Recurrence (anchored to `start_date`): weekly = same weekday; monthly = same day of month,
  months without that day are skipped; yearly = same month and day, Feb 29 only in leap
  years. Occurrences are computed directly for the requested window (no iteration from the
  start date); an event with `repeat_ended_on` has no occurrence after it.
- `GET .../calendar` returns `events: [{event_id, date, title, icon_key, repeat, revision}]`
  (kid occurrences inside the 14-day window, sorted by date then title) and
  `system_events: [{key: SystemEventKey, date}]`.
- System events (`server/src/calendar/system-events.ts`): fixed dates `halloween` 10-31,
  `christmas` 12-25, `national_day` 09-02, `womens_day_oct20` 10-20, `womens_day_mar8` 03-08,
  `teachers_day` 11-20, `childrens_day` 06-01; lunar `tet` (lunar 1/1) and `mid_autumn`
  (lunar 15/8) computed with the Ho Ngoc Duc lunar-calendar algorithm for UTC+7; tests must
  reproduce the existing Tet table in `frontend/src/lib/seasonalTheme.ts` for 2026 to 2046
  and the Mid-Autumn dates 2026-09-25, 2027-09-15, 2028-10-03.

### Notifications (server)
- `GET /api/v1/calendar/notifications` (session, family scoped, no-store, already in the
  authentication allowlist) -> `{items: [{occurrence_id, kind:'system'|'kid', profile_id:
  string|null, profile_name: string|null, title_key: string|null, title: string|null,
  icon_key: string, date, days_until: 0..3}]}` sorted by date, then name, then id; at most
  100 items. System events are one item per family (`occurrence_id` = `system:<key>:<date>`);
  kid events one item per profile occurrence (`kid:<profile_id>:<event_id>:<date>`).

### Parent (server)
- `GET /api/v1/parent/calendar/:profileId` requires the parent capability and that the
  profile belongs to the session family; returns the same JSON as the kid `GET .../calendar`
  (no weather). Read-only; there are no parent write routes.
