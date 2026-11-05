import type { CookingHeatLevel } from "./cookingConfig";

export interface HeatLevelPresentation {
  level: CookingHeatLevel;
  accessibleLabel: string;
  flameSize: number;
  colorToken: "sage" | "honey" | "coral" | "ember";
}

export const HEAT_LEVEL_PRESENTATION: readonly HeatLevelPresentation[] = [
  { level: "low", accessibleLabel: "Low heat", flameSize: 34, colorToken: "sage" },
  { level: "medium", accessibleLabel: "Medium heat", flameSize: 42, colorToken: "honey" },
  { level: "high", accessibleLabel: "High heat", flameSize: 50, colorToken: "coral" },
  { level: "extreme", accessibleLabel: "Extreme heat", flameSize: 58, colorToken: "ember" },
];
