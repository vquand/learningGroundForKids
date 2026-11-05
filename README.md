# Playing Ground

A bilingual (Vietnamese and English) learning playground for kids. Children explore
a world map of monuments, food, music, animals and more, then play educational
minigames that practice math, spelling, logic and everyday skills. Parents manage
the family, set lessons and schedules, and follow each child's progress.

> **License:** free for personal, non-commercial use. See [License](#license).

## What is inside

### Explore the world
- **World map** with illustration-style tiles, touch gestures and zoom clustering.
- **Categories:** monuments, landmarks, food, music, movies, phenomena and animals.
- **Detail pages** with photos, descriptions, fun facts, audio and video, in Vietnamese
  and English.
- **Era timeline** to filter items by period, and a **journey replay** that animates a
  path over what a child has learned.
- **Done tracking** (time on page, scroll coverage and media use) so progress means
  something, plus **item quizzes**, a **daily quiz** and **flashcards**.

### Playground minigames
| Minigame | What it practices |
|---|---|
| Town Building | Build a town, garden, keep animals, use the lake and trade with friends |
| InfiniDrill | Mine down through the earth while solving visual math |
| Waddle Wall | Fast calculation with animal hurdles |
| Shoo Shoo UFO | Bilingual spelling and word defense |
| Miniku | Kid-friendly 4x4 and 6x6 Sudoku |
| Fishing Friends | Pond and river animals and ecology |
| Road Racing | Answer questions to clear obstacles and earn speed boosts |
| Kitchen and Cooking | Recipes, drinks, burgers and cabbage rolls |

Every minigame has its own **achievement badges**. Scores, answers and completion are
verified on the server, never trusted from the browser.

### Families and parents
- **Family accounts** with password, passkey or Google sign-in, and several **child
  profiles** with avatars and independent progress.
- **Parent Space:** child reports and badge progress, custom lessons, a family
  calendar, and a weekly **adventure schedule** that limits when kids can play.
- **Friends** between families and profiles using friend codes and requests.
- **Admin tools** for catalog review, achievement migration and family overviews.
- **Privacy by design:** no real names, phone numbers or addresses are required.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, Zustand |
| Maps and globe | Leaflet with clustering, CesiumJS |
| API | Node.js 22, Hono, TypeScript (strict) |
| Database | PostgreSQL (Neon in production) with Drizzle ORM |
| Auth | Server-owned secure cookie sessions, WebAuthn passkeys, optional Google |
| Media | Private S3-compatible object storage, served through the API |
| Hosting | Vercel (frontend), Render (API), Neon (database) |

Browser requests stay same-origin: Vercel rewrites `/api/*` and `/media/*` to the
API, which owns authentication and data access. The browser never talks to the
database directly.

## Quick start

**Requirements:** Docker with Compose (easiest) or Node.js 22 and PostgreSQL.

### Docker (recommended)

```bash
scripts/start-uat.sh
```

This starts the frontend on <http://localhost:5173>, the API on port 10000 and an
isolated local PostgreSQL, applies migrations, seeds the catalog and runs health
checks. Source edits in `frontend/src` and `server/src` reload automatically. Stop it
with `docker compose -f compose.dev.yml down` (your local data is kept).

Self-registration is off by default. Create a local admin with a password of at
least 12 characters:

```bash
read -r -s -p 'Local admin password: ' PLG_DEV_PASSWORD; printf '\n'
printf '%s' "$PLG_DEV_PASSWORD" | docker compose -f compose.dev.yml run --rm -T --no-deps \
  -e BOOTSTRAP_EMAIL=dev@example.test -e 'BOOTSTRAP_NAME=Local Dev Admin' \
  api node --import /app/docker/dev/local-db-guard.mjs --import tsx scripts/bootstrap-family.ts
unset PLG_DEV_PASSWORD
```

### No-login map preview

```bash
npm ci --prefix frontend
npm run dev:uat --prefix frontend -- --host 127.0.0.1 --port 5173
```

Open <http://127.0.0.1:5173/uat/map>. It uses the checked-in catalog, so no account,
API or database is needed.

### Native development

```bash
npm ci --prefix frontend && npm ci --prefix server
cp server/.env_dev.example server/.env_dev     # local-only credentials
npm run db:migrate:local --prefix server
npm run db:seed:local --prefix server
npm run dev:local --prefix server              # API on 127.0.0.1:10000
npm run dev --prefix frontend -- --mode vercel # site on 127.0.0.1:5173
```

Local scripts refuse non-local database URLs. See `server/.env_dev.example` for a
dedicated PostgreSQL container command.

## Testing

```bash
npm test --prefix frontend
npm run typecheck:hosting --prefix frontend
npm run build --prefix frontend
npm test --prefix server
npm run typecheck --prefix server
npm run build --prefix server
```

Some art-source tests are skipped when the local-only `art/` folder is absent.

## Deploying your own copy

1. **Database:** create a PostgreSQL database. Run `npm run db:migrate --prefix server`
   with the direct connection string, then `npm run db:seed --prefix server`. Runtime
   traffic uses the pooled connection string.
2. **API:** deploy `server/` (see [`render.yaml`](render.yaml)). Set `DATABASE_URL`,
   `DATABASE_URL_UNPOOLED`, `ALLOWED_ORIGINS`, `ALLOWED_FORWARDED_HOSTS` and your
   object-storage variables. See [`server/.env.example`](server/.env.example) and
   `server/.env.staging.example`. Registration stays off until `ALLOW_REGISTRATION=true`.
3. **Frontend:** deploy `frontend/` and set `RENDER_API_ORIGIN` to your API URL.
4. **Make it yours:** replace the placeholder contact address in
   `frontend/src/components/Landing/legalContent.ts` (and the Vietnamese entries in
   `frontend/src/i18n/vi.json`), set `MET_USER_AGENT` for weather requests, and have
   the privacy policy and terms reviewed for your country.

Never put database, session or storage credentials in `VITE_*` variables or in
source control.

## Repository layout

```
frontend/         React/Vite app and Vercel routing
  src/features/   Minigames, parent space, achievements
  src/components/ Map, item detail, quizzes, journey, calendar, landing
  data/           Catalog seeds and image provenance
server/           Hono API
  src/            Auth, catalog, quizzes, achievements, minigame rules
  drizzle/        Database migrations
docs/             Plans, decisions and API guides
wikis/            Architecture, requirements, database and minigame notes
scripts/          Local launch and repository checks
compose.dev.yml   Local PostgreSQL, API and frontend stack
```

Start with [`wikis/index.md`](wikis/index.md) for architecture and minigame notes,
[`docs/plans/`](docs/plans/) for design history, and the `AGENTS.md` files for
contributor conventions. Original art sources and generation prompts are not part of
this repository, so a few notes point to files you will not find here.

## License

Free to use, copy, modify and fork for **personal, non-commercial use** under the
[PolyForm Noncommercial License 1.0.0](LICENSE). Commercial use, such as selling it,
running it as a paid or ad-supported service, or using it inside a business, is not
permitted without separate permission. This is a source-available license, not an
OSI-approved open-source license. Bundled third-party libraries and data keep their
own terms; see `frontend/public/legal/third-party-notices.txt`.

## Support

The app is free. If it is useful to you, an optional donation helps with hosting costs:
[Donate via PayPal](https://www.paypal.com/qrcodes/p2pqrc/H2KY5GDQVPX2Y).
