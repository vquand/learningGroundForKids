# ADR-004: Render-owned math wall sessions with an illustrated 2D arena

## Status

Accepted; implementation reviewed by the user on 2026-10-06.

## Date

2026-10-06

## Context

The new fifth kid activity requires moving walls and chubby animal sprites,
endless timed arithmetic, persistent badges and personal bests, and a ranking
visible only to explicitly befriended kids. The application already owns
identity and game progress in the Render API and PostgreSQL.

## Decision

Use a lazily routed DOM arena with generated 2D artwork and HTML question/lane
controls. The square illustrated garden preserves its aspect ratio at every
viewport size. One continuous wall strip carries three answer positions; a
clip reveals the correct passage after arrival. Raster flowers, stars, heart,
and splash match the warm outlined style of the kid avatars and avatar frames.
Animal pieces have rear, left, right, and surprised views. Pose switching,
bobbing, and a small rotation provide the waddle. This supersedes the earlier
WebGL arena and procedural models, following the user's revised direction.
Three.js and its type dependencies are removed from the frontend.
Character and wall choices change presentation only. Generated raster artwork
is used for country-ball selectors and the coherent achievement badge group.

Follow the existing UFO repository pattern: one server-owned JSON progress
snapshot per profile with row locks and optimistic revisions. Store a checked
integer `best_score` alongside the snapshot for SQL rankings. Generate, time,
grade, and award progress on the server; accept only settings and actions.
Persist selection before the server deadline and resolve it when time expires.
The API returns the correct lane only after resolution.

Rank through accepted friendship records with both scopes set to `profile`,
matching the active kid on either side. Family-wide and mixed-scope records
never expand ranking visibility. All routes retain existing authentication,
ownership, origin, input validation, and private-cache protections.

## Alternatives considered

- Procedural WebGL scenery: used in the first implementation, superseded by
  the user's preference for matching 2D illustrations and a lighter runtime.
- Custom WebGL rendering: adds geometry, lighting, and resource lifetime work
  that the illustrated board no longer needs.
- Client-submitted scores or local-only persistence: simpler but violates the
  repository's score trust boundary and cannot support private friend rankings.
- A full question/attempt relational schema: supports auditing every historical
  action, but adds unnecessary complexity to the current best-score and badge
  requirements. The existing session snapshot pattern is sufficient.

## Consequences

- The game route stays lazy loaded and works without WebGL. Artwork is served
  from the app's own static assets; text and controls remain HTML for crisp
  type, keyboard/touch interaction, and accessibility.
- Anonymous and cross-family requests cannot read or mutate game progress.
- The API can reject stale tabs, duplicate grading, forged points, and late
  lane changes; transactionally saved bests survive restarts.
- Network latency may delay the celebration or reject a lane change made
  immediately at the deadline. Failed requests stop automatic progression and
  expose a reload control instead of inventing local score changes.
- Rankings contain names and best scores only, within the requested social
  boundary. Friendship permission is evaluated on every leaderboard read.
- All database changes require the guarded migration workflow. Feature-branch
  work does not authorize cloud changes or production migration.
