---
title: Seed Data & Content Refresh Pipeline
tags: [database, seed-data, catalog, content-hash, ingestion]
created: 2026-11-01
---

# Seed Data & Content Refresh Pipeline

The geographic landmarks, historical articles, quiz questions, and bilingual descriptions forming the educational core of **Personal Learning Ground** originate as reviewed JSON seed files.

---

## 📂 Catalog Seeds Location

Seed files reside in:
`frontend/data/catalog-seeds/`

These files contain:
- Landmark coordinate metadata (`latitude`, `longitude`, `countryCode`).
- Era and category classifications.
- Localized English and Vietnamese text (`item_translations`).
- Quiz questions with validated correct answers (`quiz_questions`).
- Flashcard prompts and explanations (`flashcards`).

---

## 🔄 Content Hash Versioning (`catalog_content_hash`)

To avoid redundant database writes and excessive Neon CPU consumption during seed updates:

```mermaid
flowchart TD
    Read["Read catalog-seeds/*.json"] --> Hash["Compute SHA-256 of Normalized JSON Content"]
    Hash --> Query["Query items.catalog_content_hash"]
    Query --> Match{"Hash matches\nexisting record?"}

    Match -- Yes --> Skip["Skip Item (No write required)"]
    Match -- No --> Upsert["Upsert items, translations, quiz_questions\nUpdate catalog_content_hash"]
    Upsert --> BumpRev["Bump explore_revisions.catalogRevision"]
    BumpRev --> SnapQueue["Queue explore_rebuild_jobs"]
```

---

## ⚙️ Refresh & Sync Commands

```bash
# Seed initial admin account and default catalog
npm run db:seed --prefix server

# Trigger catalog refresh from seed files
npm run catalog:refresh --prefix server
```

The server also exposes an authenticated admin endpoint (`POST /api/v1/admin/items/refresh`) with a background worker manager (`CatalogRefreshJobManager`) providing progress reporting via `GET /api/v1/admin/items/refresh/status`.

---

## 🧭 Navigation & Cross References
- Complete Tables Reference: [[05-database/tables-reference|Complete Database Tables Reference]]
- Explore Snapshots: [[01-architecture/caching-and-performance|Caching and Performance Architecture]]
- Admin Ingestion API: [[06-api-reference/parent-and-admin-routes|Parent and Admin Routes]]
- Local UAT Launcher: [[08-development-and-ops/local-development|Local Development and UAT]]
