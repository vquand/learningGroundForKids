---
title: Social & Community Interaction Entities
tags: [entities, social, friend-requests, town-baskets, river, community]
created: 2026-11-01
---

# Social & Community Interaction Entities

The social domain models positive, safe interactions between verified friends and family circles without public messaging risks.

---

## 🤝 Entity Relationship Diagram

```mermaid
erDiagram
    FAMILIES ||--o{ FRIEND_REQUESTS : "requests / receives"
    PROFILES ||--o{ FRIEND_REQUESTS : "scopes to (optional)"
    PROFILES ||--o{ TOWN_BASKET_GIFTS : "sends / opens"
    PROFILES ||--o{ TOWN_RAFT_ITEMS : "provides / picks"
    PROFILES ||--o{ TOWN_RIVER_EVENTS : "records event"
    PROFILES ||--o{ TOWN_RIVER_INBOX : "receives news"

    FRIEND_REQUESTS {
        text id PK
        text requesting_family_id FK
        text requesting_scope
        text requesting_profile_id FK
        text requesting_label
        text target_family_id FK
        text target_scope
        text target_profile_id FK
        text target_label
        text target_code
        text requester_message
        text status
        timestamp created_at
        timestamp responded_at
        text responded_by_family_id FK
    }

    TOWN_BASKET_GIFTS {
        text id PK
        text sender_profile_id FK
        text recipient_profile_id FK
        text decoration
        integer message
        timestamp created_at
        timestamp opened_at
    }

    TOWN_RAFT_ITEMS {
        text id PK
        text provider_id FK
        text source_key
        text kind
        text item_id
        integer stamina
        timestamp produced_at
        text picker_id FK
        timestamp picked_at
        text pickup_request_id
    }

    TOWN_RIVER_EVENTS {
        bigserial sequence PK
        text event_key UK
        text owner_id FK
        text visitor_id
        text kind
        jsonb data
        integer stamina
        timestamp created_at
    }
```

---

## 📋 Entity Specifications

### 1. `FriendRequest` (`friend_requests`)
A formal connection request between two accounts.
- **`requestingScope`** & **`targetScope`**: `"family"` (connects household accounts) or `"profile"` (connects specific child profiles).
- **`targetCode`**: The private alphanumeric code supplied out-of-band by the recipient.
- **`status`**: `"pending"`, `"accepted"`, `"rejected"`, or `"cancelled"`.
- **`crossFamily Check`**: Ensures families cannot send friend requests to themselves.

### 2. `TownBasketGift` (`town_basket_gifts`)
Surprise gift baskets sent between connected friends' town islands.
- **`decoration`**: Cosmetic basket topper (`"flowers"`, `"balloons"`, `"gnome"`).
- **`message`**: Integer ID (0–9) referencing pre-scripted, child-safe greeting cards.
- **`openedAt`**: Recorded when the recipient discovers the basket on their island.

### 3. `TownRaftItem` (`town_raft_items`)
Shared trading rafts floating between friends' islands down the river.
- **`kind`**: `"fish"`, `"vegetable"`, or `"egg"`.
- **`stamina`**: Energy boost granted upon pickup (1–10).
- **`pickupRequestId`**: Idempotency token preventing double-collection.

### 4. `TownRiverEvent` (`town_river_events`) & `TownRiverInbox` (`town_river_inbox`)
An append-only timeline of visitors, gifted baskets, and raft deliveries seen in the child's River Log.

---

## 🧭 Navigation & Cross References
- Safety and Privacy: [[02-requirements/safety-and-privacy|Safety and Privacy Requirements]]
- Town Island Simulation: [[07-minigames/town-building|Town Building Minigame]]
- Database Tables Reference: [[05-database/tables-reference|Complete Database Tables Reference]]
- Social API Routes: [[06-api-reference/auth-and-profile-routes|Auth and Profile Routes]]
