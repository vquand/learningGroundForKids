import type { Entity, TownState } from './game.js';
import type { LakeRaft } from './water/types.js';
import type { GardeningState } from './garden.js';
import type { CivState } from './civCatalog.js';
import { halloweenProjection } from './events/halloweenProjection.js';
import { HALLOWEEN_EVENT_ID } from './events/halloween2026Model.js';

/** Live simulation (never ownership/layout/balances) for one map's contents. */
interface LiveMap { droppings?:TownState['droppings'];bushes?:TownState['bushes'];entities: Entity[]; rafts?: LakeRaft[]; gardening?: GardeningState; civ?: CivState;
    events?: TownState['events']; halloween?: TownState['halloween'] }
const liveEntities = (stored: Entity[], live: Entity[]) => stored.map(entity => {
    const current = live.find(e => e.id === entity.id);
    return {...entity,...(entity.garden&&current?.garden?{garden:current.garden}:{}),...(entity.civ&&current?.civ?{civ:current.civ}:{})};
});
const liveRafts = (stored: LakeRaft[] = [], live: LakeRaft[] = []) => stored.map(raft => {
    const current = live.find(r => r.id === raft.id && r.generation === raft.generation && r.blueprintId === raft.blueprintId);
    if (!current) return raft;
    const {plantGrowth,plantCycle,plantInsectChecked,witheredPlants,duckBoosted}=current;
    return {...raft,plantGrowth,...(plantCycle!==undefined?{plantCycle}:{}),...(plantInsectChecked!==undefined?{plantInsectChecked}:{}),
        ...(witheredPlants?{witheredPlants}:{}),...(duckBoosted!==undefined?{duckBoosted}:{}),
        fish: raft.fish.map(fish => { const grown = current.fish.find(f => f.id === fish.id); return grown ? {...fish, growth: grown.growth, ...(grown.duckBoosted!==undefined?{duckBoosted:grown.duckBoosted}:{})} : fish; })};
});
function liveMap<T extends LiveMap>(stored: T, live: LiveMap): T {
    return {...stored,...(live.droppings?{droppings:live.droppings}:{}),...(live.bushes?{bushes:live.bushes}:{}), entities: liveEntities(stored.entities, live.entities),
        ...(stored.rafts||live.rafts ? {rafts: liveRafts(stored.rafts, live.rafts)} : {}),
        ...(live.gardening ? {gardening: live.gardening} : {}), ...(live.civ ? {civ: live.civ} : {}),
        ...(live.events ? {events: live.events} : {}), ...(live.halloween ? {halloween: live.halloween} : {})};
}

/** Active play is an expiring, server-owned lease, not a database tick.
 * A changed durable revision invalidates the lease; it cannot replay a harvest
 * after another API process/tab has committed one. Losing a lease loses only
 * unsaved growth, never persisted balances, crops or earned badges. Every map
 * shares the same lease rules.
 */
export class GardenSessions {
    private sessions = new Map<string, { state: TownState; touched: number }>();
    constructor(private now = Date.now, private capacity = 256) {}
    read(profileId: string, stored: TownState): TownState | undefined {
        const entry = this.sessions.get(profileId);
        if (!entry) return;
        if (entry.state.revision !== stored.revision || this.now() - entry.touched > 120000) {
            this.sessions.delete(profileId);
            return;
        }
        // Stored data remains the authority for balances/ownership/layout.
        const live = entry.state, next = liveMap(stored, live);
        const lake = stored.maps?.lake, liveLake = live.maps?.lake;
        if (lake && liveLake) {
            const {rafts, ...land} = liveMap({...lake.land, rafts: lake.rafts}, {...liveLake.land, rafts: liveLake.rafts});
            next.maps = {...stored.maps, lake: {...lake, boostedSeconds: liveLake.boostedSeconds, rafts: rafts ?? lake.rafts, land}};
        }
        return next;
    }
    put(profileId: string, state: TownState): void {
        const now = this.now();
        for (const [id, entry] of this.sessions) if (now - entry.touched > 120000) this.sessions.delete(id);
        this.sessions.delete(profileId);
        if (this.sessions.size >= this.capacity) this.sessions.delete(this.sessions.keys().next().value!);
        this.sessions.set(profileId, { state, touched: now });
    }
}

/** One map's clock, shops and event projection, ready to send or persist. */
function presentMap<T extends {gardening?: GardeningState; civ?: CivState; events?: TownState['events']; halloween?: TownState['halloween']}>(map: T, durable: boolean): T {
    const next = {...map};
    if (next.gardening) next.gardening = {...next.gardening, animals: [], ...(durable ? {lastTick: 0} : {})};
    if (next.civ && durable) next.civ = {...next.civ, lastTick: 0};
    if (next.events?.[HALLOWEEN_EVENT_ID]) {
        delete next.halloween;
        const projected = halloweenProjection(next as unknown as TownState);
        if (!durable && projected) next.halloween = projected;
    }
    return next;
}
/** Never send or persist decorative positions. Durable time cannot become
 * catch-up time when a process restarts and initializes a fresh active lease.
 */
export function withoutAnimalPositions(state: TownState, durable = false): TownState {
    const next = presentMap(state, durable), lake = next.maps?.lake;
    if (lake) next.maps = {...next.maps, lake: {...lake, land: presentMap(lake.land, durable)}};
    return next;
}
