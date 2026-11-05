import {animalSpecies,entityDoorPoint,entityFootprint,isBridge,type Entity,type Season,type TownAnimal} from '../../../../server/src/town-building/game.ts';
import {GROW_SECONDS} from '../../../../server/src/town-building/garden.ts';
import {BARN_CAPACITY,barnProduct,barnStock} from '../../../../server/src/town-building/barn.ts';
import {chickenCoverage} from '../../../../server/src/town-building/poultry.ts';
import {animalHabitat,isAnimalWater} from '../../../../server/src/town-building/maps/animalHabitat.ts';
import type {MapId} from '../../../../server/src/town-building/maps/types.ts';
import type {LakeRaft} from '../../../../server/src/town-building/water/types.ts';
import {LAKE_BLUEPRINTS} from '../../../../server/src/town-building/water/catalog.ts';
import {route,type AnimalResident,type AnimalWeather} from './animalWorld.ts';
import {shelterView,shelterSlot,sheltersAtHome} from './shelterInterior.ts';

/** Decorative, browser-only animal moments layered over the shared resident simulation.
 * Nothing here is saved, sent to the server or rewarded. */
export type AnimalLook='duckling'|'gosling'|'chick'|'lamb'|'fleece-medium'|'fleece-full'|'sheared'|'huddle'|'huddle-medium'|'huddle-full'|'huddle-sheared';
export interface AnimalShow extends AnimalResident{
    look?:AnimalLook;
    mushroom?:0|1;hidden?:boolean;shears?:boolean;
    haven?:{host:Entity;progress:number;asleep:boolean};
    /** Body size relative to the species' usual size (babies are small). */
    scale?:number;
    /** Extra height above the ground, in tiles (a hop, a chick on a capybara's back). */
    lift?:number;
    /** Only the top share of the sprite shows (ears peeking out of tall plants). */
    peek?:number;
}
export interface MomentBubble{x:number;y:number;text:'honk'|'hoot';age:number}
export interface MomentWorld{
    mapId:MapId;entities:readonly Entity[];rafts:readonly LakeRaft[];
    weather:AnimalWeather&{season:Season};
    /** Wall clock for barn wool (fleece) and display growth of crops, in ms. */
    now:number;growthSeconds:number;
    /** Halloween ghosts on this map, in tile units. */
    ghosts?:Iterable<{x:number;y:number}>;
    /** Water-duty ducks whose flock is resting between strolls. */
    restingDucks?:ReadonlySet<string>;
    /** Saved flower bushes, distinct from decorative grass tufts. */
    bushes?:readonly {x:number;y:number;since:number}[];
}
type Point={x:number;y:number};
const DOGS:readonly TownAnimal[]=['golden-retriever','shiba-inu','border-collie','samoyed','vietnamese-dog','australian-cattle-dog'];
const CATS:readonly TownAnimal[]=['british-shorthair','ragdoll','persian','scottish-straight','munchkin'];
const CATTLE:readonly TownAnimal[]=['dairy-cow','highland-cow'];
const GENTLE:readonly TownAnimal[]=['capybara','sheep','dairy-cow','highland-cow'];
const GRAZERS:readonly TownAnimal[]=['sheep','dairy-cow','highland-cow'];
const key=(x:number,y:number)=>`${Math.floor(x)}:${Math.floor(y)}`;
const near=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const hash=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0)/4294967296;};
const busy=(a:AnimalResident)=>a.mode!=='roaming'||a.sleeping||a.flying||a.perched||!!a.perch||a.bumpAge>0||a.inactive;
const pathTo=(a:AnimalResident,x:number,y:number)=>{const target=key(x,y);if(target===key(a.x,a.y))return [{x:Math.floor(x)+.5,y:Math.floor(y)+.5}];return route(a,target);};
const footprintCells=(e:Entity)=>{const f=entityFootprint(e),cells:Point[]=[];for(let x=f.x;x<f.x+f.width;x++)for(let y=f.y;y<f.y+f.length;y++)cells.push({x,y});return cells;};

export interface GrassTuft{x:number;y:number;growth:number;munched:number}
/** `direction`/`facing` come from the baby's own motion; `moving` keeps its paddle or step cycle steady. */
interface Baby{id:string;parentId:string;look:'duckling'|'gosling'|'chick'|'lamb';rank:number;x:number;y:number;snuggle:string|null;direction?:AnimalResident['direction'];facing?:1|-1;moving?:number;
    /** Smoothed velocity, so a curvy wander does not flip the sprite every frame. */
    vx?:number;vy?:number}
/** `wait` bounds the walk there; `age` runs once arrived. */
interface Hide{animalId:string;x:number;y:number;arrived:boolean;wait:number;age:number;popped:number}
interface Peck{henId:string;x:number;y:number;arrived:boolean;wait:number;age:number;bug:0|1}
interface MushroomTrip{animalId:string;hostId:string;hostX:number;hostY:number;phase:'outbound'|'foraging'|'returning';x:number;y:number;home:Point;age:number;wait:number;variant:0|1}
interface LeafPile{x:number;y:number;scattered:number}
/** A sheep walking into its barn to be shorn: it keeps its pre-collection fleece until inside, hides briefly, then comes out. */
interface Shear{animalId:string;hostId:string;held:AnimalLook|undefined;phase:'walking'|'inside';age:number}
const SHEAR_HIDE=1.2,SHEAR_WALK_LIMIT=15;
export interface ShearCue{hostId:string;at:number;stock:number;onComplete:()=>void;finish?:boolean;settled?:boolean}
/** Wool stage from a barn's waiting wool: shorn when empty, plain under a third of a basket, then medium and full fleece. */
export function fleeceLook(stock:number):AnimalLook|undefined{if(stock<=0)return 'sheared';if(stock*3<BARN_CAPACITY)return undefined;return stock*3<BARN_CAPACITY*2?'fleece-medium':'fleece-full';}

