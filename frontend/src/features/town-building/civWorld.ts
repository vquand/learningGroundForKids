import type {MapDefinition} from '../../../../server/src/town-building/maps/types.ts';
import { businessFor } from '../../../../server/src/town-building/civCatalog.ts';
import { civEntrance, civWalkable, civWalkPath, planMoveIn, workStatus, type CivClock, type CivTile, type MoveInPlan } from '../../../../server/src/town-building/civ.ts';
import type { Entity } from '../../../../server/src/town-building/game.ts';

export type CivDirection='right'|'left'|'down'|'up';
export interface TownPerson {
    id:string;hostId:string;art:string;workerIndex:number;guest:boolean;purpose:number;
    x:number;y:number;direction:CivDirection;clock:number;path:CivTile[];pause:number;
    mode:'idle'|'walk'|'work'|'rest'|'call'|'unpack'|'carry';visible:boolean;trip:number;
    routePurpose?:'errand'|'home'|'exit';
}
export interface CivWorld {map:MapDefinition;clockLabel:string|null;clockAgeMs:number;people:TownPerson[];plans:Map<string,MoveInPlan>;entities:Entity[];walkable:Set<string>;
    /** Tiles someone is standing still on (a cow watching the fish on a bridge): people wait before stepping in. */
    waitAt?:Set<string>}
