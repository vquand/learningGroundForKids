import type {Direction} from '../../../../server/src/town-building/direction.ts';
import {SHELTER_VIEWS} from './shelterInterior.ts';

export interface BuildingView{file:string;crop:readonly [number,number,number,number]}
/** Turned sheltering buildings show their closed art; the shelter table owns the sheltering layers. */
const shelterTurns=(blueprintId:string):Partial<Record<Exclude<Direction,'front'>,BuildingView>>=>{const views=SHELTER_VIEWS[blueprintId]!;return {left:{file:views.left.closed,crop:views.left.crop},right:{file:views.right.closed,crop:views.right.crop},back:{file:views.back.closed,crop:views.back.crop}};};
/** Left, right and rear artwork per building (front art stays in the existing atlases). Crops are the
* visible subject at alpha >= 32 as [x,y,width,height]; see BUILDING_DIRECTIONS.md and the coop,
* farmhouse and animal haven notes beside the images. */
export const BUILDING_VIEWS:Record<string,Partial<Record<Exclude<Direction,'front'>,BuildingView>>>={
    'town-storage':{left:{file:'town-storage-left-v1',crop:[146,283,732,560]},right:{file:'town-storage-right-v1',crop:[146,283,732,560]},back:{file:'town-storage-back-v1',crop:[144,181,736,660]}},
    'house':{left:{file:'house-left-v1',crop:[138,227,771,1023]},right:{file:'house-right-v1',crop:[115,227,771,1023]},back:{file:'house-back-v1',crop:[359,192,818,640]}},
    'town-hall':{left:{file:'town-hall-left-v1',crop:[168,252,702,925]},right:{file:'town-hall-right-v1',crop:[158,250,695,927]},back:{file:'town-hall-back-v1',crop:[304,109,926,755]}},
    'library':{left:{file:'library-left-v1',crop:[100,433,857,694]},right:{file:'library-right-v1',crop:[83,419,857,690]},back:{file:'library-back-v1',crop:[279,214,978,613]}},
    'large-house':{left:{file:'large-house-left-v1',crop:[117,261,818,943]},right:{file:'large-house-right-v1',crop:[94,260,822,946]},back:{file:'large-house-back-v1',crop:[304,156,928,712]}},
    'bakery':{left:{file:'civ-buildings/bakery-left-v1',crop:[75,322,881,855]},right:{file:'civ-buildings/bakery-right-v1',crop:[78,322,875,855]},back:{file:'civ-buildings/bakery-back-v1',crop:[210,176,1116,630]}},
    'grocery':{left:{file:'civ-buildings/grocery-left-v1',crop:[45,343,939,777]},right:{file:'civ-buildings/grocery-right-v1',crop:[46,343,939,778]},back:{file:'civ-buildings/grocery-back-v1',crop:[214,167,1108,654]}},
    'vegetable-shop':{left:{file:'civ-buildings/vegetable-shop-left-v1',crop:[88,321,876,794]},right:{file:'civ-buildings/vegetable-shop-right-v1',crop:[88,320,859,796]},back:{file:'civ-buildings/vegetable-shop-back-v1',crop:[177,140,1188,694]}},
    'meat-shop':{left:{file:'civ-buildings/meat-shop-left-v1',crop:[67,307,892,879]},right:{file:'civ-buildings/meat-shop-right-v1',crop:[69,306,893,876]},back:{file:'civ-buildings/meat-shop-back-v1',crop:[205,168,1126,680]}},
    'tools-smith':{left:{file:'civ-buildings/tools-smith-left-v1',crop:[32,289,966,853]},right:{file:'civ-buildings/tools-smith-right-v1',crop:[23,289,972,854]},back:{file:'civ-buildings/tools-smith-back-v1',crop:[87,125,1351,755]}},
    'infirmary':{left:{file:'civ-buildings/infirmary-left-v1',crop:[106,371,851,762]},right:{file:'civ-buildings/infirmary-right-v1',crop:[76,365,847,768]},back:{file:'civ-buildings/infirmary-back-v1',crop:[211,149,1113,703]}},
    'school':{left:{file:'civ-buildings/school-left-v1',crop:[70,308,884,808]},right:{file:'civ-buildings/school-right-v1',crop:[77,315,883,800]},back:{file:'civ-buildings/school-back-v1',crop:[246,128,1040,771]}},
    'coop':{left:{file:'coop-neutral-left-v1',crop:[339,199,785,629]},right:{file:'coop-neutral-right-v1',crop:[430,199,781,628]},back:{file:'coop-neutral-top-v1',crop:[346,86,842,799]}},
    'farmhouse':shelterTurns('farmhouse'),
    'animal-habitat':shelterTurns('animal-habitat'),
};
/** The view to draw for a facing, or undefined for the front (and for blueprints that never turn). */
export const buildingView=(blueprintId:string,direction:Direction|undefined):BuildingView|undefined=>
    direction&&direction!=='front'?BUILDING_VIEWS[blueprintId]?.[direction]:undefined;
/** Image keys a blueprint needs once it can face a direction other than front. */
export const buildingViewFiles=(blueprintId:string):string[]=>Object.values(BUILDING_VIEWS[blueprintId]??{}).map(view=>view.file);
