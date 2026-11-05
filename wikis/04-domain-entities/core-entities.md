---
title: Core Identity Entities
tags: [entities, domain-models, family, profile, passkey, auth]
created: 2026-11-01
---

# Core Identity Entities

The identity domain establishes account ownership, child profiles, authentication credentials, and security assertions.

---

## 👥 Entity Relationship Diagram

```mermaid
erDiagram
    FAMILIES ||--o{ SESSIONS : "creates"
    FAMILIES ||--o{ PASSKEYS : "registers"
    FAMILIES ||--o{ PROFILES : "owns (1-5 children)"
    FAMILIES ||--o{ GOOGLE_IDENTITIES : "links (0-1)"
    FAMILIES ||--o{ FAMILY_PASSWORD_AUDIT : "targets / acts"
    SESSIONS ||--o{ PASSKEY_CHALLENGES : "issues"

    FAMILIES {
        text id PK
        text email UK
        text display_name
        text password_hash
        text role
        boolean is_active
        boolean onboarding_dismissed
        boolean onboarding_parent_visited
        timestamp created_at
        timestamp updated_at
    }

    PROFILES {
        text id PK
        text family_id FK
        text name
        text emoji
        text color
        text public_id UK
        text native_country_code
        text native_city
        text avatar_type
        text avatar_url
        text avatar_frame
        timestamp created_at
        timestamp updated_at
    }

    SESSIONS {
        text id PK
        text token_hash UK
        text family_id FK
        timestamp expires_at
        timestamp parent_verified_until
        text parent_verified_by
        timestamp created_at
    }

    PASSKEYS {
        text id PK
        text family_id FK
        text public_key
        bigint counter
        jsonb transports
        text device_type
        boolean backed_up
        timestamp created_at
        timestamp last_used_at
    }

    GOOGLE_IDENTITIES {
        text subject PK
        text family_id FK, UK
        timestamp created_at
    }
```

---

## 📋 Entity Specifications

### 1. `Family` (`families`)
The top-level account representing a household or educational account.
- **`id`**: Unique text ID (UUID).
- **`email`**: Unique lowercase email address.
- **`displayName`**: Family name (e.g., "The Nguyen Family").
- **`passwordHash`**: Argon2id password hash or sentinel constant (`GOOGLE_ONLY_PASSWORD`).
- **`role`**: `"family"` (standard user) or `"admin"` (elevated platform administrator).
- **`isActive`**: Account activation flag.
- **`onboardingDismissed`** & **`onboardingParentVisited`**: Controls display of initial family setup tutorial.

### 2. `Profile` (`profiles`)
An individual child learner belonging to a family (up to 5 profiles per family).
- **`id`**: Internal profile UUID.
- **`familyId`**: Foreign key to `families.id` with cascade deletion.
- **`name`**: Child's name or nickname.
- **`emoji`**: Assigned emoji icon.
- **`color`**: Theme color hex / slug.
- **`publicId`**: Publicly shareable alphanumeric code (e.g., for friend requests).
- **`nativeCountryCode`** & **`nativeCity`**: Geographic origin for globe camera positioning and weather forecasting.
- **`avatarType`**: `"emoji"`, `"default"`, or `"custom"`.
- **`avatarUrl`**: Path or object storage key to custom avatar.
- **`avatarFrame`**: Optional cosmetic collectible frame (e.g., `"bronze"`, `"gold"`, `"ufo"`).

### 3. `Session` (`sessions`)
Active browser sessions authenticated via cookie.
- **`id`**: Session identifier.
- **`tokenHash`**: SHA-256 hash of the plain session token cookie.
- **`familyId`**: Foreign key to `families.id`.
- **`expiresAt`**: Session expiration timestamp.
- **`parentVerifiedUntil`**: Temporary elevation timestamp granting Parent Space access.
- **`parentVerifiedBy`**: Method used to elevate (`"password"`, `"passkey"`, or `"google"`).

### 4. `Passkey` (`passkeys`)
FIDO2 / WebAuthn public key credentials registered to a family.
- **`id`**: Base64URL credential ID.
- **`familyId`**: Foreign key to `families.id`.
- **`publicKey`**: Stored public key for signature verification.
- **`counter`**: Monotonic signature counter preventing replay attacks.
- **`transports`**: Supported transports (`["internal", "hybrid", "usb"]`).
- **`deviceType`**: `"singleDevice"` or `"multiDevice"`.
- **`backedUp`**: Boolean indicating sync/cloud backup status.

### 5. `GoogleIdentity` (`google_identities`)
Maps an external Google OAuth subject ID to a family account.
- **`subject`**: Unique Google sub claim.
- **`familyId`**: Unique foreign key to `families.id` (1:1 relationship).

---

## 🧭 Navigation & Cross References
- Security Model: [[01-architecture/security-and-auth|Security and Authentication Model]]
- Database Tables Reference: [[05-database/tables-reference|Complete Database Tables Reference]]
- Auth API Endpoints: [[06-api-reference/auth-and-profile-routes|Auth and Profile Routes]]
- Catalog Entities: [[04-domain-entities/catalog-and-learning|Catalog and Educational Content Entities]]
