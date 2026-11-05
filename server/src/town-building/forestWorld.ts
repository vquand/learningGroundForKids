import { terrainAt, type Entity, type Season } from './game.ts';

/** Visual world only. Server construction remains the original 20×40 grid. */
export const FOREST_DEPTH=4;
export const SCENERY_SIDE=3;
// The decorative walking world is larger than the visible scenery frame.
export const SCENERY_TOP=3;
export const SCENERY_BOTTOM=3.2; // The bottom mountain strip's ground anchor.
export const WORLD_ROWS=20+SCENERY_TOP+SCENERY_BOTTOM;
export const WORLD_COLUMNS=40+SCENERY_SIDE*2;
export function isForestTile(x:number,y:number):boolean {return y>=-SCENERY_SIDE&&y<40+SCENERY_SIDE&&x>=-FOREST_DEPTH&&x<20+FOREST_DEPTH&&(x<0||x>=20||y<0||y>=40);}
export function animalTerrainAt(x:number,y:number):ReturnType<typeof terrainAt>|'outside' {
  if(isForestTile(x,y)){
    if((y<0||y>=40)&&x>=15&&x<18)return 'river';
    if(x===-FOREST_DEPTH||x===20+FOREST_DEPTH-1||y===-SCENERY_SIDE||y===40+SCENERY_SIDE-1)return 'mountain';
    return 'grass';
  }
  return x>=0&&x<20&&y>=0&&y<40?terrainAt(x,y):'outside';
}
export const FOREST_TREES:Entity[]=[];
for(const [row,x] of [-4.3,-2.3,20.2,22.2].entries())for(let i=0;i<17;i++){
  const y=i*2.4-.7+(row%2?1.2:0);
  if(y+1>=40)continue;
  FOREST_TREES.push({id:`forest-${row}-${i}`,blueprintId:i%2?'forest-pine':'forest-broadleaf',x,y,paidCost:{}});
}
for(const y of [-2.5,40.5])for(let x=0;x<20;x+=2.4)if(x<13||x>18)FOREST_TREES.push({id:`forest-side-${y}-${x}`,blueprintId:'forest-pine',x:x-2,y,paidCost:{}});
/** Only the trunk cell blocks decorative walking; gaps connect both forest bands. */
const trunks=new Set(FOREST_TREES.map(tree=>`${Math.floor(tree.x+2)}:${Math.floor(tree.y+1)}`));
export function forestTrunkAt(x:number,y:number):boolean {return trunks.has(`${x}:${y}`);}
export const FOREST_GROUND:Record<Season,string>={spring:'#afc88c',summer:'#859f6c',autumn:'#b1a16a',winter:'#c8bfae'};
export function townSceneGeometry(width:number,height:number,zoom:number,camera:{x:number;y:number}) {
  const tile=Math.min(width/WORLD_COLUMNS,height/WORLD_ROWS)*zoom;
  const clamp=(value:number,min:number,max:number)=>min<=max?Math.max(min,Math.min(max,value)):(min+max)/2;
  return {tile,
    offsetX:clamp((width-40*tile)/2-camera.y*tile,width-(40+SCENERY_SIDE)*tile,SCENERY_SIDE*tile),
    offsetY:clamp((height-WORLD_ROWS*tile)/2+SCENERY_TOP*tile-camera.x*tile,height-(20+SCENERY_BOTTOM)*tile,SCENERY_TOP*tile),width,height};
}
