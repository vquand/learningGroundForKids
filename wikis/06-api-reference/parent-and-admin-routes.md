---
title: Parent & Admin API Routes
tags: [api, parent, admin, lessons, reports, achievement-migration]
created: 2026-11-01
---

# Parent & Admin API Routes

This reference covers elevated operations available within **Parent Space** (family supervision, custom lesson authoring) and **Admin Space** (content ingestion, achievement migrations, family audits).

---

## 🔒 Parent Space Verification (`/api/v1/parent/access/*`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/parent/access/password` | Verify master family password to elevate session for 15 minutes. |
| `POST` | `/api/v1/parent/access/passkey/options`| Generate biometric challenge for parent passkey verification. |
| `POST` | `/api/v1/parent/access/passkey/verify` | Verify passkey signature and unlock Parent Space. |
| `POST` | `/api/v1/parent/access/lock` | Immediately lock Parent Space and revoke elevation. |

---

## 👨‍👩‍👦 Parent Lesson Management (`/api/v1/parent/lessons/*`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/parent/lessons` | List custom family lessons and disabled system lessons. |
| `POST`| `/api/v1/parent/lessons` | Create a new custom landmark lesson for the family. |
| `GET` | `/api/v1/parent/lessons/:itemId` | Retrieve custom lesson content for editing. |
| `PUT` | `/api/v1/parent/lessons/:itemId` | Update custom lesson text, coordinates, or questions. |
| `POST`| `/api/v1/parent/lessons/:itemId/share` | Share custom lesson with a friend family or child profile. |
| `POST`| `/api/v1/parent/lessons/system/disable` | Disable specific system landmarks for the household. |

---

## 📈 Parent Analytics & Child Reports (`/api/v1/parent/reports/*`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/parent/reports/overview` | Family-wide dashboard of study hours, quiz scores, and game activity. |
| `GET` | `/api/v1/parent/reports/children/:id`| Comprehensive deep-dive report for a specific child. |

---

## 🛡️ Admin Space API (`/api/v1/admin/*`)

*Restricted strictly to accounts where `role === 'admin'`.*

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/admin/session` | Inspect active administrator session. |
| `PATCH`| `/api/v1/admin/root/password` | Rotate emergency root account password. |
| `GET` | `/api/v1/admin/families` | List all registered families, profiles, and activity counts. |
| `PUT` | `/api/v1/admin/families/:id/password` | Reset a family password with mandatory audit reason logging. |
| `GET` | `/api/v1/admin/families/:id/reports` | View learning analytics for any family. |
| `GET` | `/api/v1/admin/achievements` | Inspect achievement groups and migration status. |
| `POST`| `/api/v1/admin/achievements/migrate`| Run single idempotent migration button for all achievement groups. |
| `POST`| `/api/v1/admin/achievements/:id/migrate`| Migrate a specific achievement group. |
| `POST`| `/api/v1/admin/items/refresh` | Trigger catalog content refresh job from disk seeds. |
| `GET` | `/api/v1/admin/items/refresh/status` | Poll catalog refresh progress. |

---

## 🧭 Navigation & Cross References
- Security Model: [[01-architecture/security-and-auth|Security and Authentication Model]]
- Safety & Parental Controls: [[02-requirements/safety-and-privacy|Safety and Privacy Requirements]]
- Migrations Guide: [[05-database/migrations|Database Migrations]]
- API Overview: [[06-api-reference/api-overview|API Architecture and Conventions]]
