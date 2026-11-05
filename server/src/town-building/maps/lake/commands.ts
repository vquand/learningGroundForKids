import {shopTradeSchema} from '../../shopSchema.ts';
import {harvestAllForMap} from '../../harvestSchema.ts';
import {z} from 'zod';
import type {TownCommand} from '../../game.ts';
import {LAKE_ADJECTIVES} from './name.ts';
import {MAP_IDS} from '../types.ts';
import {LAKE_BLUEPRINT_IDS,LAKE_FISH_IDS,LAKE_PLANT_IDS} from '../../water/catalog.ts';
const id=z.string().min(1).max(100),coordinate=z.number().int().min(0).max(39),mapId=z.enum(MAP_IDS).optional();
export function lakeActionSchema(townSchema:z.ZodType<TownCommand>) {
    return z.union([
        shopTradeSchema,
        harvestAllForMap('lake'),
        z.object({type:z.literal('rename'),adjective:z.enum(LAKE_ADJECTIVES)}).strict(),
        z.object({type:z.literal('build-raft'),blueprintId:z.enum(LAKE_BLUEPRINT_IDS),x:coordinate,y:coordinate,mapId}).strict(),
        z.object({type:z.literal('move-raft'),raftId:id,x:coordinate,y:coordinate,mapId}).strict(),
        z.object({type:z.literal('remove-raft'),raftId:id,mapId}).strict(),
        z.object({type:z.literal('stock'),raftId:id,species:z.enum(LAKE_FISH_IDS),mapId}).strict(),
        z.object({type:z.literal('set-next-fish'),raftId:id,species:z.enum(LAKE_FISH_IDS),mapId}).strict(),
        z.object({type:z.literal('transfer-fish'),raftId:id,species:z.enum(LAKE_FISH_IDS),mapId}).strict(),
        z.object({type:z.literal('reserve-fish'),raftId:id,mapId}).strict(),
        z.object({type:z.literal('harvest-fish'),raftId:id,generation:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),mapId}).strict(),
        z.object({type:z.literal('harvest-plant'),raftId:id,generation:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),mapId}).strict(),
        z.object({type:z.literal('plant'),raftId:id,plant:z.enum(LAKE_PLANT_IDS),mapId}).strict(),
        z.object({type:z.literal('land-action'),command:townSchema,mapId}).strict(),
        z.object({type:z.literal('transfer-building'),entityId:id,sourceMap:z.enum(MAP_IDS),destinationMap:z.enum(MAP_IDS),x:coordinate,y:coordinate}).strict(),
    ]);
}
