import { BLUEPRINTS, entityDoor, entityFootprint, isPassable, isRoadLike, type Entity, type TownState } from './game.ts';
import { CIV_BUSINESSES, businessFor, freshCivHome, type CivBusiness } from './civCatalog.ts';
import type {MapDefinition} from './maps/types.ts';

export interface CivTile {x:number;y:number}
/** The permanent stone entrance meets the first player-built road here. */
export const CIV_GATE:CivTile={x:7,y:0};
export interface CivClock {localTime?:string|null;timeOfDay?:string|null;localDate?:string;allowPreview?:boolean}
export interface MoveInPlan {drive:CivTile[];walk:CivTile[];parking:CivTile;entrance:CivTile;reachable:boolean;key:string}
const key=(p:CivTile)=>`${p.x}:${p.y}`;
const neighbors=(p:CivTile):CivTile[]=>[{x:p.x-1,y:p.y},{x:p.x,y:p.y-1},{x:p.x,y:p.y+1},{x:p.x+1,y:p.y}];
const inside=(p:CivTile,map:MapDefinition)=>p.x>=0&&p.x<map.rows&&p.y>=0&&p.y<map.columns;
/** The tile outside the shop's door, wherever the shop faces. */
export const civEntrance=(host:Entity):CivTile=>entityDoor(host);
export function civWalkable(entities:readonly Entity[],map:MapDefinition):Set<string> {
    const blocked=new Set<string>();
    for(const e of entities){const b=BLUEPRINTS.find(b=>b.id===e.blueprintId);if(!b||isPassable(e))continue;
        const f=entityFootprint(e);
        for(let x=f.x;x<f.x+f.width;x++)for(let y=f.y;y<f.y+f.length;y++)blocked.add(`${x}:${y}`);
    }
    const result=new Set<string>();
    for(let x=0;x<map.rows;x++)for(let y=0;y<map.columns;y++)if(map.terrainAt(x,y)==='grass'&&!blocked.has(`${x}:${y}`))result.add(`${x}:${y}`);
    // Bridges carry people over the water.
    for(const e of entities)if(BLUEPRINTS.find(b=>b.id===e.blueprintId)?.kind==='bridge'&&!blocked.has(`${e.x}:${e.y}`))result.add(`${e.x}:${e.y}`);
    return result;
}
/** Cardinal breadth-first paths; no browser positions or straight-line shortcuts. */
function pathsFrom(starts:readonly CivTile[],allowed:Set<string>,preferred?:Set<string>) {
    const distance=new Map<string,number>(),previous=new Map<string,CivTile>(),queue:CivTile[]=[];
    for(const p of starts)if(allowed.has(key(p))&&!distance.has(key(p))){distance.set(key(p),0);queue.push(p);}
    for(let i=0;i<queue.length;i++)for(const p of neighbors(queue[i]!).sort((a,b)=>Number(preferred?.has(key(b)))-Number(preferred?.has(key(a)))))if(allowed.has(key(p))&&!distance.has(key(p))){
        distance.set(key(p),distance.get(key(queue[i]!))!+1);previous.set(key(p),queue[i]!);queue.push(p);
    }
    const route=(end:CivTile):CivTile[]=>{
        if(!distance.has(key(end)))return [];
        const result=[end];while(previous.has(key(result[0]!)))result.unshift(previous.get(key(result[0]!))!);return result;
    };
    return {distance,route,tiles:queue};
}
export function roadAccess(entities:readonly Entity[],map:MapDefinition) {
    const walkable=civWalkable(entities,map),roads=entities.filter(isRoadLike).filter(e=>walkable.has(key(e))).map(({x,y})=>({x,y}));
    return pathsFrom(roads.filter(p=>p.x===map.entry.x&&p.y===map.entry.y),new Set(roads.map(key)));
}
/** Ordinary residents/guests may cross any clear ground, with roads preferred on ties. */
export function civWalkPath(entities:readonly Entity[],start:CivTile,end:CivTile,map:MapDefinition):CivTile[] {
    const roads=new Set(entities.filter(isRoadLike).map(key));
    return pathsFrom([start],civWalkable(entities,map),roads).route(end);
}
export function planMoveIn(entities:readonly Entity[],host:Entity,map:MapDefinition):MoveInPlan {
    const entrance=civEntrance(host),roads=roadAccess(entities,map),walking=pathsFrom([entrance],civWalkable(entities,map));
    const rank=(p:CivTile)=>walking.distance.get(key(p))??1000+Math.abs(p.x-entrance.x)+Math.abs(p.y-entrance.y);
    const sorted=[...roads.tiles].sort((a,b)=>rank(a)-rank(b)||roads.distance.get(key(a))!-roads.distance.get(key(b))!||a.x-b.x||a.y-b.y);
    const parking=sorted[0]??{x:map.entry.x,y:map.entry.y-1},drive=roads.route(parking),walk=walking.route(parking).reverse();
    return {drive,walk,parking,entrance,reachable:inside(entrance,map)&&walk.length>0&&walk.length-1<=2,key:JSON.stringify([drive,walk])};
}
export function ensureCivTown(state:TownState):TownState {
    const hosts=state.entities.filter(e=>businessFor(e.blueprintId));
    if(!hosts.length||state.civ&&hosts.every(e=>e.civ))return state;
    const next=structuredClone(state);next.civ??={activeMs:0,lastTick:0,helpedTypes:[]};
    for(const e of next.entities)if(businessFor(e.blueprintId))e.civ??=freshCivHome();
    next.revision++;return next;
}
export function moveInDuration(plan:MoveInPlan):number{return (Math.max(1,plan.drive.length)+3)*400+Math.max(0,plan.walk.length-1)*650;}
/** Only bounded, server-observed active intervals advance durable move-in rules. */
/** Advance one map's move-ins; `state` is that map's view. */
export function tickCiv(state:TownState,map:MapDefinition,now:number,_clock:CivClock,resume=false,verifiedElapsedMs?:number):TownState {
    const normalized=ensureCivTown(state);if(!normalized.civ)return normalized;
    const next=structuredClone(normalized),civ=next.civ!;
    const elapsed=verifiedElapsedMs??(!resume&&civ.lastTick>0&&now>=civ.lastTick&&now-civ.lastTick<=15000?now-civ.lastTick:0);
    civ.lastTick=now;civ.activeMs+=elapsed;
    for(const host of next.entities){if(!host.civ||host.civ.phase==='ready')continue;
        const plan=planMoveIn(next.entities,host,map),home=host.civ;
        if(home.routeKey!==plan.key){home.routeKey=plan.key;home.elapsedMs=0;}
        if(!plan.reachable){home.phase='waiting';home.elapsedMs=0;continue;}
        home.elapsedMs+=elapsed;const travel=moveInDuration(plan);
        home.phase=home.elapsedMs<travel?'travelling':home.elapsedMs<travel+4000?'unpacking':'ready';
        if(home.phase==='ready'){next.earned['town-new-neighbor']??=new Date(now).toISOString();next.revision++;}
    }
    return next;
}
export function workStatus(business:CivBusiness,activeMs:number,clock:CivClock,workerIndex=0):{kind:'working'|'away'|'closed'|'unknown';returnInMs?:number} {
    const match=/^(\d{2}):(\d{2})$/.exec(clock.localTime??'');
    if(!match||Number(match[1])>23||Number(match[2])>59)return {kind:'unknown'};
    const hour=Number(match[1])+Number(match[2])/60;
    if(hour<business.opens||hour>=business.closes)return {kind:'closed'};
    const cycle=(Math.max(0,activeMs)+business.icon*17000+workerIndex*53000)%180000,duration=30000+(business.icon%3)*15000;
    if(cycle>=105000&&cycle<105000+duration)return {kind:'away',returnInMs:105000+duration-cycle};
    return {kind:'working'};
}
/** Shops count wherever they stand: every map's settled neighbors and help. */
function civAcrossMaps(state:TownState){
    const entities=[...state.entities,...(state.maps?.lake?.land.entities??[])];
    const helped=new Set([...(state.civ?.helpedTypes??[]),...(state.maps?.lake?.land.civ?.helpedTypes??[])]);
    return {ready:CIV_BUSINESSES.filter(b=>entities.some(e=>e.blueprintId===b.id&&e.civ?.phase==='ready')),helped};
}
export function prosperityStage(state:TownState):0|1|2|3 {
    const {ready:present,helped}=civAcrossMaps(state);
    const workers=present.reduce((sum,b)=>sum+b.workers.length,0);
    const help=[...helped].filter(id=>present.some(b=>b.id===id)).length;
    const value=present.length*10+Math.floor(workers*1.5)+help*2;
    return value>=75?3:value>=50?2:value>=25?1:0;
}
/** Awards that span maps (helping three kinds of shop) are settled by `awardCiv`. */
export function helpNeighbor(state:TownState,entityId:string,step:number,clock:CivClock):TownState {
    const host=state.entities.find(e=>e.id===entityId),business=host&&businessFor(host.blueprintId);
    if(!business||host?.civ?.phase!=='ready')throw new Error('This neighbor has not moved in yet.');
    const home=host.civ,activeMs=state.civ?.activeMs??0;
    if(!business.workers.some((_,i)=>workStatus(business,activeMs,clock,i).kind==='working'))throw new Error('Come back when your neighbor is working.');
    if(activeMs<home.helpAfterMs)throw new Error('Your neighbor is having a little rest.');
    if(!Number.isInteger(step)||step!==home.helpStep)throw new Error('This task changed. Try the next item.');
    const next=structuredClone(state),target=next.entities.find(e=>e.id===entityId)!.civ!;
    if(step<2)target.helpStep++;
    else {target.helpStep=0;target.helpAfterMs=activeMs+120000;next.civ??={activeMs:0,lastTick:0,helpedTypes:[]};
        if(!next.civ.helpedTypes.includes(business.id))next.civ.helpedTypes.push(business.id);
    }
    next.revision++;return next;
}
/** Shared Town awards span every map (neighbors, construction and harvests); call on the root state after any change. */
export function awardCiv(state:TownState,now:number):void {
    const {ready,helped}=civAcrossMaps(state),stamp=new Date(now).toISOString();
    const award=(id:string,met:boolean)=>{if(met&&!state.earned[id]){state.earned[id]=stamp;state.revision++;}};
    award('town-helping-hand',helped.size>=3);
    award('town-lively-street',ready.length===CIV_BUSINESSES.length);
    const entities=[...state.entities,...(state.maps?.lake?.land.entities??[])],owns=(id:string)=>entities.filter(e=>e.blueprintId===id).length;
    award('town-farm-friends',owns('farmhouse')>0&&owns('coop')>0);
    award('town-lemon-lane',owns('lemon')>=3);
    award('town-little-village',entities.filter(e=>BLUEPRINTS.find(b=>b.id===e.blueprintId)?.kind==='building').length>=10);
    award('town-garden-basket',(state.gardening?.harvests??0)+(state.maps?.lake?.land.gardening?.harvests??0)>=20);
}
