import { isSnowSculpture } from './events/xmas2026Model.ts';

/** Building facing. `front` is the original artwork with its door on the south edge;
 * the order is clockwise on screen (south → west → north → east). */
export const DIRECTIONS=['front','left','back','right'] as const;
export type Direction=typeof DIRECTIONS[number];
export const isDirection=(value:unknown):value is Direction=>DIRECTIONS.includes(value as Direction);

const FOUR_WAY=new Set(['town-storage','house','large-house','farmhouse','coop','animal-habitat','school','tools-smith','grocery','bakery','meat-shop','vegetable-shop']);
const TWO_WAY=new Set(['town-hall','library','infirmary','halloween-lantern']);
/** The directions a blueprint may face; a single entry means it cannot be rotated. */
export function allowedDirections(blueprintId:string):readonly Direction[] {
    return FOUR_WAY.has(blueprintId) || isSnowSculpture(blueprintId) ? DIRECTIONS : TWO_WAY.has(blueprintId) ? ['front','back'] : ['front'];
}
export const canRotate=(blueprintId:string)=>allowedDirections(blueprintId).length>1;
/** The next facing after one press of Rotate: clockwise, or toggling between two. */
export function nextDirection(blueprintId:string,current:Direction):Direction {
    const allowed=allowedDirections(blueprintId),index=allowed.indexOf(current);
    return allowed[(index+1)%allowed.length]!;
}
/** Quarter turns exchange rows and columns; a half turn keeps them. */
export const turnedSize=<T extends {width:number;length:number}>(size:T,direction:Direction):{width:number;length:number}=>
    direction==='left'||direction==='right'?{width:size.length,length:size.width}:{width:size.width,length:size.length};
/** Door tile for a footprint at (x,y): the middle tile just outside the facing edge. */
export function doorOutside(x:number,y:number,size:{width:number;length:number},direction:Direction):{x:number;y:number} {
    const {width,length}=turnedSize(size,direction);
    switch(direction) {
        case 'left':return {x:x+Math.floor(width/2),y:y-1};
        case 'right':return {x:x+Math.floor(width/2),y:y+length};
        case 'back':return {x:x-1,y:y+Math.floor(length/2)};
        default:return {x:x+width,y:y+Math.floor(length/2)};
    }
}
