import {quoteShop,applyShopTrade,type ShopOutcome} from './shop.ts';
import type {ShopQuoteInput,ShopQuote,ShopTradeCommand} from './shopTypes.ts';
import { recordAdventure } from '../adventures/events.js';
import { townAdventures } from '../adventures/town-events.js';
import {stockRaftHarvest} from './raftStock.js';
import { ensureTownGardens, type GardenEnvironment } from './garden.js';
import { applyMapLandCommand } from './maps/land.ts';
import type { MapId } from './maps/types.ts';
import { simulateGarden, type GardenSimulation } from './gardenSimulation.js';
import { GardenSessions, withoutAnimalPositions } from './gardenSessions.js';
import { ensureCivTown, type CivClock } from './civ.js';
import { randomUUID } from 'node:crypto';
import {interactWomensDay} from './events/index.js';
import type {WomensDayCommand} from './events/womensDay2026Model.js';
import type { Pool, PoolClient } from 'pg';
import { AppError } from '../errors.js';
import { initialTown, ensureStarterHome, MATERIALS, type Cost, type TownCommand, type TownState, type TownName, DEFAULT_TOWN_NAME } from './game.js';
import {ensureLakeUnlock} from './maps/lake/game.ts';
import {createLakeService,lakeCatches,withLakeCatches} from './maps/lake/repository.ts';
import {applyHarvestAll,type HarvestAllOutcome} from './harvestAll.ts';
import type {HarvestAllCommand} from './harvestTypes.ts';
import type {LandClock} from './maps/land.ts';
import {ensurePoultry} from './poultry.ts';
import {farmProjection,settleFarm} from './barn.ts';
import {creditMaterials,settleStorage} from './storage.ts';
import {createLakeVisitService} from './maps/lake/visits.ts';
import {expireMapEventBuildings} from './maps/view.ts';
export interface TownRepository {
    shopQuote?(profileId:string,mapId:MapId,input:ShopQuoteInput,clock:LandClock):Promise<ShopQuote>;
    shopTrade?(profileId:string,mapId:MapId,revision:number,command:ShopTradeCommand,clock:LandClock):Promise<ShopOutcome>;
    lakeFriends?:ReturnType<typeof createLakeVisitService>['lakeFriends'];
    readLakeVisit?:ReturnType<typeof createLakeVisitService>['readLakeVisit'];
    getLake?:ReturnType<typeof createLakeService>['getLake'];
    mutateLake?:ReturnType<typeof createLakeService>['mutateLake'];
    tickLake?:ReturnType<typeof createLakeService>['tickLake'];
    pauseLake?:ReturnType<typeof createLakeService>['pauseLake'];
    get(profileId: string, clock?:CivClock): Promise<TownState>;
    getName(profileId: string): Promise<TownName>;
    mutate(profileId: string, revision: number, command: TownCommand, season?: import('./game.js').Season|null, clock?:CivClock): Promise<TownState>;
    tick?(profileId:string, mapId:MapId, environment:GardenEnvironment, resume:boolean):Promise<TownState>;
    checkpoint?(profileId:string,clock?:CivClock):Promise<TownState>;
    celebrate?(profileId:string,command:WomensDayCommand,clock:CivClock):Promise<TownState>;
    /** One revision-checked, all-or-nothing batch per map and category (see harvestAll.ts). */
    harvestAll?(profileId:string,revision:number,command:HarvestAllCommand,clock:LandClock):Promise<HarvestAllOutcome>;
}
/** Order-insensitive JSON: jsonb returns object keys in its own order, so plain JSON.stringify would see a reordered save as a change. */
export function canonicalJson(value:unknown):string{return JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,(v as Record<string,unknown>)[k]])):v);}
export async function lockTown(client: PoolClient, profileId: string): Promise<TownState> {
    await client.query('INSERT INTO town_state(profile_id,state) VALUES ($1,$2) ON CONFLICT DO NOTHING', [profileId, JSON.stringify(initialTown())]);
    const row = await client.query<{
        state: TownState;
    }>('SELECT state FROM town_state WHERE profile_id=$1 FOR UPDATE', [profileId]);
    return row.rows[0]!.state;
}
export async function saveTown(client: PoolClient, profileId: string, state: TownState) { await client.query('UPDATE town_state SET state=$2,updated_at=now() WHERE profile_id=$1', [profileId, JSON.stringify(withoutAnimalPositions(state,true))]); }
/** Called inside the verified source game's existing transaction, after its game row lock. */
export async function creditTown(client: PoolClient, profileId: string, eventId: string, reward: Cost): Promise<void> {
    if (!Object.values(reward).some(n => n > 0))
        return;
    const state = settleStorage(await lockTown(client, profileId),Date.now());
    if(!Number.isSafeInteger(reward.wool??0)||(reward.wool??0)<0)throw new Error('Invalid resource credit');
    const result = await client.query('INSERT INTO town_reward_events(profile_id,event_id,reward) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING event_id', [profileId, eventId, JSON.stringify(reward)]);
    if (!result.rowCount)
        return;
    for (const key of MATERIALS) {
        const value = reward[key] ?? 0;
        if (!Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(state.materials[key] + value))
            throw new Error('Invalid resource credit');
    }
    // Building materials beyond the storage limit are not kept; the reward event is still recorded once.
    creditMaterials(state, reward);
    state.revision++;
    await saveTown(client, profileId, state);
}
export function createTownRepository(pool: Pool, now = Date.now, simulate: GardenSimulation = simulateGarden): TownRepository {
    const gardens = new GardenSessions(now);
    const pending = new Map<string, Promise<unknown>>();
    const ticks = new Map<string, Promise<TownState>>();
    // Serialize a profile's leases and commands within this API process. The
    // database row lock still handles durable writes from other processes.
    async function serial<T>(profileId: string, action: () => Promise<T>): Promise<T> {
        const previous = pending.get(profileId) ?? Promise.resolve();
        const next = previous.catch(()=>{}).then(action);
        pending.set(profileId,next);
        try { return await next; }
        finally { if(pending.get(profileId)===next)pending.delete(profileId); }
    }
    async function transaction(profileId: string, action: (state: TownState) => TownState, checkpoint = false): Promise<TownState> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const stored = await lockTown(client, profileId);
            const before = structuredClone(stored);
            const originalRevision = stored.revision;
            const state = settleFarm(ensurePoultry(ensureLakeUnlock(ensureCivTown(ensureTownGardens(ensureStarterHome(stored))),now()),now()),now());
            await client.query('INSERT INTO town_learned_items(profile_id,item_id) SELECT profile_id,item_id FROM profile_progress WHERE profile_id=$1 ON CONFLICT DO NOTHING', [profileId]);
            const learned = await client.query<{
                item_id: string;
            }>('SELECT item_id FROM town_learned_items WHERE profile_id=$1 ORDER BY item_id', [profileId]);
            const ids = learned.rows.map(r => r.item_id);
            if (JSON.stringify(ids) !== JSON.stringify(state.learnedIds)) {
                state.learnedIds = ids;
                state.revision++;
            }
            // Saving the one-time wool normalization is not a gameplay change: persist it without bumping the revision,
            // so a client holding the previous revision is never made stale by a silent data migration.
            const woolNormalized=!before.woolMigrated||Object.hasOwn(before.materials,'wool');
            const active = gardens.read(profileId,state);
            const next = settleFarm(ensurePoultry(ensureLakeUnlock(action(active ?? state),now()),now()),now());
            await stockRaftHarvest(client,profileId,active??state,next,now());
            const progressChanged=checkpoint&&canonicalJson(withoutAnimalPositions(next,true))!==canonicalJson(withoutAnimalPositions(stored,true));
            if (next.revision !== originalRevision||progressChanged||woolNormalized) {
                for(const event of townAdventures(before,next))await recordAdventure(client,profileId,event);
                await saveTown(client, profileId, next);
            }
            await client.query('COMMIT');
            if(active)gardens.put(profileId,next);
            return next;
        }
        catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
        finally {
            client.release();
        }
    }
    async function getStored(profileId: string,clock:CivClock={}): Promise<TownState> {
            // One MVCC snapshot checks both persisted milestones and legacy Done items.
            // Unchanged display reads never acquire the exclusive resource/spending lock.
            const result = await pool.query<{ state: TownState; learned_ids: string[] }>(`
                SELECT state, ARRAY(
                    SELECT item_id FROM town_learned_items WHERE profile_id=$1
                    UNION SELECT item_id FROM profile_progress WHERE profile_id=$1
                    ORDER BY item_id
                ) AS learned_ids FROM town_state WHERE profile_id=$1`, [profileId]);
            const row = result.rows[0];
            if (row && row.state.woolMigrated && !Object.hasOwn(row.state.materials,'wool') && expireMapEventBuildings(row.state,clock)===row.state && ensureStarterHome(row.state)===row.state && ensureTownGardens(row.state)===row.state && ensureCivTown(row.state)===row.state && ensureLakeUnlock(row.state,now())===row.state && ensurePoultry(row.state,now())===row.state && JSON.stringify(row.state.learnedIds) === JSON.stringify(row.learned_ids)) return farmProjection(row.state,now());
            // Initialization and newly learned milestones are rechecked under lock.
            return transaction(profileId, state => expireMapEventBuildings(state,clock));
    }
    /** The stale check needs only the revision, not another full read with learned items. */
    async function storedRevision(profileId: string): Promise<number> {
        const result = await pool.query<{ revision: number }>("SELECT (state->>'revision')::int AS revision FROM town_state WHERE profile_id=$1", [profileId]);
        return result.rows[0]?.revision ?? 0;
    }
    /** One heartbeat for any map: the shared lease, worker simulation and stale checks. */
    function tick(profileId:string,mapId:MapId,environment:GardenEnvironment,resume:boolean):Promise<TownState> {
        // Multiple tabs/retries share the in-flight heartbeat, rather than
        // queueing more CPU work or crediting the same time more than once.
        const key=`${profileId}:${mapId}`,existing=ticks.get(key);
        if(existing)return existing;
        const result=serial(profileId,async()=>{
            const stored=await getStored(profileId,environment);
            const active=gardens.read(profileId,stored);
            const next=await simulate(active??stored,mapId,now(),environment,resume||!active);
            // Another process/source game can commit while the worker runs.
            // Never publish or retain simulation of an obsolete revision.
            const latest=await storedRevision(profileId);
            if(latest!==stored.revision)throw new AppError(409,'TOWN_STALE','Your town changed. Sync and try again.');
            // A verified move-in/award crosses the durable revision boundary.
            // Persist it under the row lock; continuous animation time stays in the lease.
            const result=next.revision===stored.revision?next:await transaction(profileId,current=>{
                if(current.revision!==stored.revision)throw new AppError(409,'TOWN_STALE','Your town changed. Sync and try again.');
                return next;
            });
            gardens.put(profileId,result);
            return withLakeCatches(pool,profileId,withoutAnimalPositions(result));
        }).finally(()=>{if(ticks.get(key)===result)ticks.delete(key);});
        ticks.set(key,result);
        return result;
    }
    // Pausing checkpoints verified progress on every map, without making an
    // in-flight construction command stale or writing any animal positions.
    const checkpoint=(profileId:string,clock:CivClock={})=>serial(profileId,async()=>withLakeCatches(pool,profileId,withoutAnimalPositions(await transaction(profileId,state=>expireMapEventBuildings(state,clock),true))));
    /** Shared by Town and Lake: the verified catches are read first (Town nursery rafts check unlocks too). */
    const harvestAll=(profileId:string,revision:number,command:HarvestAllCommand,clock:LandClock)=>serial(profileId,async():Promise<HarvestAllOutcome>=>{
        const catches=await lakeCatches(pool,profileId);
        const holder:{outcome?:HarvestAllOutcome}={};
        let state:TownState;
        try {
            state=await transaction(profileId,current=>{
                holder.outcome=applyHarvestAll(current,revision,command,now(),clock,catches);
                return holder.outcome.state;
            });
        } catch(error) {
            // Domain refusals (stale, empty, storage rules) reject with no write; database failures stay sanitized 500s.
            if(error instanceof AppError||(error instanceof Error&&'code' in error))throw error;
            throw new AppError(409,'TOWN_HARVEST',error instanceof Error?error.message:'Could not harvest.');
        }
        if(!holder.outcome)throw new Error('The harvest did not run.');
        return {state:await withLakeCatches(pool,profileId,withoutAnimalPositions(state)),receipt:holder.outcome.receipt};
    });
    return {
        // Quote uses only a snapshot SELECT: no initialization, normalization writes or lease changes.
        shopQuote:async(profileId,mapId,input,clock)=>{
            const result=await pool.query<{state:TownState}>('SELECT state FROM town_state WHERE profile_id=$1',[profileId]);
            return quoteShop(result.rows[0]?.state??initialTown(),profileId,mapId,input,now(),clock);
        },
        shopTrade:(profileId,mapId,revision,command,clock)=>serial(profileId,async()=>{
            const client=await pool.connect();
            let outcome:ShopOutcome;
            try {
                await client.query('BEGIN');
                const stored=await lockTown(client,profileId);
                // Keep verified active garden progress while committing the new durable revision.
                outcome=applyShopTrade(gardens.read(profileId,stored)??stored,profileId,mapId,revision,command,now(),clock);
                if(!outcome.receipt.duplicate)await saveTown(client,profileId,outcome.state);
                await client.query('COMMIT');
            } catch(error){await client.query('ROLLBACK');throw error;}
            finally {client.release();}
            return {state:await withLakeCatches(pool,profileId,withoutAnimalPositions(outcome.state)),receipt:outcome.receipt};
        }),
        harvestAll,
        ...createLakeVisitService(pool,now),
        ...createLakeService({pool,now,serial,getStored,getLive:async (profileId,clock)=>{const stored=await getStored(profileId,clock);return gardens.read(profileId,stored)??stored;},transaction,tick,checkpoint}),
        celebrate:(profileId,command,clock)=>serial(profileId,()=>transaction(profileId,state=>{
            try {const next=expireMapEventBuildings(state,clock);interactWomensDay(next,clock,command,now());return next;}
            catch(error){throw new AppError(409,'TOWN_EVENT_UNAVAILABLE',error instanceof Error?error.message:'This celebration is not active.');}
        })),
        get: (profileId,clock) => serial(profileId,async()=>{
            const stored=await getStored(profileId,clock);
            return withLakeCatches(pool,profileId,withoutAnimalPositions(gardens.read(profileId,stored)??stored));
        }),
        async getName(profileId) {
            const result = await pool.query<{ town_name: TownName | null }>(
                "SELECT state->'townName' AS town_name FROM town_state WHERE profile_id=$1", [profileId]);
            return result.rows[0]?.town_name ?? { ...DEFAULT_TOWN_NAME };
        },
        tick,checkpoint,
        mutate: (profileId, revision, command, season=null,clock={}) => serial(profileId,async()=>withLakeCatches(pool,profileId,withoutAnimalPositions(await transaction(profileId, state => {
            if (state.revision !== revision)
                throw new AppError(409, 'TOWN_STALE', 'Your town changed. Sync and try again.');
            try {
                return applyMapLandCommand(state,{type:'land-action',command,mapId:'town'},now(),randomUUID(),{...clock,season});
            }
            catch (e) {
                if(e instanceof AppError)throw e;
                throw new AppError(409, 'TOWN_PLACEMENT', e instanceof Error ? e.message : 'Cannot build here.');
            }
        }))))
    };
}
