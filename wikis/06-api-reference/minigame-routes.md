---
title: Minigame API Routes
tags: [api, minigames, town, fishing, infinidrill, ufo, math-wall, miniku]
created: 2026-11-01
---

# Minigame API Routes

Every minigame communicates with authoritative server endpoints to persist state, verify player actions, grade answers, and award collectible badges.

---

## 🏡 Town Building Endpoints (`/api/v1/town/*`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/town` | Load child profile's town island grid, buildings, inventory, and weather. |
| `POST`| `/api/v1/town/actions` | Dispatch state action (place building, harvest garden, plant crop). |
| `GET` | `/api/v1/town/visits/:friendId` | Visit a friend's island to view their layout and leave baskets. |
| `POST`| `/api/v1/town/baskets` | Send a gift basket to a friend's island. |
| `POST`| `/api/v1/town/baskets/:id/open` | Open a received gift basket. |
| `GET` | `/api/v1/town/raft/stock` | View items waiting on the shared river trade raft. |
| `POST`| `/api/v1/town/raft/pickup` | Collect stamina-boosting crops or fish from the raft. |
| `GET` | `/api/v1/town/river/news` | Read chronological river arrival and visitor events. |

---

## ⛏️ InfiniDrill Endpoints (`/api/v1/infinidrill/*`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/infinidrill/progress` | Fetch drill expedition depth, upgrade parts, and mineral inventory. |
| `POST`| `/api/v1/infinidrill/dig` | Submit answer for current drill level math puzzle to descend deeper. |
| `POST`| `/api/v1/infinidrill/upgrade` | Purchase drill component upgrades (engine, drill bit, cooler, cargo). |
| `POST`| `/api/v1/infinidrill/bonus` | Attempt high-risk bonus puzzle inside cave discoveries. |

---

## 🎣 Fishing Friends Endpoints (`/api/v1/fishing/*`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/fishing/state` | Get current stamina, rod level, equipped bait, and caught species. |
| `POST`| `/api/v1/fishing/cast` | Cast line into Pond or River location; server grades reel timing. |
| `POST`| `/api/v1/fishing/upgrade` | Upgrade fishing equipment or restock bait. |

---

## 🛸 Shoo Shoo UFO Endpoints (`/api/v1/ufo/*`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/ufo/session` | Start spelling session, get active alien word clue and letters. |
| `POST`| `/api/v1/ufo/guess` | Submit guessed letter or complete word solution. |
| `POST`| `/api/v1/ufo/shoo` | Fire a defensive charge to scare away the UFO tractor beam. |

---

## 🧱 Waddle Wall Endpoints (`/api/v1/math-wall/*`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/math-wall/session` | Start arcade math sprint session and get initial obstacles. |
| `POST`| `/api/v1/math-wall/hurdle` | Submit arithmetic answer to breach the incoming wall. |

---

## 🧩 Miniku Endpoints (`/api/v1/miniku/*`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/miniku/puzzles` | List standard and custom mini Sudoku boards (4×4 and 6×6). |
| `GET` | `/api/v1/miniku/puzzles/:id` | Load puzzle givens and child's saved in-progress cells. |
| `POST`| `/api/v1/miniku/puzzles/:id/check` | Validate filled grid against solution; awards badges upon completion. |

---

## 🏎️ Road Racing Endpoints (`/api/v1/road-racing/*`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/road-racing/state` | Load vehicle state, course unlocks, and high scores. |
| `POST`| `/api/v1/road-racing/race/start` | Begin course run with active trivia gates. |
| `POST`| `/api/v1/road-racing/race/finish`| Submit race timing and quiz gate answers for grading. |

---

## 🧭 Navigation & Cross References
- Minigames Overview: [[07-minigames/minigames-overview|Minigames Overview]]
- Individual Minigame Guides: [[07-minigames/town-building|Town Building]], [[07-minigames/infinidrill|InfiniDrill]], [[07-minigames/fishing-friends|Fishing Friends]]
- Database Schema: [[05-database/tables-reference|Complete Database Tables Reference]]
- API Overview: [[06-api-reference/api-overview|API Architecture and Conventions]]
