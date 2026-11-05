# Calendar component guide

Follow [`frontend/AGENTS.md`](../../../AGENTS.md), [`frontend/src/i18n/AGENTS.md`](../../i18n/AGENTS.md), and the Slice 1 plan at [`docs/plans/2026-10-29-kid-calendar.md`](../../../../docs/plans/2026-10-29-kid-calendar.md).

- Number brainstorming and clarification questions uniquely within each batch;
  use short lettered choices where useful and preserve pending question numbers.
- Calendar is a reminder, not a minigame. It has no achievements, scores,
  rewards, done-ticking, or client-trusted completion state.
- Study writes `study_morning`, `study_afternoon` and `study_extra`. The API is
  profile-scoped and same-origin. Use the server-owned `today`, never a
  browser-supplied date or identity.
- Saving `Every <weekday>` sends the weekday template revision. Saving `Only
  <date>` sends the date list revision only when the effective list is an
  override; otherwise it sends revision 0. Restore is available only for an
  override and deletes with that override revision.
- A 409 `CALENDAR_REVISION_CONFLICT` keeps the draft visible, refetches the
  calendar, and lets the child save again. Do not overwrite a draft with the
  server's conflict copy.
- The editor draft stores stable catalog keys, so switching UI language
  changes labels without clearing or remounting the draft. User-entered text
  in later slices must remain plain React text.
- Optimize every calendar state for 1366x768, 1024x768 and 1180x820, plus tall
  desktop screens. Study has a 38px heading, Morning and Afternoon rows capped
  by `--calendar-study-row-max`, a compact 140px Extra row, and optional Evening
  weather. Extra is for study activities at home and uses evening artwork. All
  rows shrink with available height; chips that cannot fit use a truthful +N.
  Editors keep eight 48px order rows and their actions within the viewport.
- Kid page layout (`CalendarPage`): one 63px navigation row (`--calendar-header-height` =
  10 + 52 + 1). A 64px left rail aligned with the visible grid (`.calendar-rail`, `--calendar-rail-width`)
  sits under the header, and the table starts after it plus `--calendar-rail-gap`.
  The rail is one grid with `minmax(0, 1fr) auto minmax(0, 1fr)` rows and symmetric
  `--calendar-grid-pad-top/bottom` padding, holding three groups: (a) top, the week group
  (`CalendarWeekToggle`, `orientation="vertical"`: "This week" and "Next week", 52px
  buttons, 60px wide, 13px bold two-line labels, accent fill for the active week);
  (b) middle, the three view tabs (Study, Meals, Events; 72px buttons, 8px gap), exactly
  centred; (c) bottom, the view's adding action slot, pinned bottom-left with the table's
  bottom padding. Rail and stage share the capped natural grid height, so the
  week group aligns with the first day heading and the action ends at the last
  row on tall screens too. There is no toolbar row, so the table area starts at the header, takes
  its natural height (padding, heading, capped rows, gaps) and shrinks only when short.
  Study and Meals share `--calendar-grid-columns` (84px label minimum, .72fr, seven
  days); Events uses `--calendar-grid-columns-events` (seven days). Parent Space keeps
  its 100px label column and its horizontal week toggle and view tabs (the same
  component, horizontal orientation, identical markup).
- Week tabs keep tablist semantics: two tabs, `aria-selected`, and the week index lives
  in `CalendarPage`. The week group is never inside the table.
