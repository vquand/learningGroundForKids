---
title: Minigame Viewport and UX Requirements
tags: [viewport, ux, ipad, responsive, zero-scroll, guidelines]
created: 2026-11-01
---

# Minigame Viewport and UX Requirements

A fundamental architectural mandate across all minigames and interactive activities in **Personal Learning Ground** is the **Strict Zero-Scroll Viewport Requirement**.

---

## 📱 The Zero-Scroll Viewport Mandate

> [!IMPORTANT]
> **Every minigame must fit completely within the viewport on laptop and iPad landscape screens without vertical or horizontal scrolling.**
> All buttons, inputs, HUD indicators, question prompts, and controls needed in the current step must remain visible and directly interactable without scrolling.

### Target Reference Viewports
Every minigame flow (setup, gameplay, pause, results, reward animations, and failure states) must be validated at these standard screen sizes:

| Target Device / Resolution | Dimensions (px) | Aspect Ratio | Key Consideration |
| :--- | :---: | :---: | :--- |
| **Standard Laptop** | `1366 × 768` | ~16:9 | Low vertical height; tight header/HUD margins required. |
| **Standard iPad Landscape** | `1024 × 768` | 4:3 | Square-ish aspect ratio; horizontal space is constrained. |
| **Modern iPad Pro Landscape** | `1180 × 820` | ~1.44:1 | High density; touch targets must remain at least 44×44px. |
| **Compact Laptop / Chromebook**| `1280 × 800` | 16:10 | Safe areas and browser chrome must be accounted for. |

---

## 🎨 Layout & Sizing Strategies

To achieve full responsiveness without scrollbars:

1. **Dynamic Viewport Units**:
   - Utilize CSS `100dvh` (dynamic viewport height) or flexbox/grid containers locked to `h-[100dvh] overflow-hidden`.
2. **Aspect-Ratio Preserving Game Stages**:
   - Main game canvases and stages scale proportionally within the available container using `object-contain` or CSS `max-w-full max-h-full aspect-[4/3]` / `aspect-[16/9]`.
3. **Floating HUD & Non-Overlapping Prompts**:
   - Scores, timer bars, and health indicators are anchored to screen perimeters.
   - Question dialogues or answer buttons must never cover the primary action stage or push action buttons off-screen.
4. **Touch Targets for Children**:
   - All interactive controls have a minimum touch footprint of `44px × 44px` with ample padding to prevent accidental mis-taps.

---

## 🕹️ Playground Activity Card Ordering

To maintain cognitive consistency for young children navigating the **Playground Activity Hub** (`/playground`), the first three cards must remain strictly fixed in this exact order:

```mermaid
flowchart LR
    Card1["1. 👤 Your Avatar\n(Profile Personalization)"]
    Card2["2. 🏅 Badges\n(Trophy Cabinet)"]
    Card3["3. 🏡 Town Name\n(Active Child Town Island)"]
    Card4["4. 📅 Calendar\n(Daily Routine)"]
    Card5["5. ❓ Daily Quiz\n(Daily Streak)"]
    Card6["6+. Minigames\n(UFO, Drill, Fishing, Racing...)"]

    Card1 --> Card2 --> Card3 --> Card4 --> Card5 --> Card6
```

New minigames, seasonal events, or exploratory modules may be appended after card 5, but **must never displace slots 1, 2, or 3**.

---

## 🎁 Resource Collection Feedback (Town Reward Bar)

When a minigame awards town building resources (wood, stone, coins, sand, fish):

1. **Central Announcement**:
   - The awarded material icon and a large `+N` indicator appear in the screen center.
2. **Flying Animation**:
   - The reward sprite animates smoothly from screen center toward the visible `TownRewardBar` or inventory icon.
3. **Cosmetic Only**:
   - The animation is strictly visual feedback; the authoritative reward receipt (`receiptId`) is already committed on the server.
   - Reloading or replaying does not duplicate rewards.
4. **Accessibility**:
   - Animations respect `prefers-reduced-motion` settings and provide screen-reader announcements.

---

## 🧭 Navigation & Cross References
- Minigames Overview: [[07-minigames/minigames-overview|Minigames Overview]]
- Functional Requirements: [[02-requirements/functional-requirements|Functional Requirements]]
- Town Island Simulation: [[07-minigames/town-building|Town Building Minigame]]
- Local UAT Protocol: [[08-development-and-ops/local-development|Local Development and UAT]]
