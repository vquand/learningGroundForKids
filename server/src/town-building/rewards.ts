import type { InfinidrillGameState, Excavation } from '../infinidrill/types.ts';
import type { Cost, Material } from './game.js';

/** Additional sand from verified rock earnings; the 0–9 remainder survives digs. */
export function bonusSandFromRock(rocks: number, remainder = 0): { sand: number; remainder: number } {
    const total = rocks + remainder;
    if (!Number.isSafeInteger(rocks) || rocks < 0 || !Number.isSafeInteger(remainder)
        || remainder < 0 || remainder >= 10 || !Number.isSafeInteger(total)) {
        throw new Error('Invalid rock bonus progress');
    }
    return { sand: Math.floor(total / 10), remainder: total % 10 };
}

export function miningMaterialAt(seed: number, row: number, column: number): 'sand' | 'rock' | 'metal' {
    let hash = Math.imul(seed ^ Math.round(row * 2) ^ Math.imul(column + 13, 19349663), 73856093);
    hash = (hash ^ hash >>> 16) >>> 0;
    return hash % 100 < 6 ? 'metal' : row < 120 ? 'sand' : 'rock';
}
export interface TownDeposit {
    row: number;
    column: number;
    kind: 'sand' | 'rock' | 'metal';
}
export function minedTownMaterials(before: InfinidrillGameState | null, after: InfinidrillGameState | null): {
    reward: Cost;
    deposits: TownDeposit[];
} {
    if (!before || !after || before.worldSeed !== after.worldSeed || after.mainQuestionsCompleted <= before.mainQuestionsCompleted)
        return { reward: {}, deposits: [] };
    // Match the reducer's legacy footprint: its first synthesized cut is old ground.
    const previousExcavations = before.excavations ?? (before.depthBlocks
        ? [{ from: 0, to: before.depthBlocks, left: -1, right: 1 }]
        : []);
    const previous = [...previousExcavations, ...(before.laserCuts ?? [])];
    const cuts: Excavation[] = [...(after.excavations ?? []).slice(previousExcavations.length), ...(after.laserCuts ?? []).slice(before.laserCuts?.length ?? 0)];
    const seen = new Set<string>();
    const reward: Cost = {};
    const deposits: TownDeposit[] = [];
    for (const cut of cuts)
        for (let row = cut.from; row < cut.to; row += .5)
            for (let col = cut.left; col <= cut.right; col++) {
                const key = `${row}:${col}`;
                if (seen.has(key) || previous.some(c => row >= c.from && row < c.to && col >= c.left && col <= c.right))
                    continue;
                seen.add(key);
                const ground: Material = row < 120 ? 'sand' : 'rock';
                reward[ground] = (reward[ground] ?? 0) + 1;
                const kind = miningMaterialAt(after.worldSeed ?? 0, row, col);
                if (kind === 'metal')
                    reward.metal = (reward.metal ?? 0) + 1;
                deposits.push({ row, column: col, kind });
            }
    return { reward, deposits };
}
export const wordReward = (difficulty: 'easy' | 'medium' | 'hard'): Cost => {
    const multiplier = { easy: 1, medium: 3, hard: 7 }[difficulty];
    return { wood: 2 * multiplier, wool: multiplier };
};
export const wallReward = (difficulty: 'easy' | 'medium' | 'hard'): Cost => {
    const amount = { easy: 1, medium: 3, hard: 5 }[difficulty];
    return { wood: amount, wool: amount };
};
