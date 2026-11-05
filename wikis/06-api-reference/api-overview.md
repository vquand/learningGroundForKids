---
title: API Architecture & Conventions
tags: [api, hono, endpoints, conventions, errors, rate-limiting]
created: 2026-11-01
---

# API Architecture & Conventions

All client-to-server communication in **Personal Learning Ground** occurs over a standardized RESTful JSON API implemented with **Hono** on Node.js.

---

## 🌐 Common API Conventions

### Base Path & Same-Origin Delivery
- All endpoints are rooted under `/api/v1/`.
- In production, browser requests call `https://<domain>/api/v1/...` and are proxied via Vercel rewrites to Render Web Services (`https://api.<domain>/api/v1/...`).

### Request & Response Format
- **Content-Type**: `application/json; charset=utf-8` (except for avatar multipart/binary stream uploads).
- **Date Format**: ISO 8601 UTC strings (`2026-11-01T21:30:45.000Z`).
- **Tracing**: Every response contains an `x-request-id` header matching the server logger.

---

## ⚠️ Error Handling & Response Shapes

Errors thrown across route handlers use `AppError` and are converted by global error middleware into a standardized JSON response:

```json
{
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Authentication is required.",
    "details": null
  }
}
```

### Standard HTTP Status Codes

| Code | Status | Meaning & Common Usage |
| :---: | :--- | :--- |
| `200` | OK | Successful GET/PUT request. |
| `201` | Created | Successful entity creation (e.g., profile, friend request). |
| `400` | Bad Request | Validation error (Zod schema validation failed). |
| `401` | Unauthorized | Missing or expired family session cookie (`session_token`). |
| `403` | Forbidden | Missing parent elevation (`PARENT_ACCESS_REQUIRED`) or setup needed. |
| `404` | Not Found | Target landmark, profile, or puzzle does not exist. |
| `413` | Payload Too Large | Request body exceeded `MAX_AVATAR_BYTES` or `maxBodyBytes`. |
| `421` | Host Not Allowed | `Host` header does not match whitelisted domains. |
| `429` | Too Many Requests | Rate limit exceeded on authentication or passkey endpoint. |
| `500` | Internal Server Error | Unhandled server error (stack logged privately with `requestId`). |

---

## 🚦 Rate Limiting (`AuthRateLimiter`)

A sliding window rate limiter protects sensitive authentication routes against brute-force attacks:
- **Protected Paths**: `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/passkey/*`, `/api/v1/parent/access/*`, `/api/v1/admin/root/password`.
- **Response**: When breached, returns `429 Too Many Requests` with a `Retry-After: <seconds>` header.

---

## 🧭 Navigation & Cross References
- Auth Endpoints: [[06-api-reference/auth-and-profile-routes|Auth and Profile Routes]]
- Explore Endpoints: [[06-api-reference/catalog-and-explore-routes|Catalog and Explore Routes]]
- Minigame Endpoints: [[06-api-reference/minigame-routes|Minigame API Routes]]
- Server Architecture: [[03-codebase-structure/server-architecture|Server Architecture]]
