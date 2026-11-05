# Town weather recovery and production diagnostics

## Verified production symptom

The child profile already contains Hanoi/VN. Production displays `Local weather
unavailable`, so Halloween production correctly remains paused even though the
client can show decorative ghosts. Explorer uses a separate OpenStreetMap
geocoder and does not verify this weather path.

Read-only inspection of the confirmed Render workspace found the API
running merged commit f56fd11. Town environment and garden tick requests return
HTTP 200. The old weather service catches all provider failures without logging
their cause, so those logs cannot distinguish a provider HTTP rejection from
network, validation or freshness failures. No production settings/data changed.

The initial provider failure in production remains unconfirmed. Open-Meteo's
[terms](https://open-meteo.com/en/terms) specifically warn that shared Render IPs
can reach rate limits earlier than expected; HTTP 429 is a hypothesis to verify,
not an observed production response.

## Reproduced defects and changes

- A single failed lookup previously cached unavailable weather for 15 minutes,
  even when the provider immediately recovered. Failures now retry after 1, 2,
  4 and at most 5 minutes; successful readings retain their 15-minute cache.
- Provider HTTP status, stage, timeout, invalid payload, ambiguous city,
  invalid timezone, outdated observation and allowlisted DNS/connect errors
  now produce sanitized structured warnings. Recovery is logged once. City,
  profile, coordinate, URL, raw provider body and arbitrary error text are not
  logged or added to public API responses.
- A four-second deadline now bounds headers and the complete JSON body,
  including fetch implementations that fail to honor abort. JSON is limited
  to 256 KiB and redirects are rejected.
- Provider cooldowns respect numeric and HTTP-date Retry-After values (bounded
  to one day) and apply across cities for the same endpoint. No immediate retry
  loops or provider switching. Existing per-process request budgets remain.
- Canonical city/country cache keys share equivalent spelling, accents and
  whitespace. Known city clocks survive forecast failures. Retained observations
  expire after one hour even during longer provider cooldowns.

Retry-After handling follows the [HTTP header reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After).
No database migration, provider account, runtime secret or cloud resource is
required. No event rules, pumpkin state, rewards or frontend appearance change.

## Verification and rollout

Ten focused regressions cover recovery/coalescing, privacy, HTTP 429, shared
cooldowns, both Retry-After formats, retry caps, canonical city keys, stalled
headers/body, payload limits, observation expiry and safe network error codes.
The initial recovery/diagnostic tests failed before the fix. Server typecheck
and build pass. A live read-only Hanoi lookup from the local Node 22 container
returned live weather at 19:03 Vietnam time on October 30.

Full Node 22 server verification: 726 passing tests and 63 database skips in
the isolated container; three configuration checks initially lacked the
read-only root render.yaml fixture. Those three passed when rerun with the
fixture mounted (729 passing in total). The host sandbox separately prevents
the Node socket-adapter test from binding 127.0.0.1; that test passed in the
Node 22 container. Whitespace and generated-artifact checks pass.

Self-review: the shared createEnvironmentService still supplies Town, Lake,
visits and all server event ticks; the new transport helper contains provider
I/O only. No map-specific weather or duplicate entity behavior was added.

After an approved main-branch deployment, inspect the existing API's logs for
`Town weather lookup failed` and its `TOWN_WEATHER_*` code/status. A 429 would
confirm provider throttling; TIMEOUT/network codes identify connection failure;
INVALID_RESPONSE/STALE_READING identify rejected provider data. A subsequent
`TOWN_WEATHER_RECOVERED` confirms recovery. Until that observation, do not claim
the original production cause or production recovery is established.

## Production follow-up: early connection timeout

After PR #98 went live, production emitted
`TOWN_WEATHER_GEOCODING_NETWORK_ERROR_ETIMEDOUT` at 12:14 and 12:27 UTC,
with durations of 295ms and 336ms. This confirms a connection failure before
geocoding supplies any result; it is not an observed HTTP 429 or an invalid
saved city. No provider request body, URL or profile data was logged.

The failure timing matches Node 22's 250ms network-family attempt timeout and
the [documented premature timeout issue](https://github.com/nodejs/node/issues/54359).
This is a hypothesis about the underlying network mechanism, pending production
verification. The follow-up changes the production npm start command to pass
`--network-family-autoselection-attempt-timeout=1000`. Each TCP attempt gets
one second before trying another resolved address; IPv4/IPv6 fallback, TLS
verification, the four-second application deadline, and provider cooldowns
remain enabled. No new dependency, cloud resource or schema change is needed.

This startup setting is process-wide: other dual-stack outbound connections
can also take up to an additional 750ms per address attempt. Single-address
connections are unaffected. It is applied through the existing Render npm
start command instead of mutating runtime configuration on a feature branch.
Town/Lake weather and reward eligibility continue to use server-owned data;
moving visual weather into the browser alone would not unblock ghost harvests.

Follow-up verification: Node v22.23.3 launched with the exact npm start arguments
reports a 1000ms family-attempt timeout and automatic family selection enabled.
The full isolated Node 22 server suite passes cleanly: 729 passing, 63 database
skips, zero failures. Server typecheck/build and artifact/whitespace checks pass.

## Confirmed forecast rate limit after connection repair

After PR #99 deployed, the production lookup at 12:54:00 UTC resolved Hanoi's
local clock and reached the forecast endpoint. It emitted
`TOWN_WEATHER_FORECAST_HTTP_ERROR` with HTTP 429 after 1871ms. This establishes
provider throttling as the remaining blocker; the older geocoding ETIMEDOUT
was a separate connection failure.

Open-Meteo's terms warn that Render and Vercel shared IPs can be rate-limited
early and recommend Cloudflare Workers, where limits apply per Cloudflare user.
Its paid customer endpoint is another supported option. A plain browser-side
lookup would not supply trusted weather to the authoritative harvest/reward
simulation. Await the hosting/provider choice before adding infrastructure.

The user prefers a more open provider rather than additional hosting or a paid
Open-Meteo account. MET Norway Locationforecast is a viable keyless alternative:
its [public-service FAQ](https://docs.api.met.no/doc/FAQ.html) and
[worldwide forecast guide](https://docs.api.met.no/doc/locationforecast/HowTO.html)
describe open access with identifying User-Agent, attribution, bounded city
coordinates, and Expires/Last-Modified caching requirements. A read-only request
for public Hanoi city-centre coordinates returned valid compact forecast data
without an API key. This is an hourly forecast, not a real-time rain observation;
an adapter must preserve that distinction and existing server-owned eligibility.
No provider change or new infrastructure has been deployed for this alternative.

## Approved MET Norway implementation

The user approved server-side MET Norway forecasts, shared by registered city
rather than child, with no queries while nobody is using weather. The active
Town/Lake service now downloads Locationforecast compact on demand, keyed by
normalized city and country. Concurrent requests share one pending lookup.
Successful forecasts refresh no sooner than ten minutes, or a later provider
Expires; conditional If-Modified-Since requests reuse the payload on HTTP 304.
There is no cron, profile scan, idle timer or browser-to-provider request.

The current Render service has one API instance, so this bounded in-memory
cache is shared by all its users. A restart warms cities again on demand;
scaling to multiple API instances would require a shared cache to preserve the
same global request limit. Only cities read from authorized saved profiles or
approved friend snapshots enter the service. Profiles without cities make no
provider calls. Open-Meteo still resolves city coordinates/timezones; its Town
forecast endpoint is removed. Calendar's separate forecast API is unchanged.

The adapter follows MET's [terms](https://docs.api.met.no/doc/TermsOfService.html)
and [data model](https://docs.api.met.no/doc/locationforecast/datamodel.html):
an identifying application User-Agent, approximate city coordinates, validated
units/timestamps, wind converted from m/s to km/h, and only the hourly interval
containing server time. Future-only periods, missing hourly precipitation and
outdated model runs remain unavailable. The API publishes forecast validity and
issue timestamps, retaining `observedAt: null` for compatibility. An hourly
forecast cannot establish minute-by-minute observed rain.

Town, Lake and friend visits share MET Norway / CC BY 4.0 source credit. Their
weather queries stop while the page is hidden or unfocused and resume on return.
Decorative production ghosts now use the server's existing fresh, dry, dark
Halloween eligibility gate; unavailable/stale forecasts no longer show ghosts
that cannot work. Cosmetic development previews still cannot award rewards.

Verification: 795 frontend tests pass; the full Node 22 server run passes 737
tests with 63 database tests skipped. Both server and frontend typechecks and
builds pass, including the Vercel frontend build. Focused tests cover 2,000
profiles in ten cities producing ten forecast downloads per refresh, distinct
countries, Expires, hourly rollover, HTTP 304, unavailable data and real ghost
simulation: four ripe pumpkins produce four lanterns/eight stamina on a dry
night, and none in rain, snow or daylight.

An isolated browser showed live Hanoi MET weather, localized source credit and
no visible control overflow or document scrolling at 1366×768, 1024×768 and
1180×820. It made no environment/garden requests during 129 seconds in a
background tab and resumed after refocus, with no browser runtime errors.
The disposable test profile's temporary Hanoi setting was restored afterward.
Generated evidence remains local. No migration, provider key or new resource
is required. Production recovery still requires a main-branch deployment and
a real on-demand request; `TOWN_WEATHER_MET_NO_READY` records a validated first
forecast without logging location or profile data.
