---
title: Functional Requirements
tags: [requirements, educational, bilingual, multi-child, core-features]
created: 2026-11-01
---

# Functional Requirements

**Personal Learning Ground** is an educational platform designed to foster curiosity, historical knowledge, cultural appreciation, and foundational logic among children aged 5–14 while providing parents with transparent oversight and collaborative tools.

---

## 🎯 Core Pedagogical Objectives

1. **Geographic & Historical World Exploration**:
   - Provide an interactive 3D globe and 2D map populated with thousands of verified landmarks spanning world history, architecture, geography, food, and culture.
   - Group historical landmarks across eras (Ancient, Classical, Medieval, Early Modern, Industrial, Modern, Contemporary).
2. **Interactive Reinforcement (Quizzes & Flashcards)**:
   - Challenge learners with context-aware quizzes and multi-mode flashcard decks (SM-2 spaced repetition principles).
   - Provide daily quizzes with streak tracking and bonus rewards.
3. **Applied Learning Minigames**:
   - Transform abstract mathematics, linguistics, spatial reasoning, and culinary chemistry into engaging, arcade-style minigames.
4. **Kid Daily Routine & Calendar**:
   - Help children organize daily life with visual schedules, meal planners, study logs, lunar calendar celebrations, and weather forecasts.
5. **Positive Social Community**:
   - Allow children to connect safely with friends and family members through gift baskets, visiting each other's towns, and sharing resources on town rafts.

---

## 🌐 Bilingual Educational Mandate (`en` & `vi`)

Every user-facing educational concept, quiz question, flashcard, and interface control must support **English** and **Vietnamese**:

- **Catalog Translations (`item_translations`)**: Every item possesses localized `title`, `description`, and `history`.
- **Phonetic & Vocabulary Spelling**: Minigames such as *Shoo Shoo UFO* validate words against dual-language dictionaries (`dictionary.ts` and `dictionary.vi.ts`), strictly supporting accented Vietnamese characters:
  ```regex
  ^[a-zA-ZàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ\s]+$
  ```
- **Interface Internationalization (`i18n`)**: Seamless language toggle via `LanguageSwitcher` persisting user preference in client state and cookies.

---

## 👨‍👩‍👧‍👦 Multi-Child Profile Model

1. **Family Isolation**:
   - A single registered family account supports up to **5 child profiles** (`MAX_PROFILE_COUNT = 5`).
2. **Custom Personalization**:
   - Each child chooses a name, emoji, favorite accent color, avatar frame, and customized avatar (emoji, pre-made mascot, or custom photo upload).
   - Children set their native country and city for localized globe camera homing and weather forecasting.
3. **Independent Progression**:
   - Badges, quiz attempts, town islands, drill depth, and learning streaks belong exclusively to the active profile.
   - Switching profiles instantly swaps the active context without requiring family re-authentication.

---

## 🛠️ User Roles & Functional Matrix

| Feature / Subsystem | Child Profile | Parent Space | Admin Space |
| :--- | :---: | :---: | :---: |
| **3D World Map & Item Detail** | ✅ Full Access | ✅ Preview Mode | ✅ Full Access |
| **Marking Lesson "Done"** | ✅ Gated (3 Gates) | ✅ Verification | ✅ Content View |
| **Quizzes & Flashcards** | ✅ Earn Badges | ✅ Performance Reports | ✅ Edit / Generate / Test |
| **Minigames (Drill, Town, UFO, etc.)**| ✅ Play & Earn | ✅ Summary Progress | ✅ Catalog & Seed Mgmt |
| **Kid Calendar** | ✅ View / Check Off | ✅ Full Edit & Export | ✅ Oversight |
| **Custom Lesson Authoring** | ❌ Read Only | ✅ Create & Share | ✅ System Master |
| **Disabling Lessons for Family** | ❌ No Access | ✅ Toggle Off | ✅ Master Curation |
| **Friend Requests** | ✅ Send / Accept (Code)| ✅ Oversight | ✅ Audit Log |
| **Achievement Migrations** | ❌ No Access | ❌ Read Only | ✅ Single Idempotent Button |

---

## 🧭 Navigation & Cross References
- Safety and Parental Verification: [[02-requirements/safety-and-privacy|Safety and Privacy Requirements]]
- Done Tracking Rules: [[02-requirements/done-tracking|Done-Tracking Gated Rules]]
- Minigame Specifications: [[07-minigames/minigames-overview|Minigames Overview]]
- Identity Entities: [[04-domain-entities/core-entities|Core Domain Entities]]
