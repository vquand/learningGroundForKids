import {entityFootprint,type Entity,type TownAnimal} from '../../../../server/src/town-building/game.ts';
import type {Environment} from '../../../../server/src/town-building/environment.ts';
import type {Direction} from '../../../../server/src/town-building/direction.ts';
import type {AnimalResident} from '../../../../server/src/town-building/animalWorld.ts';
import {HABITAT_ART} from './animalAtlas.ts';
import {sceneLighting} from './sceneLighting.ts';
import {artBaseSize} from './townArtScale.ts';

/** Source foot x/y, body scale, facing into the room; `sit` keeps a rabbit upright so its ears show over a window sill. */
type Slot=readonly [number,number,number,1|-1,('sit')?];
/** `closed` is the normal art; `open` is the door-open art, shown while residents shelter until the interior layers decode;
 * `hollow` is the same art with its opening transparent and `interior` masks only that opening. `alwaysSheltered` buildings
 * (animal havens) always show their interior; the rest show it only while a resident rests at home. */
export interface ShelterView{closed:string;open:string;hollow:string;interior:string;crop:readonly [number,number,number,number];slots:Partial<Record<TownAnimal,readonly Slot[]>>;alwaysSheltered:boolean}
const FARM_SPECIES=['dairy-cow','highland-cow','sheep','pig'] as const;
/** Barn residents share one set of bay slots per facing; each species keeps its own sprite. */
const farmSlots=(slots:readonly Slot[]):Partial<Record<TownAnimal,readonly Slot[]>>=>Object.fromEntries(FARM_SPECIES.map(species=>[species,slots]));
const farmView=(name:string,crop:readonly [number,number,number,number],slots:readonly Slot[],front=false):ShelterView=>({closed:front?'farmhouse-wide-v2':`farmhouse-${name}`,open:front?'farmhouse-wide-v2-open':`farmhouse-${name}-empty`,hollow:front?'farmhouse-wide-v2-open-hollow':`farmhouse-${name}-empty-hollow`,interior:front?'farmhouse-wide-v2-open-interior':`farmhouse-${name}-empty-interior`,crop,slots:farmSlots(slots),alwaysSheltered:false});
/** One source of geometry for building art, clipping, residents and directional preloading, keyed by blueprint then facing. */
export const SHELTER_VIEWS:Partial<Record<string,Record<Direction,ShelterView>>>={
    'animal-habitat':{
        front:{closed:'habitat',open:'habitat',hollow:'animal-haven-hollow-v1',interior:'animal-haven-interior-v1',crop:HABITAT_ART.rect as [number,number,number,number],alwaysSheltered:true,slots:{capybara:[[565,815,.82,1],[835,815,.82,-1]],rabbit:[[580,740,.62,1],[820,740,.62,-1],[580,840,.62,1],[820,840,.62,-1]]}},
        left:{closed:'animal-haven-left-windowed-v1',open:'animal-haven-left-windowed-v1',hollow:'animal-haven-left-hollow-v1',interior:'animal-haven-left-interior-v1',crop:[76,295,877,873],alwaysSheltered:true,slots:{capybara:[[594,1045,.82,1]],rabbit:[[530,1076,.62,1,'sit'],[660,1076,.62,-1,'sit']]}},
        right:{closed:'animal-haven-right-windowed-v1',open:'animal-haven-right-windowed-v1',hollow:'animal-haven-right-hollow-v1',interior:'animal-haven-right-interior-v1',crop:[71,295,877,873],alwaysSheltered:true,slots:{capybara:[[430,1045,.82,-1]],rabbit:[[494,1076,.62,-1,'sit'],[364,1076,.62,1,'sit']]}},
        back:{closed:'animal-haven-back-windowed-v1',open:'animal-haven-back-windowed-v1',hollow:'animal-haven-back-hollow-v1',interior:'animal-haven-back-interior-v1',crop:[291,112,954,800],alwaysSheltered:true,slots:{capybara:[[768,790,.82,1]],rabbit:[[700,793,.62,1,'sit'],[836,793,.62,-1,'sit']]}},
    },
    farmhouse:{
        front:farmView('wide-v2',[82,168,1495,642],[[760,792,1,1],[905,792,1,-1]],true),
        left:farmView('left-v5',[152,66,701,1411],[[400,1425,1,1],[620,1425,1,-1]]),
        right:farmView('right-v5',[171,66,701,1411],[[623,1425,1,-1],[403,1425,1,1]]),
        back:farmView('back-v4',[73,155,1511,639],[[245,772,1,1],[400,772,1,-1]]),
    },
};
export const shelterView=(host:Entity):ShelterView|undefined=>SHELTER_VIEWS[host.blueprintId]?.[host.direction??'front'];
/** Same aspect-preserving crop and ground anchor as the shared building renderer. */
export function shelterArtBounds(host:Entity,tile:number,ox=0,oy=0){
    const f=entityFootprint(host),c=shelterView(host)!.crop,scale=Math.min(f.length*tile/c[2]!, (f.width+.9)*tile/c[3]!);
    const width=c[2]!*scale,height=c[3]!*scale;
    return {x:ox+host.y*tile+(f.length*tile-width)/2,y:oy+(host.x+f.width)*tile-height,width,height};
}
/** Foot anchors measured in the source opening; ordinals never depend on draw order. */
/** Where a barn's single sheep-dream bubble sits, in tile units (x = row, y = column), clear of the sleepers:
 * above the roof toward the right on front/rear views, beside the hay bay (away from the door) on side views. */
