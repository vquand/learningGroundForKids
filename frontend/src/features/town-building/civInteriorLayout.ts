import type {CivDirection,TownPerson} from './civWorld.ts';

export type InteriorFloor='stone'|'hardwood'|'terracotta'|'ceramic'|'pastel-wood';
/** Atlas tile per floor. `pastel-wood` is its own painted two-cell strip (vegetable-shop/floor-wood-v1.png), drawn by CSS instead. */
export const INTERIOR_FLOORS:Record<Exclude<InteriorFloor,'pastel-wood'>,number>={stone:0,hardwood:1,terracotta:2,ceramic:3};
export interface InteriorFixture {art:string;tile:number;legacy:boolean;x:number;y:number;width:number;height:number}
export interface InteriorStation {art:string;x:number;y:number;direction:CivDirection;activity:TownPerson['mode'];period:number;phase:number;fixture:number}
export interface InteriorLayout {columns:number;rows:number;floor:InteriorFloor;fixtures:InteriorFixture[];stations:InteriorStation[]}
const fixture=(art:string,tile:number,x:number,y:number,width=1,height=1,legacy=false):InteriorFixture=>({art,tile,x,y,width,height,legacy});
const station=(art:string,x:number,y:number,fixture:number,period=7,phase=0):InteriorStation=>({art,x,y,fixture,period,phase,direction:'right',activity:'work'});
/** Each person occupies one clear cell beside a specialized one- or two-cell fixture. */
export const CIV_INTERIORS:Record<string,InteriorLayout>={
    grocery:{columns:4,rows:5,floor:'hardwood',fixtures:[fixture('dry-goods-cabinet',4,0,0),fixture('dry-goods-cabinet',4,3,0),fixture('grocery-checkout',5,2,2,2)],stations:[station('grocer',1,2,2,8)]},
    bakery:{columns:6,rows:5,floor:'terracotta',fixtures:[fixture('bread-oven',8,0,0),fixture('bread-rack',6,4,0,2),fixture('kneading-bench',7,1,2,2),fixture('bread-rack',6,4,2,2)],stations:[station('baker',0,2,2,8),station('bakery-helper',3,2,3,9,3)]},
    'meat-shop':{columns:4,rows:5,floor:'ceramic',fixtures:[fixture('chilled-meat-case',11,1,0,2),fixture('butcher-bench',12,2,2,2)],stations:[station('butcher',1,2,1,9)]},
    'vegetable-shop':{columns:4,rows:5,floor:'pastel-wood',fixtures:[fixture('produce-cabinet',9,0,0,2),fixture('produce-cabinet',9,2,0,2),fixture('vegetable-packing-bench',10,2,2,2)],stations:[station('greengrocer',1,2,2,10)]},
    'tools-smith':{columns:6,rows:5,floor:'stone',fixtures:[fixture('forge',14,0,0),fixture('tool-workbench',15,3,0,2),fixture('anvil',13,1,2),fixture('tool-workbench',15,4,2,2)],stations:[station('smith',0,2,2,6),station('tool-shopkeeper',3,2,3,10,4)]},
    school:{columns:6,rows:5,floor:'hardwood',fixtures:[fixture('chalkboard',12,4,0,2,1,true),fixture('bookcase',16,0,0),fixture('desk',13,1,2,1,1,true),fixture('desk',13,3,2,1,1,true),fixture('desk',13,5,2,1,1,true),fixture('desk',13,1,3,1,1,true),fixture('desk',13,3,3,1,1,true),fixture('desk',13,5,3,1,1,true)],stations:[station('teacher',3,0,0,11)]},
    infirmary:{columns:6,rows:5,floor:'ceramic',fixtures:[fixture('medicine-cabinet',18,0,0),fixture('medicine-cabinet',18,4,0),fixture('examination-bed',17,1,2,1,2),fixture('pharmacy-preparation-counter',19,4,2,2)],stations:[station('doctor',0,2,2,9),station('pharmacy-assistant',3,2,3,12,5)]},
};
/** Short role-specific actions with quiet pauses; no synchronized continuous arm loop. */
export function interiorActivity(station:InteriorStation,time:number,reduced=false):TownPerson['mode'] {
    return !reduced&&(time+station.phase)%station.period<station.period*.48?station.activity:'idle';
}

/** Painted pastel fixtures that replace atlas tiles (vegetable shop), keyed by fixture art. */
export const INTERIOR_FIXTURE_IMAGES:Record<string,string>={
    'produce-cabinet':'/minigames/town-building/vegetable-shop/shop-produce-crate-v1.png',
    'vegetable-packing-bench':'/minigames/town-building/vegetable-shop/shop-packing-counter-v1.png',
};
