---
title: Local Development & UAT Environment
tags: [development, local-uat, docker, startup, scripts]
created: 2026-11-01
---

# Local Development & UAT Environment

To guarantee consistent local reproduction across all development workstations, the repository provides an authoritative startup harness: `scripts/start-uat.sh`.

---

## 🚀 Starting Local UAT (The Single Launcher Command)

> [!IMPORTANT]
> Whenever initiating local development or local User Acceptance Testing (UAT), run **strictly**:
> ```bash
> scripts/start-uat.sh
> ```
> from the repository root. Do not start disparate Node scripts or Docker containers manually.

### What `scripts/start-uat.sh` Executes:
1. **Health Inspection**: Reuses an existing healthy native or Docker Compose stack if already active.
2. **Docker Orchestration**: If missing or stopped, launches local Postgres via `compose.dev.yml`.
3. **Database Population & Migration**: Applies pending Drizzle migrations and preserves existing local test accounts.
4. **Service Verification**:
   - Checks backend API readiness on `http://localhost:10000/api/v1/health/ready`.
   - Checks frontend Vite server on `http://localhost:5173`.
   - Executes a test login POST to ensure authentication cookies and database connections are operational.

---

## 🔌 Standard Local Ports

| Service | Local URL / Port | Environment Notes |
| :--- | :--- | :--- |
| **Frontend Web App** | `http://localhost:5173` | Proxies `/api/*` to Render API on port 10000 via Vite proxy. |
| **Hono API Server** | `http://localhost:10000`| Node.js / TypeScript API server. |
| **PostgreSQL Database** | `localhost:5432` | Native Postgres or Docker container (`compose.dev.yml`). |

---

## 🛠️ Essential NPM Scripts

### Frontend Scripts (`frontend/package.json`)
```bash
# Start Vite development server
npm run dev --prefix frontend

# Run TypeScript checks
npm run typecheck --prefix frontend
npm run typecheck:hosting --prefix frontend

# Execute unit and component tests
npm test --prefix frontend

# Build production bundle
npm run build --prefix frontend
```

### Server Scripts (`server/package.json`)
```bash
# Start backend in watch mode
npm run dev --prefix server

# Run backend TypeScript checks
npm run typecheck --prefix server

# Run backend unit & integration tests
npm test --prefix server

# Build production server bundle
npm run build --prefix server
```

---

## 🧭 Navigation & Cross References
- Testing & Verification: [[08-development-and-ops/testing-and-verification|Testing and Verification]]
- Release and Deployment: [[08-development-and-ops/release-and-deployment|Deployment and Operations]]
- Architecture Overview: [[01-architecture/overview|System Architecture Overview]]
