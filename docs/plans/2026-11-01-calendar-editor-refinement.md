# Calendar editor refinement

## Agreed behavior

The kid calendar keeps its rail aligned with the visible table on both compact
landscape and tall desktop screens. Week controls align with the day headings;
My favorites/Add event ends at the last calendar row.

Tapping an Events date or card background opens Arrange events for that day.
Its Add event button opens the existing editor with the selected date. System
events stay read-only. Kid events retain editing, recurrence and revision rules.
The selected icon must be visible when reopening its picker.

Past Study dates show saved entries and the existing rename action, without
subject selection, save scope or Save. Editable plans support bilingual,
accent-insensitive name search. Favorites opens first when nonempty and owns
Manage favorite subjects, replacing the separate My subjects button.

The wider Study editor supports optional teaching language on each planned
subject: unspecified, English, Vietnamese. Stored `teaching_language` is `en`
or `vi`, omitted when unspecified. UI language remains independent. Kid and
parent calendar chips use the same flag medallion and accessible language label.

Morning and Afternoon group clubs below a subtle dashed divider at the bottom.
Every day in a row reserves the same club-section height, based on the largest
club count and available stack height. Grouping preserves stored order within
each group. Each region shows truthful overflow when entries cannot fit.

Extra follows Afternoon, uses evening artwork and holds additional study
activities at home. Its compact row uses the normal Study editor, eight-entry
limit, date/template saves and server revision protection. Evening weather
remains informational. Compact screens may show +N rather than all eight chips.

Matching fields, icon choices, group tabs, library actions, navigation, icon
buttons and scroll lists use shared classes. Feature CSS handles placement.

## Data and release

Migration 0035 extends the existing calendar list-area constraint with
`study_extra`. Teaching language is optional JSONB metadata and needs no column
migration. No cloud resources or production data are changed here. Release the
migration and API before the frontend relies on Extra writes.

## Validation

Source tests cover bilingual search, optional language, grouping and shared club
height; server contracts reject invalid languages and wrong-area metadata.
Disposable PostgreSQL tests cover Extra/language round trips, frozen historical
plans, overrides/restores, existing revision conflicts and ownership rules.

The isolated agent-browser fixture checks 1366x768, 1024x768, 1180x820 and
1830x1330. It verifies rail alignment, club heights, past-date controls,
favorites/search, language and Extra save payloads, nested event dialogs,
selected-icon visibility, viewport bounds and absence of page scrolling.
Screenshots and logs remain under /tmp.

## Medicine weekday selection

The Medicine reminder dialog uses the same button-group component/classes as
language and arrow/remove groups. MON through SUN toggle independently, starting
with the tapped weekday; an empty selection disables Add medicine. The reminder
repeats in the same row where it is added. Add changes the draft; the outer Save
commits all selected weekdays and ordinary list changes atomically.

Selected weekday templates retain their foods and existing reminders. New weekly
medicine also appears in future date overrides, while past plans stay unchanged.
Captured template revisions protect each selected weekday; cap/conflict errors
keep the whole draft and commit nothing. Stable reminder lineage prevents retry
appends from duplicating an already saved medicine. This uses existing JSONB
lists and requires no additional SQL migration.

Tests cover independent toggles, empty selection, payload separation/revisions,
weekday persistence beyond the displayed window, same-row behavior, future
overrides, past history, dedupe and atomic cap/conflict rollback. The browser
fixture checks the full dialog and weekly save at all four landscape sizes; the
existing Meals fixture also checks Vietnamese and portrait layouts.

## Calendar sharing and event participants

Share beside Back to Playground exports the complete two-week data into six
landscape pages, ordered by week then Study, Meals, Events. Each entry includes
its artwork and full name, teaching-language label when specified, medicine
quantity/colour/dose and selected event people. Available weather is included.
Navigation, buttons and editors never enter the document. Dense calendars use
larger landscape sheets to retain all content. PDF generation is local and
cancels when the active child or family session changes.

Event people are display-only. The user selected no invitations or calendar
copies. Roles: Dad, Mom, paternal/maternal Grandpa/Grandma, plus A friend. Live
profile choices are siblings and accepted child/family friends whose scopes
cover both endpoints. The API validates references and resolves current names.
Participant versions share event name history and preserve earlier occurrences.
Revoked/deleted profiles become A friend in the read projection.

Parents can hide any of the six relative buttons for the whole family through
Family members in events in a child's Parent Space calendar. This setting does
not remove historical selections. A friend stays available. Parent capability,
server family identity, optimistic revision checking and a family lock protect
writes. Migration 0036 adds the settings table without changing existing data.


## UAT refinement: event editor and inline people

Opening Add event or an existing event from Arrange events dismisses the day
manager and returns focus to the originating calendar date when the editor closes.
Participant(s) sits directly below Repeat in the event form, with selectable
chips. Relatives, selected child profiles
and the Friends toggle use one shared chip component and selection style. Friends
expands a live searchable child/friend list inline, without a nested dialog.
Selected event artwork stays revealed when inline sections resize the editor.

English relative labels use Paternal grandfather/grandmother and Maternal
grandfather/grandmother. Vietnamese labels and saved role keys stay unchanged.
