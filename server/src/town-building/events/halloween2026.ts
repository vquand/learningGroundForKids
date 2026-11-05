import { BLUEPRINTS, entityFootprint, isBridge, isPassable, type Entity } from '../game.ts';
import { LAKE_BLUEPRINTS } from '../water/catalog.ts';
import type { LakeRaft } from '../water/types.ts';
import { terrainKind } from '../areaOfEffect.ts';
import type { MapDefinition } from '../maps/types.ts';
import { halloweenWorkAllowed, isHalloweenNight, isHalloweenPumpkinSeason } from '../halloweenCalendar.ts';
import { stableNoise } from '../ghostMotion.ts';
import { defineTimedEvent, type EventContext } from './runtime.ts';
import { HALLOWEEN_COUNTER, HALLOWEEN_ACHIEVEMENTS } from './halloweenAchievements.ts';
import { GHOST_ORIGINS, GHOST_WORKERS, MAX_HALLOWEEN_LANTERNS, HALLOWEEN_EDITION, HALLOWEEN_EVENT_ID, ghostDestination, ghostJobPosition, ghostJobTiming, ghostIdleSeconds, travelSeconds, type HalloweenState, type GhostJob, type LanternSite } from './halloween2026Model.ts';
const siteKey=(site:LanternSite)=>`${site.x}:${site.y}`;

/** Hooks decorate clear ground beside player buildings, trees or roads, and
 * bridge decks clear of an insect nest. They never reserve construction tiles
 * or change the placement/navigation mask. */
export function lanternSites(entities: readonly Readonly<Entity>[], map: MapDefinition, rafts: readonly Readonly<Pick<LakeRaft,'x'|'y'|'blueprintId'>>[] = []): (LanternSite & { priority: number })[] {
  const terrainAt=(x:number,y:number)=>map.terrainAt(x,y),rows=map.rows,columns=map.columns;
  const occupied = new Set<string>(), candidates = new Map<string, LanternSite & { priority: number }>();
  for (const entity of entities) {
    const blueprint = BLUEPRINTS.find(b => b.id === entity.blueprintId);
    if (!blueprint) continue;
    const f = entityFootprint(entity);
    for (let x = f.x; x < f.x + f.width; x++) for (let y = f.y; y < f.y + f.length; y++) occupied.add(`${x}:${y}`);
  }
  const roads=new Set(entities.filter(e=>BLUEPRINTS.find(b=>b.id===e.blueprintId)?.kind==='road').map(siteKey));
  for (const entity of [...entities].sort((a, b) => a.id.localeCompare(b.id))) {
    const blueprint = BLUEPRINTS.find(b => b.id === entity.blueprintId);
    if (!blueprint || !['building', 'tree', 'road'].includes(blueprint.kind)) continue;
    const roadNeighbors=blueprint.kind==='road'?[[entity.x-1,entity.y],[entity.x+1,entity.y],[entity.x,entity.y-1],[entity.x,entity.y+1]].filter(([x,y])=>roads.has(`${x}:${y}`)).length:0;
    const f = entityFootprint(entity), direction = entity.direction ?? 'front';
    const doorSide = (x: number, y: number) => direction === 'left' ? y === f.y - 1 : direction === 'right' ? y === f.y + f.length : direction === 'back' ? x === f.x - 1 : x === f.x + f.width;
    for (let x = f.x - 1; x <= f.x + f.width; x++) for (let y = f.y - 1; y <= f.y + f.length; y++) {
      if (x < 0 || y < 0 || x >= rows || y >= columns || terrainAt(x, y) !== 'grass' || occupied.has(`${x}:${y}`)) continue;
      const priority=blueprint.kind==='building'&&doorSide(x,y)?0:roadNeighbors>=3?1:blueprint.kind==='tree'?2:4;
      const key=`${x}:${y}`;
      if(!candidates.has(key)||candidates.get(key)!.priority>priority)candidates.set(key,{x,y,priority});
    }
  }
  // Shorelines are permanent landmarks, even without buildings nearby.
  // Waterside decorations belong to a settled map with a building.
  if(entities.some(e=>BLUEPRINTS.find(b=>b.id===e.blueprintId)?.kind==='building'))for(let x=0;x<rows;x++)for(let y=0;y<columns;y++) {
    const key=`${x}:${y}`;
    if(terrainAt(x,y)==='grass'&&!occupied.has(key)&&[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b])=>a!>=0&&a!<rows&&b!>=0&&b!<columns&&terrainKind(terrainAt(a!,b!))==='water'))
      if(!candidates.has(key)||candidates.get(key)!.priority>3)candidates.set(key,{x,y,priority:3});
  }
  // Bridges are light platforms over the water: a lantern post may stand on any free deck.
  const nests=new Set<string>();
  for(const raft of rafts){const b=LAKE_BLUEPRINTS.find(b=>b.id===raft.blueprintId);if(b)for(let x=raft.x;x<raft.x+b.width;x++)for(let y=raft.y;y<raft.y+b.length;y++)nests.add(`${x}:${y}`);}
  const blockedDecks=new Set([...nests,...entities.filter(e=>!isPassable(e)).map(siteKey)]);
  for(const deck of entities)if(isBridge(deck)&&!blockedDecks.has(siteKey(deck)))candidates.set(siteKey(deck),{x:deck.x,y:deck.y,priority:1});
  return [...candidates.values()];
}

