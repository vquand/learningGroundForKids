import atlas from './halloweenAtlas.json' with {type:'json'};
import type {TownLantern} from '../../../../server/src/town-building/halloween';
import type {Entity} from '../../../../server/src/town-building/game.ts';

export function lanternLightSources(holiday:{lanterns:readonly TownLantern[]}|undefined,entities:readonly Entity[]=[]){
 return [...(holiday?.lanterns??[]).map(lamp=>({...lamp,flipped:false,ground:true})),
  ...entities.filter(e=>e.blueprintId==='halloween-lantern').map(e=>({x:e.x,y:e.y,post:0,variant:0,flipped:e.direction==='back',ground:false}))];
}

/** One measured assembly for event posts, player buildings and catalog artwork. */
export function lanternLayout(lamp:Pick<TownLantern,'x'|'y'|'post'|'variant'>,geometry:{tile:number;offsetX:number;offsetY:number}){
 const {tile,offsetX,offsetY}=geometry,crop=atlas['lantern-posts'].rects[lamp.post]!,hook=atlas['lantern-posts'].hooks[lamp.post]!;
 const scale=tile*1.15/crop[3]!,width=crop[2]!*scale,height=crop[3]!*scale;
 const x=offsetX+(lamp.y+.5)*tile-width/2,y=offsetY+(lamp.x+.9)*tile-height;
 const hookX=x+hook[0]!*scale,hookY=y+hook[1]!*scale,face=atlas.lanterns.rects[lamp.variant%6]!,faceWidth=tile*.5;
 return {post:{crop,x,y,width,height},lantern:{crop:face,x:hookX-faceWidth/2,y:hookY,width:faceWidth,height:faceWidth*face[3]!/face[2]!},hookX,hookY};
}
