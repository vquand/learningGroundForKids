# Admin family learning overview and town scenery follow-up

Branch: `feature/admin-family-learning-overview`. Requested after PR #57 was
merged. No release, cloud resource changes or production migrations are included.

## Reporting

Admin family details now show the family’s saved learning totals, children with
recorded learning, last saved activity, aggregate activity metrics, and a selected
child’s complete activity report and achievement collection. Exploring, quiz
attempts/passes, study sessions, UFO, Waddle Wall, InfiniDrill, Miniku, Town and
Drinks use persisted reports. Cooking/Burger remain explicitly unavailable and
their catalog badges are never presented as earned. A starter town home alone
is not evidence of learning. Friend-code copying and chosen avatar artwork are
available in the selected child header; existing family/password/friendship and
journey/activity-history workflows remain available.

`GET /api/v1/admin/families/:familyId/reports` requires authenticated admin role,
validates the path/query and target family, and returns the same bounded
read-only snapshot as Parent Space. The parent endpoint remains session-owned.
No raw game boards, answers or provider/database credentials are returned.
The UI scopes and aborts reads by administrator/session/target-family, rejects
invalid report envelopes, and separates loading, unavailable, empty and recorded
states. Both views reuse activity-card artwork/labels and family aggregation.

## Town scenery

The construction grid and decorative walking bounds remain unchanged. The
visible frame stops at three tiles above the town and at the lower mountain
foot, 3.2 tiles below; sides retain three columns. Both zoom levels clamp to
that frame. Staggered additional top mountains and a second lower forest row
reuse existing transparent sprites without stretching or altering the artwork.
Canvas hit testing and selected-tile actions use the same clamped geometry.

## Verification

Frontend baseline/type checks and both hosting builds; guarded local API tests,
API type/build checks; browser checks at laptop/iPad landscape and phone sizes.
Reporting checks cover exact per-child/family metrics, unavailable games,
achievement catalog status, locale changes, refresh, child/family switching,
invalid/error responses and existing family/parent management flows. API tests
cover unauthenticated/non-admin access, target lookup, forged queries, method
restrictions and no-store responses. Town checks cover construction/removal,
road gliding, pets, wildlife, occlusion, viewport fit and scenery/camera limits.
Screenshots and logs are temporary artifacts under `/tmp/plg-admin-*` and
`/tmp/plg-town-*`; they are not committed.

Completed checks: 76 frontend test files and 282 guarded API tests pass with
none skipped. App/hosting/API TypeScript checks and frontend Vercel/compatibility
builds plus the API build pass (existing large-chunk build warnings remain).
Browser coverage includes the Admin learning overview and selected-child reports,
existing Parent Space/family-management flows, town construction/removal, pet
save/reload, wildlife and corrected foreground-occlusion sampling for the new
frame. The five Admin report flows and two existing family/profile navigation
regressions pass after the final integration. The UAT launcher reuses the healthy
local 5173/10000 stack and retains existing accounts/progress. The user approved
committing and pushing these changes on 2026-10-14. No SQL migration is required.
