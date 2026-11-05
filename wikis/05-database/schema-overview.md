---
title: Database Schema Overview & ERD
tags: [database, schema, postgresql, neon, drizzle, erd]
created: 2026-11-01
---

# Database Schema Overview & ERD

The **Personal Learning Ground** persistence tier runs on **Neon PostgreSQL 16+** using **Drizzle ORM**. The database is normalized around core relational boundaries while utilizing indexed `jsonb` columns for game state reducers, complex layouts, and localized question options.

---

## 🗄️ Database Architecture Highlights

1. **Strict Relational Integrity**:
   - Foreign key constraints with `ON DELETE CASCADE` ensure that removing a family or child profile cleanly removes all associated quiz attempts, minigame progress, calendar lists, and social baskets without orphaned records.
2. **Robust Check Constraints**:
   - Scores, totals, percentages, coordinates, and status enums are enforced at the database level using SQL check constraints.
3. **Optimized Multi-Column & Partial Indexes**:
   - Unique partial indexes enforce pending friend request uniqueness and template calendar uniqueness while keeping index size minimal.
4. **Authoritative Materialized Snapshots**:
   - Heavy explore tree hierarchies are stored in `explore_snapshots` as pre-computed blobs, decoupled from transactional user tables.

---

## 📊 Comprehensive Schema Entity Map

```mermaid
classDiagram
    direction TB
    class families {
      +text id PK
      +text email UK
      +text display_name
      +text password_hash
      +text role
    }
    class profiles {
      +text id PK
      +text family_id FK
      +text name
      +text public_id UK
    }
    class items {
      +text id PK
      +text category
      +doublePrecision latitude
      +doublePrecision longitude
      +boolean is_published
    }
    class quiz_questions {
      +text id PK
      +text item_id FK
      +text question
    }
    class profile_progress {
      +text id PK
      +text profile_id FK
      +text item_id FK
    }
    class calendar_plan_lists {
      +text id PK
      +text profile_id FK
      +text scope
      +text area
    }
    class town_state {
      +text profile_id PK, FK
      +jsonb state
    }
    class fishing_progress {
      +text profile_id PK, FK
      +jsonb state
    }
    class infinidrill_progress {
      +text profile_id PK, FK
      +jsonb state
    }

    families "1" --> "*" profiles : owns
    families "1" --> "*" sessions : creates
    families "1" --> "*" passkeys : registers
    profiles "1" --> "*" profile_progress : records
    items "1" --> "*" profile_progress : tracks
    items "1" --> "*" quiz_questions : contains
    items "1" --> "*" item_translations : localizes
    profiles "1" --> "*" calendar_plan_lists : schedules
    profiles "1" --> "1" town_state : simulates
    profiles "1" --> "1" fishing_progress : fishes
    profiles "1" --> "1" infinidrill_progress : drills
```

---

## 🧭 Navigation & Cross References
- Complete Tables Reference: [[05-database/tables-reference|Complete Database Tables Reference]]
- Migration Workflow: [[05-database/migrations|Database Migrations]]
- Seed Data Management: [[05-database/seed-data|Seed Data and Content Refresh]]
- Core Entities: [[04-domain-entities/core-entities|Core Domain Entities]]
