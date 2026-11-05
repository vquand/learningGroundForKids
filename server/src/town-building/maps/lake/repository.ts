import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {AppError} from '../../../errors.ts';
import type {TownState} from '../../game.ts';
import type {GardenEnvironment} from '../../garden.ts';
import {withoutAnimalPositions} from '../../gardenSessions.ts';
import {applyMapLandCommand,type LandMapCommand} from '../land.ts';
import type {MapId} from '../types.ts';
import {LAKE_FISH_IDS,type LakeFishId} from '../../water/catalog.ts';
import type {LakeCommand} from './types.ts';
import {applyLakeCommand} from './game.ts';
import {expireMapEventBuildings,requireLake} from '../view.ts';
import type {CivClock} from '../../civ.ts';

export type LakeAction=LakeCommand|LandMapCommand;
/** Verified fishing catches, the only source of fish unlocks. */
export async function lakeCatches(pool:Pool,profileId:string):Promise<Partial<Record<LakeFishId,number>>> {
    const result=await pool.query<{fish_id:string;count:string}>('SELECT fish_id,count(*)::text AS count FROM fishing_cast_results WHERE profile_id=$1 AND fish_id=ANY($2::text[]) GROUP BY fish_id',[profileId,LAKE_FISH_IDS]);
    return Object.fromEntries(result.rows.map(row=>[row.fish_id,Number(row.count)])) as Partial<Record<LakeFishId,number>>;
}
/** A copy that shows the viewer's catches on whichever map's endpoint answers. */
export async function withLakeCatches(pool:Pool,profileId:string,state:TownState):Promise<TownState> {
    if(!state.maps?.lake)return state;
    return {...state,maps:{...state.maps,lake:{...state.maps.lake,catches:await lakeCatches(pool,profileId)}}};
}
/** Lake endpoints. Time, leases and checkpoints are the shared map ones; water
 * and land commands target any map (default: the Lake). */
export function createLakeService(options:{pool:Pool;now:()=>number;
    serial:<T>(id:string,action:()=>Promise<T>)=>Promise<T>;
    getStored:(id:string)=>Promise<TownState>;
    /** The stored state with the live lease merged in, as Town's own read shows it. */
    getLive:(id:string,clock?:CivClock)=>Promise<TownState>;
    transaction:(id:string,action:(state:TownState)=>TownState)=>Promise<TownState>;
    tick:(id:string,mapId:MapId,environment:GardenEnvironment,resume:boolean)=>Promise<TownState>;
    checkpoint:(id:string,clock?:CivClock)=>Promise<TownState>;
}) {
    const catches=(profileId:string)=>lakeCatches(options.pool,profileId);
    const domainError=(error:unknown):never=>{
        if(error instanceof AppError)throw error;
        // Database/transport errors belong to the common sanitized 500 handler.
        if(error instanceof Error&&'code' in error)throw error;
        throw new AppError(409,'LAKE_ACTION',error instanceof Error?error.message:'Could not update the lake.');
    };
    const withCatches=async(profileId:string,state:TownState)=>{const next=structuredClone(state);requireLake(next).catches=await catches(profileId);return next;};
    return {
        getLake:(profileId:string,clock?:CivClock)=>options.serial(profileId,async()=>{
            try {return withoutAnimalPositions(await withCatches(profileId,await options.getLive(profileId,clock)));}
            catch(error){return domainError(error);}
        }),
        mutateLake:(profileId:string,revision:number,command:LakeAction,environment:GardenEnvironment)=>options.serial(profileId,async()=>{
            const verified=await catches(profileId);
            try {
                const result=await options.transaction(profileId,state=>{
                    if(state.revision!==revision)throw new AppError(409,'TOWN_STALE','Your town changed. Sync and try again.');
                    state=expireMapEventBuildings(state,environment);
                    requireLake(state).catches=verified;
                    const now=options.now();
                    return command.type==='land-action'||command.type==='transfer-building'?applyMapLandCommand(state,command,now,randomUUID(),environment):applyLakeCommand(state,command,now,randomUUID(),verified);
                });
                return withoutAnimalPositions(result);
            }catch(error){return domainError(error);}
        }),
        tickLake:async(profileId:string,environment:GardenEnvironment,resume:boolean)=>{
            try {return await withCatches(profileId,await options.tick(profileId,'lake',environment,resume));}
            catch(error){return domainError(error);}
        },
        pauseLake:async(profileId:string,clock?:CivClock)=>{
            try {return await options.checkpoint(profileId,clock);}
            catch(error){return domainError(error);}
        },
    };
}