/** Stable random variation survives retries; spacing outweighs placing a row
 * of adjacent posts, while landmark priority wins among equally spread sites. */
export function chooseLanternSite(sites: ReturnType<typeof lanternSites>, occupied: readonly LanternSite[], seed: string): LanternSite | undefined {
  let best:LanternSite|undefined,score=-Infinity;
  for(const site of sites) {
    const distance=occupied.length?Math.min(...occupied.map(other=>Math.hypot(other.x-site.x,other.y-site.y))):8;
    if(distance<3)continue;
    const value=Math.min(8,distance)*1.5+(4-site.priority)*1.5+stableNoise(`${seed}:${siteKey(site)}`)*3;
    if(value>score){score=value;best={x:site.x,y:site.y};}
  }
  return best;
}

/** Halloween pumpkin behavior is edition-local; shared ghost math has no crop rules. */
function tickPumpkins(holiday:HalloweenState,context:EventContext):void {
  recordLanterns(holiday,context);
  const {weather,elapsed,ripeGrowth}=context;
  if (!halloweenWorkAllowed(weather)) { holiday.working=false; return; }
  holiday.activeSeconds += holiday.working ? elapsed : 0;
  holiday.working = true;
  const sites = lanternSites(context.entities,context.map,context.rafts), allowed = new Set(sites.map(siteKey));
  const used = new Set(holiday.lanterns.map(siteKey));
  const seed=`${holiday.year}:${context.entities.map(e=>e.id).join(':')}`;
  if(!holiday.workers){holiday.workers=GHOST_ORIGINS.map((position,worker)=>({worker,position:{...position},readyAt:0}));context.changed();}
  const rest=(job:GhostJob,delivered=false)=>{
    const worker=holiday.workers!.find(w=>w.worker===job.worker)!;
    worker.position=delivered?ghostDestination(job.to):ghostJobPosition(job,holiday.activeSeconds);
    worker.readyAt=holiday.activeSeconds+ghostIdleSeconds(seed,job.worker,job.id);
    holiday.jobs=holiday.jobs.filter(other=>other.id!==job.id);context.changed();
  };
  const freeSite = () => chooseLanternSite(sites, [...holiday.lanterns,...holiday.jobs.map(job=>job.to)],`${seed}:${holiday.nextId}`);
  for (const job of [...holiday.jobs]) {
    const age = holiday.activeSeconds - job.startedAt,timing=ghostJobTiming(job);
    const patch = context.entities.find(entity => entity.id === job.entityId);
    const slot = patch?.garden?.slots[job.slot];
    if (!job.harvested && (!slot || slot.withered || slot.crop !== 'pumpkin' || slot.generation !== job.generation || slot.growth < ripeGrowth)) {
      rest(job); continue;
    }
    if (!allowed.has(siteKey(job.to)) || used.has(siteKey(job.to))) {
      const replacement = freeSite();
      if (!replacement) {
        if (!job.harvested) rest(job);
        continue;
      }
      if(job.harvested){job.from=ghostJobPosition(job,holiday.activeSeconds);job.startedAt=holiday.activeSeconds-timing.pickupAt;}
      job.to = { ...replacement };job.carrySeconds=travelSeconds(job.from,ghostDestination(job.to));context.changed();
      continue; // Start the rerouted flight before considering installation.
    }
    if (!job.harvested && age >= timing.pickupAt) {
      if (!context.harvest({entityId:job.entityId,slot:job.slot,generation:job.generation})) continue;
      job.harvested = true;
      // Ghost harvests deliberately do not increment manual-harvest badges.
    }
    if (job.harvested && age >= timing.finishedAt) {
      holiday.lanterns.push({ ...job.to, id: job.id, variant: job.id % 6, post: job.id % 3 });
      context.recordCompletion(HALLOWEEN_COUNTER,lanternReceipt(context.map,job.id));
      used.add(siteKey(job.to));
      rest(job,true);
    }
  }
  for (let worker = 0; worker < GHOST_WORKERS; worker++) {
    if(holiday.lanterns.length+holiday.jobs.length>=MAX_HALLOWEEN_LANTERNS)break;
    if (holiday.jobs.some(job => job.worker === worker)) continue;
    const helper=holiday.workers.find(w=>w.worker===worker)!;
    if(helper.readyAt>holiday.activeSeconds)continue;
    let source: { entity: Entity; slot: number } | undefined;
    for (const entity of context.entities) {
      if(holiday.jobs.some(job=>job.entityId===entity.id&&!job.harvested))continue;
      const slot = entity.garden?.slots.findIndex((slot, index) => !slot.withered && slot.crop === 'pumpkin' && slot.growth >= ripeGrowth
        && !holiday.jobs.some(job => job.entityId === entity.id && job.slot === index));
      if (slot !== undefined && slot >= 0) { source = { entity, slot }; break; }
    }
    if (!source){helper.readyAt=holiday.activeSeconds+ghostIdleSeconds(seed,worker,holiday.nextId);continue;}
    const destination = freeSite();
    if (!destination) break; // Leave ripe crops untouched when no well-spaced site remains.
    const { entity, slot } = source;
    const from={x:entity.x+Math.floor(slot/2)+.5,y:entity.y+slot%2+.5},origin={...helper.position};
    holiday.jobs.push({ id: holiday.nextId++, worker, entityId: entity.id, slot,
      generation: entity.garden!.slots[slot]!.generation, from,origin,approachSeconds:travelSeconds(origin,from),carrySeconds:travelSeconds(from,ghostDestination(destination)),
      to: { ...destination }, startedAt: holiday.activeSeconds, harvested: false });
    context.changed();
  }
}

