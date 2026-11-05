# Town home-city clock correction

## Verified issue

At 20:14 Vietnam time, a correctly saved Hanoi/VN profile received the default
calendar and no local clock. The live geocoder returned four Vietnam matches:
the capital, another Hanoi locality, Bạch Mai, and Hanoi/Gialam airport. The
service rejected them all because it required exactly one country match. With
`timeOfDay: null`, the scene could not apply its nighttime lighting.

## Correction

Filter by the saved country, then compare normalized exact city names (case,
accents and whitespace). Prefer a unique exact capital identified by GeoNames
`PPLC`; otherwise require one exact candidate, or one country candidate when no
exact name exists. Do not choose a capital for a partial query or guess among
multiple equivalent populated places. The feature-code meaning is documented in
[GeoNames' primary reference](https://www.geonames.org/export/codes.html).

Keep IANA timezone validation and server-derived time. A resolved city still
supplies its clock if weather fails. An unresolved configured city keeps its
saved label; only a genuinely missing home location prompts setting one. No
profile, game, currency, schema or cloud-resource changes are needed.

## Evidence

Seven service regressions passed: live-result-shaped Hanoi selection, accented
name/result order, real ambiguity, partial queries, foreign country filtering,
forecast failure with a known clock, and invalid timezone rejection. Independent
Luna review found no remaining issue in those paths. Existing clock/weather
regressions passed as well.

A live read-only lookup after the fix returned Hanoi/VN, local time 20:35,
`timeOfDay: night`, `isDay: false`, and live weather. The timezone supplied by the
provider was `Asia/Bangkok` (UTC+7 for this reading). No profile data was changed.
The local API remains healthy; the Town page refreshes its environment every
minute and can be reloaded immediately for UAT.

Standard checks passed: server typecheck/build and 266 server tests (eight DB
cases skipped without a test database for this provider-only change), plus 334
frontend tests. No database code or data changed; the earlier complete disposable
DB run for the reward changes passed separately.
