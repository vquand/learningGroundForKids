import {LAKE_BLUEPRINTS} from './water/catalog.ts';
import { CIV_SHOP_BLUEPRINTS, businessFor, freshCivHome } from './civCatalog.ts';
import {mapDefinition,mapPlacementError} from './maps/registry.ts';
import type {MapId} from './maps/types.ts';
import {allowedDirections,doorOutside,turnedSize,type Direction} from './direction.ts';
import {isHalloweenNight} from './halloweenCalendar.ts';
import {takeCrop,availableFishCount,spendFish} from './storage.ts';
import {animalHostChoices} from './animalHostRules.ts';
import {isSnowSculpture,isXmasOpen,xmasStartingYear,XMAS_EVENT_ID,XMAS_EDITION,type XmasSculptureId} from './events/xmas2026Model.ts';
export {isSnowSculpture,isXmasOpen,xmasStartingYear,XMAS_SCULPTURE_IDS,type XmasSculptureId} from './events/xmas2026Model.ts';
export {DIRECTIONS,allowedDirections,canRotate,nextDirection,type Direction} from './direction.ts';
export const TOWN_ADJECTIVES = ['Sunny', 'Cozy', 'Happy', 'Little', 'Gentle', 'Lovely', 'Sleepy', 'Golden', 'Blooming', 'Sparkly'] as const;
export const TOWN_NOUNS = ['Meadow', 'Haven', 'Valley', 'Grove', 'Village', 'Garden', 'Brook', 'Hollow', 'Hill', 'Nest'] as const;
export interface TownName { adjective: typeof TOWN_ADJECTIVES[number]; noun: typeof TOWN_NOUNS[number] }
export const DEFAULT_TOWN_NAME: TownName = { adjective:'Sunny', noun:'Meadow' };
export function townDisplayName(state: { townName?: TownName } | undefined): string { const name=state?.townName ?? DEFAULT_TOWN_NAME; return `${name.adjective} ${name.noun}`; }
export const TOWN_PETS = ['golden-retriever','shiba-inu','border-collie','samoyed','vietnamese-dog','british-shorthair','ragdoll','persian','scottish-straight','munchkin','parrot','white-owl','australian-cattle-dog'] as const;
export type TownPet = typeof TOWN_PETS[number];
export const TOWN_ANIMALS = ['dairy-cow','highland-cow','sheep','chicken','duck','goose','capybara','rabbit','pig',...TOWN_PETS] as const;
export type TownAnimal = typeof TOWN_ANIMALS[number];
export const ANIMAL_NAMES: Record<TownAnimal,string> = { 'dairy-cow':'Dairy Cow', 'highland-cow':'Highland Cow', sheep:'Sheep', chicken:'Chicken', duck:'Duck', goose:'Goose', capybara:'Capybara', rabbit:'Rabbit', pig:'Pig', 'golden-retriever':'Golden Retriever', 'shiba-inu':'Shiba Inu', 'border-collie':'Border Collie', samoyed:'Samoyed', 'vietnamese-dog':'Vietnamese village dog', 'british-shorthair':'British Shorthair', ragdoll:'Ragdoll', persian:'Persian', 'scottish-straight':'Scottish Straight', munchkin:'Munchkin', parrot:'Parrot', 'white-owl':'White Owl', 'australian-cattle-dog':'Australian Cattle Dog' };
export function petCapacity(blueprintId:string):number { return blueprintId==='house'?1:blueprintId==='large-house'?2:blueprintId==='town-hall'?3:0; }
export function animalChoices(blueprintId:string): readonly TownAnimal[] {
    return animalHostChoices(blueprintId) as readonly TownAnimal[];
}
export function animalSpecies(entity: { blueprintId:string; animal?:TownAnimal }): TownAnimal | undefined { const choices=animalChoices(entity.blueprintId); return entity.animal && choices.includes(entity.animal) ? entity.animal : choices[0]; }
export function animalCount(species:TownAnimal):number { return ['chicken','duck','goose','rabbit'].includes(species) ? 4 : 2; }
export function residentSpecies(entity:Entity):TownAnimal[] {
    const capacity=petCapacity(entity.blueprintId);
    if(capacity) return (entity.pets??[]).filter(pet=>TOWN_PETS.includes(pet)).slice(0,capacity);
    const species=animalSpecies(entity);return species?Array.from({length:animalCount(species)},()=>species):[];
}
export const MATERIALS = ['stamina', 'wood', 'rock', 'sand', 'metal'] as const;
export type Material = typeof MATERIALS[number];
export type Cost = Partial<Record<Material | 'wool' | 'yarn' | 'fish', number>>;
export type CropCost = Partial<Record<import('./garden.ts').CropId, number>>;
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export interface Blueprint {
    id: string;
    name: string;
    width: number;
    length: number;
    learned: number;
    cost: Cost;
    cropCost?: CropCost;
    kind: 'building' | 'tree' | 'road' | 'garden' | 'fence' | 'bridge' | 'decoration';
    /** False for blueprints made from something already placed (a farm gate is made from a fence). */
    palette?: false;
    art: number;
    /** Restricts the blueprint to these maps; absent means every map. */
    maps?: readonly MapId[];
}
export const XMAS_SCULPTURE_BLUEPRINTS: Blueprint[] = [
    { id:'snow-snowman', name:'Snowman', width:1, length:1, learned:0, cost:{stamina:5, wood:2}, cropCost:{carrot:1}, kind:'decoration', art:0 },
    { id:'snow-rabbit', name:'Snow rabbit', width:1, length:1, learned:0, cost:{stamina:5, wool:1}, cropCost:{tomato:1}, kind:'decoration', art:1 },
    { id:'snow-owl', name:'Snow owl', width:1, length:1, learned:0, cost:{stamina:5, wool:2}, kind:'decoration', art:2 },
    { id:'snow-penguin', name:'Snow penguin', width:1, length:1, learned:0, cost:{stamina:5, yarn:1, fish:1}, kind:'decoration', art:3 },
    { id:'snow-fox', name:'Snow fox', width:1, length:1, learned:0, cost:{stamina:5, yarn:1}, cropCost:{pumpkin:1}, kind:'decoration', art:4 },
    { id:'snow-lamb', name:'Snow lamb', width:1, length:1, learned:0, cost:{stamina:5, wool:2}, cropCost:{corn:1}, kind:'decoration', art:5 },
    { id:'snow-duckling', name:'Snow duckling', width:1, length:1, learned:0, cost:{stamina:5, wood:1}, cropCost:{peas:1}, kind:'decoration', art:6 },
    { id:'snow-bear', name:'Snow bear', width:1, length:1, learned:0, cost:{stamina:5, rock:3, yarn:1}, kind:'decoration', art:7 },
    { id:'snow-tree', name:'Snow tree', width:1, length:1, learned:0, cost:{stamina:5, wood:2, yarn:1}, kind:'decoration', art:8 },
    { id:'snow-angel', name:'Snow angel', width:1, length:1, learned:0, cost:{stamina:5, wool:1, yarn:1}, kind:'decoration', art:9 },
];
export const BLUEPRINTS: Blueprint[] = [
    { id: 'house', name: 'Normal house', width: 2, length: 3, learned: 0, cost: { stamina: 7, wood: 9, rock: 5 }, kind: 'building', art: 0 },
    { id: 'farmhouse', name: 'Farmhouse', width: 2, length: 4, learned: 0, cost: { stamina: 11, wood: 13, rock: 6 }, kind: 'building', art: 1 },
    { id: 'coop', name: 'Chicken coop', width: 2, length: 2, learned: 0, cost: { stamina: 4, wood: 6, rock: 2 }, kind: 'building', art: 2 },
    { id: 'animal-habitat', name: 'Animal haven', width: 2, length: 3, learned: 0, cost: { stamina: 8, wood: 10, rock: 4 }, kind: 'building', art: 8 },
    { id: 'lemon', name: 'Lemon tree', width: 2, length: 2, learned: 0, cost: { stamina: 4, wood: 2 }, kind: 'tree', art: 0 },
    { id: 'apple', name: 'Apple tree', width: 2, length: 2, learned: 4, cost: { stamina: 4, wood: 3 }, kind: 'tree', art: 1 },
    { id: 'large-house', name: 'Large house', width: 3, length: 4, learned: 7, cost: { stamina: 14, wood: 18, rock: 9, wool: 4 }, kind: 'building', art: 3 },
    { id: 'infirmary', name: 'Infirmary', width: 3, length: 3, learned: 14, cost: { stamina: 14, wood: 16, rock: 10, wool: 6 }, kind: 'building', art: 4 },
    { id: 'school', name: 'School', width: 3, length: 4, learned: 21, cost: { stamina: 18, wood: 21, rock: 14, sand: 8 }, kind: 'building', art: 5 },
    { id: 'town-hall', name: 'Town Hall', width: 4, length: 4, learned: 35, cost: { stamina: 25, wood: 28, rock: 21, metal: 5 }, kind: 'building', art: 6, maps: ['town'] },
    { id: 'cherry', name: 'Cherry blossom tree', width: 2, length: 2, learned: 53, cost: { stamina: 5, wood: 4 }, kind: 'tree', art: 2 },
    { id: 'library', name: 'Library', width: 3, length: 3, learned: 70, cost: { stamina: 21, wood: 25, rock: 18, sand: 10, wool: 8 }, kind: 'building', art: 7 },
    { id: 'dirt-road', name: 'Dirt road', width: 1, length: 1, learned: 0, cost: {}, kind: 'road', art: 0 },
    { id: 'rocky-road', name: 'Rocky road', width: 1, length: 1, learned: 0, cost: { rock: 1 }, kind: 'road', art: 1 },
    { id:'town-storage', name:'Town Storage', width:2, length:2, learned:0, cost:{stamina:6, wood:16, rock:8, sand:2}, kind:'building', art:0 },
    { id:'vegetable-patch', name:'Vegetable patch', width:2, length:2, learned:0, cost:{wood:4}, kind:'garden', art:0 },
    { id:'wooden-fence', name:'Wooden fence', width:1, length:1, learned:0, cost:{wood:1}, kind:'fence', art:0 },
    { id:'farm-gate', name:'Farm gate', width:1, length:1, learned:0, cost:{wood:3}, kind:'fence', art:1, palette:false },
    { id:'wood-bridge', name:'Wood bridge', width:1, length:1, learned:0, cost:{wood:2}, kind:'bridge', art:0 },
    { id:'stone-bridge', name:'Stone bridge', width:1, length:1, learned:0, cost:{rock:2}, kind:'bridge', art:1 },
    { id:'halloween-lantern', name:'Halloween lantern', width:1, length:1, learned:0, cost:{wood:1}, cropCost:{pumpkin:1}, kind:'decoration', art:0 },
    ...CIV_SHOP_BLUEPRINTS,
    ...XMAS_SCULPTURE_BLUEPRINTS,
];
export interface Entity {
    /** Seasonal construction occurrence; legacy Halloween lanterns belong to 2026. */
    eventYear?:number;
    poultry?:import('./poultry.ts').CoopEggs;
    /** Farmhouse milk/wool/yarn production (see barn.ts). */
    barn?:import('./barn.ts').BarnStock;
    /** Legacy save field. A map's entity list defines membership; never read this. */
    mapId?:MapId;
    civ?: import('./civCatalog.ts').CivHome;
    garden?: import('./garden.js').GardenPatch;
    pets?: TownPet[];
    animal?: TownAnimal;
    /** Facing; absent means `front`, the original artwork, so older saves are unchanged. */
    direction?: Direction | undefined;
    id: string;
    blueprintId: string;
    x: number;
    y: number;
    paidCost: Cost;
    paidCropCost?: CropCost;
}
export interface TownState {
    /** Bounded server-owned harvest retry ledger, never returned on reads. */
    shopReceipts?:import('./shopTypes.ts').SavedShopReceipt[];
    harvestReceipts?:import('./harvestTypes.ts').SavedHarvestReceipt[];
    poultry?:import('./poultry.ts').PoultryState;
    /** Crops, milk and fish dates shared by every map (see storage.ts). */
    droppings?:import('./animalHabits.ts').Dropping[];
    bushes?:import('./animalHabits.ts').FlowerBush[];
    storage?:import('./storage.ts').TownStorage;
    woolMigrated?:boolean;
    storageBuildingCount?:number;
    storageRemovalReceipt?:import('./storage.ts').StorageRemovalReceipt;
    maps?:{lake?:import('./maps/lake/types.ts').LakeState};
    /** Water structures on the Town map (the Lake keeps its own under maps.lake). */
    rafts?:import('./maps/lake/types.ts').LakeRaft[];
    halloween?: import('./halloween.ts').HalloweenState;
    events?: Record<string, import('./events/runtime.ts').TimedEventRecord>;
    eventHistory?: Record<string, Record<string, import('./events/runtime.ts').EventHistory>>;
    civ?: import('./civCatalog.ts').CivState;
    gardening?: import('./garden.js').GardeningState;
    starterHomeGranted?: boolean;
    townName?: TownName;
    revision: number;
    materials: Record<Material, number>;
    entities: Entity[];
    learnedIds: string[];
    earned: Record<string, string>;
}
export type TownCommand = {type:'harvest-eggs';entityId:string;generation:number} | {type:'collect-barn';entityId:string;generation:number} | {type:'feed-animals';entityId:string} | {type:'help-neighbor';entityId:string;step:number} | { type:'wrap-fence'; entityId:string } | { type:'plant'; entityId:string; generation:number; crop:import('./garden.js').CropId } | { type:'harvest'; entityId:string; generation:number } | { type:'set-pets'; entityId:string; pets:TownPet[] } | { type:'rename'; adjective:TownName['adjective']; noun:TownName['noun'] } | { type:'set-animal'; entityId:string; animal:TownAnimal } | {
    type: 'build';
    blueprintId: string;
    x: number;
    y: number;
    direction?: Direction | undefined;
} | {
    type: 'move';
    entityId: string;
    x: number;
    y: number;
    direction?: Direction | undefined;
} | {
    type: 'remove';
    entityId: string;
    confirmLoss?:boolean|undefined;
    lossConfirmation?:string|undefined;
} | {
    type: 'remove-line';
    entityId: string;
} | {
    type: 'make-gate';
    entityId: string;
} | {
    type: 'build-line';
    blueprintId: string;
    tiles: { x: number; y: number }[];
};
/** Roads, fences and later bridges: drawn by gliding across tiles and removed tile by tile or as a whole connected line. */
export const isLineBlueprint=(b:{kind:string}|undefined)=>b?.kind==='road'||b?.kind==='fence'||b?.kind==='bridge';
const kindOf=(e:Pick<Entity,'blueprintId'>)=>BLUEPRINTS.find(b=>b.id===e.blueprintId)?.kind;
export const isBridge=(e:Pick<Entity,'blueprintId'>)=>kindOf(e)==='bridge';
/** A farm gate stays part of its fence line; everything else joins only its own blueprint. */
const lineFamily=(id:string)=>id==='farm-gate'?'wooden-fence':id;
/** People, animals and vehicles cross roads, bridges and farm gates (a gate carries a dirt road). */
export const isPassable=(e:Pick<Entity,'blueprintId'>)=>kindOf(e)==='road'||kindOf(e)==='bridge'||e.blueprintId==='farm-gate';
/** Tiles that count as road for vehicles and road joins: roads, bridges and the dirt road under a gate. */
export const isRoadLike=isPassable;
const NEST_ON_BRIDGE='Move the insect nest off this bridge first.';
/** An insect nest (shore insect raiser) standing on this bridge tile. */
const nestOn=(state:Pick<TownState,'rafts'>,e:Entity)=>isBridge(e)&&(state.rafts??[]).some(r=>r.blueprintId==='insect-raiser'&&r.x===e.x&&r.y===e.y);
const lanternOn=(state:Pick<TownState,'entities'>,e:Entity)=>isBridge(e)&&state.entities.some(r=>r.blueprintId==='halloween-lantern'&&r.x===e.x&&r.y===e.y);
const sculptureOn=(state:Pick<TownState,'entities'>,e:Entity)=>isBridge(e)&&state.entities.some(r=>isSnowSculpture(r.blueprintId)&&r.x===e.x&&r.y===e.y);
const LANTERN_ON_BRIDGE='Move the lantern off this bridge first.';
const SCULPTURE_ON_BRIDGE='Move the snow sculpture off this bridge first.';
export const bridgeSupportError=(state:Pick<TownState,'entities'|'rafts'>,e:Entity):string|null=>nestOn(state,e)?NEST_ON_BRIDGE:lanternOn(state,e)?LANTERN_ON_BRIDGE:sculptureOn(state,e)?SCULPTURE_ON_BRIDGE:null;
const BRIDGE_ANCHOR_ERROR='Connect your bridge to land on at least one side.';
/** On construction every bridge piece touched must belong to a bridge that reaches land on a side. */
export function bridgeAnchorError(entities:readonly Entity[],mapId:MapId,tiles:readonly {x:number;y:number}[]):string|null {
    const map=mapDefinition(mapId),bridges=new Map(entities.filter(isBridge).map(e=>[`${e.x}:${e.y}`,e]));
    const land=(x:number,y:number)=>x>=0&&y>=0&&x<map.rows&&y<map.columns&&map.terrainAt(x,y)==='grass';
    const seen=new Set<string>();
    for(const tile of tiles){
        const start=`${tile.x}:${tile.y}`;if(seen.has(start)||!bridges.has(start))continue;
        let anchored=false;const queue=[tile];seen.add(start);
        while(queue.length){const {x,y}=queue.pop()!;
            for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]] as const){const k=`${nx}:${ny}`;
                if(bridges.has(k)){if(!seen.has(k)){seen.add(k);queue.push({x:nx,y:ny});}}else if(land(nx,ny))anchored=true;}}
        if(!anchored)return BRIDGE_ANCHOR_ERROR;
    }
    return null;
}
/** A fence can become a farm gate only in the middle of a straight line: fence on both opposite sides. */
export function gateAxis(entities:readonly Entity[],fence:Pick<Entity,'x'|'y'>):'across'|'along'|null {
    const fenced=(x:number,y:number)=>entities.some(e=>e.x===x&&e.y===y&&lineFamily(e.blueprintId)==='wooden-fence');
    if(fenced(fence.x,fence.y-1)&&fenced(fence.x,fence.y+1))return 'across';
    if(fenced(fence.x-1,fence.y)&&fenced(fence.x+1,fence.y))return 'along';
    return null;
}
export const MAX_LINE_TILES=200;
export const emptyTown = (): TownState => ({ townName: { ...DEFAULT_TOWN_NAME }, revision: 0, materials: { stamina: 0, wood: 0, rock: 0, sand: 0, metal: 0 }, entities: [], learnedIds: [], earned: {} });
/** One-time server-owned grant. Existing residences satisfy it; demolition never repeats it. */
export function ensureStarterHome(state:TownState):TownState {
    if(state.starterHomeGranted) return state;
    const next=structuredClone(state);
    if(!next.entities.some(entity=>petCapacity(entity.blueprintId)>0)) {
        const house=BLUEPRINTS.find(b=>b.id==='house')!;
        let placed=false;
        for(let x=6;x<20&&!placed;x++) for(let y=20;y<40&&!placed;y++) {
            if(!placementError(next.entities,'town',house,x,y)) {next.entities.push({id:'starter-home',blueprintId:'house',x,y,paidCost:{},pets:[]});placed=true;}
        }
        if(!placed) for(let x=0;x<20&&!placed;x++) for(let y=0;y<40&&!placed;y++) {
            if(!placementError(next.entities,'town',house,x,y)) {next.entities.push({id:'starter-home',blueprintId:'house',x,y,paidCost:{},pets:[]});placed=true;}
        }
        if(!placed) return state; // A full legacy map can retry after a plot becomes available.
    }
    next.starterHomeGranted=true;next.revision++;return next;
}
export function initialTown():TownState {return {...ensureStarterHome(emptyTown()),revision:0};}
/** Logical 20×40; renderer maps length horizontally. 120 river + 40 mountain tiles. */
export function terrainAt(x: number, y: number): 'grass' | 'river' | 'mountain' {
    return mapDefinition('town').terrainAt(x,y) as 'grass'|'river'|'mountain';
}
export function movementCost(cost: Cost): Cost { return Object.fromEntries(Object.entries(cost).map(([key, n]) => [key, Math.ceil(n / 2)])); }
export function movementCropCost(cost:CropCost={}):CropCost {return Object.fromEntries(Object.entries(cost).map(([key,n])=>[key,Math.ceil(n/2)]));}
export const blueprintEventError=(blueprintId:string,localDate?:string,allowPreview=false):string|null=>{
    if(blueprintId==='halloween-lantern'&&!isHalloweenNight(localDate)&&!allowPreview)return 'Halloween lanterns are only available on October 30–31.';
    if(isSnowSculpture(blueprintId)&&!isXmasOpen(localDate)&&!allowPreview)return 'Snow sculptures are only available from December 20 to January 6.';
    return null;
};
/** A lantern's occurrence year. Built in an admin preview after Halloween, it belongs to next year's event so it is not put away at once. */
export function lanternEventYear(localDate?:string):number {
    const year=Number(localDate?.slice(0,4)),month=Number(localDate?.slice(5,7));
    return localDate&&!isHalloweenNight(localDate)&&month>=11?year+1:year;
}
/** Only valid civil dates after the saved occurrence may expire a construction. */
export function eventBuildingExpired(entity:Entity,localDate:string):boolean {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(localDate))return false;
    const date=new Date(`${localDate}T00:00:00Z`),year=entity.eventYear??2026;
    if(!Number.isInteger(year)||year<1||year>9999||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==localDate)return false;
    if(entity.blueprintId==='halloween-lantern') {
        return localDate>=`${String(year).padStart(4,'0')}-11-01`;
    }
    if(isSnowSculpture(entity.blueprintId)) {
        return localDate>=`${String(year+1).padStart(4,'0')}-01-07`;
    }
    return false;
}
/** Seasonal constructions expire on the trusted home calendar, independently of event rewards. */
export function expireEventBuildings(state:TownState,localDate:string):void {
    const kept=state.entities.filter(e=>!eventBuildingExpired(e,localDate));
    if(kept.length!==state.entities.length){state.entities=kept;state.revision++;}
}
export function cropCostError(state:Pick<TownState,'storage'>,cost:CropCost={}):string|null {
    if(cost.pumpkin&&(state.storage?.crops.pumpkin??0)<cost.pumpkin)return 'Harvest the missing pumpkins first.';
    return Object.entries(cost).some(([crop,count])=>(state.storage?.crops[crop as keyof CropCost]??0)<count)?'Harvest the missing crops first.':null;
}
export function spendCrops(state:TownState,cost:CropCost={}):void {
    const error=cropCostError(state,cost);if(error)throw new Error(error);
    for(const [crop,count] of Object.entries(cost))for(let i=0;i<count;i++)takeCrop(state,crop as keyof CropCost);
}
export function shortages(materials: Record<Material, number> & {wool?:number; yarn?:number; fish?:number}, cost: Cost): Cost {
    return Object.fromEntries(([...MATERIALS,'wool','yarn','fish'] as const).filter(key => (materials[key]??0) < (cost[key] ?? 0)).map(key => [key, (cost[key] ?? 0) - (materials[key]??0)]));
}
export function countInstalledSnowSculptures(state:TownState):number {
    const townCount=state.entities.filter(e=>isSnowSculpture(e.blueprintId)).length;
    const lakeCount=(state.maps?.lake?.land.entities??[]).filter(e=>isSnowSculpture(e.blueprintId)).length;
    return townCount+lakeCount;
}
export interface XmasEventHistoryRecord {
    edition:string;total:number;byType:Record<string,number>;builtTypes:string[];maxSimultaneous:number;receipts:string[];counters:Record<string,{count:number;receipts:string[]}>;
}
/** Raises the per-event "installed at once" record from the ROOT state (Town and Lake together) and awards Winter Wonderland. */
export function refreshXmasSimultaneous(root:TownState,occurrence:string,now:number):void {
    const history=root.eventHistory?.[XMAS_EVENT_ID]?.[occurrence] as XmasEventHistoryRecord|undefined;if(!history)return;
    history.maxSimultaneous=Math.max(history.maxSimultaneous??0,countInstalledSnowSculptures(root));
    const earned=(root.earned??={});
    if(history.maxSimultaneous>=20&&!earned['xmas-2026-winter-wonderland'])earned['xmas-2026-winter-wonderland']=new Date(now).toISOString();
}
/** `mapId` is the map of `state`: a Lake action sees only a Lake land view, so the all-map "at once" count is refreshed from the root afterwards. */
export function recordXmasSculptureBuilt(state:TownState,blueprintId:XmasSculptureId,entityId:string,occurrence:string,now:number,mapId:MapId='town'):void {
    state.events??={};state.events[XMAS_EVENT_ID]={occurrence,edition:XMAS_EDITION,data:{year:occurrence}};
    state.eventHistory??={};state.eventHistory[XMAS_EVENT_ID]??={};
    const history=(state.eventHistory[XMAS_EVENT_ID][occurrence]??={edition:XMAS_EDITION,total:0,byType:{},builtTypes:[],maxSimultaneous:0,receipts:[],counters:{}}) as XmasEventHistoryRecord;
    const receipt=`xmas:${occurrence}:${entityId}`;
    if(history.receipts.includes(receipt))return;
    history.receipts.push(receipt);
    history.total=(history.total??0)+1;
    history.byType??={};history.byType[blueprintId]=(history.byType[blueprintId]??0)+1;
    history.builtTypes??=[];if(!history.builtTypes.includes(blueprintId))history.builtTypes.push(blueprintId);
    if(mapId==='town')history.maxSimultaneous=Math.max(history.maxSimultaneous??0,countInstalledSnowSculptures(state));
    const sc=(history.counters['sculptures-built']??={count:0,receipts:[]});sc.count=history.total;if(!sc.receipts.includes(receipt))sc.receipts.push(receipt);
    const tc=(history.counters[blueprintId]??={count:0,receipts:[]});tc.count=history.byType[blueprintId]!;if(!tc.receipts.includes(receipt))tc.receipts.push(receipt);
    const earned=(state.earned??={}),ts=new Date(now).toISOString();
    if(history.total>=1&&!earned['xmas-2026-snowy-friends'])earned['xmas-2026-snowy-friends']=ts;
    if(history.builtTypes.length>=10&&!earned['xmas-2026-snow-parade'])earned['xmas-2026-snow-parade']=ts;
    if(history.maxSimultaneous>=20&&!earned['xmas-2026-winter-wonderland'])earned['xmas-2026-winter-wonderland']=ts;
    if((history.byType['snow-snowman']??0)>=20&&!earned['xmas-2026-snowman-army'])earned['xmas-2026-snowman-army']=ts;
    if((history.byType['snow-rabbit']??0)>=15&&!earned['xmas-2026-rabbit-warren'])earned['xmas-2026-rabbit-warren']=ts;
    if((history.byType['snow-owl']??0)>=12&&!earned['xmas-2026-owl-parliament'])earned['xmas-2026-owl-parliament']=ts;
    if((history.byType['snow-penguin']??0)>=10&&!earned['xmas-2026-penguin-colony'])earned['xmas-2026-penguin-colony']=ts;
}
/** Land placement on one map: terrain, reserved tiles, buildings and, when given, that map's water structures. */
/** A land building's habitat: grass only. */
const LAND_HABITAT={depths:['grass']} as const;
const WATER_HABITAT={depths:['shallow','deep']} as const;
type TileFootprintOf=Pick<import('./maps/lake/types.ts').LakeRaft,'blueprintId'|'x'|'y'>;
export function placementError(entities: readonly Entity[], mapId: MapId, blueprint: Blueprint, x: number, y: number, ignoreId?: string, rafts: readonly TileFootprintOf[] = [], direction: Direction = 'front'): string | null {
    const b={...blueprint,...turnedSize(blueprint,direction)};
    // Bridges span river or lake water; everything else stands on dry land.
    const onBridge=(blueprint.id==='halloween-lantern'||isSnowSculpture(blueprint.id))&&entities.some(e=>e.id!==ignoreId&&isBridge(e)&&e.x===x&&e.y===y);
    const terrainError=mapPlacementError(mapDefinition(mapId),b,x,y,blueprint.kind==='bridge'||onBridge?WATER_HABITAT:LAND_HABITAT);
    if(terrainError)return terrainError;
    const overlaps=(other:{x:number;y:number;width:number;length:number})=>x<other.x+other.width&&x+b.width>other.x&&y<other.y+other.length&&y+b.length>other.y;
    const occupied=entities.some(e=>e.id!==ignoreId&&!(onBridge&&isBridge(e))&&overlaps(entityFootprint(e)))
        ||rafts.some(r=>overlaps({...r,...LAKE_BLUEPRINTS.find(v=>v.id===r.blueprintId)!}));
    if(occupied)return 'That space is occupied. Choose an open patch.';
    return null;
}
/** The tiles an entity covers, turned by its facing. */
export function entityFootprint(entity:Pick<Entity,'blueprintId'|'x'|'y'|'direction'>):{x:number;y:number;width:number;length:number} {
    const b=BLUEPRINTS.find(v=>v.id===entity.blueprintId)!;
    return {x:entity.x,y:entity.y,...turnedSize(b,entity.direction??'front')};
}
/** The tile just outside the entity's door: where people and animals come and go. */
export function entityDoor(entity:Pick<Entity,'blueprintId'|'x'|'y'|'direction'>):{x:number;y:number} {
    return doorOutside(entity.x,entity.y,BLUEPRINTS.find(v=>v.id===entity.blueprintId)!,entity.direction??'front');
}
/** Where residents gather at the door: the tile outside it, centred along its wall. */
export function entityDoorPoint(entity:Pick<Entity,'blueprintId'|'x'|'y'|'direction'>):{x:number;y:number} {
    const f=entityFootprint(entity),direction=entity.direction??'front';
    return direction==='left'?{x:f.x+f.width/2,y:f.y-1}:direction==='right'?{x:f.x+f.width/2,y:f.y+f.length}:direction==='back'?{x:f.x-1,y:f.y+f.length/2}:{x:f.x+f.width,y:f.y+f.length/2};
}
/** Validates a requested facing against what the blueprint can do. */
export function requireDirection(blueprintId:string,direction:Direction|undefined,fallback:Direction='front'):Direction {
    const facing=direction??fallback;
    if(!allowedDirections(blueprintId).includes(facing))throw new Error('This building cannot face that way.');
    return facing;
}
export function fenceRing(patch:Entity):{x:number;y:number}[] {
    const b=BLUEPRINTS.find(b=>b.id===patch.blueprintId);
    if(b?.kind!=='garden')throw new Error('Select a vegetable patch.');
    const tiles=[];
    for(let x=patch.x-1;x<=patch.x+b.width;x++)for(let y=patch.y-1;y<=patch.y+b.length;y++)
        if(x===patch.x-1||x===patch.x+b.width||y===patch.y-1||y===patch.y+b.length)tiles.push({x,y});
    return tiles;
}
export function planPatchFence(state:Pick<TownState,'entities'|'materials'|'rafts'>,patch:Entity,mapId:MapId) {
    const b=BLUEPRINTS.find(b=>b.id==='wooden-fence')!;
    const tiles=fenceRing(patch).filter(tile=>!state.entities.some(e=>e.blueprintId===b.id&&e.x===tile.x&&e.y===tile.y));
    const blocked=tiles.map(tile=>placementError(state.entities,mapId,b,tile.x,tile.y,undefined,state.rafts)).find(Boolean);
    return {tiles,wood:tiles.length,error:blocked??(state.materials.wood<tiles.length?'Collect the missing wood first.':null)};
}
export function wrapPatchFence(state:TownState,mapId:MapId,entityId:string,id:string):void {
    const patch=state.entities.find(e=>e.id===entityId);
    if(!patch)throw new Error('This patch is no longer here.');
    const plan=planPatchFence(state,patch,mapId);
    if(plan.error)throw new Error(plan.error);
    state.materials.wood-=plan.wood;
    for(const [index,tile]of plan.tiles.entries())state.entities.push({id:`${id}:${index}`,blueprintId:'wooden-fence',...tile,paidCost:{wood:1}});
}