/** Receipts stay unique across maps (Town keeps its original receipt ids). */
const lanternReceipt=(map:MapDefinition,id:number)=>map.id==='town'?String(id):`${map.id}:${id}`;
function recordLanterns(holiday:HalloweenState,context:EventContext) {
  // Adopt already installed, server-saved lanterns from the earlier local state.
  // Receipts deduplicate backfill, retries, checkpoints and final cleanup.
  for(const lantern of holiday.lanterns)context.recordCompletion(HALLOWEEN_COUNTER,lanternReceipt(context.map,lantern.id));
}
export const halloweenPumpkins = defineTimedEvent<HalloweenState>({
  id:HALLOWEEN_EVENT_ID,
  occurrence:weather=>isHalloweenNight(weather.localDate)?weather.localDate!.slice(0,4):undefined,
  // Keep this fallback until a reviewed later edition is explicitly registered.
  editionFor:()=>HALLOWEEN_EDITION,
  allowsCrop:(crop,date)=>crop==='pumpkin'&&isHalloweenPumpkinSeason(date),
  editions:[{version:HALLOWEEN_EDITION,harvest:{crop:'pumpkin',stamina:2},
    counters:[{id:HALLOWEEN_COUNTER,achievements:HALLOWEEN_ACHIEVEMENTS.map(({id,target})=>({id,target}))}],
    create:year=>({year,edition:HALLOWEEN_EDITION,activeSeconds:0,nextId:0,lanterns:[],jobs:[]}),tick:tickPumpkins,finish:recordLanterns}],
});
