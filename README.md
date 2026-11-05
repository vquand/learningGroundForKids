# PersonalLearningGround

An interactive world-map app for kids to explore Monuments, Landmarks, Food, Music, and Movies — in Vietnamese and English.

Designed as a production web application with a separately deployable frontend,
API, and database.

## What it does

- **World map** with illustration-style tiles, touch-friendly gestures (pinch-zoom, finger scroll)
- **Category filters**: Monuments, Landmarks, Food, Music/Composer, Movies, Phenomena, Animals
- **Zoom clustering**: count bubbles at low zoom → individual icons at high zoom → tap to open detail
- **Detail pages** per category with photos, descriptions, recipes, fun facts, audio clips, YouTube embeds, character cards
- **Bilingual content**: items support Vietnamese and/or English with a language toggle
- **Era timeline**: scrubber bar groups items by historical era; tap to filter by year
- **Done tracking**: compound gate (15s on page + scroll coverage + media interaction)
- **Child profiles** with independent progress tracking and badge milestones
- **Quizzes**: per-item quizzes and a daily mixed quiz across completed items
- **Journey replay**: animated great-circle path over completed items
- **Telegram bot** for content management with AI-assisted research

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4 on Vercel |
| Backend | Node.js 22 + Hono API on Render |
| Database | Neon PostgreSQL via Drizzle ORM |
| Auth / User data | Backend-owned, secure cookie sessions |
| Map | Leaflet 1.9 + react-leaflet 5 + react-leaflet-cluster |
| Media | Private S3-compatible object storage behind the API |

## Getting started

**Requirements:** Node.js 22+.

1. Install the frontend and server dependencies:

```bash
npm ci --prefix frontend
npm ci --prefix server
```

2. Copy the example environment files and supply local PostgreSQL and object
   storage credentials. Then start the API and the Vercel-mode frontend in
   separate terminals.

```bash
npm run dev --prefix server
npm run dev --prefix frontend -- --mode vercel
```

The Vite development server proxies `/api/*` and `/media/*` to
`LOCAL_API_ORIGIN` (default `http://127.0.0.1:10000`).

Set `APP_NAME` in `frontend/.env.local` or the frontend build environment to
customize the browser-tab title. Unset or blank values use `Playing Ground`.
Restart the development server or rebuild the frontend after changing it.

### No-login local UAT

For a fast review of the map and journey replay, start the frontend in its
Vercel-compatible local mode:

```bash
npm run dev:uat --prefix frontend -- --host 127.0.0.1 --port 5173
```

Open <http://127.0.0.1:5173/uat/map>. This development-only route uses the
checked-in catalog and a deterministic replay fixture, so it does not require
an account, API, database, or writes. Production builds redirect `/uat` back
to the normal app entry point.

### One-command Docker development

With Docker and Docker Compose installed, start the active frontend, Node API,
and isolated PostgreSQL database from the repository root:

```bash
scripts/start-uat.sh
```

The launcher always uses frontend port **5173** and API port **10000**. It reuses
a healthy running stack or starts Docker, waits for database/API readiness, and
checks Vite compilation of the activity/game modules, the frontend proxy and a
login POST. The frontend image and its read-only development mounts include
`server/src`, because games import shared pure logic/types from that tree.
If an unrelated service occupies a
required port, it reports the conflict without killing the service. It keeps
existing data and accounts. To replace a partial native stack, it stops only
recognizable Node/Vite listeners from this checkout. Docker uses its own
database volume and adopts existing native accounts only when that volume has no user records.
Docker services remain running after the command exits.

On startup, if the original running `plg-dev-postgres` local container is
present and Compose has no user records, the launcher imports that local
database before starting the API. Accounts, password hashes, passkeys, profiles,
towns and progress are preserved; credentials are not reset. Import uses local
PostgreSQL sockets and one atomic restore. It never replaces a Compose database
with existing user records or accesses a hosted database. This also repairs
an already-running empty stack. The import helper can be run directly as
`scripts/import-native-dev-db.sh`, followed by `scripts/start-uat.sh`.
If the original container is stopped, start it first.

