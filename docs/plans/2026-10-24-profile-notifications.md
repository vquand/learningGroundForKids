# Compact profile-picker friend notifications

Implemented locally on `feature/town-lake` following the user's 2026-10-24
addition. Display the two most recent updates by default, sorting by response
time for answered requests and creation time otherwise. Show all/Show less
exposes the bounded history. Switching family resets the expanded state.

Each notification occupies one line in iPad landscape: avatar and name,
`wants to friend` for pending or `friended with` for accepted, then the other
avatar and name. A family-scoped party uses a family icon. Pending accept and
reject controls remain inline with 44px targets. Long names truncate, retaining
their complete text/title and keyboard focus. Remove the implementation-note
subtitle, request codes/messages, type chips, repeated status explanations and
separate date rows. Full timestamps remain available on hover.

The authenticated list adds only participant names/avatar presentation fields.
Profile metadata loads in bounded batches after selecting requests involving
the session family. Current custom photos are readable by another family only
when a pending/accepted request involves both the viewer and that profile.
The exact profile/family/current object key must match; rejected/cancelled
foreign photos use the emoji fallback. Avatar responses are private/no-store.
No profile, email, location or arbitrary media access is granted.

Validation: pure preview/sorting/status/fallback tests, disposable DB metadata
and avatar ownership tests, existing integration regression and media route
authorization checks pass. Real agent-browser screenshots/geometry checks at
1024×768, 1180×820 and 1366×768 verify two rows initially and single-line
pending/accepted/family rows, including long names, inline actions and Vietnamese.
Test evidence stays under `/tmp`. User UAT and release confirmation are pending.