function clearTile(preferred:CivTile,walkable:Set<string>):CivTile {
    if(walkable.has(`${preferred.x}:${preferred.y}`))return preferred;
    let nearest=preferred,distance=Infinity;
    for(const key of walkable){const [x,y]=key.split(':').map(Number),d=Math.abs(x!-preferred.x)+Math.abs(y!-preferred.y);if(d<distance){distance=d;nearest={x:x!,y:y!};}}
    return nearest;
}
export const civDirection=(dx:number,dy:number):CivDirection=>Math.abs(dy)>=Math.abs(dx)?dy>=0?'right':'left':dx>=0?'down':'up';
export function alongCivPath(path:readonly CivTile[],progress:number):CivTile&{direction:CivDirection} {
    if(!path.length)return {x:7,y:-1,direction:'right'};
    const index=Math.min(path.length-1,Math.max(0,Math.floor(progress))),a=path[index]!,b=path[Math.min(index+1,path.length-1)]!;
    const amount=Math.min(1,Math.max(0,progress-index));
    return {x:a.x+(b.x-a.x)*amount,y:a.y+(b.y-a.y)*amount,direction:civDirection(b.x-a.x,b.y-a.y)};
}
/** Shops and guests on one map; the map is always passed explicitly. */
export function createCivWorld(entities:Entity[],map:MapDefinition,previous?:CivWorld,guestCount=0):CivWorld {
    const people:TownPerson[]=[],plans=new Map<string,MoveInPlan>(),walkable=civWalkable(entities,map);
    const entry=map.entry;
    const add=(id:string,host:Entity,art:string,workerIndex:number,guest=false,purpose=0)=>{
        const entrance=guest?entry:civEntrance(host),old=previous?.people.find(p=>p.id===id);
        const sameHost=previous?.entities.find(e=>e.id===host.id);
        const person:TownPerson=old&&previous?.map.id===map.id&&sameHost?.x===host.x&&sameHost.y===host.y&&(sameHost.direction??'front')===(host.direction??'front')?old:{id,hostId:host.id,art,workerIndex,guest,purpose,...entrance,direction:'down',clock:0,path:[],pause:0,mode:'idle',visible:true,trip:0};
        if(guest||host.civ?.phase==='ready'){
            const tile={x:Math.round(person.x),y:Math.round(person.y)};
            if(!walkable.has(`${tile.x}:${tile.y}`)){Object.assign(person,clearTile(tile,walkable));person.path=[];person.pause=0;}
            if(person.path.some(p=>!walkable.has(`${p.x}:${p.y}`))){person.path=[];person.pause=0;}
        }
        people.push(person);
    };
    for(const host of entities){const b=businessFor(host.blueprintId);if(!b)continue;
        plans.set(host.id,planMoveIn(entities,host,map));b.workers.forEach((worker,i)=>add(`${host.id}:${i}`,host,worker.art,i));
    }
    const ready=entities.filter(e=>e.civ?.phase==='ready');
    for(let i=0;i<Math.min(3,guestCount)&&ready.length;i++){
        const host=ready[i%ready.length]!,art=['grocer','teacher','tool-shopkeeper'][i]!;
        add(`outside-guest:${i}`,host,art,0,true,[0,7,8][i]!);
    }
    return {map,people,plans,entities,walkable,clockLabel:previous?.clockLabel??null,clockAgeMs:previous?.clockAgeMs??0};
}
function move(person:TownPerson,dt:number,world:CivWorld):void {
    let budget=Math.max(0,dt)*1.4;
    while(person.path.length&&budget>0){
        const target=person.path[0]!,dx=target.x-person.x,dy=target.y-person.y,distance=Math.hypot(dx,dy);
        if(distance>.6&&world.waitAt?.has(`${Math.round(target.x)}:${Math.round(target.y)}`)){person.mode='idle';return;}
        if(distance>0)person.direction=civDirection(dx,dy);
        if(distance<=budget){person.x=target.x;person.y=target.y;person.path.shift();budget-=distance;}
        else{person.x+=dx/distance*budget;person.y+=dy/distance*budget;budget=0;}
    }
    person.mode=person.path.length?'walk':'idle';
}
function visitorsMayRoam(clock:CivClock):boolean {
    if(clock.timeOfDay==='evening'||clock.timeOfDay==='night')return false;
    const time=/^(\d{2}):(\d{2})$/.exec(clock.localTime??'');
    if(!time||Number(time[1])>23||Number(time[2])>59)return true;
    const hour=Number(time[1])+Number(time[2])/60;return hour>=8&&hour<20;
}
function returnTo(person:TownPerson,target:CivTile,purpose:'home'|'exit',world:CivWorld,dt:number,reduced:boolean,insideMode:'work'|'rest'):void {
    if(reduced||Math.hypot(person.x-target.x,person.y-target.y)<.05){
        person.x=target.x;person.y=target.y;person.visible=false;person.mode=insideMode;person.path=[];person.routePurpose=purpose;return;
    }
    if(person.routePurpose!==purpose){person.path=[];person.pause=0;person.routePurpose=purpose;}
    if(!person.path.length&&person.pause<=0){
        person.path=civWalkPath(world.entities,{x:Math.round(person.x),y:Math.round(person.y)},target,world.map);
        if(!person.path.length)person.pause=3;
    }
    person.visible=true;
    if(person.path.length)move(person,dt,world);else person.mode='call';
}
/** Local decorative movement only. Server state alone equips buildings/awards progress. */
export function stepCivWorld(world:CivWorld,paintEntities:Entity[],activeMs:number,clock:CivClock,dt:number,reduced=false):void {
    const walkable=world.walkable,label=clock.localTime??null;
    if(world.clockLabel!==label){world.clockLabel=label;world.clockAgeMs=0;}else world.clockAgeMs+=Math.max(0,dt)*1000;
    for(const person of world.people){person.clock+=reduced?0:dt;person.pause=Math.max(0,person.pause-dt);
        const host=paintEntities.find(e=>e.id===person.hostId),business=host&&businessFor(host.blueprintId);
        if(!host||!business){person.visible=false;continue;}
        const home=clearTile(civEntrance(host),walkable),plan=world.plans.get(host.id)!;
        if(!person.guest&&host.civ?.phase!=='ready'){
            person.path=[];person.visible=true;
            if(!plan.reachable){person.x=plan.parking.x+.25+person.workerIndex*.2;person.y=plan.parking.y+.35;person.direction='right';person.mode='call';}
            else if(host.civ?.phase==='unpacking'){person.x=home.x;person.y=home.y+person.workerIndex*.3;person.mode='unpack';person.direction='up';}
            else {person.visible=false;person.mode='carry';}
            continue;
        }
        if(person.guest&&!visitorsMayRoam(clock)){
            returnTo(person,clearTile(world.map.entry,walkable),'exit',world,dt,reduced,'rest');continue;
        }
        const status=workStatus(business,activeMs,clock,person.workerIndex);
        if(!person.guest&&status.kind!=='away'){
            returnTo(person,home,'home',world,dt,reduced,status.kind==='working'?'work':'rest');
            continue;
        }
        if(person.routePurpose&&person.routePurpose!=='errand'){person.path=[];person.pause=0;}
        person.routePurpose='errand';
        person.visible=true;
        if(reduced){person.mode='idle';continue;}
        if(person.path.length){move(person,dt,world);if(!person.path.length)person.pause=person.guest?5:3;continue;}
        if(person.pause>0){person.mode='idle';continue;}
        const start={x:Math.round(person.x),y:Math.round(person.y)};
        // Alternate a nearby shop visit with a short pause to shop/chat/look around.
        const candidates=paintEntities.filter(e=>e.civ?.phase==='ready'&&e.id!==host.id&&businessFor(e.blueprintId)?.workers.some((_,i)=>workStatus(businessFor(e.blueprintId)!,activeMs,clock,i).kind!=='closed')).map(civEntrance)
            .filter(p=>walkable.has(`${p.x}:${p.y}`)&&(p.x!==start.x||p.y!==start.y)&&Math.abs(p.x-start.x)+Math.abs(p.y-start.y)<=14);
        const choose=(targets:CivTile[])=>{
            const offset=(person.trip+person.workerIndex*3)%Math.max(1,targets.length);person.trip++;
            for(let index=0;index<targets.length;index++){
                const route=civWalkPath(world.entities,start,targets[(offset+index)%targets.length]!,world.map).slice(1);
                if(route.length){person.path=route;return true;}
            }
            return false;
        };
        if(!choose(candidates)){
            const nearby:CivTile[]=[];
            for(let x=Math.max(0,start.x-4);x<=Math.min(world.map.rows-1,start.x+4);x++)for(let y=Math.max(0,start.y-4);y<=Math.min(world.map.columns-1,start.y+4);y++)
                if((x!==start.x||y!==start.y)&&walkable.has(`${x}:${y}`))nearby.push({x,y});
            choose(nearby);
        }
        person.pause=person.guest?5:3;person.mode=person.path.length?'walk':'idle';
    }
}
