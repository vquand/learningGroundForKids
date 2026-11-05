---
title: Miniku · Little Sudoku
tags: [minigames, miniku, sudoku, logic, puzzles]
created: 2026-11-01
---

# Miniku · Little Sudoku

**Miniku** (`/miniku`) is a child-friendly mini Sudoku experience designed to introduce logical deduction, spatial patterns, and numerical problem solving without intimidating young learners.

---

## 🧩 Grid Sizes & Layouts

Unlike standard 9×9 Sudoku, *Miniku* features kid-optimized boards:

| Grid Size | Subgrid Regions | Number Range | Target Age / Skill Level |
| :---: | :---: | :---: | :--- |
| **4 × 4** | 2 × 2 boxes | 1 through 4 | Beginner (Ages 5–7); single-pass deduction. |
| **6 × 6** | 2 × 3 boxes | 1 through 6 | Intermediate (Ages 8–12); row/column intersection logic. |

---

## 💡 Intelligent Hint Engine & Error Checking

- **Visual Conflict Highlighting**:
  - Duplicate numbers in the same row, column, or mini-box gently highlight in amber.
- **Smart Hint Assistance**:
  - When enabled in `miniku_family_settings`, the hint button reveals the only logical candidate for an empty cell without revealing the entire board.
- **Custom Family Puzzles (`miniku_puzzles`)**:
  - Parents can build and share custom Sudoku puzzle layouts for their children directly from Parent Space (`/parent/lists/miniku`).

---

## 🏅 Miniku Achievements

From the `miniku` achievement group:
- **First Logic**: Solve 1st mini Sudoku puzzle.
- **Grid Master**: Solve 10 puzzles.
- **Sudoku Sizes**: Solve both 4×4 and 6×6 variants.
- **Flawless Solver**: Complete a 6×6 puzzle without using any hints or triggering error conflicts.

---

## 🧭 Navigation & Cross References
- Minigames Overview: [[07-minigames/minigames-overview|Minigames Overview]]
- Miniku Tables: [[05-database/tables-reference|Database Tables Reference (miniku_puzzles, miniku_progress)]]
- Miniku API Routes: [[06-api-reference/minigame-routes|Minigame API Routes]]
