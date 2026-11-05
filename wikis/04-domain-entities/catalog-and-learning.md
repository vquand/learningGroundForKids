---
title: Catalog & Educational Content Entities
tags: [entities, catalog, items, quizzes, flashcards, translations]
created: 2026-11-01
---

# Catalog & Educational Content Entities

The catalog domain models geographic locations, historical landmarks, cultural topics, and their associated educational assessments.

---

## 🗺️ Entity Relationship Diagram

```mermaid
erDiagram
    ITEMS ||--o{ ITEM_TRANSLATIONS : "translated in (en, vi)"
    ITEMS ||--o{ ITEM_MEDIA : "features (images, audio)"
    ITEMS ||--o{ QUIZ_QUESTIONS : "assesses via"
    ITEMS ||--o{ FLASHCARDS : "practices via"
    ITEMS ||--o{ LESSON_AUDIENCES : "shared with"
    ITEMS ||--o{ FAMILY_DISABLED_LESSONS : "disabled for"
    ITEMS ||--o{ PROFILE_PROGRESS : "completed by"

    ITEMS {
        text id PK
        text category
        doublePrecision latitude
        doublePrecision longitude
        text country_code
        text icon_slug
        boolean is_published
        text source_type
        text owner_family_id FK
        text recipe
        text location_desc
        jsonb fun_facts
        jsonb audio_urls
        text youtube_url
        text trailer_url
        jsonb characters
        integer start_year
        integer end_year
        text time_precision
        text released_date
        jsonb rich_fields
        text franchise_id
        boolean quiz_required
        text catalog_content_hash
        timestamp created_at
        timestamp updated_at
    }

    ITEM_TRANSLATIONS {
        text id PK
        text item_id FK
        text lang
        text title
        text description
        text history
    }

    ITEM_MEDIA {
        text id PK
        text item_id FK
        text media_type
        text label
        text lang
        text filename
        integer sort_order
    }

    QUIZ_QUESTIONS {
        text id PK
        text item_id FK
        text question_group_id
        text lang
        text question
        text question_type
        jsonb options
        jsonb correct_answers
        integer sort_order
        boolean is_active
        timestamp created_at
    }

    FLASHCARDS {
        text id PK
        text item_id FK
        text lang
        text front
        text back
        text media_hint
        integer sort_order
        boolean is_published
        text source_type
        timestamp created_at
        timestamp updated_at
    }
```

---

## 📋 Entity Specifications

### 1. `Item` (`items`)
A physical landmark, historical event, animal habitat, culinary dish, or scientific discovery represented on the world map.
- **`id`**: Unique kebab-case slug (e.g., `"ha-long-bay"`, `"eiffel-tower"`).
- **`category`**: Category classification (`"history"`, `"nature"`, `"food"`, `"science"`, `"culture"`, etc.).
- **`latitude`** & **`longitude`**: Coordinate point on the 3D globe.
- **`countryCode`**: ISO 3166-1 alpha-2 country code.
- **`isPublished`**: Flag controlling catalog visibility.
- **`sourceType`**: `"system"` (built-in seed) or `"family"` (authored by a parent).
- **`ownerFamilyId`**: NULL for system items; references `families.id` for custom parent lessons.
- **`startYear`** & **`endYear`**: Temporal range for era-based timeline grouping.
- **`youtubeUrl`** & **`audioUrls`**: Media files triggering Gate 3 done-tracking.
- **`quizRequired`**: Mandatory flag derived from seed questions.
- **`catalogContentHash`**: SHA-256 hash of seed content for idempotent re-synchronization.

### 2. `ItemTranslation` (`item_translations`)
Bilingual content attached to an item.
- **`itemId`**: Foreign key to `items.id`.
- **`lang`**: Language code (`"en"` or `"vi"`).
- **`title`**: Localized landmark name.
- **`description`**: Engaging introductory summary.
- **`history`**: In-depth historical and cultural background story.

### 3. `ItemMedia` (`item_media`)
Photos, diagrams, and illustrations attached to an item.
- **`mediaType`**: `"image"`, `"diagram"`, `"audio"`.
- **`filename`**: CDN or local storage filename.
- **`sortOrder`**: Carousel presentation order.

### 4. `QuizQuestion` (`quiz_questions`)
Assessment question testing comprehension of an item.
- **`itemId`**: Foreign key to `items.id`.
- **`lang`**: `"en"` or `"vi"`.
- **`question`**: The question text.
- **`questionType`**: `"single_choice"`, `"multiple_choice"`, `"true_false"`.
- **`options`**: Array of string choices.
- **`correctAnswers`**: Zero-based array of correct answer indices.
- **`isActive`**: Allows soft-disabling questions without deletion.

### 5. `Flashcard` (`flashcards`)
Spaced repetition study card.
- **`front`**: Question / prompt side.
- **`back`**: Answer / explanation side.
- **`mediaHint`**: Optional pronunciation clip or visual clue.

---

## 🧭 Navigation & Cross References
- Done-Tracking Requirements: [[02-requirements/done-tracking|Done-Tracking Gated Rules]]
- Progress Entities: [[04-domain-entities/progress-and-achievements|Progress and Achievements Entities]]
- Database Tables Reference: [[05-database/tables-reference|Complete Database Tables Reference]]
- Catalog API Routes: [[06-api-reference/catalog-and-explore-routes|Catalog and Explore Routes]]