export class AnimalMoments{
    private time=0;private seed=1;
    private cooldown=new Map<string,number>();
    private hearts=new Map<string,number>();
    private hops=new Map<string,number>();
    private flaps=new Map<string,number>();
    private crumbs=new Map<string,Point[]>();
    private babies:Baby[]=[];
    private layout='';
    mushroomTrips:MushroomTrip[]=[];
    mushrooms:{x:number;y:number;age:number;variant:0|1}[]=[];
    private previousBushes:readonly {x:number;y:number;since:number}[]=[];
    private bushMap:MapId|null=null;
    private mushroomMap:MapId|null=null;
    private nibbles=new Map<string,number>();
    grass:GrassTuft[]=[];
    leafPiles:LeafPile[]=[];
    bubbles:MomentBubble[]=[];
    sparkles:{x:number;y:number;age:number}[]=[];
    leaves:{x:number;y:number;age:number;spin:number}[]=[];
    splashes:{x:number;y:number;age:number}[]=[];
    pecks:Peck[]=[];
    hides:Hide[]=[];
    private stops=new Map<string,number>();
    private crossed=new Set<string>();
    private pauses=new Map<string,number>();
    private sleepingBefore=new Set<string>();
    private rainShelter=new Map<string,Point>();
    private gateHolders=new Map<string,{x:number;y:number;until:number}>();
    private snuggles=new Map<string,string>();
    private sharing=new Map<string,string>();
    private sitting=new Map<string,number>();
    private decorated=0;
    private havens=new Map<string,{layout:string;progress:number}>();
    private shears:Shear[]=[];
    private shearHolds=new Map<string,{age:number;done:boolean;complete:(()=>void)|undefined}>();

    private random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
    private ready(id:string,seconds:number){if((this.cooldown.get(id)??-1e9)>this.time)return false;this.cooldown.set(id,this.time+seconds);return true;}
    private heart(id:string,seconds=2.5){this.hearts.set(id,Math.max(this.hearts.get(id)??0,this.time+seconds));}

    /** Client-only pre-collection trip. Completion requests collection; it never awards wool. */
    shear(hostId:string,stock:number,residents:readonly AnimalResident[],onComplete?:()=>void,immediate=false){
        if(this.shearHolds.has(hostId))return;
        this.shearHolds.set(hostId,{age:0,done:false,complete:onComplete});
        const held=fleeceLook(stock);
        if(!immediate)for(const a of residents){
            if(a.hostId!==hostId||a.species!=='sheep'||busy(a)||!a.allowed.size||this.shearing(a.id))continue;
            a.path=pathTo(a,a.shelter.x,a.shelter.y);a.pause=0;a.sleeping=false;
            this.shears.push({animalId:a.id,hostId,held,phase:'walking',age:0});
        }
        if(!this.shears.some(s=>s.hostId===hostId))this.finishShear(hostId);
    }
    /** Safety timeout/reduced motion also finish the visible trip before notifying, once. */
    finishShear(hostId:string){
        for(let i=this.shears.length-1;i>=0;i--){const s=this.shears[i]!;if(s.hostId!==hostId)continue;this.heart(s.animalId,2.5);this.shears.splice(i,1);}
        const held=this.shearHolds.get(hostId);if(!held||held.done)return;
        held.done=true;const complete=held.complete;held.complete=undefined;complete?.();
    }
    /** A resolved request releases the preview: authoritative stock decides the look again. */
    resolveShear(hostId:string){this.finishShear(hostId);this.shearHolds.delete(hostId);}
    private shearing(id:string){for(const s of this.shears)if(s.animalId===id)return true;return false;}
    /** Hearts over every resident of a farmhouse that was just fed. */
    feed(hostId:string,residents:readonly AnimalResident[]){for(const a of residents)if(a.hostId===hostId)this.heart(a.id,3.5);}
    /** Tiles a resident stands still on, where passing people wait. */
    waitTiles(residents:readonly AnimalResident[]):Set<string>{const tiles=new Set<string>();for(const a of residents)if((this.stops.get(a.id)??0)>this.time)tiles.add(key(a.x,a.y));return tiles;}
    /** Dogs holding a farm gate open, as gate movers. */
    holders():Point[]{return [...this.gateHolders.values()].filter(h=>h.until>this.time);}

    /** Rebuild layout-derived sites (grass, leaf piles, babies) when buildings change. */
    private sync(world:MomentWorld,residents:readonly AnimalResident[]){
        const layout=JSON.stringify([world.mapId,world.entities.map(e=>[e.id,e.blueprintId,e.x,e.y,e.direction,e.animal]),world.weather.season]);
        if(layout===this.layout)return;this.layout=layout;
        const habitat=animalHabitat(world.mapId),occupied=new Set<string>();
        for(const e of world.entities){const f=entityFootprint(e);for(let x=f.x-1;x<f.x+f.width;x++)for(let y=f.y;y<f.y+f.length;y++)occupied.add(`${x}:${y}`);}
        for(const r of world.rafts){const b=LAKE_BLUEPRINTS.find(b=>b.id===r.blueprintId);if(b)for(let x=r.x;x<r.x+b.width;x++)for(let y=r.y;y<r.y+b.length;y++)occupied.add(`${x}:${y}`);}
        const free=(x:number,y:number)=>x>=0&&y>=0&&x<habitat.map.rows&&y<habitat.map.columns&&habitat.terrainAt(x,y)==='grass'&&!occupied.has(`${x}:${y}`)&&!habitat.blockedAt(x,y);
        const hosts=world.entities.filter(e=>['farmhouse','coop','animal-habitat'].includes(e.blueprintId));
        const old=new Map(this.grass.map(t=>[`${t.x}:${t.y}`,t]));
        const tufts=new Map<string,GrassTuft>();
        for(const host of hosts){const f=entityFootprint(host);
            for(let x=f.x-5;x<f.x+f.width+5;x++)for(let y=f.y-5;y<f.y+f.length+5;y++){
                const k=`${x}:${y}`;if(tufts.has(k)||!free(x,y)||hash(`grass:${k}`)>.3)continue;
                tufts.set(k,old.get(k)??{x,y,growth:hash(`start:${k}`),munched:0});
            }}
        this.grass=[...tufts.values()];
        this.mushrooms=this.mushrooms.filter(m=>free(Math.floor(m.x),Math.floor(m.y)));
        this.leafPiles=[];
        if(world.weather.season==='autumn')for(const host of world.entities.filter(e=>e.blueprintId==='farmhouse'&&animalSpecies(e)==='sheep')){
            const f=entityFootprint(host),spots=[] as Point[];
            for(let x=f.x-3;x<f.x+f.width+3;x++)for(let y=f.y-3;y<f.y+f.length+3;y++)if(free(x,y)&&!tufts.has(`${x}:${y}`))spots.push({x,y});
            spots.sort((a,b)=>hash(`leaf:${a.x}:${a.y}`)-hash(`leaf:${b.x}:${b.y}`));
            for(const spot of spots.slice(0,2))this.leafPiles.push({...spot,scattered:0});
        }
        // Babies follow the first residents of their parents' homes.
        const babies:Baby[]=[];
        for(const host of hosts){
            const species=animalSpecies(host);
            const look=host.blueprintId==='coop'&&species==='duck'?'duckling':host.blueprintId==='coop'&&species==='goose'?'gosling':host.blueprintId==='coop'&&species==='chicken'?'chick':host.blueprintId==='farmhouse'&&species==='sheep'&&world.weather.season==='spring'?'lamb':null;
            if(!look)continue;
            const parents=residents.filter(a=>a.hostId===host.id);
            for(let i=0;i<2&&parents.length;i++){
                const parent=parents[i%parents.length]!,id=`${host.id}:${look}:${i}`,previous=this.babies.find(b=>b.id===id);
                babies.push(previous??{id,parentId:parent.id,look,rank:i,x:parent.x,y:parent.y,snuggle:null});
            }
        }
        this.babies=babies;
    }

