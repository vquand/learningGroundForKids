export const ERA_DEFINITIONS = [
  { id: "dino", label: "🦕 Dino Age", plainLabel: "Dino Age" },
  { id: "ancient", label: "🏛️ Long Ago", plainLabel: "Long Ago" },
  { id: "medieval", label: "⚔️ Middle Ages", plainLabel: "Middle Ages" },
  { id: "olden", label: "🚂 Olden Times", plainLabel: "Olden Times" },
  { id: "today", label: "🌍 Today", plainLabel: "Today" },
] as const;

export type EraId = (typeof ERA_DEFINITIONS)[number]["id"];

export function getEraId(year: number | null | undefined): EraId | null {
  if (year == null) return null;
  if (year <= -10000) return "dino";
  if (year <= 500) return "ancient";
  if (year <= 1500) return "medieval";
  if (year <= 1900) return "olden";
  return "today";
}