export const TOWN_BADGES = [
    { id: 'town-first-home', name: 'First Home', description: 'Construct a normal house.', difficulty: 'easy' as const },
    { id: 'town-farm-friends', name: 'Farm Friends', description: 'Own a farmhouse and chicken coop.', difficulty: 'medium' as const },
    { id: 'town-lemon-lane', name: 'Lemon Lane', description: 'Own three lemon trees.', difficulty: 'easy' as const },
    { id: 'town-little-village', name: 'Little Village', description: 'Own ten buildings, excluding trees and roads.', difficulty: 'medium' as const },
    { id: 'town-founder', name: 'Town Founder', description: 'Construct an unlocked Town Hall.', difficulty: 'hard' as const },
    {id:'town-first-harvest',name:'First Harvest',description:'Manually harvest your first ripe vegetable.',difficulty:'easy' as const},
    {id:'town-garden-basket',name:'Garden Basket',description:'Manually harvest 20 ripe vegetables.',difficulty:'medium' as const},
    {id:'town-new-neighbor',name:'New Neighbor',description:'Welcome the first shop owner to town.',difficulty:'easy' as const},
    {id:'town-helping-hand',name:'Helping Hand',description:'Help neighbors at three different kinds of shop.',difficulty:'medium' as const},
    {id:'town-lively-street',name:'Lively Street',description:'Welcome owners to all seven kinds of shop.',difficulty:'hard' as const},
];
/** Cardinal connectivity stops at gaps and other road types, including at junctions. */
export function connectedLineIds(entities: readonly Entity[], entityId: string): Set<string> {
    const start = entities.find(e => e.id === entityId);
    if (!start || !isLineBlueprint(BLUEPRINTS.find(b => b.id === start.blueprintId))) return new Set();
    const tiles = new Map(entities.filter(e => lineFamily(e.blueprintId) === lineFamily(start.blueprintId)).map(e => [`${e.x}:${e.y}`, e]));
    const visited = new Set<string>();
    const pending = [start];
    for (let index = 0; index < pending.length; index++) {
        const tile = pending[index]!;
        if (visited.has(tile.id)) continue;
        visited.add(tile.id);
        for (const [x, y] of [[tile.x - 1, tile.y], [tile.x + 1, tile.y], [tile.x, tile.y - 1], [tile.x, tile.y + 1]]) {
            const neighbor = tiles.get(`${x}:${y}`);
            if (neighbor && !visited.has(neighbor.id)) pending.push(neighbor);
        }
    }
    return visited;
}
/** Land commands against one map's view (`state` is that map's landView). */
export function applyTownCommand(state: TownState, mapId: MapId, command: TownCommand, id: string, now: number, localDate?:string, allowPreview=false): TownState {
    const next = structuredClone(state);
    if (command.type === 'rename') {
        if (!TOWN_ADJECTIVES.includes(command.adjective) || !TOWN_NOUNS.includes(command.noun)) throw new Error('Choose a town name from the lists.');
        if (townDisplayName(state) === `${command.adjective} ${command.noun}`) return state;
        next.townName = { adjective:command.adjective, noun:command.noun };
    }
    else if (command.type === 'set-pets') {
        const host=next.entities.find(entity=>entity.id===command.entityId);
        if(!host) throw new Error('This pet home is no longer here.');
        const capacity=petCapacity(host.blueprintId);
        if(!capacity || !Array.isArray(command.pets) || command.pets.length>capacity || command.pets.some(pet=>!TOWN_PETS.includes(pet))) throw new Error('Choose pets from the menu within this home’s pet limit.');
        if(JSON.stringify(host.pets??[])===JSON.stringify(command.pets)) return state;
        host.pets=[...command.pets];
    }
    else if (command.type === 'set-animal') {
        const host = next.entities.find(entity => entity.id === command.entityId);
        if (!host) throw new Error('This animal home is no longer here.');
        if (!animalChoices(host.blueprintId).includes(command.animal)) throw new Error('That animal cannot live in this building.');
        if (animalSpecies(host) === command.animal) return state;
        if((host.barn?.stock??0)>0)throw new Error('Collect their products before changing these animals.');
        host.animal = command.animal;
    }
    else if(command.type==='wrap-fence') {
        wrapPatchFence(next,mapId,command.entityId,id);
    }
    else if(command.type==='help-neighbor') {
        throw new Error('Neighbor help requires the live town clock.');
    }
    else if(command.type==='plant'||command.type==='harvest'||command.type==='harvest-eggs'||command.type==='collect-barn'||command.type==='feed-animals') {
        throw new Error('Garden actions require the live home calendar.');
    }
    else if (command.type === 'build-line') {
        throw new Error('Lines are built through a map.');
    }
    else if (command.type === 'remove-line') {
        const connected = connectedLineIds(next.entities, command.entityId);
        if (!connected.size) throw new Error('Select a road, fence or bridge that is still on your map.');
        for(const e of next.entities)if(connected.has(e.id)){const error=bridgeSupportError(next,e);if(error)throw new Error(error);}
        next.entities = next.entities.filter(e => !connected.has(e.id));
    }
    else if (command.type === 'make-gate') {
        const fence = next.entities.find(e => e.id === command.entityId);
        if (fence?.blueprintId !== 'wooden-fence') throw new Error('Select a wooden fence.');
        if (!gateAxis(next.entities, fence)) throw new Error('A farm gate needs fence on both sides in a straight line.');
        const cost = BLUEPRINTS.find(b => b.id === 'farm-gate')!.cost;
        if (Object.keys(shortages({...next.materials,wool:next.storage?.wool??0}, cost)).length) throw new Error('Collect the missing materials first.');
        for (const key of MATERIALS) next.materials[key] -= cost[key] ?? 0;
        fence.blueprintId = 'farm-gate';
        for (const key of MATERIALS) if (cost[key]) fence.paidCost[key] = (fence.paidCost[key] ?? 0) + cost[key]!;
    }
    else if (command.type === 'remove') {
        if((next.entities.find(e=>e.id===command.entityId)?.poultry?.eggs??0)>0)throw new Error('Harvest the eggs before removing this coop.');
        if((next.entities.find(e=>e.id===command.entityId)?.barn?.stock??0)>0)throw new Error('Collect the milk, wool or yarn before removing this farmhouse.');
        const removing=next.entities.find(e=>e.id===command.entityId),supportError=removing&&bridgeSupportError(next,removing);if(supportError)throw new Error(supportError);
        if (!next.entities.some(e => e.id === command.entityId))
            throw new Error('This building is no longer here.');
        next.entities = next.entities.filter(e => e.id !== command.entityId);
    }
    else {
        const entity = command.type === 'move' ? next.entities.find(e => e.id === command.entityId) : undefined;
        if (command.type === 'move' && !entity)
            throw new Error('This building is no longer here.');
        const b = BLUEPRINTS.find(v => v.id === (command.type === 'build' ? command.blueprintId : entity!.blueprintId));
        if (!b)
            throw new Error('Unknown blueprint.');
        if (command.type === 'build' && b.palette === false)
            throw new Error('Make a farm gate from a fence in the middle of a straight fence line.');
        const supportError=entity&&bridgeSupportError(next,entity);if(supportError)throw new Error(supportError);
        const eventError=blueprintEventError(b.id,localDate,allowPreview);if(eventError)throw new Error(eventError);
        if (next.learnedIds.length < b.learned)
            throw new Error(`Learn ${b.learned} different items to unlock ${b.name}.`);
        const direction = requireDirection(b.id, command.direction, entity?.direction ?? 'front');
        if (entity && entity.x === command.x && entity.y === command.y && (entity.direction ?? 'front') === direction)
            return state;
        let replacing: Entity | undefined;
        if (command.type === 'build' && isLineBlueprint(b)) {
            replacing = next.entities.find(e => e.x === command.x && e.y === command.y && BLUEPRINTS.find(v => v.id === e.blueprintId)?.kind === b.kind);
            if (replacing?.blueprintId === b.id)
                return state;
        }
        if (command.type === 'build' && isSnowSculpture(b.id) && mapId === 'town' && countInstalledSnowSculptures(next) >= 100)
            throw new Error('Cap of 100 snow sculptures reached.');
        const error = placementError(next.entities,mapId, b, command.x, command.y, entity?.id ?? replacing?.id,next.rafts,direction);
        if (error)
            throw new Error(error);
        const cost = entity ? movementCost(entity.paidCost) : b.cost;
        const cropCost=entity?movementCropCost(entity.paidCropCost):b.cropCost;
        if (Object.keys(shortages({...next.materials,wool:next.storage?.wool??0,yarn:next.storage?.yarn??0,fish:availableFishCount(next)}, cost)).length)
            throw new Error('Collect the missing materials first.');
        spendCrops(next,cropCost);
        if(cost.wool) {next.storage!.wool=(next.storage?.wool??0)-cost.wool;}
        if(cost.yarn) {next.storage!.yarn=(next.storage?.yarn??0)-cost.yarn;}
        if(cost.fish) {spendFish(next,cost.fish);}
        for (const key of MATERIALS)
            next.materials[key] -= cost[key] ?? 0;
        if (entity) {
            entity.x = command.x;
            entity.y = command.y;
            if (direction === 'front') delete entity.direction;
            else entity.direction = direction;
        }
        else {
            if (replacing)
                next.entities = next.entities.filter(e => e.id !== replacing.id);
            const sculptureYear = localDate ? xmasStartingYear(localDate) : 2026;
            next.entities.push({ id, blueprintId: b.id, x: command.x, y: command.y, paidCost: { ...cost }, ...(b.id==='halloween-lantern'?{eventYear:lanternEventYear(localDate)}:{}), ...(isSnowSculpture(b.id)?{eventYear:sculptureYear}:{}), ...(b.cropCost?{paidCropCost:{...b.cropCost}}:{}), ...(direction === 'front' ? {} : { direction }), ...(animalChoices(b.id)[0] ? { animal: animalChoices(b.id)[0] } : {}) });
            if (isSnowSculpture(b.id)) {
                recordXmasSculptureBuilt(next, b.id, id, String(sculptureYear), now, mapId);
            }
            if(businessFor(b.id)){next.entities.at(-1)!.civ=freshCivHome();next.civ??={activeMs:0,lastTick:0,helpedTypes:[]};}
            if (b.id === 'house')
                next.earned['town-first-home'] ??= new Date(now).toISOString();
            if (b.id === 'town-hall')
                next.earned['town-founder'] ??= new Date(now).toISOString();
        }
        const owns = (key: string) => next.entities.filter(e => e.blueprintId === key).length;
        if (owns('farmhouse') && owns('coop'))
            next.earned['town-farm-friends'] ??= new Date(now).toISOString();
        if (owns('lemon') >= 3)
            next.earned['town-lemon-lane'] ??= new Date(now).toISOString();
        if (next.entities.filter(e => BLUEPRINTS.find(v => v.id === e.blueprintId)?.kind === 'building').length >= 10)
            next.earned['town-little-village'] ??= new Date(now).toISOString();
    }
    next.revision++;
    return next;
}
