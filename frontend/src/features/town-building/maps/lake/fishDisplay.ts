import type {LakeFish} from '../../../../../../server/src/town-building/maps/lake/types.ts';

/** A representative school keeps small rafts readable without changing stock. */
export function visibleLakeFish(fish:readonly LakeFish[]):readonly LakeFish[]{
    return fish.length<=6?fish:fish.slice(0,6);
}
