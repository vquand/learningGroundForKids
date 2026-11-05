---
title: Town Building & Island Simulation
tags: [minigames, town-building, island, lake, gardening, rafts, events]
created: 2026-11-01
---

# Town Building & Island Simulation

**Town Building** (`/town-building`) is a persistent island-building simulation where children utilize materials earned across quizzes and minigames to cultivate gardens, raise poultry, build civic structures, and welcome visiting friends.

---

## 🏝️ Island Mechanics & Subsystems

```mermaid
flowchart TD
    subgraph Resources["Resource Ingestion"]
        QuizRewards["Quizzes & Minigames\n(Wood, Stone, Sand, Coins)"]
        GardenHarvest["Garden Crops\n(Cabbages, Pumpkins, Berries)"]
        LakeCatch["Town Lake\n(Fish, Ducklings, Water plants)"]
    end

    subgraph Simulation["Town Reducer (town_state)"]
        Grid["Isometric Grid (16x16)\n(Tiles, Paths, Fences)"]
        Civ["Civic Houses & Workshops\n(Level 1 - 5 Upgrades)"]
        Animals["Wildlife & Pets\n(Cows, Sheep, Capybaras)"]
        Weather["Town Weather Engine\n(Sunny, Rain, Met forecast)"]
    end

    subgraph Social["River Trade & Visitors"]
        Raft["Town Raft Items\n(Shared river stock)"]
        Baskets["Town Basket Gifts\n(Friend gifts & greeting cards)"]
        RiverLog["Town River Events\n(Arrival timeline)"]
    end

    Resources --> Simulation
    Simulation --> Social
```

---

## 🌾 Gardening & Wildlife Ecology

- **Crop Growth Cycles**: Crops progress through seeded, sprouting, and ready-to-harvest stages influenced by town weather and watering routines (`gardenSimulation.ts`).
- **Town Lake & Aquatic Life**:
  - The Town Lake map features water depth layers, swimming ducks, and fish schools.
  - Feeding waterfowl unlocks eggs and feathers used in crafting.
- **Wildlife Interactions**:
  - Animals (dairy cows, Highland cattle, sheep, and friendly capybaras) wander the island with realistic pasture habits (`animalHabits.ts`).
  - Caring for animals increases their friendship level and produces milk, wool, and comfort.

---

## 🎃 Seasonal & Timed Events (ADR-008)

Town islands experience dynamic seasonal events:
- **Halloween Event**:
  - Spooky ghostly skies, wandering spirit critters (`ghostMotion.ts`), and pumpkin lantern crafting (`halloweenCalendar.ts`).
  - Unlocks exclusive Halloween badge medallions.
- **Women's Day Event**:
  - Special flower stalls and greeting missions celebrating mothers, grandmothers, and female role models.

---

## 🛶 Social River Trade & Friend Baskets

- **Friend Baskets (`town_basket_gifts`)**: Children leave decorated baskets with pre-scripted messages on friends' islands.
- **Shared Rafts (`town_raft_items`)**: Rafts float down the shared river loaded with produce and fresh catches. Friends take what they need to recharge minigame stamina.

---

## 🧭 Navigation & Cross References
- Minigames Overview: [[07-minigames/minigames-overview|Minigames Overview]]
- Town Database Tables: [[05-database/tables-reference|Database Tables Reference (town_state, town_raft_items)]]
- Town API Endpoints: [[06-api-reference/minigame-routes|Minigame API Routes]]
- ADR-008: [[01-architecture/adrs-and-decisions|Architecture Decision Records]]
