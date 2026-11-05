import { BLUEPRINTS, MATERIALS, isLineBlueprint, placementError, shortages, type Blueprint, type TownState } from '../../../../server/src/town-building/game.ts';
import type { MapId } from '../../../../server/src/town-building/maps/types.ts';
export type RoadTile = { x: number; y: number };

/** Fill skipped pointer positions with a connected, four-neighbor path. */
export function roadLine(from: RoadTile, to: RoadTile): RoadTile[] {
    const result: RoadTile[] = [];
    let x = from.x, y = from.y;
    const dx = Math.abs(to.x - x), dy = Math.abs(to.y - y);
    let ix = 0, iy = 0;
    while (ix < dx || iy < dy) {
        if (ix < dx && (iy === dy || (ix + .5) / dx <= (iy + .5) / dy)) { x += Math.sign(to.x - from.x); ix++; }
        else { y += Math.sign(to.y - from.y); iy++; }
        result.push({ x, y });
    }
    return result;
}

/** Preview is bounded by the current balance; the server still verifies every build.
 * `view` is the map's landView, so water structures and map terrain apply. */
export function planRoadStroke(view: TownState, mapId: MapId, blueprint: Blueprint, tiles: RoadTile[]): RoadTile[] {
    const state = view;
    if (!isLineBlueprint(blueprint)) return [];
    const balance = { ...state.materials }, seen = new Set<string>(), result: RoadTile[] = [];
    for (const tile of tiles) {
        const key = `${tile.x}:${tile.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const existing = state.entities.find(e => e.x === tile.x && e.y === tile.y && BLUEPRINTS.find(b => b.id === e.blueprintId)?.kind === blueprint.kind);
        if (placementError(state.entities, mapId, blueprint, tile.x, tile.y, existing?.id, state.rafts)) break;
        if (existing?.blueprintId !== blueprint.id) {
            if (Object.keys(shortages(balance, blueprint.cost)).length) break;
            for (const material of MATERIALS) balance[material] -= blueprint.cost[material] ?? 0;
        }
        result.push(tile);
    }
    return result;
}
