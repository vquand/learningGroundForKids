# Kitchen menu completion medals

Each recipe card displays a small original chef-hat medal and `× count` in its
top-right corner after a saved successful finish. Counts are private to the
selected child, localized for accessibility, and refreshed on menu entry and
after queued Cooking/Burger saves. Failed loads offer a retry; zero/unavailable
counts show no medal. Explicit practice routes do not use saved counts.

The owned, authenticated read-only `/api/v1/profiles/:id/kitchen-completions`
projection counts distinct successful recipe sessions from the verified journal.
OK-ish and Perfect cabbage-roll outcomes qualify. Burnt and undercooked outcomes
do not; retrying a batch cannot increment it twice. Town reward history cannot
be used as proof of success because cabbage serving also rewards failed results.

New events include stable recipe IDs. Existing journal titles remain supported;
the latest saved successful sessions also contribute without double counting.
Older overwritten sessions from before journal tracking cannot be reconstructed
and are not invented. No schema changes, cloud resources, or earned achievement
definitions are involved; the illustrated counter does not award badges.

Verification covers actual verified Burger/grill/drink completions, failed
outcomes, duplicate sessions, legacy history, sibling isolation and endpoint
ownership. Browser checks cover all eight cards, zero/100 counts, narrow-phone
and laptop/iPad placement, English/Vietnamese, retry, return refresh and switching
children. Preserve UAT accounts and data; run local-only checks.

Validation: 328 server tests passed in an isolated local database with no skips;
the final eight focused API/database checks also passed after adding actual
cabbage retry/outcome assertions. All 17 recipe-medal/journal browser cases
passed, including production Cooking/Burger saves. Frontend tests, app/hosting
and server typechecks, Vercel/compatibility frontend builds and server build
passed. The isolated test database was removed; UAT data was not reset.
