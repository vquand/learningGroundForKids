---
title: Catalog & Explore API Routes
tags: [api, explore, map, items, clusters, snapshots]
created: 2026-11-01
---

# Catalog & Explore API Routes

This reference covers world map exploration, spatial bounding queries, landmark detail retrieval, and cluster drill-downs.

---

## 🗺️ Map & Exploration Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/items` | Query catalog item summaries with category and pagination filters. |
| `GET` | `/api/v1/items/:itemId` | Retrieve full details, bilingual stories, and media for a landmark. |
| `GET` | `/api/v1/items/map/views` | Stream optimized spatial clusters for current map viewport and camera height. |
| `GET` | `/api/v1/items/map/clusters/:node/leaves`| Fetch leaf items for an expanded cluster node upon zooming in. |

### Map View Query Parameters (`/api/v1/items/map/views`)
- `min_lat`, `max_lat`: Latitude bounding box.
- `min_lon`, `max_lon`: Longitude bounding box.
- `zoom`: Current zoom level / camera altitude.
- `categories`: Comma-separated list of active category filters.
- `era`: Historical era identifier (or `year` for exact timeline position).
- `profile_id`: Evaluates custom shared lessons and disabled content for the active child.

---

## 🧭 Navigation & Cross References
- Explore Performance: [[01-architecture/caching-and-performance|Caching and Performance Architecture]]
- Catalog Entities: [[04-domain-entities/catalog-and-learning|Catalog and Educational Content Entities]]
- Done-Tracking Endpoints: [[06-api-reference/learning-and-quiz-routes|Learning and Quiz Routes]]
- API Overview: [[06-api-reference/api-overview|API Architecture and Conventions]]
