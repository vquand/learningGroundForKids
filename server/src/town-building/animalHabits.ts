import {entityFootprint,type TownState} from './game.ts';
import {GROW_SECONDS,cropMayGrow,type GardenEnvironment} from './garden.ts';
import type {AnimalResident} from './animalWorld.ts';
import type {MapDefinition} from './maps/types.ts';
import {LAKE_BLUEPRINTS} from './water/catalog.ts';
import {affects,emits} from './areaOfEffect.ts';

export interface Dropping{x:number;y:number;at:number}
export interface FlowerBush{x:number;y:number;since:number}
export const POOP_COOLDOWN=180,HABIT_CAPACITY=8;
/** One stable 12% roll per five active seconds; no client/random wall-clock input. */
export function droppingChance(id:string,bucket:number):number{let h=2166136261;for(const c of `${id}:poop:${bucket}`){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}h^=h>>>16;h=Math.imul(h,0x45d9f3b);h^=h>>>16;return (h>>>0)/4294967296;}
const standing=(a:AnimalResident)=>!a.inactive&&!a.sleeping&&!a.flying&&!a.perched&&a.mode==='roaming'&&!a.path.length;
const contains=(f:{x:number;y:number;width:number;length:number},x:number,y:number)=>x>=f.x&&x<f.x+f.width&&y>=f.y&&y<f.y+f.length;
function occupied(state:TownState,x:number,y:number):boolean{
    return state.entities.some(e=>contains(entityFootprint(e),x,y))||(state.rafts??[]).some(r=>{const b=LAKE_BLUEPRINTS.find(b=>b.id===r.blueprintId)!;return contains({...r,width:b.width,length:b.length},x,y);});
}
/** Props never obstruct placement. Clear them after any successful placement/transfer. */
export function clearOccupiedHabits(state:TownState):void{
    if(state.droppings)state.droppings=state.droppings.filter(p=>!occupied(state,p.x,p.y));
    if(state.bushes)state.bushes=state.bushes.filter(p=>!occupied(state,p.x,p.y));
}
/** The local calendar day of the most recent 05:00, rather than a fixed 24h duration (DST safe). */
const formats=new Map<string,Intl.DateTimeFormat>();
function sunriseDay(at:number,timeZone:string):string{
    let format=formats.get(timeZone);
    if(!format){format=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});formats.set(timeZone,format);}
    const parts=format.formatToParts(new Date(at));
    const part=(name:string)=>parts.find(p=>p.type===name)!.value;
    const date=`${part('year')}-${part('month')}-${part('day')}`;
    return Number(part('hour'))>=5?date:new Date(Date.parse(date+'T12:00:00Z')-86400000).toISOString().slice(0,10);
}
/** Wall-clock sunrise conversion also runs on resume; it never accrues offline animal contacts. */
export function settleBushes(state:TownState,map:MapDefinition,timeZone:string,now:number):void{
    const before=(state.droppings?.length??0)+(state.bushes?.length??0);
    clearOccupiedHabits(state);
    if(before!==(state.droppings?.length??0)+(state.bushes?.length??0))state.revision++;
    if(!state.droppings?.length)return;
    const today=sunriseDay(now,timeZone),waiting:Dropping[]=[];
    for(const p of state.droppings){
        if(map.terrainAt(p.x,p.y)!=='grass'){state.revision++;continue;}
        if(today>sunriseDay(p.at,timeZone)){(state.bushes??=[]).push({x:p.x,y:p.y,since:now});state.revision++;}else waiting.push(p);
    }
    state.droppings=waiting;
}
/** Shared simulation contacts for every map. A single animal cooldown covers both kinds of poop. */
export function applyAnimalHabits(state:TownState,animals:AnimalResident[],map:MapDefinition,weather:GardenEnvironment,activeSeconds:number,now:number):void{
    const bucket=Math.floor((activeSeconds+1e-7)/5),clock=state.gardening??={lastTick:0,activeSeconds,harvests:0,animals:[],season:weather.season};
    const history=clock.animalPoop??={};
    const ids=new Set(animals.map(a=>a.id));for(const id of Object.keys(history))if(!ids.has(id))delete history[id];
    for(const a of animals){
        if(!standing(a))continue;
        const x=Math.floor(a.x),y=Math.floor(a.y);
        if(['dairy-cow','highland-cow','sheep'].includes(a.species)&&state.bushes?.some(b=>b.x===x&&b.y===y)){
            state.bushes=state.bushes.filter(b=>b.x!==x||b.y!==y);a.pause=Math.max(a.pause,1.5);state.revision++;
        }
        if(!emits('animal-poop-boost',`animal:${a.species}`)||activeSeconds-(history[a.id]?.at??-POOP_COOLDOWN)<POOP_COOLDOWN-1e-7||history[a.id]?.check===bucket)continue;
        const patch=state.entities.find(e=>affects('animal-poop-boost',e.blueprintId)&&contains(entityFootprint(e),x,y)),garden=patch?.garden;
        const growing=garden?.slots.filter(s=>s.crop&&!s.withered&&s.growth<GROW_SECONDS&&cropMayGrow(s.crop,weather.season,weather.localDate))??[];
        if(garden){if(garden.poop||!growing.length)continue;}
        else{
            if(a.species!=='highland-cow'||x<0||y<0||x>=map.rows||y>=map.columns||map.terrainAt(x,y)!=='grass'||occupied(state,x,y))continue;
            if((state.droppings?.length??0)+(state.bushes?.length??0)>=HABIT_CAPACITY||[...(state.droppings??[]),...(state.bushes??[])].some(p=>p.x===x&&p.y===y))continue;
        }
        const record=history[a.id]??={check:bucket};record.check=bucket;
        if(droppingChance(a.id,bucket)>=.12)continue;
        if(garden){
            for(const slot of growing)slot.growth=Math.min(GROW_SECONDS,slot.growth+30);
            garden.poop={slot:(x-patch!.x)*2+y-patch!.y,at:now};
        }else (state.droppings??=[]).push({x,y,at:now});
        record.at=activeSeconds;state.revision++;
    }
}

/** Public scene props contain no clocks, contact history or reward state. */
export function habitScenery(state:{droppings?:TownState['droppings'];bushes?:TownState['bushes']}|null|undefined){return {
    ...(state?.droppings?{droppings:state.droppings.map(p=>({x:p.x,y:p.y,at:0}))}:{}),
    ...(state?.bushes?{bushes:state.bushes.map(p=>({x:p.x,y:p.y,since:0}))}:{}),
};}
/** Carry the animal's remaining active cooldown when its home changes maps. */
export function transferHabitCooldowns(source:TownState,destination:TownState,hostId:string):void{
    const history=source.gardening?.animalPoop;if(!history)return;
    for(const [id,record] of Object.entries(history))if(id.startsWith(`${hostId}:`)){
        const clock=destination.gardening??={lastTick:0,activeSeconds:0,harvests:0,animals:[],season:null};
        (clock.animalPoop??={})[id]={check:Math.floor(clock.activeSeconds/5),...(record.at!==undefined?{at:clock.activeSeconds-((source.gardening?.activeSeconds??0)-record.at)}:{})};
        delete history[id];
    }
}
