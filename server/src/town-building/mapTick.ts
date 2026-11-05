import {applyAnimalHabits,settleBushes} from './animalHabits.ts';
import {expireEventBuildings,type TownState} from './game.ts';
import {GROW_SECONDS,advanceCropGrowth,applyGardenContacts,ensureTownGardens,freshPatch,restoreAnimals,snapshotAnimals,type GardenEnvironment} from './garden.ts';
import {stepAnimalResidents} from './animalWorld.ts';
import {awardCiv,tickCiv} from './civ.ts';
import {tickTownEvents} from './events/index.ts';
import {gardenAreaEffects,gardenInsectSources} from './gardenEffects.ts';
import {mapDefinition} from './maps/registry.ts';
import {landView,mapClock,mergeLand} from './maps/view.ts';
import type {MapId} from './maps/types.ts';
import {awardLake} from './maps/lake/achievements.ts';
import {LAKE_GROW_SECONDS} from './water/catalog.ts';
import {feedingSources,fishGrowthMultiplier} from './water/behavior.ts';
import {advanceRaftPlants} from './water/plantEffects.ts';
import {applyDuckHelp} from './water/rules.ts';

/** Leases never catch up time away: a gap longer than this starts a fresh lease. */
export const LEASE_GAP_MS=15000;
const STEP_SECONDS=.05;
export const leaseElapsed=(lastTick:number,now:number,resume:boolean)=>!resume&&lastTick>0&&now>=lastTick&&now-lastTick<=LEASE_GAP_MS?(now-lastTick)/1000:0;
/** Fixed steps accumulate float error; keep growth on a fine grid so ripe means ripe. */
const snap=(value:number)=>Math.round(value*1e6)/1e6;

/** The one simulation for every map: crops (area and contact effects), animals,
 * fish and water plants, shop move-ins and events, in exact fixed steps on the
 * map's own clock. Durable changes (awards, move-ins) bump the revision. */
export function tickMap(previous:TownState,mapId:MapId,now:number,weather:GardenEnvironment,resume=false):TownState {
    const state=structuredClone(ensureTownGardens(previous)),map=mapDefinition(mapId);
    // Without a home clock (no home city) every map rests, as Town always has.
    const clock=mapClock(state,mapId),elapsed=weather.timeOfDay?leaseElapsed(clock.lastTick,now,resume):0;
    clock.lastTick=now;clock.season=weather.timeOfDay?weather.season:null;
    const view=landView(state,mapId),rafts=view.rafts??[];
    if(weather.timeOfDay&&weather.localDate&&weather.weatherSource!=='preview')expireEventBuildings(view,weather.localDate);
    const patches=view.entities.filter(e=>e.blueprintId==='vegetable-patch');
    for(const patch of patches)patch.garden??=freshPatch(clock.season);
    const insects=gardenInsectSources(rafts,mapId),feeding=feedingSources(rafts,mapId);
    const effects=new Map(patches.map(patch=>[patch.id,gardenAreaEffects(patch,view.entities,insects,mapId)]));
    const multipliers=new Map(rafts.map(raft=>[raft.id,fishGrowthMultiplier(raft,feeding)]));
    // Water-duty ducks help the rafts in their area by day.
    if(weather.timeOfDay&&!['evening','night'].includes(weather.timeOfDay))applyDuckHelp({mapId,entities:view.entities,rafts});
    if(weather.timeOfDay&&weather.timeZone)settleBushes(view,map,weather.timeZone,now);
    const animals=restoreAnimals(view.entities,clock.animals,{mapId,rafts});
    let boosted=0;
    for(let remaining=elapsed;remaining>1e-7;) {
        const dt=Math.min(STEP_SECONDS,remaining);remaining-=dt;
        stepAnimalResidents(animals,dt,weather);
        clock.activeSeconds+=dt;
        for(const patch of patches) {
            const effect=effects.get(patch.id)!;
            advanceCropGrowth(patch,dt,clock.season,weather.localDate,effect.chicken,effect.insects);
            applyGardenContacts(patch,animals);
        }
        applyAnimalHabits(view,animals,map,weather,clock.activeSeconds,now-(remaining*1000));
        for(const raft of rafts) {
            advanceRaftPlants(raft,dt,rafts,mapId);
            const multiplier=multipliers.get(raft.id)!;
            for(const fish of raft.fish) {
                const growing=Math.min(dt,Math.max(0,(LAKE_GROW_SECONDS-fish.growth)/multiplier));
                fish.growth=Math.min(LAKE_GROW_SECONDS,fish.growth+growing*multiplier);
                if(multiplier>1)boosted+=growing;
            }
        }
    }
    for(const patch of patches)for(const slot of patch.garden!.slots)slot.growth=snap(slot.growth);
    for(const raft of rafts){raft.plantGrowth=snap(raft.plantGrowth);for(const fish of raft.fish)fish.growth=snap(fish.growth);}
    clock.activeSeconds=snap(clock.activeSeconds);
    clock.animals=snapshotAnimals(animals);
    tickTownEvents(view,map,weather,elapsed,GROW_SECONDS,now);
    // Shop move-ins keep their own lease when there is no home clock, exactly as before maps shared a tick.
    const ticked=mergeLand(state,tickCiv(view,map,now,weather,resume,weather.timeOfDay?elapsed*1000:undefined),mapId);
    const lake=ticked.maps?.lake;
    if(lake){
        lake.boostedSeconds+=boosted;
        const before=JSON.stringify([lake.stage,lake.earned]);awardLake(lake,now);
        if(JSON.stringify([lake.stage,lake.earned])!==before)ticked.revision++;
    }
    awardCiv(ticked,now);
    return ticked;
}
