---
title: Learning & Quiz API Routes
tags: [api, quiz, progress, flashcards, badges, daily-quiz]
created: 2026-11-01
---

# Learning & Quiz API Routes

This reference covers lesson progress marking, item-specific quizzes, daily streak quizzes, flashcard study sessions, and badge awards.

---

## ✅ Progress & Landmark Completion

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/profiles/:profileId/progress` | List all completed and in-progress item IDs for profile. |
| `GET` | `/api/v1/profiles/:profileId/progress/:itemId` | Check single landmark completion status. |
| `POST`| `/api/v1/profiles/:profileId/progress/:itemId` | Submit landmark completion (enforces the 3-gate rule; checks `quiz_required`). |
| `GET` | `/api/v1/profiles/:profileId/completions` | Return detailed timestamped completion history. |
| `GET` | `/api/v1/profiles/:profileId/badges` | List all badges earned by profile. |
| `GET` | `/api/v1/profiles/:profileId/achievement-groups` | Detailed group-by-group achievement progress. |

---

## ❓ Item Assessment Quizzes

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/items/:itemId/quiz` | Fetch active quiz questions for an item (options are randomized; correct answers withheld). |
| `GET` | `/api/v1/profiles/:profileId/quiz/items/:itemId/status` | Get attempt count, best score, and pass status. |
| `POST`| `/api/v1/profiles/:profileId/quiz/items/:itemId/submit` | Submit answers for grading, evaluate badges, and unlock completion. |

---

## 📅 Daily Quiz Endpoints (`/api/v1/profiles/:profileId/quiz/daily/*`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `.../quiz/daily` | Fetch today's personalized 5-question daily quiz. |
| `GET` | `.../quiz/daily/status` | Get today's streak count, completion status, and bonus sand. |
| `POST`| `.../quiz/daily/submit` | Submit daily answers; increments streak and awards town materials. |
| `GET` | `.../quiz/daily/settings` | Get configured vocabulary and subject modes. |
| `PUT` | `.../quiz/daily/settings` | Update enabled question types. |

---

## 🃏 Flashcards & Spaced Repetition

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/items/:itemId/flashcards/options` | Discover available deck themes (country, category, era). |
| `GET` | `/api/v1/profiles/:profileId/items/:itemId/flashcards/deck` | Load a study deck for the selected theme. |
| `POST`| `/api/v1/profiles/:profileId/flashcard-study-sessions` | Record a completed study session (`got_it` vs `review_again`). |

---

## 🧭 Navigation & Cross References
- Done Tracking Requirements: [[02-requirements/done-tracking|Done-Tracking Gated Rules]]
- Progress Entities: [[04-domain-entities/progress-and-achievements|Progress and Achievements Entities]]
- Parent Reports API: [[06-api-reference/parent-and-admin-routes|Parent and Admin Routes]]
- API Overview: [[06-api-reference/api-overview|API Architecture and Conventions]]
