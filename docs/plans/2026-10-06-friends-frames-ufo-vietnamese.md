# Friend dialogs, avatar frames, and Vietnamese UFO

Branch: `fix/friend-dialog-frames-ufo-vietnamese`, from merged main `6d11281`.
User UAT passed; the user authorized committing and pushing these changes.
Production rollout remains outside this approval.

## Friend requests

Compact From/To scope choices share the dialog with the quiz and friend code.
Remove repeated scope explanations, verbose quiz instructions and generated
request-summary wording. Keep one concise explanation that family scope covers
current and future kids. Show the code input together with the quiz; submitting
still requires passing the quiz when required. Editing a checked answer clears
readiness. The footer remains visible independently of the dialog body.

The add and accept dialogs fit laptop/iPad landscape viewports without scrolling.
On exceptionally short/narrow viewports the body can scroll while footer actions
remain available. Profile/family request payloads and backend authorization are
unchanged; zero-profile families can send using family scope.

## Toy Car frame

The API frame allowlist was missing car, plane, jet, volcano and helicopter,
although all are offered by the frontend. Accept those IDs in create/update
validation; retain rejection of unknown IDs. Existing text storage needs no DB
migration for these frames. Tests verify API round trips, persisted car selection,
and parity with every frontend frame ID.

## Vietnamese Shoo Shoo UFO

Choose EN or VI before starting. Each dictionary entry has one language; the
190 Vietnamese entries are separate from the original 190 English entries.
Vietnamese clues and meanings are checked-in editorial text corresponding to
all original starter concepts (100 easy, 60 medium, 30 hard).

User confirmed base-letter guessing: the 29-letter Vietnamese alphabet includes
Ă, Â, Đ, Ê, Ô, Ơ and Ư. Guessing a base vowel reveals its tones automatically;
vowel shapes remain distinct (A/Ă/Â, E/Ê, O/Ô/Ơ, U/Ư). Spaces are visible and do
not consume guesses/hints. Physical key input follows the same mapping.

The server filters selection by language, grades base letters, owns counters and
badges, and preserves word snapshots/revision locking. Missing language on older
settings/sessions defaults to English. Changing setup language then keeping the
saved game restores that saved game's language. Session UI and achievements have
Vietnamese copy. Admin CRUD/filtering supports both dictionaries.

Migration `server/drizzle/0014_ufo_vietnamese.sql` adds the language column,
per-language uniqueness and bounded Vietnamese word validation, and inserts the
190 Vietnamese entries. Existing words default to English. Master reloads remain
additive and preserve edits. The migration was applied only to the guarded local
development database and the disposable integration test database, not production.

## Verification

Frontend/server unit suites, app/hosting/server type checks and both frontend
build modes plus server build. Browser coverage includes laptop/iPad request
submission, short-screen footer access, acceptance quiz gating, EN/VI setup,
29-letter keyboard, tone reveals, long phrases, saved English compatibility, and
canceling a language change. Layouts checked at 1280×600, 1366×768, 1024×768 and
1180×820, with a 375×400 fallback check.

Final verification: 195 server tests, 51 frontend test files, and 12 browser
tests passed. App, hosting and server type checks and all required builds passed.

## Follow-up visual refinements

Shoo Shoo UFO setup, play and resume use the full available viewport on larger
screens. Artwork, text and controls scale with both screen width and height;
1080p and 1440p layouts are covered alongside laptop/iPad cases. Language
buttons reuse Waddle Wall's British and Vietnamese countryball atlas, without
visible language labels; accessible names and pressed states remain available.
Friend dialogs have 24px outer padding on wider screens and 8px within the
scrollable body so input focus rings are not clipped. Browser checks confirm
focus-ring bounds and that laptop/iPad layouts still require no scrolling.
