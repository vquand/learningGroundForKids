import type {Environment} from '../../../../../server/src/town-building/environment';
import type {MapId} from '../../../../../server/src/town-building/maps/types';
import type {LakeRaft} from '../../../../../server/src/town-building/water/types';
import {LAKE_BLUEPRINTS,LAKE_FISH,LAKE_PLANTS} from '../../../../../server/src/town-building/water/catalog';
import {fishBehavior,fishGrowthMultiplier,type AreaSource} from '../../../../../server/src/town-building/water/behavior';
import {advanceRaftPlants} from '../../../../../server/src/town-building/water/plantEffects';
import {clipUnderBridges,drawSelectionOutline} from '../buildingRender';
import {LAKE_ATLAS} from '../maps/lake/LakeArt';
import {plantCrop} from '../maps/lake/gardenArt';
import {drawFloatingGarden,drawRaftSign} from '../maps/lake/raftRender';
import {lakeFishPosition} from '../maps/lake/fishMotion';
import {visibleLakeFish} from '../maps/lake/fishDisplay';
import {releasePose,type LakeRelease} from '../maps/lake/releaseAnimation';

type Geometry={x:number;y:number;tile:number};
export function drawSprite(ctx:CanvasRenderingContext2D,image:HTMLImageElement|undefined,crop:readonly number[],x:number,y:number,width:number,height:number,mirror=false,selected=false) {
    if(!image)return;const scale=Math.min(width/crop[2]!,height/crop[3]!);
    if(selected)drawSelectionOutline(ctx,image,crop,x-crop[2]!*scale/2,y-crop[3]!*scale/2,crop[2]!*scale,crop[3]!*scale);
    ctx.save();ctx.translate(x,y);if(mirror)ctx.scale(-1,1);
    ctx.drawImage(image,crop[0]!,crop[1]!,crop[2]!,crop[3]!,-crop[2]!*scale/2,-crop[3]!*scale/2,crop[2]!*scale,crop[3]!*scale);ctx.restore();
}
export interface WaterPaint {
    ctx:CanvasRenderingContext2D;images:Map<string,HTMLImageElement>;g:Geometry;mapId:MapId;
    rafts:readonly LakeRaft[];feeding:readonly AreaSource[];environment:Environment;
    /** Seconds on the map clock, and how far the display has run past the last server state. */
    seconds:number;growthElapsed:number;selectedId:string;still:boolean;reduced:boolean;
    /** Bridge decks the fish swim under. */
    bridges?:readonly {x:number;y:number}[];
}
/** Water structures for any map: rafts, floating gardens (with growth preview),
 * feeders and the Fish home raft's egg basket, then the fish and the signs. */
export function drawWaterLayer(p:WaterPaint){
    const {ctx,images,g,rafts}=p,tile=g.tile,sheet=LAKE_ATLAS['structures-v1'];
    for(const raft of rafts) {
        const b=LAKE_BLUEPRINTS.find(b=>b.id===raft.blueprintId)!,species=raft.fish[0]?.species;
        const index=raft.plant?LAKE_PLANTS[raft.plant].art:raft.blueprintId==='floating-garden'?0:raft.blueprintId==='friendly'&&species==='R4'?7:b.art;
        const selected=raft.id===p.selectedId;
        if(raft.blueprintId==='floating-garden'){const visual={...raft};advanceRaftPlants(visual,p.growthElapsed,rafts,p.mapId);drawFloatingGarden(ctx,images,visual,g,undefined,selected);}
        else drawSprite(ctx,images.get('lake-structures'),sheet.rects[index]!,g.x+(raft.y+b.length/2)*tile,g.y+(raft.x+b.width/2)*tile,b.length*tile,(b.width+.75)*tile,false,selected);
        if(raft.feeder)drawSprite(ctx,images.get('lake-structures'),sheet.rects[4]!,g.x+(raft.y+.35)*tile,g.y+(raft.x+.3)*tile,tile*.8,tile*.8);
    }
    const fishSheet=LAKE_ATLAS['fish-v1'],seconds=p.seconds,env=p.environment;
    ctx.save();if(p.bridges?.length)clipUnderBridges(ctx,p.bridges,tile,g.x,g.y);
    for(const raft of rafts)for(const fish of visibleLakeFish(raft.fish)) {
        const pos=lakeFishPosition(raft,fish,seconds,env),behavior=fishBehavior(fish.species,env),data=LAKE_FISH[fish.species];
        const phase=(seconds+Array.from(fish.id).reduce((n,c)=>n+c.charCodeAt(0),0))%31,surface=behavior.surface&&phase<1.7;
        const column=p.still||!behavior.active?3:surface?2:Math.floor(seconds*3)%2;
        const crop=fishSheet.rects[data.art*4+column]!;
        ctx.save();if(raft.blueprintId==='nursery'){ctx.beginPath();ctx.rect(g.x+(raft.y+.45)*tile,g.y+(raft.x+.4)*tile,2.1*tile,tile);ctx.clip();}
        ctx.globalAlpha=column===2?.92:column===3?.28:behavior.sheltered?.28:.47;
        const small=data.size==='small',growth=.6+.4*Math.min(1,(fish.growth+p.growthElapsed*fishGrowthMultiplier(raft,p.feeding))/300),size=tile*(raft.blueprintId==='nursery'?(small?.42:.65):(small?.65:1.05))*growth;
        const jump=surface&&!p.reduced?Math.sin(phase/1.7*Math.PI)*tile*(raft.blueprintId==='nursery'?.1:.4):0;
        const row=raft.blueprintId==='nursery'?Math.max((raft.x+.4)*tile+size/2,Math.min((raft.x+1.4)*tile-size/2,pos.x*tile-jump)):pos.x*tile-jump;
        drawSprite(ctx,images.get('lake-fish'),crop,g.x+pos.y*tile,g.y+row,size*1.5,size,column===1);
        ctx.restore();
    }
    ctx.restore();
    for(const raft of rafts)drawRaftSign(ctx,images,raft,g);
}
/** Fish and plants drifting away from a removed raft. */
export function drawWaterReleases(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,g:Geometry,releases:readonly {event:LakeRelease;age:number}[],reduced:boolean,mapId:MapId,bridges:readonly {x:number;y:number}[]=[]){
    const fishSheet=LAKE_ATLAS['fish-v1'],tile=g.tile;
    for(const {event,age}of releases){
        const fish=visibleLakeFish(event.raft.fish),count=fish.length||3;ctx.save();if(bridges.length)clipUnderBridges(ctx,bridges,tile,g.x,g.y);
        for(let i=0;i<count;i++){
            const pose=releasePose(event.raft,i,count,age,reduced,mapId);ctx.globalAlpha=pose.alpha*.8;const resident=fish[i];
            if(resident){const crop=fishSheet.rects[LAKE_FISH[resident.species].art*4]!;drawSprite(ctx,images.get('lake-fish'),crop,g.x+pose.y*tile,g.y+pose.x*tile,tile*.8,tile*.55);}
            else if(event.raft.plant){const crop=plantCrop(event.raft.plant);if(crop)drawSprite(ctx,images.get('lake-plants'),crop,g.x+pose.y*tile,g.y+pose.x*tile,tile*.65,tile*.65);}
        }
        ctx.restore();
    }
}
