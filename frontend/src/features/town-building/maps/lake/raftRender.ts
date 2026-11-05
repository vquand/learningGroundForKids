import type {LakeRaft} from '../../../../../../server/src/town-building/maps/lake/types';
import {LAKE_FISH,LAKE_BLUEPRINTS} from '../../../../../../server/src/town-building/water/catalog';
import {ANIMAL_SIGNPOST} from '../../animalAtlas';
import {LAKE_ATLAS} from './LakeArt';
import {GARDEN_FRAME,plantCrop} from './gardenArt';
import {drawWitheredCrop} from '../../witheredPlant';
import {drawSelectionOutline} from '../../buildingRender';

export function drawFloatingGarden(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,raft:LakeRaft,g:{tile:number;x:number;y:number},visualGrowth=raft.plantGrowth,selected=false) {
    const frame=images.get('lake-garden'),crop=GARDEN_FRAME.crop;if(!frame)return;
    const scale=3*g.tile/crop[2],left=g.x+(raft.y+1.5)*g.tile-crop[2]*scale/2,top=g.y+(raft.x+1)*g.tile-crop[3]*scale/2;
    if(selected)drawSelectionOutline(ctx,frame,crop,left,top,crop[2]*scale,crop[3]*scale);
    ctx.drawImage(frame,...crop,left,top,crop[2]*scale,crop[3]*scale);
    const image=images.get('lake-plants');if(!raft.plant||!image)return;
    const plant=plantCrop(raft.plant),progress=Math.min(1,visualGrowth/300);
    for(const [index,[x,y,width]]of GARDEN_FRAME.slots.entries()){
        const px=left+(x-crop[0])*scale,py=top+(y-crop[1])*scale;
        if(raft.witheredPlants?.includes(index)){drawWitheredCrop(ctx,images.get('withered-plant-v1'),px,py+width*scale*.08,width*scale);continue;}
        if(progress<.1){ctx.fillStyle='#e9cb8b';ctx.beginPath();ctx.ellipse(px,py,width*scale*.075,width*scale*.035,0,0,Math.PI*2);ctx.fill();continue;}
        const w=width*scale*(.3+.7*progress),h=w*plant[3]/plant[2];
        ctx.drawImage(image,plant[0],plant[1],plant[2],plant[3],px-w/2,py+width*scale*.08-h,w,h);
    }
}

/** The identical wooden sign board used by Town animal homes. */
export function drawRaftSign(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,raft:LakeRaft,g:{tile:number;x:number;y:number}) {
    const species=raft.fish[0]?.species;if(!species&&!raft.plant)return;
    const sign=images.get('animalSign');if(!sign)return;
    const b=LAKE_BLUEPRINTS.find(b=>b.id===raft.blueprintId)!,board=ANIMAL_SIGNPOST.rect,face=ANIMAL_SIGNPOST.face;
    const width=.86*g.tile,scale=width/board[2]!,height=board[3]!*scale,left=g.x+(raft.y+b.length-.08)*g.tile-width,top=g.y+(raft.x+b.width)*g.tile-height;
    ctx.drawImage(sign,board[0]!,board[1]!,board[2]!,board[3]!,left,top,width,height);
    const image=images.get(species?'lake-fish':'lake-plants'),crop=species?LAKE_ATLAS['fish-v1'].rects[LAKE_FISH[species].art*4+2]!:plantCrop(raft.plant!);if(!image)return;
    const size=face[2]!*scale*.88,iconScale=Math.min(size/crop[2]!,size/crop[3]!);
    ctx.drawImage(image,crop[0]!,crop[1]!,crop[2]!,crop[3]!,left+(face[0]!+face[2]!/2)*scale-crop[2]!*iconScale/2,top+(face[1]!+face[3]!/2)*scale-crop[3]!*iconScale/2,crop[2]!*iconScale,crop[3]!*iconScale);
}
