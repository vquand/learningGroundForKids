---
title: Auth & Profile API Routes
tags: [api, auth, profiles, passkeys, sessions, avatars]
created: 2026-11-01
---

# Auth & Profile API Routes

This reference covers authentication, family session lifecycle, WebAuthn passkeys, Google OAuth, and child profile management.

---

## 🔐 Authentication & Session Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/v1/auth/session` | Get active family session and user profile. | No |
| `GET` | `/api/v1/auth/registration` | Check if registration is open / available. | No |
| `POST` | `/api/v1/auth/register` | Register a new family account. | No (Rate-limited) |
| `POST` | `/api/v1/auth/login` | Authenticate with email and password. Sets `session_token` cookie. | No (Rate-limited) |
| `POST` | `/api/v1/auth/logout` | Revoke session and clear cookie. | Yes |

### WebAuthn Passkeys (`/api/v1/auth/passkey/*`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/passkey/options` | Generate WebAuthn assertion options for login. |
| `POST` | `/api/v1/auth/passkey/verify` | Verify passkey assertion and issue family session. |

### Google OAuth (`/api/v1/auth/google/*`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/google/start` | Initialize Google OAuth PKCE flow. |
| `GET` | `/api/v1/auth/google/callback` | OAuth redirect callback handler. |

---

## 🧒 Profile Management Endpoints (`/api/v1/profiles`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/v1/profiles` | List child profiles belonging to authenticated family. | Yes |
| `POST` | `/api/v1/profiles` | Create a new child profile (name, emoji, color, city). | Yes |
| `GET` | `/api/v1/profiles/:profileId` | Get profile details, done counts, and badge totals. | Yes |
| `PATCH` | `/api/v1/profiles/:profileId` | Update profile appearance, name, or home city. | Yes |
| `DELETE`| `/api/v1/profiles/:profileId` | Remove a child profile and cascade-delete child data. | Yes (Parent access) |
| `POST` | `/api/v1/profiles/:profileId/avatar` | Stream upload custom profile avatar image. | Yes |

---

## 🤝 Social & Friend Requests (`/api/v1/friend-requests`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/friend-requests` | List incoming and outgoing friend requests for family. |
| `POST` | `/api/v1/friend-requests` | Create a friend request using recipient's `target_code`. |
| `POST` | `/api/v1/friend-requests/:id/respond` | Accept or reject a pending friend request. |

---

## 🧭 Navigation & Cross References
- Security Architecture: [[01-architecture/security-and-auth|Security and Authentication Model]]
- Core Entities: [[04-domain-entities/core-entities|Core Domain Entities]]
- Parent Space Routes: [[06-api-reference/parent-and-admin-routes|Parent and Admin Routes]]
- API Overview: [[06-api-reference/api-overview|API Architecture and Conventions]]
