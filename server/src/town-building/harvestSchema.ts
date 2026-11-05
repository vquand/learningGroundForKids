import {z} from 'zod';
import {HARVEST_CATEGORIES} from './harvestTypes.ts';
import type {MapId} from './maps/types.ts';

/** Strict harvest-all body for one endpoint's own map: Town accepts only `town`, the Lake only `lake`. */
export const harvestAllForMap=(mapId:MapId)=>z.object({
    type:z.literal('harvest-all'),
    category:z.enum(HARVEST_CATEGORIES),
    mapId:z.literal(mapId),
}).strict();