For Codex, approve the scoped `scripts/start-uat.sh` command and save the approval
when offered. The launcher's startup, health checks, and failure logs then use
one invocation. Managed policies can still require approval; repository guides
cannot grant sandbox permissions. See the [OpenAI command rules documentation](https://learn.chatgpt.com/docs/agent-configuration/rules).

The underlying Docker command remains
`docker compose -f compose.dev.yml up --build -d --wait`.

Open <http://localhost:5173>. The API is available on
<http://localhost:10000/api/v1/health/ready>. Source edits in `frontend/src` and
`server/src` reload automatically. Rebuild after changing dependencies or other
unmounted configuration files. No host Node installation or environment file is
required.

Startup waits for PostgreSQL, applies migrations, seeds the checked-in catalog,
then waits for API readiness before starting Vite, using Compose's
[dependency conditions](https://docs.docker.com/compose/how-tos/startup-order/).
The guard refuses hosted database URLs. This stack uses its own `plg-dev_pgdata`
volume; it does not access the native `plg-dev-postgres` database or Neon. The
development database credentials are local-only. PostgreSQL has no published
host port, and the frontend and API ports bind to loopback.

Create a local admin once with a password of at least 12 characters. In Bash,
read the password without displaying it or saving it in shell history:

```bash
read -r -s -p 'Local admin password: ' PLG_DEV_PASSWORD
printf '\n'
printf '%s' "$PLG_DEV_PASSWORD" | docker compose -f compose.dev.yml run --rm -T --no-deps \
  -e BOOTSTRAP_EMAIL=dev@example.test -e 'BOOTSTRAP_NAME=Local Dev Admin' \
  api node --import /app/docker/dev/local-db-guard.mjs --import tsx scripts/bootstrap-family.ts
unset PLG_DEV_PASSWORD
```

Private upload storage and external AI/Google providers require separate runtime
configuration; they are not provisioned by this local stack. Registration remains
disabled. For a review without an account, use <http://localhost:5173/uat/map>.

```bash
docker compose -f compose.dev.yml logs -f api frontend
docker compose -f compose.dev.yml down  # retains the local database
node --test docker/dev/local-db-guard.test.mjs
```

If native servers already occupy the default ports, set `PLG_DEV_FRONTEND_PORT`
and `PLG_DEV_API_PORT` for every Compose command, for example
`PLG_DEV_FRONTEND_PORT=15173 PLG_DEV_API_PORT=11000 docker compose -f compose.dev.yml up --build -d --wait`.
The frontend origin allowlist and passkey origin follow the chosen frontend port.
Passkey UAT should use `localhost`.

### Native local PostgreSQL setup

The local API uses an ignored `server/.env_dev` file. Start a dedicated
PostgreSQL container bound to loopback, then copy
[`server/.env_dev.example`](server/.env_dev.example) to `server/.env_dev`.
The example credentials are for local development only; never reuse them on a
shared or hosted database.

```bash
docker run -d --name plg-dev-postgres -p 127.0.0.1:55432:5432 \
  --mount type=volume,source=plg-dev-pgdata,target=/var/lib/postgresql/data \
  -e POSTGRES_USER=plg_dev -e POSTGRES_PASSWORD=plg_dev_local_only \
  -e POSTGRES_DB=plg_dev postgres:17-alpine
docker exec plg-dev-postgres createdb -U plg_dev plg_test
cp server/.env_dev.example server/.env_dev
npm run db:migrate:local --prefix server
npm run db:seed:local --prefix server
```

To create an admin for local login, set `BOOTSTRAP_EMAIL`, `BOOTSTRAP_NAME`,
and a unique `BOOTSTRAP_PASSWORD` in the ignored `server/.env_dev`, then run
`npm run db:bootstrap:local --prefix server` once. Start the API with
`npm run dev:local --prefix server` and the site with
`npm run dev --prefix frontend -- --mode vercel --host 127.0.0.1`.
Open `http://127.0.0.1:5173/`. The API is on `127.0.0.1:10000`.

`npm run test:local --prefix server` runs the full server suite against the
separate `plg_test` database. The integration test resets that test database;
it does not reset `plg_dev`. Local scripts refuse nonlocal database URLs.

To add content through the backend rather than writing directly to Neon, use
the admin-only [catalog ingestion API](docs/api/catalog-ingestion.md). It is
usable by a human or an AI agent through the existing secure admin session
cookie flow.

For a dedicated root account with a generated initial password, independent
Render recovery password, and root-only password dialog, follow the
[root initialization and recovery guide](docs/api/root-account.md). The
`db:init-root` data migration is explicit and idempotent; it is not run on deploy.

## Production hosting

The frontend deploys to Vercel as a static Vite SPA. Same-origin `/api/*` and
`/media/*` requests are rewritten to the Render service, so the core browser
path never connects directly to Neon or object storage. Render owns core
authentication, authorization, data validation, database access, and media
access. Quiz, flashcard, and friend-request traffic now uses the Render API.
Profile extras, the recent-activity feed, parent, and admin clients also use
same-origin API routes. Production readiness still requires migration UAT.

Family-level lesson shares are enforced by the Render API. Profile-only shares
currently fail closed on family-scoped routes; enabling them requires a later
API slice that verifies the active profile belongs to the signed-in family.
Do not treat this branch as ready for production cutover.

Build each deployable independently:

```bash
npm run build --prefix frontend
npm run build --prefix server
```

Apply database migrations from a trusted release environment using Neon's
direct connection string, then run the catalog seed utility. Runtime traffic
uses Neon's pooled connection string.

```bash
npm run db:migrate --prefix server
npm run db:seed --prefix server
npm run db:bootstrap --prefix server
```

The bootstrap command requires `BOOTSTRAP_EMAIL`, `BOOTSTRAP_NAME`, and a
password supplied through `BOOTSTRAP_PASSWORD` or standard input. It refuses
duplicate accounts and does not accept credentials as command-line arguments.

Family self-registration is controlled by the API's `ALLOW_REGISTRATION`
setting and remains disabled by default. When enabled in the server runtime,
the sign-in page offers **Create a family account** at `/register`. The form
requires a family name, email, and a password of at least 12 characters.
`GET /api/v1/auth/registration` supplies the public availability flag; the
server still enforces the setting on every registration POST.

Authentication quotas use the Node socket peer. For a deployment behind verified
ingress proxies, configure `AUTH_TRUSTED_PROXY_CIDRS` with their exact IPs/CIDRs
alongside `TRUST_PROXY_HEADERS=true`. The API walks the forwarded chain from
the socket toward the client and stops at the first untrusted address. Empty
proxy ranges ignore forwarded IPs; confirm the ingress chain before changing
this runtime setting. Do not copy broad private-network or catch-all ranges.

The previous Sites Worker/D1 implementation and the former Python and Go
backends remain as migration references only; they are not production runtimes.

## Environment variables

For a staging setup, use the checked-in
[`server/.env.staging.example`](server/.env.staging.example) and
[`frontend/.env.staging.example`](frontend/.env.staging.example) as worksheets.
The corresponding `.env.staging` files are Git-ignored private copies. Render
and Vercel do not automatically read those local copies: enter the filled
values in each platform's environment settings. Never put production secrets
or production database URLs in these staging files.

**`server/.env`:**

```bash
DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://.../neondb?sslmode=require
ALLOWED_ORIGINS=http://localhost:5173
ALLOWED_FORWARDED_HOSTS=localhost
TRUST_PROXY_HEADERS=false
ALLOW_REGISTRATION=false
# S3-compatible private object storage variables are documented in server/.env.example.
```

**Vercel project environment:**

```bash
RENDER_API_ORIGIN=https://your-api.onrender.com
```

Do not expose database, session, or object-storage credentials through
`VITE_*` variables. Only browser-safe values belong in frontend environment
variables.

## Project structure

```
frontend/         React/Vite SPA and Vercel routing configuration
  data/            Catalog fixtures and public-image provenance mappings
    catalog-seeds/  Authored JSON seeds for all seven categories
  scripts/         Content generation and transitional D1 tooling
  src/
    api/          same-origin `/api/v1` clients
    components/   Map, ItemDetail, Quiz, Journey, DoneTracking, ...
server/           Render-compatible Node/Hono API
  src/db/         Neon/Drizzle schema and repositories
  drizzle/        PostgreSQL migrations
  scripts/         Neon catalog seed and one-shot account bootstrap commands
compose.dev.yml   Active local PostgreSQL, API, and frontend stack
```

## Development status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation — Docker, map, clustering, filters | ✅ Complete |
| 2 | Content Layer — detail pages, bilingual, done tracking | ✅ Complete |
| 3 | Profiles, badges, quiz, journey | ✅ Complete |
| Vercel/Render/Neon production architecture | Frontend, API, PostgreSQL, auth, and media boundaries | 🚧 In progress |

## License

Free to use, copy, modify and fork for **personal, non-commercial use** under the
[PolyForm Noncommercial License 1.0.0](LICENSE). Commercial use (selling it, offering
it as a paid or ad-supported service, or using it inside a business) is not permitted
without separate permission. This is a source-available license, not an OSI-approved
open-source license. Bundled third-party libraries and data keep their own terms; see
`frontend/public/legal/third-party-notices.txt`.

Before running your own copy, replace the placeholder contact address in
`frontend/src/components/Landing/legalContent.ts` (and its Vietnamese entries in
`frontend/src/i18n/vi.json`), set `MET_USER_AGENT` for weather requests, and have the
privacy policy and terms reviewed for your country.

## Support

The app is free. If it is useful to you, an optional donation helps with hosting costs:
[Donate via PayPal](https://www.paypal.com/qrcodes/p2pqrc/H2KY5GDQVPX2Y).