- Adding actions are portaled, never rendered in the view: `CalendarPage` owns the
  `calendar-toolbar-action` element (the rail's bottom slot) and passes it as
  `toolbarSlot`. Events renders "Add event" and Meals renders "My meals" (opens
  `MealLibraryDialog`) there, only when not `readOnly`. Each is a 60 x 64px primary
  button with a decorative `+` (`aria-hidden`) above a two-line label, so its
  accessible name is the label alone. Study has no action. A view with no slot renders no action.
- Chips remain 28px tall with 2px gaps and 24px artwork. Morning and Afternoon
  display clubs at the bottom, below a subtle dashed divider. Each row measures
  its shortest stack and largest club count to reserve one shared club-section
  height for cards containing clubs; cards without clubs keep their whole stack.
  Bottom-align the club entries within that section; keep order within each
  group and never rewrite
  saved item order for presentation. Include the divider in capacity calculations
  and reserve +N for hidden entries in each section. Extra uses a single stack.
- Weather is server-owned and fetched by `useCalendarWeather` through the
  same-origin profile route. Failures are silent. An `ok` response renders a
  22px icon and temperature in a full-width strip above each Morning/Afternoon
  chip stack (22px high plus a 2px gap, muted, no background, not interactive),
  plus a 38px Evening row with 24px icons; `no_location` renders that row with
  one spanning home-city hint; loading and unavailable responses reclaim the
  row and strip. Weather artwork is informational and never interactive. Keep
  the day heading, strip height/gap, chip height/gap, and Evening row tied to the
  shared CSS variables/constants (`CALENDAR_CHIP_HEIGHT`, `CALENDAR_WEATHER_STRIP_HEIGHT`)
  so chip capacity remains truthful. Past days
  and weekend/today styling continue to win over weather presentation.
- Keep controls keyboard-accessible with 44px-or-larger actions, Escape
  close, visible focus, focus return to the tapped cell, and reduced-motion
  support.
- Meals (`MealsView`, `MealEditorDrawer`, `MealLibraryDialog`, `MedicineDialog`):
  meal slots hold at most 8 entries (foods and medicine together) and the
  Medicine row at most 6. Lists use the same revision and scope rules as Study
  (`buildMealListWrite`). "My meals" rows are at most 60, sent to
  `POST/DELETE .../calendar/meals`; the client never invents library rows or
  rewards. Medicine entries are reminders (method, colour, quantity, optional
  16-character dose note); no medicine name is stored or displayed.
- Meal tiles are 32px and wrap inside the cell. `visibleTileCount` (in
  `lib/calendarMealHelpers.ts`) draws only the tiles that fit and reserves one
  slot for "+N". Meal rows are capped at 160px and the Medicine row at 96px
  (`--calendar-meal-row-max`, `--calendar-meal-medicine-row-max`), with
  `minmax(0, cap)` so they shrink on short screens. Meal cells pad 4px sideways.
  At 1024 and 1180 wide a Meals tile stack is about 102px wide (1024: day column
  113.6px), enough for three tile columns; eight tiles need a 100px-tall stack (the
  768px layout gives 100.75px). `calendar-layout-budget.test.ts` models these numbers;
  browser checks at 1366x768, 1024x768, 1180x820 and 1495x1288 are still required.
- `readOnly` (parent view) renders inert `div` cells with neutral labels
  ("Breakfast for 26 Oct: Rice, Eggs"), never "Edit ...", and mounts no drawer,
  dialog or add/set-up control.
- Meal artwork lives under `/calendar/icons/meals/<key>.webp` and medicine under
  `/calendar/icons/medicine/<method>.webp`. Keys must match the server catalog;
  `server/tests/calendar-meal-parity.test.ts` checks both directions. Tests do
  not require the image files to exist.
- Eye/nose drops use `eye_nose_drops`, a pointed-tip squeeze bottle. Keep the
  existing `drops` key/art compatible with saved reminders.
- Apply favorite mutations to the family/profile calendar query from the
  server-returned row before refreshing. Never invent saved rows or hide the
  loaded calendar/dialog on a background read failure; keep an explicit retry.
  Scroll the saved favorite into view and show an accessible success confirmation.
- `node tests/calendar-meals.browser.mjs` (from `frontend`) verifies independent
  device sessions, failed save/read recovery, scrolling and landscape bounds
  with isolated synthetic data. Database tests verify persistence separately.

## Events view and kid-event editor

- The Events view shows seven day cards for the selected week. System events
  are orange, read-only and use bespoke artwork from `lib/calendarEventCatalog.ts`;
  kid events are yellow with the custom-item border and tappable on displayed
  past days too. Past days remain dimmed; system events are always read-only.
- Each day has a `calendar-day-heading` container above its card (the same
  markup, weekend tint, today highlight and past dimming as Study and Meals).
  The weekday and date are not inside the card; the card's accessible name keeps
  them. Cards are capped at 480px (`--calendar-event-card-max`) and centred.
- A day with no events (system or kid) shows a visible 12px "Empty day" label
  (`uiText`, Vietnamese "Ngày trống") centred in the card. The card still renders
  with its border, tint and past dimming, and the accessible name ends in
  ", Empty day". This also applies to past days, Next week and readOnly.
- Kid event rows are 44px touch targets; the day list shows as many rows as fit
  (`visibleEventRowCount`) and reserves a row for "+N". The repeat badge is
  decorative: the row's accessible name states whether it repeats.
- `readOnly` (parent view) renders no edit affordance at all: no Add button, no
  buttons or tab stops on event cards, neutral accessible names and no drawer.
- The editor saves the series `start_date` from the server, never the occurrence
  `date`. A started event (start before today) keeps its date and changes only its
  title, icon and participants. "Stop repeating" is offered only for a live series
  (`repeat !== 'none'` and `repeat_ended_on` null); stop and delete use a two-step
  inline confirm, never browser dialogs.
- A 409 keeps the draft; only the revision the next write sends is refreshed from
  `details.current` or the next window read. A 422 `CALENDAR_EVENTS_FULL` shows the cap
  message. Titles are trimmed, control characters removed and NFC-normalised, max 40
  UTF-16 units (the server's count). New one-time records may start on this
  week's Monday; new repeating events start today or later, up to 365 days ahead.
- Icon keys are study, meal or generic only (never system or medicine).
  `server/tests/calendar-event-parity.test.ts` checks the system and generic keys
  in both directions. Artwork is rendered with reserved size; tests never require
  the image files to exist.
- Eight picker tabs (Study, Meals and six generic groups) show each group's full
  icon list in a bounded scroll panel; labels use the active UI language.
- Layout targets are the same as the Study editor: landscape right drawer, sticky
  action bar, no page scrolling at 1366x768, 1024x768 and 1180x820.
- "+N" on a day card is a 44px button with `aria-expanded="false"` (accessible name "Show all 12
  events on 30 Oct"). Tapping it expands that card in place: every event of the day is listed inline
  and the card grows downward as an overlay. There is no separate window and no pager.
- Expansion rules: one card expanded at a time (expanding another collapses the first). Only the
  card changes. The slot (`.events-day-slot`, `position: relative`) keeps the grid cell, so no row,
  neighbour or page scroll moves. The expanded card is `position: absolute` at the slot top, uses
  the same border, tint, today, weekend and past styling, is elevated (`z-index`, soft shadow), and
  its height is the content height capped at `--events-expanded-max` (viewport bottom minus the
  card's top minus 12px). It scrolls inside only past that cap. The height and shadow transition
  is 180 ms and disabled under reduced motion.
- Collapse: a `pointerdown` in the capture phase on the document collapses the card when the target
  is outside it. The press is never cancelled, so a tap on another "+N" or control still works. Escape
  collapses too. Both pause while a kid-event editor is open, so the card stays expanded underneath.
  A tap inside the card does not collapse it.
- Focus: expanding moves focus to the card's "Show fewer" control; Escape and "Show fewer" return
  focus to the day's "+N" button. "Show fewer" is a keyboard and screen-reader control: it is visually
  hidden until it takes focus, and it `aria-controls` the card.
- In the expanded card a kid row opens the event editor (the card stays expanded) and system rows are
  read-only. In `readOnly` (parent view) the "+N" still toggles the card and rows stay non-interactive.
  The "+N" is the one button a parent sees on the Events view, so the parent rule above covers cards
  and rows, not this control.
- Study and Meals cells are unchanged: their "+N" is part of the cell button that opens the editor.
- Every dialog calls `useModalA11y` (Tab trap, inert page behind the topmost dialog,
  focus fallback when focus was lost on close; Escape stays in each component) and
  `useVisualViewportFit` (iPad on-screen keyboard). The viewport variables are unset on
  desktop. Meal dialogs fit their backdrop, which contains only the dialog.

## Family notifications

- The Notifications panel is one merged panel. Its badge is the total of listed calendar
  items plus friend requests. "Coming up" (calendar, preview 3) sits above friend requests
  (preview 2); each group has its own "Show all" toggle, so one group never hides the other.
- Calendar data comes from `useCalendarNotifications` (`calendar-notifications` family key,
  5 minute stale time, 15 minute refetch, refetch on focus, failures silent). Calendar writes
  should invalidate `calendarNotificationsQueryKey(familyId)` so the panel updates.
- Browser alerts run only when `Notification.permission` is already `granted`; never prompt
  from calendar code. Alerts fire only for days 3 and 0, once per occurrence and day, and
  the dedupe ledger stores identifiers only under a per-family key (max 200 entries).
  Logout or a family switch closes open alerts and clears that family's ledger.
- Calendar items and their artwork use the shared event catalog (system labels are
  localized; kid titles stay as typed). Keep copy in `uiText`/`vi.json`.
- Panel rows use 28px artwork with `alt=""` and reserved size; the text carries the meaning.

## Alerts decisions (user, 2026-10-29)
- Calendar browser alerts fire whether or not the tab is visible (friend-request alerts still wait for a hidden tab). Do not gate `calendarNotificationAlerts.ts` on `visibilityState`; a test pins this.
- The permission banner on the profile picker is titled "News" (Vietnamese "Tin mới") and covers friend requests and upcoming events.

## Custom items and direct rename (user, 2026-10-30)

- Choose an icon first, autopopulate the editable name with a soft static glow,
  then explicitly press "Mark as favorite". Choosing an icon must never save.
  Keep child-typed text when changing icons; unedited defaults follow UI locale.
- Study has a per-child "My subjects" library with reviewed study icons and
  custom names. Meals has category filters and accent-insensitive EN/VI search.
  Favorites allow name/icon edits and removal; no copy action.
- Distinguish custom subjects, meals and kid events with a subtle lilac border.
  Never add a "Custom" label. Selection and focus remain separately visible.
- Study names stay editable after adding, removing or reordering draft items.
  New subject names stay in the draft until the plan is saved. Saved subject
  renames keep their original server position and refresh captured revisions
  without discarding unsaved additions. Meals currently requires saving
  structural changes before renaming. Past Study/Meals cells open for renaming only; ordinary plan edits
  remain disabled. Send the selected list position and both captured revisions
  to the server; never perform catalog-wide replacement in the browser.
- Rename from the selected occurrence onward, including a displayed past day,
  only within that entry's weekday/area series. Tuesday Math and Wednesday Math
  are independent. Earlier occurrences keep their original names. Date-only
  items with no series link change once. Events send the selected `from_date`.
- Keep custom historical events; label past one-time records "No reminder".
  Do not permit new repeating series to start in the past. System events are
  derived from universal definitions instead of saved per child.
- Existing icon sheets are part 1. Add sheets as parts 2, 3, etc. using the shared
  calendar icon prompt; preserve old keys/art and extract production WebP icons.
  Raw sheets, extraction and QA stay in ignored `output/calendar-icons/`.

- Meal/event fixed overlays portal to the calendar page outside the animated
  week pane: its retained transform creates a fixed-position containing block.
  Keep the medicine action in the palette; meal entries use non-shrinking 46px
  rows for 44px controls. Check clipping ancestors as well as viewport bounds
  when verifying every entry; overflow-hidden content can be inside the viewport
  and still be invisible.
- Scope meal row columns/padding above the shared study-list selectors: one
  flexible name column plus one 44px remove target. Its visible face is 32px,
  inset 6px vertically, so the button stays inside its own 46px row.

- Meals includes sausage, generic vegetable soup and fast food. Fast food uses
  a generic red takeaway bag with only the letters FF, explicitly requested
  by the user as an exception to the text-free artwork rule. Never use a
  burger/fries/drink bundle or restaurant branding for this generic icon.
- Choosing the fast-food icon shows a non-blocking amber notice in the favorite
  chooser and meal editor, including custom names using that icon. Explain that
  fast food can be high in salt, sugar and unhealthy fats; never claim unknown
  chemical exposure, count consumption or infer actual eating from a plan.

- Study order rows use 48px tracks: 44px controls plus 2px total padding and
  2px total border. Keep the track and row height aligned; verify each button
  against its own row bounds, including a full eight-subject list.

- On touch devices or viewports up to 1180px wide, meal slots use two columns
  of larger icons, up to 64px. Size them from the cell width/height and reserve
  +N when not all entries fit. Keep the capacity calculation and rendered tile
  size identical. The dedicated Medicine row retains its compact layout.

## Reusable controls

- Use `CalendarIconButton` for standalone remove and close actions in every view, drawer and library.
  Keep localized accessible labels, handlers, refs and disabled state at the call site.
- `CalendarControls.css` owns their skin, focus and disabled states. Change it
  once to update Timetable, Meals and Events together. Use its semantic variants
  and shared control tokens for extensions; feature CSS owns placement only.
- Both language choices and arrow/remove actions must render `CalendarButtonGroup`.
  Their containers use exactly `calendar-button-group` and their buttons exactly
  `calendar-group-button`, with one shared frame, selected/pressed, hover, focus
  and disabled skin. Only labels, click handlers and logical state may differ;
  do not introduce separate language/action skin classes. Keep 44px targets.

## Scrollable picker and library lists

- `CalendarScrollPanel` is the shared bounded scroll viewport for the Timetable
  palette, meal icon catalog, saved meal favorites, meal editor favorites, subject library icons/favorites and event icons. Render the
  full filtered list; do not reintroduce pagination in these panels.
- Keep filters, group tabs and save/close actions outside the scroll viewport.
  Internal list scrolling is intentional here; the page and current action
  controls must still fit the required landscape viewports.
- Share persistent scrollbar styling, keyboard focus and scroll
  reset/reveal behavior through `CalendarScrollPanel.css` and its component.

## Study editor and event-day refinements (2026-11-01)

- Past Study dates show their saved list and explicit rename action only: no
  palette, scope choice, reorder/remove/language controls or Save button.
- Editable dates have accent-insensitive English/Vietnamese/custom-name search.
  Open Favorites by default when nonempty. Only that tab has “Manage favorite
  subjects”, which opens StudyLibraryDialog; do not restore the ambiguous
  stand-alone “My subjects” button above the tabs.
- Each planned subject optionally carries `teaching_language: 'en' | 'vi'`.
  Use CalendarButtonGroup's N/A | EN | VI buttons (44px touch targets and a
  shared 36px visible frame) in the plan editor, never a dropdown.
  N/A omits the property. Do not infer it from UI language or the subject
  icon/name. Render the same flag medallions in kid and read-only parent views.
  Preserve language through reorders, renames, conflicts and past-plan freezing.
- Tapping an Events day heading or card background opens EventDayDialog for that
  date. It lists system events read-only and kid events with their edit action;
  Add event opens the existing editor initialized to that date. Nested dialogs
  retain focus, Escape handling and inertness through the shared modal hooks.
- Event icon choices reveal their selected item on opening or returning to its
  group using CalendarScrollPanel revealKey and matching data-scroll-key.
- Matching controls reuse matching classes: `calendar-field`/`calendar-input`,
  `calendar-palette-choice`, `calendar-group-tabs`, `calendar-library-button`,
  `calendar-icon-button`, shared save/navigation actions and scroll panels.
  CalendarControls.css owns field/library/icon-control skins; feature selectors
  own placement and sizing only. Avoid separate Study/Meals/Events control skins.
- Run `node frontend/tests/calendar-editor.browser.mjs` for the isolated fixture
  covering rail alignment, clubs, past dates, favorites/search, language saves,
  Extra saves and nested event editors across all required landscape sizes.

## Medicine weekday repetition (2026-11-01)

- MedicineDialog uses the exact `CalendarButtonGroup`, `calendar-button-group`
  and `calendar-group-button` classes used by language and arrow/remove groups.
  Show MON/TUE/WED/THU/FRI/SAT/SUN (localized abbreviations with full weekday
  accessible names); each is an independent pressed toggle. Initially select
  the tapped weekday. Allow clearing all choices, but disable Add medicine.
- Add medicine updates only the draft. The outer Save commits the normal list
  and new medicine repetitions together. Repeat in the originating row, including
  Breakfast/Lunch/Snack/Dinner, never silently move to the Medicine row.
- Capture all weekday template revisions at editor open. Send only selected
  weekday revisions, `medicine_repeats` with stable draft `series_id`s, and base
  items excluding those new repeating entries. Keep the draft after a 409 and
  refresh captured revisions only through the existing conflict path.
- Removing a new draft medicine also removes its pending weekday schedule.
  Nonnamed medicine details remain reminders, not instructions or completion.
- Medicine type choices use two rows in the wider dialog to fit weekdays, dose,
  quantity and current action controls together at the required landscape sizes.

## Event people and PDF export (2026-11-01)

- Event participants are labels on that child's event only. Never create invitations,
  notifications or copies on another child's calendar from a participant selection.
  Store fixed role keys or authorized profile references; render server-resolved
  child names as plain text. Roles have no accounts or profiles.
- `EventPeoplePicker` live-searches the owned-profile `/calendar/participants` API.
  It offers siblings and accepted friends covered by both friendship scopes.
  Keep Participant(s) directly below Repeat in the event editor form. Use
  `CalendarChoiceChip` for relatives, selected children and the Friends toggle; Friends expands a searchable list
  inline, never another dialog. All chips share the same appearance and states.
- Use Paternal grandfather/grandmother and Maternal grandfather/grandmother
  as the English grandparent labels. Vietnamese remains Ông nội/Bà nội and
  Ông ngoại/Bà ngoại; saved role keys never change.
- Parents control six relative buttons under Parent Space > child calendar >
  Family members in events. Hidden buttons cannot be newly selected; historical
  selections remain removable and may be retained. A friend stays available.
- Share sits beside Back to Playground and downloads six landscape PDF pages:
  Study, Meals, Events for this week, then the same three for next week. Compose
  this from the complete data model, never a screenshot or a clipped screen grid.
  Include every entry's artwork and full name, optional teaching language, medicine
  details, people and available weather. Exclude all navigation and editing controls.
- Export is lazy-loaded, same-origin and device-local. Cancel it on profile/session
  changes. Reuse one canvas, bound image decode concurrency and canvas pixel count.
  Dense calendars use larger landscape sheets rather than losing saved entries.

- Opening Add event or editing from Arrange events dismisses the day manager.
  Return focus to the original calendar date after the editor closes, never a
  button in a dismissed dialog.
