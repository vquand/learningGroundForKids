import type { RandomSource, UpgradePart, UpgradeSlot } from "./types.ts";

const SLOTS: readonly UpgradeSlot[] = ["head", "cabin", "accessory", "engine", "treads"];

const BRANCHES: Readonly<Record<UpgradeSlot, readonly [string, string, string, string]>> = {
  head: ["Copper cone", "Steel spiral", "Crystal crown", "Star-shaped head"],
  cabin: ["Sunny yellow", "Ocean blue", "Forest green", "Sunset pink"],
  accessory: ["Scout laser", "Deep laser", "Wide laser", "Expedition laser"],
  engine: ["Copper housing", "Steel housing", "Crystal housing", "Star housing"],
  treads: ["Rubber tracks", "Steel tracks", "Crystal-edged tracks", "Star-pattern tracks"],
};

const COLORS: Readonly<Record<UpgradeSlot, readonly string[]>> = {
  head: ["#d98a48", "#aeb8c7", "#8fe4d8", "#f6d16d"],
  cabin: ["#ffd86a", "#72c8f2", "#79d19d", "#f59aba"],
  accessory: ["#ef8d51", "#9ca8b7", "#9b8cf2", "#f7b35d"],
  engine: ["#d98a48", "#aeb8c7", "#8fe4d8", "#f6d16d"],
  treads: ["#485263", "#79879a", "#64bbb2", "#5d4b78"],
};

const PRICES: readonly [{ crystals: number; nuggets: number }, { crystals: number; nuggets: number }, { crystals: number; nuggets: number }, { crystals: number; nuggets: number }] = [
  { crystals: 2, nuggets: 4 },
  { crystals: 5, nuggets: 8 },
  { crystals: 9, nuggets: 14 },
  { crystals: 14, nuggets: 22 },
];

export const INFINIDRILL_UPGRADES: readonly UpgradePart[] = SLOTS.flatMap((slot) =>
  BRANCHES[slot].map((name, index) => ({
    id: `${slot}-${index + 1}`,
    slot,
    tier: (index + 1) as UpgradePart["tier"],
    name,
    description: slot === 'head' ? `Digs ${index + 4} tiles wide${index % 2 === 0 ? ', with one extra tile on either side' : ''}.`
      : slot === 'accessory' ? `Fires diagonal beams ${index < 2 ? 1 : 3} tiles wide and ${[2, 4, 4, 6][index]} rows down, stepping outward beyond the drill's reach.`
      : `Adds ${index + 1} visible tile${index ? 's' : ''} of depth per dig. Stacks with cabin, engine and treads.`,
    prerequisiteId: index === 0 ? null : `${slot}-${index}`,
    crystals: PRICES[index]?.crystals ?? 0,
    nuggets: PRICES[index]?.nuggets ?? 0,
    color: COLORS[slot][index] ?? "#ffffff",
  })),
);

const UPGRADE_BY_ID = new Map(INFINIDRILL_UPGRADES.map((part) => [part.id, part]));

export function getUpgrade(id: string): UpgradePart | undefined {
  return UPGRADE_BY_ID.get(id);
}

export function getUpgradesForSlot(slot: UpgradeSlot): readonly UpgradePart[] {
  return INFINIDRILL_UPGRADES.filter((part) => part.slot === slot);
}

export function isUpgradeOwned(ownedIds: readonly string[], id: string): boolean {
  return ownedIds.includes(id);
}

/** Free rewards may be held in the stash before their branch prerequisite is usable. */
export function isUpgradeUsable(ownedIds: readonly string[], id: string): boolean {
  const part = getUpgrade(id);
  if (!part || !isUpgradeOwned(ownedIds, id)) return false;
  return part.prerequisiteId === null || isUpgradeUsable(ownedIds, part.prerequisiteId);
}

export function getAvailableUpgradeIds(ownedIds: readonly string[]): readonly string[] {
  return INFINIDRILL_UPGRADES.filter((part) => !ownedIds.includes(part.id) && (part.prerequisiteId === null || isUpgradeUsable(ownedIds, part.prerequisiteId))).map((part) => part.id);
}

export function chooseUpgradeIds(
  ownedIds: readonly string[],
  random: RandomSource = Math.random,
): readonly string[] {
  const remaining = INFINIDRILL_UPGRADES.filter((part) => !ownedIds.includes(part.id)).map((part) => part.id);
  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = remaining[index];
    remaining[index] = remaining[swapIndex] as string;
    remaining[swapIndex] = current as string;
  }
  return remaining.slice(0, Math.min(3, remaining.length));
}

export function allUpgradesOwned(ownedIds: readonly string[]): boolean {
  return INFINIDRILL_UPGRADES.every((part) => ownedIds.includes(part.id));
}