export function shelterDreamAnchor(host:Entity){
    const b=shelterArtBounds(host,1),side=host.direction==='left'||host.direction==='right';
    return side?{x:b.y+b.height*.72,y:host.direction==='left'?b.x+b.width+.45:b.x-.45}:{x:b.y+.9,y:b.x+b.width*.74};
}
export function shelterSlot(host:Entity,species:TownAnimal,ordinal:number){
    const view=shelterView(host),slot=view?.slots[species]?.[ordinal];if(!slot)return null;
    const b=shelterArtBounds(host,1),c=view!.crop,scale=b.width/c[2]!,[px,py,size,facing,pose]=slot;
    return {x:b.y+(py-c[1]!)*scale,y:b.x+(px-c[0]!)*scale,scale:size,facing,sit:pose==='sit'};
}
/** Residents inside their home's sheltering pose: resting at home, or asleep within reach of their shelter point. */
export const sheltersAtHome=(a:Pick<AnimalResident,'mode'|'sleeping'|'x'|'y'|'shelter'>)=>a.mode==='resting'||a.sleeping&&Math.hypot(a.x-a.shelter.x,a.y-a.shelter.y)<=.75;
/** Hosts with a resident sheltering at home, filled into the reused set; only that set changes which closed or sheltering art draws. */
export function shelteredHostIds(residents:readonly AnimalResident[],entities:readonly Entity[],into:Set<string>){
    into.clear();
    for(const a of residents){if(!sheltersAtHome(a)||into.has(a.hostId))continue;const host=entities.find(e=>e.id===a.hostId);if(host&&shelterView(host)?.slots[a.species]?.[a.ordinal])into.add(host.id);}
    return into;
}
const tinted=new WeakMap<HTMLImageElement,Map<string,HTMLCanvasElement>>();
/** Cache source-sized interior fills by the existing scene tone stack, never per frame. */
export function shelterInteriorTint(image:HTMLImageElement,environment:Environment){
    const tones=sceneLighting(environment),key=tones.join('|');if(!key)return image;
    let cache=tinted.get(image);if(!cache){cache=new Map();tinted.set(image,cache);}
    let canvas=cache.get(key);if(!canvas){
        canvas=document.createElement('canvas');const base=artBaseSize(image);canvas.width=base.width;canvas.height=base.height;
        const work=canvas.getContext('2d')!;work.drawImage(image,0,0,base.width,base.height);work.globalCompositeOperation='source-atop';
        for(const tone of tones){work.fillStyle=tone;work.fillRect(0,0,canvas.width,canvas.height);}
        if(cache.size>=4)cache.delete(cache.keys().next().value!);cache.set(key,canvas);
    }
    return canvas;
}
