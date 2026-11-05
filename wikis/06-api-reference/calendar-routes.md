---
title: Calendar & Daily Routine API Routes
tags: [api, calendar, routines, meals, study, weather, notifications]
created: 2026-11-01
---

# Calendar & Daily Routine API Routes

This reference covers the kid calendar, daily routine task lists, meal planners, school study plans, local weather forecasts, and parent notifications.

---

## 📅 Schedule & Routine Endpoints (`/api/v1/calendar/*`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/calendar/plans` | Fetch schedule plans (templates or date-specific lists) for profile. |
| `PUT` | `/api/v1/calendar/plans/:id` | Save changes to a checklist (with optimistic concurrency revision check). |
| `GET` | `/api/v1/calendar/events` | List upcoming calendar events, birthdays, and recurring reminders. |
| `POST`| `/api/v1/calendar/events` | Create a new calendar milestone or reminder. |
| `PUT` | `/api/v1/calendar/events/:id` | Edit event details or recurrence rules. |
| `DELETE`| `/api/v1/calendar/events/:id`| Remove a calendar event. |
| `GET` | `/api/v1/calendar/weather` | Get current weather and 7-day forecast for the child's home city. |
| `GET` | `/api/v1/calendar/notifications`| Fetch upcoming schedule reminders and routine alerts. |

---

## 🍽️ Meal & Study Library Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/calendar/meals/library` | Get list of custom food items added to the child's meal planner. |
| `POST`| `/api/v1/calendar/meals/library` | Add a custom food item to the profile library. |
| `GET` | `/api/v1/calendar/study/library` | Get customized subject study list. |
| `POST`| `/api/v1/calendar/study/library` | Add a custom subject item. |

---

## 👨‍👩‍👧 Family Calendar Settings & Roles

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/calendar/family/settings` | Get household settings (e.g., enabled participant roles). |
| `PUT` | `/api/v1/calendar/family/settings` | Update enabled family member roles. |
| `GET` | `/api/v1/calendar/parent/overview` | Parent Space overview of all children's schedules and completion rates. |

---

## 🧭 Navigation & Cross References
- Calendar Entities: [[04-domain-entities/calendar-and-routines|Kid Calendar and Routine Models]]
- Parent Space Routes: [[06-api-reference/parent-and-admin-routes|Parent and Admin Routes]]
- API Overview: [[06-api-reference/api-overview|API Architecture and Conventions]]
