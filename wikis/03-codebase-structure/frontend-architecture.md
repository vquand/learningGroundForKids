---
title: Frontend Architecture & Client State
tags: [frontend, react, vite, zustand, react-query, cesium]
created: 2026-11-01
---

# Frontend Architecture & Client State

The frontend of **Personal Learning Ground** is structured as an interactive, highly responsive Single Page Application (SPA) designed to load swiftly and render rich 3D geospatial views alongside lightweight 2D minigames.

---

## 🏗️ Architectural Topology

```mermaid
flowchart TD
    subgraph UIComponents["View Layer (React 18)"]
        Router["React Router (BrowserRouter)"]
        Gates["Security Gates (FamilyGate, ParentGate, ProfileGate, AdminGate)"]
        Pages["Feature Pages (MapPage, CalendarPage, ActivityHub, ParentPages)"]
        CesiumComp["Cesium 3D Globe Viewer / 2D Leaflet"]
    end

    subgraph StateMgmt["Client State Layer"]
        FamilyStore["useFamilyStore (Family, Auth, SessionGeneration)"]
        ProfileStore["useProfileStore (Active Profile, Switching)"]
        FilterStore["useFilterStore (Active Categories, Active Year / Eras)"]
        AdminStore["useAdminStore (Admin Navigation & State)"]
    end

    subgraph ServerState["Server Query Cache (TanStack Query)"]
        ReactQuery["QueryClient"]
        FamilyCache["Family & Profile Queries"]
        CatalogCache["Explore Map Clusters & Items"]
        CalendarCache["Routines, Events & Weather"]
    end

    subgraph APILayer["API Client Layer (Fetch Wrapper)"]
        FetchCore["api/core.ts (Fetch with Credentials)"]
        EndpointModules["api/*.ts (profiles, items, town, calendar, miniku...)"]
    end

    Router --> Gates
    Gates --> Pages
    Pages --> CesiumComp
    Pages --> StateMgmt
    Pages --> ServerState
    ServerState --> APILayer
    APILayer --> FetchCore
```

---

## 🗃️ Client Stores (Zustand)

Client state that does not belong in the server cache is partitioned into specialized Zustand stores:

### 1. `useFamilyStore` (`frontend/src/stores/familyStore.ts`)
- **Responsibilities**: Holds currently authenticated family identity, login status, onboarding flags, and session generation counter.
- **Key Methods**:
  - `initSession()`: Reads active session state from `/api/v1/auth/session`.
  - `setAuthenticated(family)`: Updates family session.
  - `logout()`: Clears credentials and increments `sessionGeneration` to purge private query caches.

### 2. `useProfileStore` (`frontend/src/stores/profileStore.ts`)
- **Responsibilities**: Tracks which child profile is currently active in the UI.
- **Key Methods**:
  - `setActiveProfileId(profileId)`: Switches current child player.
  - `clearProfile()`: Resets active child profile, prompting the `ProfilePickerPage`.

### 3. `useFilterStore` (`frontend/src/stores/filterStore.ts`)
- **Responsibilities**: Coordinates map filters, categories, and historical era timelines.
- **Key Methods & Invariant**:
  > [!IMPORTANT]
  > `filterStore.clearEra()` clears **only** `activeYear`;
  > `filterStore.clearFilters()` clears **only** `activeCategories`.
  > Never substitute one for the other!

### 4. `useAdminStore` (`frontend/src/stores/adminStore.ts`)
- **Responsibilities**: Manages admin inspection state, active content edit drafts, and batch review filters.

---

## 🛡️ Route Gates & Navigation Protections

The routing pipeline (`frontend/src/App.tsx`) enforces hierarchical route gating:

1. **`FamilyGate`**:
   - Ensures an authenticated family session exists. If unauthenticated, renders `FamilyLoginPage`.
2. **`ProfileGate`**:
   - Ensures an active child profile is selected and verifies that the selected profile still belongs to the current server-owned profile list. If missing or invalid, renders `ProfilePickerPage`.
3. **`ParentGate`**:
   - Enforces parent verification (password/passkey) before revealing `ParentRoutes`. Clears parent cache upon access loss.
4. **`AdminGate`**:
   - Verifies the family account has `role === 'admin'`.

---

## 🌍 CesiumJS 3D Globe Integration

- **Lifecycle Management**:
  - Managed via `usePreparedMapView` and `preparedMapLifecycle.ts`.
  - Destroys WebGL contexts safely on component unmount to prevent GPU memory leaks.
- **Vite Plugin Integration**:
  - Pre-copies Cesium Workers, Widgets, and Assets into `dist/client/cesium/`.
  - Custom base URL configured via `window.CESIUM_BASE_URL = '/cesium/'`.

---

## 🧭 Navigation & Cross References
- Repository Layout: [[03-codebase-structure/repository-layout|Repository Layout]]
- Server Architecture: [[03-codebase-structure/server-architecture|Server Architecture]]
- Viewport Rules: [[02-requirements/viewport-and-ux|Minigame Viewport Requirements]]
- API Clients: [[06-api-reference/api-overview|API Reference]]