    /** Behaviour nudges on the live residents, before they are sampled for drawing. */
    step(residents:AnimalResident[],world:MomentWorld,dt:number,reduced:boolean){
        if(this.mushroomMap!==world.mapId){this.mushroomTrips=[];this.mushrooms=[];this.mushroomMap=world.mapId;}
        this.sync(world,residents);
        const present=new Set<string>();
        for(const a of residents){
            const host=world.entities.find(e=>e.id===a.hostId);if(!host||!shelterView(host)?.slots[a.species])continue;
            present.add(a.id);const layout=`${host.x}:${host.y}:${host.direction}:${a.species}`,previous=this.havens.get(a.id);
            const inside=sheltersAtHome(a);
            const progress=reduced||!previous||previous.layout!==layout?Number(inside):Math.max(0,Math.min(1,previous.progress+(inside?1:-1)*Math.max(0,dt)/.4));
            this.havens.set(a.id,{layout,progress});
        }
        for(const id of this.havens.keys())if(!present.has(id))this.havens.delete(id);
        if(reduced){for(const trip of this.mushroomTrips){const a=residents.find(a=>a.id===trip.animalId);if(a){a.path=[];a.pause=0;}}this.mushroomTrips=[];this.mushrooms=[];
            for(const shear of this.shears){const a=residents.find(a=>a.id===shear.animalId);if(a){a.path=[];a.pause=0;}}this.shears=[];for(const hostId of this.shearHolds.keys())this.finishShear(hostId);}
        if(reduced||dt<=0){this.previousBushes=world.bushes??[];this.bushMap=world.mapId;this.age(0);return;}
        this.time+=dt;
        const byId=new Map(residents.map(a=>[a.id,a]));
        // Shearing: walk in wearing the old fleece, hide briefly inside, then come out and roam again.
        for(let i=this.shears.length-1;i>=0;i--){
            const shear=this.shears[i]!,a=byId.get(shear.animalId);
            if(!a||!world.entities.some(e=>e.id===shear.hostId)){this.shears.splice(i,1);continue;}
            shear.age+=dt;
            if(shear.phase==='walking'&&!a.path.length&&near(a,a.shelter)<.6){shear.phase='inside';shear.age=0;}
            if(shear.phase==='walking')continue;
            a.path.length=0;a.pause=Math.max(a.pause,.1);
            if(shear.age<SHEAR_HIDE)continue;
            this.heart(a.id,2.5);a.pause=0;this.shears.splice(i,1);
        }
        for(const [hostId,held] of this.shearHolds){
            if(held.done)continue;held.age+=dt;
            let walking=false;for(const s of this.shears)if(s.hostId===hostId){walking=true;break;}
            if(!walking||held.age>=SHEAR_WALK_LIMIT)this.finishShear(hostId);
        }
        const evening=world.weather.timeOfDay==='evening',night=evening||world.weather.timeOfDay==='night'||world.weather.isDay===false;
        const raining=world.weather.precipitation==='rain';
        const bridges=new Set(world.entities.filter(isBridge).map(e=>`${e.x}:${e.y}`));
        const justPaused=(a:AnimalResident)=>{const before=this.pauses.get(a.id)??0;this.pauses.set(a.id,a.pause);return a.pause>before+.05&&a.mode==='roaming'&&!a.path.length;};

        for(const a of residents){
            const paused=justPaused(a);
            if(this.shearing(a.id))continue;
            // 4 Gentle big animals sometimes lie down for a daytime rest, once they have been up a while.
            if(paused&&!night&&!raining&&this.time>45&&GENTLE.includes(a.species)&&a.species!=='capybara'&&!busy(a)&&this.random()<.12&&this.ready(`nap:${a.id}`,60)){a.sleeping=true;a.pause=12+this.random()*10;}
            // 8 Grazers walk to a tall tuft nearby, then nibble it.
            if(paused&&!night&&GRAZERS.includes(a.species)&&!a.sleeping&&this.random()<.35){
                const tuft=this.grass.filter(t=>t.growth>.4&&near({x:t.x+.5,y:t.y+.5},a)<3).sort((p,q)=>near(p,a)-near(q,a))[0];
                if(tuft){const path=pathTo(a,tuft.x,tuft.y);if(path.length){a.path=path;a.pause=0;}}
            }
            // 17 A cow stops on a bridge to watch the fish below.
            if(CATTLE.includes(a.species)){
                const on=bridges.has(key(a.x,a.y));
                if(on&&a.path.length&&a.pause<=0&&!this.crossed.has(a.id)){this.crossed.add(a.id);if(this.random()<.45){a.pause=4+this.random()*2;a.direction='front';this.stops.set(a.id,this.time+a.pause);}}
                if(!on)this.crossed.delete(a.id);
            }
            // 18 Rain: cats dash to shelter, under a nearby bridge end when that is closer than home.
            if(CATS.includes(a.species)){
                if(raining&&!a.raining&&!this.rainShelter.has(a.id)){
                    const ends=[...a.allowed].map(k=>k.split(':').map(Number) as [number,number]).filter(([x,y])=>[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([p,q])=>bridges.has(`${p}:${q}`)));
                    const end=ends.map(([x,y])=>({x:x+.5,y:y+.5})).sort((p,q)=>near(p,a)-near(q,a))[0];
                    if(end&&near(end,a)<near(a.shelter,a)){this.rainShelter.set(a.id,{...a.shelter});a.shelter=end;}
                }
                if(raining&&a.mode==='returning')a.running=true;
                if(!raining&&this.rainShelter.has(a.id)){a.shelter=this.rainShelter.get(a.id)!;this.rainShelter.delete(a.id);}
            }
        }

        // 1 At dusk the cattle dog walks behind the cows on their way home.
        if(evening)for(const dog of residents.filter(a=>a.species==='australian-cattle-dog')){
            const cows=residents.filter(a=>CATTLE.includes(a.species)&&a.mode==='returning'&&near(a,dog)<12);
            if(!cows.length||!this.ready(`dusk:${dog.id}`,1.2))continue;
            const last=cows.sort((p,q)=>near(q,q.shelter)-near(p,p.shelter))[0]!,d=near(last,last.shelter)||1;
            const behind={x:last.x+(last.x-last.shelter.x)/d*1.2,y:last.y+(last.y-last.shelter.y)/d*1.2};
            const path=pathTo(dog,behind.x,behind.y);if(path.length){dog.path=path;dog.mode='returning';dog.pause=0;dog.sleeping=false;}
            for(const cow of cows)if(near(cow,dog)<2.5)this.heart(cow.id,1.5);
        }
        // 1 A Border Collie circles a far straggler back to its flock.
        if(!night)for(const dog of residents.filter(a=>a.species==='border-collie'&&!busy(a)&&!a.herding)){
            const sheep=residents.filter(a=>a.species==='sheep'&&!busy(a)&&!this.shearing(a.id));if(sheep.length<2)continue;
            for(const stray of sheep){
                const flock=sheep.filter(s=>s.hostId===stray.hostId&&s!==stray);if(!flock.length)continue;
                const center={x:flock.reduce((s,f)=>s+f.x,0)/flock.length,y:flock.reduce((s,f)=>s+f.y,0)/flock.length},d=near(stray,center);
                if(d<3.5||near(dog,stray)>8||!this.ready(`stray:${dog.id}`,25))continue;
                const side={x:stray.x+(stray.x-center.x)/d,y:stray.y+(stray.y-center.y)/d},dogPath=pathTo(dog,side.x,side.y),home=pathTo(stray,center.x,center.y);
                if(dogPath.length&&home.length){dog.path=dogPath;dog.running=true;dog.pause=0;stray.path=home;stray.pause=1.5;this.heart(dog.id,3);this.heart(stray.id,3);}
                break;
            }
        }
        // 3 A goose honks and flaps at a dog that comes too close; the dog hops back.
        for(const goose of residents.filter(a=>a.species==='goose'&&!a.sleeping&&!a.flying))for(const dog of residents.filter(a=>DOGS.includes(a.species)&&!a.sleeping)){
            if(near(goose,dog)>1.4||!this.ready(`honk:${goose.id}`,15))continue;
            this.flaps.set(goose.id,this.time+.8);this.bubbles.push({x:goose.x,y:goose.y,text:'honk',age:0});
            const away=[[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]].map(([dx,dy])=>({x:dog.x+dx!,y:dog.y+dy!})).filter(p=>dog.allowed.has(key(p.x,p.y))).sort((p,q)=>near(q,goose)-near(p,goose))[0];
            if(away){const path=pathTo(dog,away.x,away.y);if(path.length){dog.path=path;dog.running=true;dog.pause=0;dog.mode=dog.mode==='resting'?dog.mode:'roaming';}}
            this.hops.set(dog.id,this.time+.5);
        }
        // 4 A napping cat curls up next to a resting gentle animal.
        for(const cat of residents.filter(a=>CATS.includes(a.species))){
            const wasSleeping=this.sleepingBefore.has(cat.id);
            if(cat.sleeping)this.sleepingBefore.add(cat.id);else this.sleepingBefore.delete(cat.id);
            const target=this.snuggles.get(cat.id);
            if(target){
                const big=byId.get(target);
                if(!big?.sleeping){this.snuggles.delete(cat.id);continue;}
                if(!cat.path.length&&!cat.sleeping&&near(cat,big)<1.6){cat.sleeping=true;cat.pause=Math.max(cat.pause,12);this.heart(cat.id,2);this.heart(big.id,2);}
                continue;
            }
            if(night||!cat.sleeping||wasSleeping)continue;
            const big=residents.find(b=>GENTLE.includes(b.species)&&b.sleeping&&b.mode==='roaming'&&near(b,cat)<4);
            if(!big)continue;
            const spot=[[0,-1],[0,1],[1,0],[-1,0]].map(([dx,dy])=>({x:big.x+dx!,y:big.y+dy!})).find(p=>cat.allowed.has(key(p.x,p.y)));
            const path=spot?pathTo(cat,spot.x,spot.y):[];
            if(path.length){cat.sleeping=false;cat.pause=0;cat.path=path;this.snuggles.set(cat.id,big.id);}
        }
        // 7 Animals queue at a farm gate; a nearby dog sits beside it to hold it open.
        const gates=world.entities.filter(e=>e.blueprintId==='farm-gate');
        for(const gate of gates){
            const center={x:gate.x+.5,y:gate.y+.5},inGate=residents.filter(a=>!a.flying&&key(a.x,a.y)===key(center.x,center.y));
            let queued=false;
            for(const a of residents){
                const next=a.path[0];if(!next||a.flying||key(next.x,next.y)!==key(center.x,center.y)||key(a.x,a.y)===key(center.x,center.y))continue;
                if(inGate.some(o=>o!==a)){a.pause=Math.max(a.pause,.3);queued=true;}
            }
            if(!queued)continue;
            const holder=residents.filter(a=>DOGS.includes(a.species)&&!busy(a)&&near(a,center)<5).sort((p,q)=>near(p,center)-near(q,center))[0];
            if(!holder||!this.ready(`gate:${gate.id}`,12))continue;
            const side=[[0,1],[0,-1],[1,0],[-1,0]].map(([dx,dy])=>({x:center.x+dx!,y:center.y+dy!})).find(p=>holder.allowed.has(key(p.x,p.y)));
            if(!side)continue;
            const path=pathTo(holder,side.x,side.y);if(!path.length)continue;
            holder.path=path;holder.pause=0;this.sitting.set(holder.id,this.time+8);
            this.gateHolders.set(gate.id,{x:center.x,y:center.y,until:this.time+8});
        }
        for(const [id,until] of this.sitting){const dog=byId.get(id);if(!dog||until<this.time){this.sitting.delete(id);continue;}if(!dog.path.length)dog.pause=Math.max(dog.pause,.2);}
        // 8 Grass grows, faster near many animals; grazers nibble tall tufts.
        for(const tuft of this.grass){
            const crowd=residents.filter(a=>near(a,{x:tuft.x+.5,y:tuft.y+.5})<3).length;
            tuft.growth=Math.min(1,tuft.growth+dt/240*(1+.3*crowd));
            tuft.munched=Math.max(0,tuft.munched-dt);
            if(tuft.growth>.4)for(const a of residents)if(GRAZERS.includes(a.species)&&!a.path.length&&!a.sleeping&&a.mode==='roaming'&&near(a,{x:tuft.x+.5,y:tuft.y+.5})<.9){tuft.growth=0;tuft.munched=1.5;a.pause=Math.max(a.pause,1.5);break;}
        }
        // 9 Hens peck ordinary bugs in the patches they protect.
        const covered=new Set(chickenCoverage(world.entities,world.mapId).flatMap(c=>[...c.cells]));
        const patches=world.entities.filter(e=>e.blueprintId==='vegetable-patch'&&e.garden?.crop);
        for(const hen of residents.filter(a=>a.species==='chicken'&&!busy(a))){
            const active=this.pecks.find(p=>p.henId===hen.id);
            if(active)continue;
            if(!this.ready(`peck:${hen.id}`,22+this.random()*15))continue;
            const cells=patches.flatMap(footprintCells).filter(c=>covered.has(`${c.x}:${c.y}`)&&near(hen,{x:c.x+.5,y:c.y+.5})<5);
            const cell=cells[Math.floor(this.random()*cells.length)];
            const path=cell?pathTo(hen,cell.x,cell.y):[];
            if(path.length){hen.path=path;hen.pause=0;this.pecks.push({henId:hen.id,x:cell!.x+.5,y:cell!.y+.5,arrived:false,wait:20,age:0,bug:this.random()<.5?0:1});}
        }
        for(const peck of this.pecks){const hen=byId.get(peck.henId);if(!peck.arrived&&hen&&!hen.path.length&&near(hen,peck)<.8){peck.arrived=true;hen.pause=Math.max(hen.pause,1.8);}}
        // 11 Rabbits and cats hide in tall ripe plants (corn, pumpkin) with only their ears showing.
        const tall=patches.flatMap(p=>(p.garden?.slots??[]).map((slot,index)=>({slot,x:p.x+Math.floor(index/2)+.5,y:p.y+index%2+.5})))
            .filter(({slot})=>slot.crop&&['corn','pumpkin'].includes(slot.crop)&&!slot.withered&&slot.growth+world.growthSeconds>=GROW_SECONDS);
        for(const a of residents.filter(r=>(r.species==='rabbit'||CATS.includes(r.species))&&!busy(r)&&!r.path.length)){
            if(this.hides.some(h=>h.animalId===a.id)||!this.ready(`hide:${a.id}`,30+this.random()*20))continue;
            const spot=tall.filter(t=>near(t,a)<5&&!this.hides.some(h=>near(h,t)<.5)).sort((p,q)=>near(p,a)-near(q,a))[0];
            const path=spot?pathTo(a,spot.x,spot.y):[];
            if(path.length){a.path=path;a.pause=0;this.hides.push({animalId:a.id,x:spot!.x,y:spot!.y,arrived:false,wait:20,age:0,popped:0});}
        }
        for(const hide of this.hides){
            const a=byId.get(hide.animalId);if(!a)continue;
            if(!hide.arrived&&!a.path.length&&near(a,hide)<.8)hide.arrived=true;
            if(hide.arrived&&!hide.popped)a.pause=Math.max(a.pause,.3);
        }
        // 12 A capybara carries its fruit to a nearby friend.
        for(const capy of residents.filter(a=>a.species==='capybara'&&a.fruit&&a.fruitTime>0&&a.bumpAge===0&&!a.sleeping)){
            let friendId=this.sharing.get(capy.id);
            if(!friendId){
                const friend=residents.filter(a=>a!==capy&&['dairy-cow','highland-cow','sheep','rabbit','pig','capybara'].includes(a.species)&&!busy(a)&&near(a,capy)<6).sort((p,q)=>near(p,capy)-near(q,capy))[0];
                if(!friend||!this.ready(`share:${capy.id}`,40))continue;
                const path=pathTo(capy,friend.x,friend.y);if(!path.length)continue;
                capy.path=path;capy.pause=0;friendId=friend.id;this.sharing.set(capy.id,friendId);
            }
            const friend=byId.get(friendId);
            if(!friend){this.sharing.delete(capy.id);continue;}
            if(near(capy,friend)<1.4){friend.fruit=capy.fruit;friend.fruitTime=20;capy.fruit=null;capy.fruitTime=0;this.heart(capy.id,3);this.heart(friend.id,3);this.sharing.delete(capy.id);}
            else if(!capy.path.length&&this.ready(`share-chase:${capy.id}`,2)){const path=pathTo(capy,friend.x,friend.y);if(path.length)capy.path=path;else this.sharing.delete(capy.id);}
        }
        // 16 Autumn: sheep roll in leaf piles.
        for(const pile of this.leafPiles){
            pile.scattered=Math.max(0,pile.scattered-dt);
            for(const sheep of residents.filter(a=>a.species==='sheep'&&!busy(a)&&!a.path.length&&!this.shearing(a.id))){
                if(near(sheep,{x:pile.x+.5,y:pile.y+.5})<.8&&!pile.scattered){pile.scattered=25;sheep.pause=Math.max(sheep.pause,2.5);this.hops.set(sheep.id,this.time+2.5);this.heart(sheep.id,2.5);
                    for(let i=0;i<6;i++)this.leaves.push({x:pile.x+.5,y:pile.y+.5,age:0,spin:this.random()*Math.PI*2});}
                else if(!pile.scattered&&near(sheep,{x:pile.x+.5,y:pile.y+.5})<3&&this.ready(`leaf:${sheep.id}`,45)&&this.random()<.5){const path=pathTo(sheep,pile.x,pile.y);if(path.length){sheep.path=path;sheep.pause=0;}}
            }
        }
        // 16 Summer: ducks splash as they swim around bridges.
        if(world.weather.season==='summer')for(const duck of residents.filter(a=>(a.species==='duck'||a.species==='goose')&&a.path.length)){
            const habitat=animalHabitat(world.mapId),[x,y]=[Math.floor(duck.x),Math.floor(duck.y)];
            if(isAnimalWater(habitat.terrainAt(x,y))&&[[x,y],[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([p,q])=>bridges.has(`${p}:${q}`))&&this.ready(`splash:${duck.id}`,.6))this.splashes.push({x:duck.x,y:duck.y,age:0});
        }
        // 19 The owl keeps night watch beside a coop and hoots at ghosts that come close.
        if(night)for(const owl of residents.filter(a=>a.species==='white-owl'&&a.mode==='roaming'&&!a.flying)){
            const coop=world.entities.filter(e=>e.blueprintId==='coop').map(e=>{const f=entityFootprint(e);return {x:f.x+f.width/2,y:f.y+f.length/2};}).sort((p,q)=>near(p,owl)-near(q,owl))[0];
            if(coop&&!owl.path.length&&near(owl,coop)>2.2&&this.ready(`watch:${owl.id}`,6)){
                const spot=[...owl.allowed].map(k=>k.split(':').map(Number) as [number,number]).map(([x,y])=>({x:x+.5,y:y+.5})).filter(p=>near(p,coop)<2.6).sort((p,q)=>near(p,owl)-near(q,owl))[0];
                const path=spot?pathTo(owl,spot.x,spot.y):[];if(path.length){owl.path=path;owl.pause=0;}
            }
            if(coop&&!owl.path.length&&near(owl,coop)<2.8)owl.pause=Math.max(owl.pause,1);
            for(const ghost of world.ghosts??[])if(near(ghost,owl)<3.5&&this.ready(`hoot:${owl.id}`,8)){this.bubbles.push({x:owl.x,y:owl.y,text:'hoot',age:0});break;}
        }
        this.forage(residents,world,dt,night||raining);
        if(this.bushMap===world.mapId)for(const bush of this.previousBushes)if(!(world.bushes??[]).some(b=>b.x===bush.x&&b.y===bush.y&&b.since===bush.since)){
            const a=residents.find(a=>GRAZERS.includes(a.species)&&!busy(a)&&near(a,{x:bush.x+.5,y:bush.y+.5})<1.5);
            if(a){a.pause=Math.max(a.pause,1.5);this.nibbles.set(a.id,this.time+1.5);}
        }
        this.previousBushes=world.bushes??[];this.bushMap=world.mapId;
        this.age(dt);
    }
    /** One occasional trip per farmhouse, using the resident's actual reachable navigation cells. */
    private forage(residents:AnimalResident[],world:MomentWorld,dt:number,rest:boolean){
        const habitat=animalHabitat(world.mapId),hosts=world.entities.filter(e=>e.blueprintId==='farmhouse'&&animalSpecies(e)==='pig');
        const valid:MushroomTrip[]=[];
        for(const trip of this.mushroomTrips){
            const a=residents.find(a=>a.id===trip.animalId),host=hosts.find(h=>h.id===trip.hostId);
            if(!a||!host||host.x!==trip.hostX||host.y!==trip.hostY||busy(a)||rest||!a.allowed.has(key(trip.x,trip.y))||!a.allowed.has(key(trip.home.x,trip.home.y))){if(a){a.path=[];a.pause=0;}continue;}
            trip.wait-=dt;if(trip.wait<=0){a.path=[];a.pause=0;continue;}
            if(trip.phase==='outbound'&&!a.path.length&&near(a,trip)<.85){trip.phase='foraging';trip.age=0;}
            if(trip.phase==='foraging'){
                a.path=[];a.pause=Math.max(a.pause,.3);trip.age+=dt;
                if(trip.age>=4){const path=pathTo(a,trip.home.x,trip.home.y);if(!path.length)continue;a.path=path;a.pause=0;trip.phase='returning';trip.wait=60;}
            }else if(trip.phase==='returning'&&!a.path.length&&near(a,trip.home)<.85){
                this.mushrooms.push({x:a.x,y:a.y,age:0,variant:trip.variant});a.pause=Math.max(a.pause,2);
                for(const pig of residents)if(pig.species==='pig'&&near(pig,a)<3)this.heart(pig.id,3);
                continue;
            }
            valid.push(trip);
        }
        this.mushroomTrips=valid;
        if(rest)return;
        for(const host of hosts){
            const id=`forage:${world.mapId}:${host.id}`;
            if(!this.cooldown.has(id)){this.cooldown.set(id,this.time+150+this.random()*120);continue;}
            if(this.mushroomTrips.some(t=>t.hostId===host.id)||!this.ready(id,150+this.random()*120))continue;
            const pig=residents.find(a=>a.hostId===host.id&&a.species==='pig'&&!busy(a));if(!pig)continue;
            const treeEdges=new Set<string>();
            for(const tree of world.entities.filter(e=>e.blueprintId.includes('pine')||e.blueprintId.includes('broadleaf')||['lemon','apple','cherry'].includes(e.blueprintId))){const f=entityFootprint(tree);for(let x=f.x-1;x<=f.x+f.width;x++)for(let y=f.y-1;y<=f.y+f.length;y++)if(x===f.x-1||x===f.x+f.width||y===f.y-1||y===f.y+f.length)treeEdges.add(`${x}:${y}`);}
            const spots=[...pig.allowed].map(k=>{const [x,y]=k.split(':').map(Number);return {x:x!+.5,y:y!+.5};}).filter(p=>(p.x<0||p.y<0||p.x>=habitat.map.rows||p.y>=habitat.map.columns)&&habitat.trees.length>0||treeEdges.has(key(p.x,p.y))).sort((p,q)=>near(p,pig)-near(q,pig));
            const home=[...pig.allowed].map(k=>{const [x,y]=k.split(':').map(Number);return {x:x!+.5,y:y!+.5};}).sort((p,q)=>near(p,entityDoorPoint(host))-near(q,entityDoorPoint(host)))[0];
            if(!home)continue;
            for(const spot of spots){const path=pathTo(pig,spot.x,spot.y);if(!path.length)continue;
                pig.path=path;pig.pause=0;this.mushroomTrips.push({animalId:pig.id,hostId:host.id,hostX:host.x,hostY:host.y,phase:'outbound',...spot,home,age:0,wait:60,variant:this.random()<.5?0:1});break;}
        }
    }
    private age(dt:number){
        for(const m of this.mushrooms)m.age+=dt;this.mushrooms=this.mushrooms.filter(m=>m.age<60);
        for(const b of this.bubbles)b.age+=dt;this.bubbles=this.bubbles.filter(b=>b.age<1.4);
        for(const s of this.sparkles)s.age+=dt;this.sparkles=this.sparkles.filter(s=>s.age<.9);
        for(const l of this.leaves)l.age+=dt;this.leaves=this.leaves.filter(l=>l.age<1.6);
        for(const s of this.splashes)s.age+=dt;this.splashes=this.splashes.filter(s=>s.age<1);
        for(const p of this.pecks){if(!p.arrived){p.wait-=dt;continue;}p.age+=dt;if(p.age>=1.2&&p.age-dt<1.2)this.sparkles.push({x:p.x,y:p.y,age:0});}
        this.pecks=this.pecks.filter(p=>p.arrived?p.age<1.6:p.wait>0);
        for(const h of this.hides){if(!h.arrived){h.wait-=dt;continue;}h.age+=dt;if(h.popped)h.popped+=dt;else if(h.age>25)h.popped=1e-6;}
        this.hides=this.hides.filter(h=>h.arrived?h.popped<1:h.wait>0);
    }

    /** A tap on a hiding spot pops the animal out with a heart. Returns whether the tap was used. */
    tap(tile:Point,residents:readonly AnimalResident[]):boolean{
        const hide=this.hides.find(h=>h.arrived&&!h.popped&&key(h.x,h.y)===key(tile.x+.5,tile.y+.5));
        if(!hide)return false;
        hide.popped=1e-6;const a=residents.find(r=>r.id===hide.animalId);
        if(a){a.pause=0;this.heart(a.id,3);this.hops.set(a.id,this.time+.6);}
        return true;
    }

    /** Display copies: babies, fleece, huddles, hops, peeks and hearts. */
    decorate(samples:readonly AnimalResident[],world:MomentWorld):AnimalShow[]{
        const shows:AnimalShow[]=samples.map(a=>({...a}));
        const byId=new Map(shows.map(a=>[a.id,a]));
        const raining=world.weather.precipitation==='rain',winter=world.weather.season==='winter';
        const barns=new Map(world.entities.filter(e=>e.blueprintId==='farmhouse').map(e=>[e.id,e]));
        for(const a of shows){
            if((this.nibbles.get(a.id)??0)>this.time)a.lift=-Math.abs(Math.sin(this.time*10))*.04;
            const trip=this.mushroomTrips.find(t=>t.animalId===a.id);if(trip?.phase==='foraging')a.hidden=true;else if(trip?.phase==='returning')a.mushroom=trip.variant;
            const shear=this.shears.find(s=>s.animalId===a.id);if(shear?.phase==='inside')a.hidden=true;else if(shear?.phase==='walking')a.shears=true;
            if((this.hearts.get(a.id)??0)>this.time)a.heart=Math.max(a.heart,.5+.5*Math.sin((this.hearts.get(a.id)!-this.time)*4));
            const hop=this.hops.get(a.id)??0;if(hop>this.time)a.lift=Math.abs(Math.sin((hop-this.time)*Math.PI*2))*.25;
            if((this.flaps.get(a.id)??0)>this.time){a.flying=true;a.flightAge=0;}
            const peck=this.pecks.find(p=>p.henId===a.id&&p.arrived);if(peck)a.lift=-Math.abs(Math.sin(peck.age*12))*.06;
            const hide=this.hides.find(h=>h.animalId===a.id&&h.arrived&&!h.popped);if(hide){a.x=hide.x;a.y=hide.y+.1;a.peek=.32;a.path=[];}
            if(a.species==='sheep'){
                const barn=barns.get(a.hostId);
                // Keep old fleece through the trip inside; hold the shorn preview until the request resolves.
                const fleece=shear?shear.held:this.shearHolds.has(a.hostId)?'sheared':barn?fleeceLook(barnStock(barn.barn,world.now,barnProduct(barn))):undefined;
                // Fleece sheets are drawn at the plain sheep's height, so a fluffier sheep is scaled up.
                if(raining&&a.mode==='resting'){a.look=fleece==='fleece-full'?'huddle-full':fleece==='sheared'?'huddle-sheared':'huddle-medium';a.scale=fleece==='fleece-full'?1.12:1;}
                else if(fleece){a.look=fleece;a.scale=fleece==='fleece-full'?1.22:fleece==='fleece-medium'?1.1:1;}
            }
        }
        // 16 Winter: resting animals huddle closer to their family.
        if(winter){
            const groups=new Map<string,AnimalShow[]>();
            for(const a of shows)if(a.mode==='resting'&&a.housing==='open'){const g=groups.get(a.hostId)??[];g.push(a);groups.set(a.hostId,g);}
            for(const group of groups.values()){if(group.length<2)continue;const cx=group.reduce((s,a)=>s+a.x,0)/group.length,cy=group.reduce((s,a)=>s+a.y,0)/group.length;for(const a of group){a.x+=(cx-a.x)*.35;a.y+=(cy-a.y)*.35;}}
        }
        const hidden=new Set<string>();
        for(const a of shows){
            const host=world.entities.find(e=>e.id===a.hostId);if(!host||!shelterView(host)?.slots[a.species])continue;
            const slot=shelterSlot(host,a.species,a.ordinal),progress=this.havens.get(a.id)?.progress??0;
            if(!slot){a.housing='inside';if(progress>0)hidden.add(a.id);continue;}
            a.housing='open';if(progress<=0)continue;
            const eased=progress*progress*(3-2*progress);
            const door=a.mode==='resting'?entityDoorPoint(host):a;
            a.haven={host,progress,asleep:a.sleeping};a.x=door.x+(slot.x-door.x)*eased;a.y=door.y+(slot.y-door.y)*eased;
            // Behind a window only the top shows: rabbits sit up so their ears peek over the sill.
            a.sleeping=!slot.sit;a.path=[];a.pause=1;a.scale=1+(slot.scale-1)*eased;a.lift=0;a.peek=undefined;a.flying=false;a.perched=false;a.perchTree=null;a.perchProgress=0;
            a.direction='side';a.facing=slot.facing;
        }
        // 13 Ducks resting beside a floating garden nap on it.
        for(const raft of world.rafts.filter(r=>r.blueprintId==='floating-garden')){
            const b=LAKE_BLUEPRINTS.find(b=>b.id===raft.blueprintId)!,center={x:raft.x+b.width/2,y:raft.y+b.length/2};
            const nappers=shows.filter(a=>a.species==='duck'&&world.restingDucks?.has(a.id)&&near(a,center)<2.2).slice(0,2);
            nappers.forEach((a,i)=>{a.x=center.x+.15;a.y=center.y+(i?.55:-.55);a.sleeping=true;});
        }
        // 2/4/16 Babies follow a parent, or snuggle a resting gentle animal nearby.
        const frame=Math.min(.1,Math.max(0,this.time-this.decorated));this.decorated=this.time;
        for(const baby of this.babies){
            const parent=byId.get(baby.parentId);if(!parent)continue;
            // A fine breadcrumb trail; the parent's live position is its head, so the target glides every frame.
            const crumbs=this.crumbs.get(parent.id)??[];
            const last=crumbs[crumbs.length-1];if(!last||near(last,parent)>.02){crumbs.push({x:parent.x,y:parent.y});if(crumbs.length>160)crumbs.shift();this.crumbs.set(parent.id,crumbs);}
            const big=!parent.sleeping&&baby.look!=='lamb'?shows.find(b=>GENTLE.includes(b.species)&&b.sleeping&&b.mode==='roaming'&&near(b,parent)<3):undefined;
            let target:Point,sleeping=parent.sleeping,lift=0;
            // Resting at home, babies settle with their parent (inside the coop for birds).
            if(parent.mode==='resting'){target=parent.housing==='inside'?{x:parent.x,y:parent.y}:{x:parent.x+.1,y:parent.y+(baby.rank?.45:-.45)};sleeping=parent.sleeping;baby.snuggle=null;if(parent.housing==='inside'||near(baby,target)>.5){baby.x=target.x;baby.y=target.y;}}
            else if(big){target=big.species==='capybara'?{x:big.x-.05,y:big.y+(baby.rank?-.15:.12)}:{x:big.x+.1,y:big.y+(baby.rank?.62:-.62)};sleeping=true;lift=big.species==='capybara'?.32:0;if(baby.snuggle!==big.id){baby.snuggle=big.id;this.heart(big.id,2);}}
            else{
                baby.snuggle=null;
                const trail=[...crumbs,{x:parent.x,y:parent.y}];
                let distance=.5+.42*baby.rank,point:Point=trail[0]!,tangent:Point={x:0,y:parent.facing||1};
                for(let i=trail.length-1;i>0;i--){const step=near(trail[i]!,trail[i-1]!);if(distance<=step){const t=step?distance/step:0;point={x:trail[i]!.x+(trail[i-1]!.x-trail[i]!.x)*t,y:trail[i]!.y+(trail[i-1]!.y-trail[i]!.y)*t};if(step)tangent={x:(trail[i]!.x-trail[i-1]!.x)/step,y:(trail[i]!.y-trail[i-1]!.y)/step};distance=0;break;}distance-=step;}
                if(distance>0)point={x:parent.x+.15+.2*baby.rank,y:parent.y-(parent.facing||1)*(.45+.3*baby.rank)};
                // Swimming babies keep strictly to the parent's wake; on land they potter along a curvy path
                // around it (always the parent's general direction), never into water or blocked cells.
                const habitat=animalHabitat(parent.mapId),swimming=isAnimalWater(habitat.terrainAt(Math.floor(parent.x),Math.floor(parent.y)));
                if(!swimming){
                    const phase=hash(baby.id)*Math.PI*2,t=this.time,side=Math.sin(t*.9+phase)*.3+Math.sin(t*2.3+phase*1.7)*.1,along=Math.sin(t*.6+phase*.5)*.15;
                    for(let k=1;k>.1;k*=.5){
                        const candidate={x:point.x+(-tangent.y*side+tangent.x*along)*k,y:point.y+(tangent.x*side+tangent.y*along)*k};
                        const cell=key(candidate.x,candidate.y);
                        if(parent.allowed.has(cell)&&!isAnimalWater(habitat.terrainAt(Math.floor(candidate.x),Math.floor(candidate.y)))){point=candidate;break;}
                    }
                }
                target=point;
            }
            // Frame-rate independent: glide along with the parent, a little faster when catching up.
            const before={x:baby.x,y:baby.y},d=near(baby,target),reach=Math.max(.9,d*3)*frame;
            if(d>3){baby.x=target.x;baby.y=target.y;}else if(d>0){const t=Math.min(1,reach/d);baby.x+=(target.x-baby.x)*t;baby.y+=(target.y-baby.y)*t;}
            const mx=baby.x-before.x,my=baby.y-before.y;
            if(Math.hypot(mx,my)>.0005&&d<=3&&frame>0){
                const k=Math.min(1,frame*6);baby.vx=(baby.vx??0)+(mx/frame-(baby.vx??0))*k;baby.vy=(baby.vy??0)+(my/frame-(baby.vy??0))*k;
                const vx=baby.vx,vy=baby.vy,side=baby.direction==='side';
                // Hysteresis: only turn to a new axis once it clearly dominates.
                if(side?Math.abs(vx)>Math.abs(vy)*1.4:Math.abs(vx)>=Math.abs(vy)/1.4)baby.direction=vx>0?'front':'back';else baby.direction='side';
                if(Math.abs(vy)>.02)baby.facing=vy>0?1:-1;
                // Never backward: a reversal along the shown axis turns the sprite at once.
                if(baby.direction==='side'&&my*(baby.facing??1)<0&&Math.abs(my)>Math.abs(mx)*.3)baby.facing=my>0?1:-1;
                else if(baby.direction==='front'&&mx<0&&Math.abs(mx)>Math.abs(my)*.3)baby.direction='back';
                else if(baby.direction==='back'&&mx>0&&Math.abs(mx)>Math.abs(my)*.3)baby.direction='front';
                baby.moving=.25;}
            else baby.moving=Math.max(0,(baby.moving??0)-frame);
            const walking=!sleeping&&(baby.moving??0)>0;
            shows.push({...parent,id:baby.id,x:baby.x,y:baby.y,look:baby.look,scale:baby.look==='lamb'?.62:.5,lift,sleeping,heart:(this.hearts.get(baby.id)??0)>this.time?1:0,
                path:walking?[{x:target.x,y:target.y}]:[],pause:walking?0:1,fruit:null,fruitTime:0,flying:false,perched:false,
                direction:baby.direction??parent.direction,facing:baby.facing??parent.facing,peek:undefined});
            if(big)this.heart(baby.id,.1);
        }
        return shows.filter(a=>!hidden.has(a.id));
    }
}
